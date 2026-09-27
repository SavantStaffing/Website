-- =========================================================================
-- Temp partner listings in the job feed
--
--   jobs.pay_unit      + 'shift' for flat-rate gigs ("$110 flat").
--   jobs.valid_through listings from the partner apps are snapshots; the feed
--                      hides them after this date unless they're refreshed.
--   talent_preferences.min_hourly_pay / temp_apps
--                      preferences that seed the feed's "Pay at least" and
--                      "Temp app" filters and add to the ranking.
-- =========================================================================

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_pay_unit_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_pay_unit_check
  CHECK (pay_unit IN ('hour', 'shift', 'day', 'week', 'month', 'year'));

ALTER TABLE public.jobs ADD COLUMN valid_through TIMESTAMPTZ;

ALTER TABLE public.talent_preferences
  ADD COLUMN min_hourly_pay NUMERIC(6, 2) CHECK (min_hourly_pay IS NULL OR min_hourly_pay BETWEEN 0 AND 500),
  ADD COLUMN temp_apps TEXT[] NOT NULL DEFAULT '{}'
    CHECK (temp_apps <@ ARRAY['bluecrew', 'workwhile', 'instawork']::text[]);
