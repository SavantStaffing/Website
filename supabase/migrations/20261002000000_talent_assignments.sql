-- =========================================================================
-- Admin-run talent assignments, and coach access narrowed to assigned work.
--
--   * Coaching sign-ups (service_requests) go to admins only. Admins assign a
--     coach on /admin/schedule; that coach is notified and can then see and
--     work that request — and only requests assigned to them.
--   * talent_assignments: admins assign a talent to a recruiter or a coach
--     (status active). Coaches can also ask to coach someone from a limited
--     directory (status requested); an admin approves or declines.
--   * Assigned staff — an active assignment, or a coach on a talent's
--     coaching request — can read that talent's profile, contact details,
--     job preferences and résumé file. Coaches no longer read every talent.
--   * Recruiters keep their existing talent feed of profiles the talent set
--     "Visible to recruiters"; assignment adds full details on top.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Coaching requests: admins receive them; coaches see their own only
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_service_request()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  label TEXT := CASE NEW.service
    WHEN 'career_programs' THEN 'Career Programs'
    WHEN 'resume_building' THEN 'Resume Building'
    WHEN 'job_fairs' THEN 'Job Fairs'
    ELSE 'Interview Development' END;
  who TEXT;
BEGIN
  SELECT coalesce(nullif(trim(tp.first_name || ' ' || coalesce(tp.last_name, '')), ''), p.username, p.email)
    INTO who
    FROM public.profiles p LEFT JOIN public.talent_profiles tp ON tp.user_id = p.id
    WHERE p.id = NEW.talent_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    SELECT ur.user_id, 'service_request', 'New ' || label || ' sign-up',
           coalesce(who, 'A talent') || ' signed up' || coalesce(' for ' || NEW.program, '')
             || '. Assign a coach.',
           '/admin/schedule'
    FROM public.user_roles ur WHERE ur.role = 'admin';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.assigned_coach_id IS NOT NULL
       AND NEW.assigned_coach_id IS DISTINCT FROM OLD.assigned_coach_id THEN
      INSERT INTO public.notifications (user_id, kind, title, body, link)
      VALUES (NEW.assigned_coach_id, 'service_request_assigned',
              'New ' || label || ' request assigned to you',
              coalesce(who, 'A talent') || coalesce(' — ' || NEW.program, '') || '.',
              '/coach');
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.notifications (user_id, kind, title, link)
      VALUES (
        NEW.talent_id, 'service_request_' || NEW.status,
        label || ': ' || CASE NEW.status
          WHEN 'in_progress' THEN 'a coach is working with you'
          WHEN 'completed' THEN 'marked complete'
          WHEN 'cancelled' THEN 'cancelled'
          ELSE 'updated' END,
        '/talent'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_service_request() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Coaches and admins read service requests" ON public.service_requests;
DROP POLICY IF EXISTS "Coaches and admins work service requests" ON public.service_requests;

CREATE POLICY "Admins read service requests" ON public.service_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Coaches read assigned service requests" ON public.service_requests
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'career_coach') AND assigned_coach_id = auth.uid()
  );
CREATE POLICY "Admins work service requests" ON public.service_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- A coach can update the status of their own requests but can't hand them to
-- anyone else or unassign themselves (the row must still be theirs after).
CREATE POLICY "Coaches work assigned service requests" ON public.service_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'career_coach') AND assigned_coach_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'career_coach') AND assigned_coach_id = auth.uid());

-- -------------------------------------------------------------------------
-- 2. Talent assignments (admin-assigned, or coach-requested)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.talent_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_role TEXT NOT NULL CHECK (staff_role IN ('recruiter', 'career_coach')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('requested', 'active', 'declined', 'ended')),
  note TEXT CHECK (char_length(note) <= 1000),
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  UNIQUE (talent_id, staff_id)
);
CREATE INDEX IF NOT EXISTS talent_assignments_staff ON public.talent_assignments (staff_id, status);

ALTER TABLE public.talent_assignments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.talent_assignments TO authenticated;
GRANT ALL ON public.talent_assignments TO service_role;

CREATE POLICY "Admins manage talent assignments" ON public.talent_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff read own assignments" ON public.talent_assignments
  FOR SELECT TO authenticated USING (staff_id = auth.uid());
CREATE POLICY "Talent read who is assigned to them" ON public.talent_assignments
  FOR SELECT TO authenticated USING (talent_id = auth.uid());
-- "Request to coach": a coach asks for a talent; an admin decides.
CREATE POLICY "Coaches request to coach" ON public.talent_assignments
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'career_coach')
    AND staff_id = auth.uid() AND staff_role = 'career_coach'
    AND status = 'requested' AND requested_by = auth.uid()
  );
-- Ask again after a decline, or withdraw a pending request.
CREATE POLICY "Coaches renew declined requests" ON public.talent_assignments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'career_coach') AND staff_id = auth.uid() AND status = 'declined')
  WITH CHECK (staff_id = auth.uid() AND status = 'requested');
CREATE POLICY "Coaches withdraw pending requests" ON public.talent_assignments
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'career_coach') AND staff_id = auth.uid() AND status = 'requested');

-- Integrity: the right roles on both sides; decision stamps; notifications.
CREATE OR REPLACE FUNCTION public.talent_assignment_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(NEW.talent_id, 'talent') THEN
    RAISE EXCEPTION 'Only talent accounts can be assigned';
  END IF;
  IF NOT public.has_role(NEW.staff_id, NEW.staff_role::public.app_role) THEN
    RAISE EXCEPTION 'That person is not a %', replace(NEW.staff_role, '_', ' ');
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.talent_id IS DISTINCT FROM OLD.talent_id OR NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
      RAISE EXCEPTION 'An assignment can''t be moved to other people; end it and create a new one';
    END IF;
  END IF;
  IF NEW.status IN ('active', 'declined', 'ended')
     AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
    NEW.decided_at := now();
    NEW.decided_by := coalesce(auth.uid(), NEW.decided_by);
  END IF;
  IF NEW.status = 'requested' THEN
    NEW.decided_at := NULL;
    NEW.decided_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.talent_assignment_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS talent_assignments_guard ON public.talent_assignments;
