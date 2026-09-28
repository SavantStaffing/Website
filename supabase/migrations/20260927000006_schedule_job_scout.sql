-- =========================================================================
-- Scheduled Job Scout
--
-- pg_cron calls the job-scout Edge Function every 15 minutes through pg_net.
-- Each call scans the enabled company scanned longest ago, so all companies
-- are refreshed in turn (11 companies: about every 3 hours).
--
-- The function checks x-scout-token against scout_settings.cron_token, a
-- random value generated here that never leaves the database (admin-only
-- table; the cron job reads it at call time). To rotate it:
--   UPDATE public.scout_settings SET cron_token = <new random> WHERE id = 1;
--
-- The URL is this project's (tohslisvzeliehezgnod). On another project,
-- reschedule with its URL.
-- =========================================================================

ALTER TABLE public.scout_settings
  ADD COLUMN IF NOT EXISTS cron_token TEXT NOT NULL
    DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Replace any earlier schedule under the same name.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'savant-job-scout';

SELECT cron.schedule(
  'savant-job-scout',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tohslisvzeliehezgnod.supabase.co/functions/v1/job-scout',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-scout-token', (SELECT cron_token FROM public.scout_settings WHERE id = 1)
    ),
    body := '{"companies": 1}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
