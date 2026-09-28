-- Unique scanners for the three staffing agencies whose boards load in the
-- browser (src/lib/scout/staffing-boards.ts). Their unique_scanner_sites
-- rows move to "supported" on the first scan that returns jobs.
--
--   Staffing Network   — Avionte job board EXAzP0DlCr8 (the iframe on
--                        staffingnetwork.com/job-board). The board linked from
--                        the home page (f4eUdCSFYjo) is the general application.
--   Partners Personnel — client jobs are on jobs.partnerspersonnel.com; the
--                        Paycom portal is their internal (corporate) careers.
--   Renoir Staffing    — Smpl board at jobs.renoirstaffing.com.

UPDATE public.scout_companies
SET ats = 'avionte', ats_token = 'c8f-WuNtN_g/EXAzP0DlCr8',
    careers_url = 'https://staffingnetwork.com/job-board/', last_status = NULL, last_error = NULL
WHERE name = 'Staffing Network';

UPDATE public.scout_companies
SET ats = 'partners', ats_token = 'https://jobs.partnerspersonnel.com',
    careers_url = 'https://jobs.partnerspersonnel.com/', last_status = NULL, last_error = NULL
WHERE name = 'Partners Personnel';

UPDATE public.scout_companies
SET ats = 'smpl', ats_token = 'https://jobs.renoirstaffing.com',
    careers_url = 'https://jobs.renoirstaffing.com/', last_status = NULL, last_error = NULL
WHERE name = 'Renoir Staffing';

UPDATE public.unique_scanner_sites u
SET status = 'in_progress',
    notes = coalesce(u.notes || E'\n', '') || 'Scanner built 2026-09-27 (staffing-boards.ts); marked supported after its first successful scan.'
FROM public.scout_companies c
WHERE u.scout_company_id = c.id
  AND c.name IN ('Staffing Network', 'Partners Personnel', 'Renoir Staffing');

UPDATE public.unique_scanner_sites u
SET jobs_url = 'https://jobs.partnerspersonnel.com/',
    platform = 'Custom board (Paycom is internal careers only)'
FROM public.scout_companies c
WHERE u.scout_company_id = c.id AND c.name = 'Partners Personnel';
