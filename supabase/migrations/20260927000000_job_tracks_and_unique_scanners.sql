-- =========================================================================
-- Feed tracks + unique-scanner registry
--
--   jobs.track            hourly (temp & low barrier to entry) | professional,
--                         set by the scout's classifier (src/lib/scout/track.ts);
--                         track_override lets an admin or the posting recruiter
--                         move a posting to the other feed.
--   jobs.pay_*            posted pay, when the source publishes it.
--   talent_preferences.job_track   which feed a talent opens on.
--   scout_companies.company_type   employer | staffing_agency.
--   unique_scanner_sites  careers sites the scout can't read (no supported
--                         ATS, no JobPosting markup, no job sitemap), queued
--                         for a custom scanner. The scout adds rows itself.
--
-- Seeds the five staffing agencies analysed on 2026-09-26.
-- =========================================================================

-- -------------------------------------------------------------------------
-- jobs: feed track + pay
-- -------------------------------------------------------------------------
ALTER TABLE public.jobs
  ADD COLUMN track TEXT,
  ADD COLUMN track_reasons TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN track_override TEXT CHECK (track_override IN ('hourly', 'professional')),
  ADD COLUMN pay_min NUMERIC(12, 2),
  ADD COLUMN pay_max NUMERIC(12, 2),
  ADD COLUMN pay_unit TEXT CHECK (pay_unit IN ('hour', 'day', 'week', 'month', 'year'));

-- Until the next scan reclassifies them: schedule is the best signal on hand.
UPDATE public.jobs
SET track = CASE WHEN employment_type IN ('temporary', 'part_time') THEN 'hourly' ELSE 'professional' END;

ALTER TABLE public.jobs
  ALTER COLUMN track SET DEFAULT 'professional',
  ALTER COLUMN track SET NOT NULL,
  ADD CONSTRAINT jobs_track_check CHECK (track IN ('hourly', 'professional'));

CREATE INDEX jobs_status_track_posted_idx ON public.jobs (status, track, posted_at DESC);

-- -------------------------------------------------------------------------
-- talent_preferences: which feed opens first
-- -------------------------------------------------------------------------
ALTER TABLE public.talent_preferences
  ADD COLUMN job_track TEXT NOT NULL DEFAULT 'all'
    CHECK (job_track IN ('all', 'hourly', 'professional'));

-- -------------------------------------------------------------------------
-- scout_companies: staffing agencies post both kinds of role
-- -------------------------------------------------------------------------
ALTER TABLE public.scout_companies
  ADD COLUMN company_type TEXT NOT NULL DEFAULT 'employer'
    CHECK (company_type IN ('employer', 'staffing_agency'));

-- -------------------------------------------------------------------------
-- unique_scanner_sites: the queue of sites that need a custom scanner
-- -------------------------------------------------------------------------
CREATE TABLE public.unique_scanner_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_company_id UUID UNIQUE REFERENCES public.scout_companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  site_url TEXT NOT NULL,                  -- the careers page the scout was given
  jobs_url TEXT,                           -- where the job list actually lives, when known
  platform TEXT,                           -- recognized but unsupported platform: Paycom, Avionte…
  reason TEXT NOT NULL,                    -- why the scout can't read it
  status TEXT NOT NULL DEFAULT 'needs_scanner'
    CHECK (status IN ('needs_scanner', 'in_progress', 'supported', 'wont_build')),
  notes TEXT,                              -- what a scanner for it would need
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX unique_scanner_sites_status_idx ON public.unique_scanner_sites (status, platform);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unique_scanner_sites TO authenticated;
GRANT ALL ON public.unique_scanner_sites TO service_role;
ALTER TABLE public.unique_scanner_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage unique scanner sites" ON public.unique_scanner_sites
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER unique_scanner_sites_updated_at BEFORE UPDATE ON public.unique_scanner_sites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------
-- Seed: the five staffing agencies (ATS analysis, 2026-09-26)
--   Aerotek   — Phenom careers site; job sitemap + embedded job data → readable
--   Randstad  — own site; job sitemap + JobPosting markup → readable
--   Partners Personnel, Staffing Network, Renoir — job lists built in the
--   browser (Paycom, Avionte, Smpl) → unique-scanner registry
-- -------------------------------------------------------------------------
INSERT INTO public.scout_companies (name, careers_url, ats, ats_token, company_type)
SELECT v.name, v.careers_url, v.ats, v.ats_token, 'staffing_agency'
FROM (VALUES
  ('Aerotek', 'https://jobs.aerotek.com/us/en', 'jsonld', 'https://jobs.aerotek.com/us/en'),
  ('Randstad', 'https://www.randstadusa.com/jobs/', 'jsonld', 'https://www.randstadusa.com/jobs/'),
  ('Partners Personnel', 'https://www.partnerspersonnel.com', NULL, NULL),
  ('Staffing Network', 'https://staffingnetwork.com', NULL, NULL),
  ('Renoir Staffing', 'https://www.renoirstaffing.com', NULL, NULL)
) AS v(name, careers_url, ats, ats_token)
WHERE NOT EXISTS (
  SELECT 1 FROM public.scout_companies c WHERE lower(c.name) = lower(v.name)
);

UPDATE public.scout_companies
SET company_type = 'staffing_agency'
WHERE lower(name) IN ('aerotek', 'randstad', 'partners personnel', 'staffing network', 'renoir staffing');

INSERT INTO public.unique_scanner_sites (scout_company_id, name, site_url, jobs_url, platform, reason, notes)
SELECT c.id, v.name, v.site_url, v.jobs_url, v.platform, v.reason, v.notes
FROM (VALUES
  ('Partners Personnel', 'https://www.partnerspersonnel.com',
   'https://www.paycomonline.net/v4/ats/web.php/jobs?clientkey=9D17603E5040899661173CBE8821A9CC',
   'Paycom',
   'Job list is a Paycom applicant portal that loads in the browser; no JobPosting markup or job sitemap.',
   'Paycom portals fetch their listings from a JSON call keyed by the clientkey. A scanner would replay that call (or render the page) and map each listing.'),
  ('Staffing Network', 'https://staffingnetwork.com',
   'https://hire.myavionte.com/app/careers/#/jobs/c8f-WuNtN_g/f4eUdCSFYjo/general',
   'Avionte',
   'Job list is an Avionte Sonar careers widget built in the browser; the page itself has no job data.',
   'Avionte''s widget reads listings from its careers API using the bId/jbId in the embed. A scanner would call that API for this board.'),
  ('Renoir Staffing', 'https://www.renoirstaffing.com',
   'https://jobs.renoirstaffing.com/index.smpl?arg=jb_search_results',
   'Smpl job board',
   'jobs.renoirstaffing.com loads its search results through an AJAX call (ajax_rq.smpl); no JobPosting markup or job sitemap.',
   'A scanner would request the search results the page asks ajax_rq.smpl for, then read each index.smpl?arg=jb_details&POST_ID= page.')
) AS v(name, site_url, jobs_url, platform, reason, notes)
LEFT JOIN public.scout_companies c ON lower(c.name) = lower(v.name)
ON CONFLICT (scout_company_id) DO NOTHING;
