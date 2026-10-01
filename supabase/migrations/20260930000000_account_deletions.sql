-- Self-service account deletion (Settings → Delete account), handled by
-- src/lib/account.server.ts with the service role:
--   1. removes the user's résumé files (storage bucket "resumes", folder <uid>/)
--      and contact-form messages sent from their email;
--   2. deletes the auth user, which cascades to profiles, roles, talent profile
--      and preferences, applications, saved jobs and answers, autofill records,
--      notifications, service requests, saved talent, application requests and
--      jobs they posted (scouted jobs have no posted_by and are unaffected);
--   3. records the request here.
--
-- This log is the record of consumer deletion requests that privacy laws
-- (e.g. the CCPA's 24-month record-keeping rule) expect. It deliberately holds
-- nothing that identifies the person: just when, and which account type.
CREATE TABLE IF NOT EXISTS public.account_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  roles TEXT[] NOT NULL DEFAULT '{}',
  resume_files_removed INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.account_deletions TO authenticated;
GRANT ALL ON public.account_deletions TO service_role;

DROP POLICY IF EXISTS "Admins read account deletions" ON public.account_deletions;
CREATE POLICY "Admins read account deletions" ON public.account_deletions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
