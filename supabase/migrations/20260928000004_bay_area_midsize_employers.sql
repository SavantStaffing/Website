-- Bay Area mid-size employers (100+ employees) for the Professional feed,
-- researched 2026-09-28. Each is headquartered in the Bay Area, is on a 2026
-- employee-survey workplace list — Fortune / Great Place To Work "Best
-- Workplaces in the Bay Area" or Axios / Energage "Bay Area Top Workplaces" —
-- publishes its jobs on a board the scout reads, and passes the ratings gate.
-- Boards verified with the scout's own adapters the same day.
INSERT INTO public.scout_companies (name, careers_url, ats, ats_token, industry, naics_code)
SELECT v.name, v.careers_url, v.ats, v.ats_token, v.industry, v.naics_code
FROM (VALUES
  -- Fortune / Great Place To Work Best Workplaces in the Bay Area 2026
  ('Carta', 'https://job-boards.greenhouse.io/carta', 'greenhouse', 'carta',
   'Finance and Insurance', '52'),
  ('Motive', 'https://job-boards.greenhouse.io/gomotive', 'greenhouse', 'gomotive',
   'Information', '51'),
  ('Tanium', 'https://job-boards.greenhouse.io/tanium', 'greenhouse', 'tanium',
   'Information', '51'),
  ('Genesys', 'https://genesys.wd1.myworkdayjobs.com/Genesys', 'workday',
   'genesys.wd1.myworkdayjobs.com/genesys/Genesys', 'Information', '51'),
  -- Axios Bay Area Top Workplaces 2026 (500+ employees)
  ('Cohesity', 'https://cohesity.wd5.myworkdayjobs.com/Cohesity_Careers', 'workday',
   'cohesity.wd5.myworkdayjobs.com/cohesity/Cohesity_Careers', 'Information', '51'),
  ('Kairos Power', 'https://job-boards.greenhouse.io/kairospower', 'greenhouse', 'kairospower',
   'Professional, Scientific, and Technical Services', '54'),
  -- Axios Bay Area Top Workplaces 2026 (150–499 employees)
  ('Karius', 'https://jobs.lever.co/kariusdx', 'lever', 'kariusdx',
   'Health Care and Social Assistance', '62'),
  ('ALOM', 'https://jobs.lever.co/alom', 'lever', 'alom', 'Manufacturing', '31'),
  -- On As You Sow at 0%, but with ~140 employees it's under the 1,000-employee
  -- floor for that gate (20260928000005_scout_ingest_rules.sql).
  ('4D Molecular Therapeutics', 'https://job-boards.greenhouse.io/4dmoleculartherapeutics',
   'greenhouse', '4dmoleculartherapeutics', 'Health Care and Social Assistance', '62'),
  ('Service Champions', 'https://job-boards.greenhouse.io/servicechampions', 'greenhouse',
   'servicechampions', 'Construction', '23')
) AS v(name, careers_url, ats, ats_token, industry, naics_code)
WHERE NOT EXISTS (
  SELECT 1 FROM public.scout_companies c WHERE lower(c.name) = lower(v.name)
);
