-- =========================================================================
-- Preparation services (Career Programs, Resume Building, Interview
-- Development) and the Career Coach role that handles sign-ups.
--
-- Career coaches: read service requests and work them; read talent and
-- recruiter lists. No admin powers — they can't change roles, orgs, jobs,
-- scout settings, or anything else admin-only.
-- =========================================================================

-- Career Coach is assigned by an admin, never chosen at signup — same rule as admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requested_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'username')
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    requested_role := (NEW.raw_user_meta_data->>'role')::public.app_role;
  EXCEPTION WHEN OTHERS THEN
    requested_role := NULL;
  END;

  IF requested_role IS NULL OR requested_role NOT IN ('talent', 'recruiter') THEN
    requested_role := 'talent';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, requested_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- -------------------------------------------------------------------------
-- Service sign-ups
-- -------------------------------------------------------------------------
CREATE TABLE public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('career_programs', 'resume_building', 'interview_development')),
  program TEXT CHECK (char_length(program) <= 120),          -- which career program, when relevant
  goals TEXT NOT NULL CHECK (char_length(goals) BETWEEN 1 AND 2000),
  availability TEXT CHECK (char_length(availability) <= 300),
  contact_method TEXT NOT NULL DEFAULT 'email' CHECK (contact_method IN ('email', 'phone')),
  phone TEXT CHECK (char_length(phone) <= 30),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_progress', 'completed', 'cancelled')),
  assigned_coach_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_requests TO authenticated;
GRANT ALL ON public.service_requests TO service_role;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX service_requests_status_idx ON public.service_requests (status, created_at DESC);
CREATE INDEX service_requests_talent_idx ON public.service_requests (talent_id);
CREATE TRIGGER service_requests_updated_at BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Talent sign up for services" ON public.service_requests
  FOR INSERT TO authenticated WITH CHECK (
    talent_id = auth.uid()
    AND public.has_role(auth.uid(), 'talent')
    AND status = 'new'
    AND assigned_coach_id IS NULL
  );
CREATE POLICY "Talent read own service requests" ON public.service_requests
  FOR SELECT TO authenticated USING (talent_id = auth.uid());
-- Talent can withdraw a request nobody has picked up yet.
CREATE POLICY "Talent withdraw new requests" ON public.service_requests
  FOR DELETE TO authenticated USING (talent_id = auth.uid() AND status = 'new');

CREATE POLICY "Coaches and admins read service requests" ON public.service_requests
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'career_coach') OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Coaches and admins work service requests" ON public.service_requests
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'career_coach') OR public.has_role(auth.uid(), 'admin')
  ) WITH CHECK (
    public.has_role(auth.uid(), 'career_coach') OR public.has_role(auth.uid(), 'admin')
  );

-- Coaches may only change workflow fields, never rewrite what the talent submitted.
CREATE OR REPLACE FUNCTION public.guard_service_request_update()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
    NEW.talent_id IS DISTINCT FROM OLD.talent_id
    OR NEW.service IS DISTINCT FROM OLD.service
    OR NEW.program IS DISTINCT FROM OLD.program
    OR NEW.goals IS DISTINCT FROM OLD.goals
    OR NEW.availability IS DISTINCT FROM OLD.availability
    OR NEW.contact_method IS DISTINCT FROM OLD.contact_method
    OR NEW.phone IS DISTINCT FROM OLD.phone
  ) THEN
    RAISE EXCEPTION 'Only status and assignment can be changed on a service request';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_service_request_update() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER service_requests_guard BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_service_request_update();

-- Notify every coach of a new sign-up; notify the talent when its status moves.
CREATE OR REPLACE FUNCTION public.notify_service_request()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  label TEXT := CASE NEW.service
    WHEN 'career_programs' THEN 'Career Programs'
    WHEN 'resume_building' THEN 'Resume Building'
    ELSE 'Interview Development' END;
  who TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT coalesce(nullif(trim(tp.first_name || ' ' || coalesce(tp.last_name, '')), ''), p.username, p.email)
      INTO who
      FROM public.profiles p LEFT JOIN public.talent_profiles tp ON tp.user_id = p.id
      WHERE p.id = NEW.talent_id;
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    SELECT ur.user_id, 'service_request', 'New ' || label || ' sign-up',
           coalesce(who, 'A talent') || ' signed up' || coalesce(' for ' || NEW.program, '') || '.',
           '/coach'
    FROM public.user_roles ur WHERE ur.role = 'career_coach';
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
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
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_service_request() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER service_requests_notify AFTER INSERT OR UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_service_request();

-- -------------------------------------------------------------------------
-- Coaches' read access: talent + recruiter lists (no writes)
-- -------------------------------------------------------------------------
CREATE POLICY "Coaches read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'career_coach'));
CREATE POLICY "Coaches read roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'career_coach'));
CREATE POLICY "Coaches read talent profiles" ON public.talent_profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'career_coach'));
CREATE POLICY "Coaches read organizations" ON public.organizations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'career_coach'));
