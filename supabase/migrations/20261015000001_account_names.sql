-- =========================================================================
-- Account names: a real name separate from the username, and usernames
-- that can never block a sign-up.
--
--   Before: profiles.username (UNIQUE) was both the login handle and what
--   people were called. The coach sign-up and the recruiter Account page
--   labelled it "Name", so two people called "Sarah Lee" collided: the
--   second sign-up failed inside handle_new_user ("Database error saving
--   new user") and lost its role, invite and recruiter request with it.
--
--   Now:
--     profiles.full_name — what a person is called. Not unique.
--     profiles.username  — a unique handle. If the one asked for is taken
--                          at sign-up, a free variant is used (jordan-2).
--     username_available() — lets the sign-up and account forms check a
--                          username and suggest free ones as people type.
--     display_name() / chat_name() prefer the real name.
-- =========================================================================

ALTER TABLE public.profiles
  ADD COLUMN full_name TEXT CHECK (char_length(full_name) <= 100);

-- Backfill: talent names from their talent profile; for everyone else the
-- "Name" they typed went into username, so that is their name.
UPDATE public.profiles p
SET full_name = nullif(btrim(coalesce(tp.first_name, '') || ' ' || coalesce(tp.last_name, '')), '')
FROM public.talent_profiles tp
WHERE tp.user_id = p.id AND p.full_name IS NULL;

UPDATE public.profiles p
SET full_name = left(btrim(p.username), 100)
WHERE p.full_name IS NULL
  AND nullif(btrim(p.username), '') IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.user_roles ur
              WHERE ur.user_id = p.id AND ur.role IN ('recruiter', 'career_coach', 'admin'));

-- Recruiters waiting for approval have no role yet but did type their name.
UPDATE public.profiles p
SET full_name = left(btrim(p.username), 100)
WHERE p.full_name IS NULL
  AND nullif(btrim(p.username), '') IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.recruiter_requests rr WHERE rr.user_id = p.id);

-- -------------------------------------------------------------------------
-- Usernames
-- -------------------------------------------------------------------------

-- A handle from whatever was typed: "Sarah Lee" → "sarah.lee".
CREATE OR REPLACE FUNCTION public.username_slug(_s TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT nullif(left(btrim(regexp_replace(lower(btrim(coalesce(_s, ''))), '[^a-z0-9._-]+', '.', 'g'), '.-_'), 32), '');
$$;

-- Whether a username is taken by anyone but _uid (ignores case, so
-- "Jordan" and "jordan" count as the same name).
CREATE OR REPLACE FUNCTION public.username_taken(_name TEXT, _uid UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(btrim(_name))
      AND (_uid IS NULL OR id <> _uid)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.username_taken(TEXT, UUID) FROM PUBLIC, anon, authenticated;

-- The name asked for if it's free, else the first free "name-2", "name-3"…
CREATE OR REPLACE FUNCTION public.free_username(_want TEXT, _uid UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  base TEXT := left(btrim(coalesce(_want, '')), 34);
  candidate TEXT;
  n INT := 2;
BEGIN
  IF base = '' THEN RETURN NULL; END IF;
  candidate := base;
  WHILE public.username_taken(candidate, _uid) LOOP
    candidate := base || '-' || n;
    n := n + 1;
    IF n > 500 THEN
      RETURN base || '-' || substr(md5(random()::text), 1, 6);
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.free_username(TEXT, UUID) FROM PUBLIC, anon, authenticated;

-- For the sign-up and account forms: is this username free, and if not,
-- some that are. Callable signed out (the sign-up form).
CREATE OR REPLACE FUNCTION public.username_available(_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  n TEXT := btrim(coalesce(_name, ''));
  slug TEXT := public.username_slug(n);
  ideas TEXT[] := '{}';
  idea TEXT;
BEGIN
  IF char_length(n) < 2 OR char_length(n) > 40 THEN
    RETURN jsonb_build_object('available', false, 'suggestions', '[]'::jsonb);
  END IF;
  IF NOT public.username_taken(n, auth.uid()) THEN
    RETURN jsonb_build_object('available', true, 'suggestions', '[]'::jsonb);
  END IF;
  FOREACH idea IN ARRAY ARRAY[
    public.free_username(n, auth.uid()),
    public.free_username(slug || '.' || to_char(now(), 'YY'), auth.uid()),
    public.free_username(slug || (10 + floor(random() * 90))::int, auth.uid())
  ] LOOP
    IF idea IS NOT NULL AND NOT idea = ANY (ideas) THEN ideas := ideas || idea; END IF;
  END LOOP;
  RETURN jsonb_build_object('available', false, 'suggestions', to_jsonb(ideas));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.username_available(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.username_available(TEXT) TO anon, authenticated;

-- -------------------------------------------------------------------------
-- Sign-up: never fails on a name clash
-- -------------------------------------------------------------------------

-- Same as 20261005000007_recruiter_approval.sql, except the profile gets a
-- free username (from the username, else the name, else the email) and the
-- real name, and a clash can't roll back the sign-up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requested_role public.app_role;
  invite_id UUID;
  who TEXT;
  real_name TEXT := nullif(left(btrim(coalesce(NEW.raw_user_meta_data->>'full_name', '')), 100), '');
  handle TEXT;
BEGIN
  handle := public.free_username(coalesce(
    nullif(left(btrim(coalesce(NEW.raw_user_meta_data->>'username', '')), 40), ''),
    public.username_slug(real_name),
    public.username_slug(split_part(coalesce(NEW.email, ''), '@', 1))
  ), NEW.id);

  BEGIN
    INSERT INTO public.profiles (id, email, username, full_name)
    VALUES (NEW.id, NEW.email, handle, real_name)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    -- Someone took the same handle in the same instant.
    INSERT INTO public.profiles (id, email, username, full_name)
    VALUES (NEW.id, NEW.email, left(coalesce(handle, 'member'), 32) || '-' || substr(NEW.id::text, 1, 6), real_name)
    ON CONFLICT (id) DO NOTHING;
  END;

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

    who := coalesce(real_name, handle, NEW.email);
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

-- -------------------------------------------------------------------------
-- What people are called
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.display_name(uid UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(nullif(trim(coalesce(tp.first_name, '') || ' ' || coalesce(tp.last_name, '')), ''),
                  nullif(btrim(p.full_name), ''),
                  p.username, p.email, 'Someone')
  FROM public.profiles p LEFT JOIN public.talent_profiles tp ON tp.user_id = p.id
  WHERE p.id = uid;
$$;

CREATE OR REPLACE FUNCTION public.chat_name(_uid UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(
    nullif(trim(coalesce(tp.first_name, '') || ' ' || coalesce(tp.last_name, '')), ''),
    nullif(btrim(p.full_name), ''),
    nullif(btrim(p.username), ''),
    CASE public.chat_role(_uid)
      WHEN 'admin' THEN 'Savant team'
      WHEN 'career_coach' THEN 'Career coach'
      WHEN 'recruiter' THEN 'Recruiter'
      ELSE 'Savant member' END
  )
  FROM public.profiles p
  LEFT JOIN public.talent_profiles tp ON tp.user_id = p.id
  WHERE p.id = _uid;
$$;
REVOKE EXECUTE ON FUNCTION public.chat_name(UUID) FROM PUBLIC, anon, authenticated;
