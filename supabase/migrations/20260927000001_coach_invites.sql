-- =========================================================================
-- Coach invites
--
-- Career coaches sign up at /join/coach?invite=<code>, a page nothing on the
-- site links to. The link alone isn't the protection: the role is granted
-- by handle_new_user only when the invite code is valid (not revoked, not
-- expired, uses left). Anyone signing up without one still becomes talent.
-- =========================================================================

CREATE TABLE public.coach_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 128 random bits; the only thing that makes an invite link work.
  code TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', '')
    || replace(gen_random_uuid()::text, '-', ''),
  label TEXT CHECK (char_length(label) <= 120),        -- who it's for, e.g. the coach's name
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses BETWEEN 1 AND 100),
  uses INTEGER NOT NULL DEFAULT 0,
  redeemed_by UUID[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '14 days',
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_invites TO authenticated;
GRANT ALL ON public.coach_invites TO service_role;
ALTER TABLE public.coach_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage coach invites" ON public.coach_invites
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Lets the sign-up page say "this link has expired" before the form is filled.
-- Reveals nothing but whether a (128-bit) code is currently usable.
CREATE OR REPLACE FUNCTION public.coach_invite_status(_code TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN i.id IS NULL THEN 'invalid'
    WHEN i.revoked THEN 'revoked'
    WHEN i.expires_at < now() THEN 'expired'
    WHEN i.uses >= i.max_uses THEN 'used'
    ELSE 'valid'
  END
  FROM (SELECT 1) AS one
  LEFT JOIN public.coach_invites i ON i.code = _code;
$$;
REVOKE EXECUTE ON FUNCTION public.coach_invite_status(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coach_invite_status(TEXT) TO anon, authenticated;

-- Sign-up: talent or recruiter as before; career_coach only with a valid invite.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requested_role public.app_role;
  invite_id UUID;
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
  ELSIF requested_role IS NULL OR requested_role NOT IN ('talent', 'recruiter') THEN
    requested_role := 'talent';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, requested_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
