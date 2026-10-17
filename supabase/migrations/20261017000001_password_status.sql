-- =========================================================================
-- Password status: Google-only accounts can add a password.
--
--   Accounts created with "Continue with Google" have no password, so an
--   email + password sign-in fails with "Invalid login credentials".
--
--   email_needs_password() — the login form calls this after a failed
--     sign-in. True means the email belongs to a Google-only account, and
--     the form offers "Continue with Google" or an emailed link to set a
--     password. (This deliberately tells the person typing that the email
--     has a Google account; that was the product decision.)
--   my_has_password() — the account page shows "Set a password" instead
--     of "Change password" when the signed-in user has none yet.
--
--   Setting the password still goes through the emailed recovery link, so
--   nobody can add a password to someone else's account.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.email_needs_password(_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE lower(u.email) = lower(btrim(coalesce(_email, '')))
      AND coalesce(u.encrypted_password, '') = ''
      AND u.deleted_at IS NULL
  );
$$;
REVOKE EXECUTE ON FUNCTION public.email_needs_password(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_needs_password(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_has_password()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(u.encrypted_password, '') <> ''
  FROM auth.users u
  WHERE u.id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.my_has_password() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_has_password() TO authenticated;
