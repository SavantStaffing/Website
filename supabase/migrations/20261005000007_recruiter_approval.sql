-- =========================================================================
-- Recruiter sign-ups wait for an admin's approval.
--
--   recruiter_requests   one row per recruiter sign-up: pending until an
--                        admin approves or declines it on /admin/recruiters.
--   handle_new_user()    a recruiter sign-up now files a request instead of
--                        granting the recruiter role, so a pending account
--                        can't reach recruiter data (talent feed, job posting)
--                        even outside the site's own pages.
--   decide_recruiter_request()  admins approve (grants the role) or decline.
--
-- Recruiters who already have the role are unaffected. Admins are notified
-- of each request; the recruiter is notified of the decision.
-- =========================================================================

CREATE TABLE public.recruiter_requests (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT CHECK (char_length(company_name) <= 200),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  note TEXT CHECK (char_length(note) <= 1000)
);
CREATE INDEX recruiter_requests_status_idx ON public.recruiter_requests (status, requested_at);

GRANT SELECT ON public.recruiter_requests TO authenticated;
GRANT ALL ON public.recruiter_requests TO service_role;
ALTER TABLE public.recruiter_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own recruiter request" ON public.recruiter_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read recruiter requests" ON public.recruiter_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Same as 20260927000001_coach_invites.sql, except a recruiter sign-up files
-- a request (and gets no role yet) instead of becoming a recruiter at once.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requested_role public.app_role;
  invite_id UUID;
  who TEXT;
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'username')
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    requested_role := (NEW.raw_user_meta_data->>'role')::public.app_role;
  EXCEPTION WHEN OTHERS THEN
    requested_role := NULL;
  END;

  IF requested_role = 'career_coach' THEN
    SELECT id INTO invite_id
    FROM public.coach_invites
    WHERE code = NEW.raw_user_meta_data->>'coach_invite'
      AND NOT revoked
      AND expires_at >= now()
      AND uses < max_uses
    FOR UPDATE;

    IF invite_id IS NOT NULL THEN
      UPDATE public.coach_invites
      SET uses = uses + 1, redeemed_by = array_append(redeemed_by, NEW.id)
      WHERE id = invite_id;
    ELSE
      requested_role := 'talent';
    END IF;
  ELSIF requested_role = 'recruiter' THEN
    INSERT INTO public.recruiter_requests (user_id, company_name)
    VALUES (NEW.id, nullif(left(btrim(coalesce(NEW.raw_user_meta_data->>'company', '')), 200), ''))
    ON CONFLICT (user_id) DO NOTHING;

    who := coalesce(nullif(btrim(NEW.raw_user_meta_data->>'username'), ''), NEW.email);
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    SELECT ur.user_id, 'recruiter_request', 'Recruiter account waiting for approval',
           coalesce(who, 'A new recruiter')
             || coalesce(' (' || nullif(btrim(NEW.raw_user_meta_data->>'company'), '') || ')', '')
             || ' signed up as a recruiter.',
           '/admin/recruiters'
    FROM public.user_roles ur WHERE ur.role = 'admin';

    -- The role is granted on approval (decide_recruiter_request).
    RETURN NEW;
  ELSIF requested_role IS NULL OR requested_role <> 'talent' THEN
    requested_role := 'talent';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, requested_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Approve (grants the recruiter role) or decline a pending request.
CREATE OR REPLACE FUNCTION public.decide_recruiter_request(
  _user_id UUID,
  _approve BOOLEAN,
  _note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;

  UPDATE recruiter_requests
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'declined' END,
      decided_by = auth.uid(),
      decided_at = now(),
      note = nullif(left(btrim(coalesce(_note, '')), 1000), '')
  WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No recruiter request for this user' USING ERRCODE = 'P0002';
  END IF;

  IF _approve THEN
    INSERT INTO user_roles (user_id, role) VALUES (_user_id, 'recruiter')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM user_roles WHERE user_id = _user_id AND role = 'recruiter';
  END IF;

  INSERT INTO notifications (user_id, kind, title, body, link)
  VALUES (
    _user_id,
    CASE WHEN _approve THEN 'recruiter_approved' ELSE 'recruiter_declined' END,
    CASE WHEN _approve THEN 'Your recruiter account is approved'
         ELSE 'Your recruiter account wasn''t approved' END,
    nullif(left(btrim(coalesce(_note, '')), 1000), ''),
    '/dashboard'
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.decide_recruiter_request(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_recruiter_request(UUID, BOOLEAN, TEXT) TO authenticated;