CREATE TRIGGER talent_assignments_guard BEFORE INSERT OR UPDATE ON public.talent_assignments
  FOR EACH ROW EXECUTE FUNCTION public.talent_assignment_guard();

CREATE OR REPLACE FUNCTION public.notify_talent_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  who TEXT;
  staff TEXT;
  hub TEXT := CASE NEW.staff_role WHEN 'recruiter' THEN '/recruiter/assigned' ELSE '/coach/talent' END;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  SELECT coalesce(nullif(trim(tp.first_name || ' ' || coalesce(tp.last_name, '')), ''), p.username, 'A talent')
    INTO who FROM public.profiles p LEFT JOIN public.talent_profiles tp ON tp.user_id = p.id
    WHERE p.id = NEW.talent_id;
  SELECT coalesce(p.username, p.email, 'A coach') INTO staff
    FROM public.profiles p WHERE p.id = NEW.staff_id;

  IF NEW.status = 'requested' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    SELECT ur.user_id, 'coach_request', 'Request to coach ' || who,
           staff || ' would like to coach ' || who || '.', '/admin/assignments'
    FROM public.user_roles ur WHERE ur.role = 'admin';
  ELSIF NEW.status = 'active' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (NEW.staff_id, 'talent_assigned', who || ' has been assigned to you',
            coalesce(NEW.note, 'Their full profile and résumé are now available.'), hub);
  ELSIF NEW.status = 'declined' THEN
    INSERT INTO public.notifications (user_id, kind, title, link)
    VALUES (NEW.staff_id, 'coach_request_declined',
            'Your request to coach ' || who || ' wasn''t approved', '/coach/talent');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_talent_assignment() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS talent_assignments_notify ON public.talent_assignments;
CREATE TRIGGER talent_assignments_notify AFTER INSERT OR UPDATE ON public.talent_assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_talent_assignment();

-- -------------------------------------------------------------------------
-- 3. Who counts as assigned to a talent
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_assigned(_staff UUID, _talent UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.talent_assignments a
    WHERE a.staff_id = _staff AND a.talent_id = _talent AND a.status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.service_requests r
    WHERE r.assigned_coach_id = _staff AND r.talent_id = _talent AND r.status <> 'cancelled'
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_assigned(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_assigned(UUID, UUID) TO authenticated;

-- Same check for a résumé folder name (storage paths are "<talent id>/<file>").
CREATE OR REPLACE FUNCTION public.is_assigned_folder(_staff UUID, _folder TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.talent_assignments a
    WHERE a.staff_id = _staff AND a.talent_id::text = _folder AND a.status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.service_requests r
    WHERE r.assigned_coach_id = _staff AND r.talent_id::text = _folder AND r.status <> 'cancelled'
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_assigned_folder(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_assigned_folder(UUID, TEXT) TO authenticated;

-- -------------------------------------------------------------------------
-- 4. Read access: assigned staff in, blanket coach access out
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Coaches read talent profiles" ON public.talent_profiles;
CREATE POLICY "Assigned staff read talent profiles" ON public.talent_profiles
  FOR SELECT TO authenticated USING (public.is_assigned(auth.uid(), user_id));

CREATE POLICY "Assigned staff read talent preferences" ON public.talent_preferences
  FOR SELECT TO authenticated USING (public.is_assigned(auth.uid(), user_id));

-- Coaches keep reading staff accounts (recruiter and coach lists) but see a
-- talent's contact details only when assigned to them.
DROP POLICY IF EXISTS "Coaches read profiles" ON public.profiles;
CREATE POLICY "Coaches read staff and assigned profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'career_coach') AND (
      public.is_assigned(auth.uid(), id)
      OR public.has_role(id, 'recruiter')
      OR public.has_role(id, 'career_coach')
      OR public.has_role(id, 'admin')
    )
  );
CREATE POLICY "Recruiters read assigned talent" ON public.profiles
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'recruiter') AND public.is_assigned(auth.uid(), id)
  );

CREATE POLICY "Assigned staff read resumes" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'resumes'
    AND public.is_assigned_folder(auth.uid(), (storage.foldername(name))[1])
  );

-- -------------------------------------------------------------------------
-- 5. What coaches can browse to choose someone: no contact details, no
--    résumé — just enough to decide whether to ask.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coach_talent_directory()
RETURNS TABLE (
  talent_id UUID,
  display_name TEXT,
  headline TEXT,
  current_title TEXT,
  location TEXT,
  skills TEXT[],
  joined_at TIMESTAMPTZ,
  assignment_status TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'career_coach') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Coaches only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id,
         coalesce(
           nullif(trim(coalesce(tp.first_name, '') || ' ' || coalesce(left(tp.last_name, 1) || '.', '')), ''),
           'Talent'
         ),
         tp.headline, tp.current_title, tp.location, coalesce(tp.skills, '{}'::TEXT[]), p.created_at,
         CASE
           WHEN public.is_assigned(auth.uid(), p.id) THEN 'active'
           ELSE (SELECT a.status FROM public.talent_assignments a
                 WHERE a.talent_id = p.id AND a.staff_id = auth.uid())
         END
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'talent'
  LEFT JOIN public.talent_profiles tp ON tp.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.coach_talent_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_talent_directory() TO authenticated;
