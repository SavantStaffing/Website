-- =========================================================================
-- Employer Ratings, adaptive route: Where You Work Matters + WBA + DOL.
--
--   where_you_work_matters    the Where You Work Matters list (employers with
--                             4+ Gold/Platinum badges), one row per employer.
--                             normalized_name matches normalizeCompanyName()
--                             in src/lib/scout/ratings.ts.
--   employer_listing_counts() live postings per employer name, so the Job
--                             Scout can look up WBA + DOL records for every
--                             employer hiring on Savant, not only the ones on
--                             its scan list.
--   employer_rating_inputs()  now also returns the Where You Work Matters list.
-- =========================================================================

CREATE TABLE public.where_you_work_matters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE CHECK (normalized_name <> ''),
  industry TEXT,
  careers_url TEXT,
  gold_badges INTEGER NOT NULL CHECK (gold_badges >= 0),
  platinum_badges INTEGER NOT NULL CHECK (platinum_badges >= 0),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The list's qualifier: more than 3 badges.
  CHECK (gold_badges + platinum_badges >= 4)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.where_you_work_matters TO authenticated;
GRANT ALL ON public.where_you_work_matters TO service_role;
ALTER TABLE public.where_you_work_matters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage Where You Work Matters" ON public.where_you_work_matters
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.where_you_work_matters
  (company_name, normalized_name, industry, careers_url, gold_badges, platinum_badges)
VALUES
  ('Accenture', 'accenture', 'Professional Services', 'https://www.accenture.com/us-en/careers', 2, 2),
  ('Alarm.com', 'alarm', 'Software & Technology', 'https://alarm.com/careers', 2, 2),
  ('Ally Financial', 'ally financial', 'Banks & Financial Services', 'https://www.ally.com/about/careers/', 1, 3),
  ('Amazon', 'amazon', 'Software & Technology', 'https://www.amazon.jobs', 1, 3),
  ('Amica Mutual Insurance', 'amica mutual insurance', 'Insurance', 'https://www.amica.com/en/about-us/careers.html', 1, 3),
  ('Ansys', 'ansys', 'Software & Technology', 'https://careers.ansys.com', 1, 3),
  ('Appfolio', 'appfolio', 'Software & Technology', 'https://www.appfolio.com/company/careers', 1, 3),
  ('Arthrex', 'arthrex', 'Medical Devices & Distribution', 'https://careers.arthrex.com', 4, 0),
  ('Atlassian', 'atlassian', 'Software & Technology', 'https://www.atlassian.com/company/careers', 2, 2),
  ('Atmos Energy', 'atmos energy', 'Utilities', 'https://www.atmosenergy.com/careers', 3, 1),
  ('Auto-Owners Insurance', 'auto owners insurance', 'Insurance', 'https://www.auto-owners.com/careers', 1, 3),
  ('Boeing', 'boeing', 'Aerospace & Defense', 'https://jobs.boeing.com', 0, 4),
  ('Boston Scientific', 'boston scientific', 'Medical Devices & Distribution', 'https://www.bostonscientific.com/en-US/careers.html', 1, 3),
  ('Bright Horizons', 'bright horizons', 'Business Services', 'https://careers.brighthorizons.com', 2, 2),
  ('Capital One', 'capital one', 'Banks & Financial Services', 'https://www.capitalonecareers.com', 1, 3),
  ('Carhartt', 'carhartt', 'Retail', 'https://careers.carhartt.com', 3, 1),
  ('Charles Schwab', 'charles schwab', 'Banks & Financial Services', 'https://www.schwabjobs.com', 1, 3),
  ('Children''s Hospital of Los Angeles', 'children s hospital of los angeles', 'Healthcare', 'https://www.chla.org/careers', 2, 2),
  ('Citadel & Citadel Securities', 'citadel and citadel securities', 'Banks & Financial Services', 'https://www.citadel.com/careers/', 2, 2),
  ('CNN', 'cnn', 'Entertainment & Media', 'https://careers.wbd.com', 1, 3),
  ('Collins Aerospace', 'collins aerospace', 'Aerospace & Defense', 'https://careers.rtx.com', 2, 2),
  ('Comcast', 'comcast', 'Communication & Telecom', 'https://jobs.comcast.com', 2, 2),
  ('CoStar Group', 'costar', 'Real Estate', 'https://www.costargroup.com/careers', 3, 1),
  ('Cummins', 'cummins', 'Manufacturing', 'https://www.cummins.com/careers', 3, 1),
  ('Datadog', 'datadog', 'Software & Technology', 'https://careers.datadoghq.com', 2, 2),
  ('Deckers Retail', 'deckers retail', 'Retail', 'https://careers.deckers.com', 2, 2),
  ('Deloitte', 'deloitte', 'Professional Services', 'https://www2.deloitte.com/us/en/careers.html', 1, 3),
  ('Docusign', 'docusign', 'Software & Technology', 'https://careers.docusign.com', 0, 4),
  ('Esri', 'esri', 'Software & Technology', 'https://www.esri.com/en-us/about/careers/overview', 1, 3),
  ('Federated Insurance', 'federated insurance', 'Insurance', 'https://www.federatedinsurance.com/careers', 2, 2),
  ('Fidelity Investments', 'fidelity investments', 'Banks & Financial Services', 'https://jobs.fidelity.com', 0, 4),
  ('Fisher Investments', 'fisher investments', 'Banks & Financial Services', 'https://www.fisherinvestments.com/en-us/careers', 0, 4),
  ('Geico', 'geico', 'Insurance', 'https://careers.geico.com', 1, 3),
  ('General Motors', 'general motors', 'Auto Manufacturers & Parts', 'https://search-careers.gm.com', 0, 4),
  ('GoDaddy', 'godaddy', 'Software & Technology', 'https://careers.godaddy.com', 2, 2),
  ('Great American Insurance Group', 'great american insurance', 'Insurance', 'https://www.greatamericaninsurancegroup.com/careers', 1, 3),
  ('H-E-B', 'h e b', 'Retail', 'https://careers.heb.com', 1, 3),
  ('Hilti', 'hilti', 'Building & Construction', 'https://careers.hilti.group', 1, 3),
  ('HubSpot', 'hubspot', 'Software & Technology', 'https://www.hubspot.com/careers', 0, 4),
  ('Independence Blue Cross', 'independence blue cross', 'Insurance', 'https://careers.ibx.com', 3, 1),
  ('Jamf', 'jamf', 'Software & Technology', 'https://www.jamf.com/about/careers/', 0, 4),
  ('Jefferies', 'jefferies', 'Banks & Financial Services', 'https://www.jefferies.com/careers/', 1, 3),
  ('John Deere', 'john deere', 'Manufacturing', 'https://www.deere.com/en/our-company/john-deere-careers/', 1, 3),
  ('Lazard', 'lazard', 'Banks & Financial Services', 'https://www.lazard.com/careers/', 3, 1),
  ('Liberty Mutual Insurance', 'liberty mutual insurance', 'Insurance', 'https://jobs.libertymutualgroup.com', 0, 4),
  ('Lockheed Martin', 'lockheed martin', 'Aerospace & Defense', 'https://www.lockheedmartinjobs.com', 0, 4),
  ('L''Oréal', 'l or al', 'Retail', 'https://careers.loreal.com', 1, 3),
  ('Marriott International', 'marriott international', 'Hospitality', 'https://careers.marriott.com', 1, 3),
  ('MathWorks', 'mathworks', 'Software & Technology', 'https://www.mathworks.com/company/jobs/opportunities.html', 0, 4),
  ('Mayo Clinic', 'mayo clinic', 'Healthcare', 'https://jobs.mayoclinic.org', 0, 4),
  ('MD Anderson Cancer Center', 'md anderson cancer center', 'Healthcare', 'https://jobs.mdanderson.org', 2, 2),
  ('Memorial Sloan-Kettering Cancer Center', 'memorial sloan kettering cancer center', 'Healthcare', 'https://careers.mskcc.org', 2, 2),
  ('Microsoft', 'microsoft', 'Software & Technology', 'https://careers.microsoft.com', 1, 3),
  ('Milwaukee Tool', 'milwaukee tool', 'Manufacturing', 'https://www.milwaukeetool.com/careers', 1, 3),
  ('Nationwide', 'nationwide', 'Insurance', 'https://www.nationwide.com/personal/about-us/careers/', 2, 2),
  ('Netsuite', 'netsuite', 'Software & Technology', 'https://www.oracle.com/careers/', 1, 3),
  ('NewYork-Presbyterian Hospital', 'newyork presbyterian hospital', 'Healthcare', 'https://careers.nyp.org', 1, 3),
  ('Nike', 'nike', 'Retail', 'https://careers.nike.com', 1, 3),
  ('Northrop Grumman', 'northrop grumman', 'Aerospace & Defense', 'https://www.northropgrumman.com/careers', 0, 4),
  ('Northwell Health', 'northwell health', 'Healthcare', 'https://jobs.northwell.edu', 0, 4),
  ('Okta', 'okta', 'Software & Technology', 'https://www.okta.com/company/careers/', 2, 2),
  ('Oliver Wyman', 'oliver wyman', 'Professional Services', 'https://www.oliverwyman.com/careers.html', 1, 3),
  ('Oncor Electric Delivery', 'oncor electric delivery', 'Utilities', 'https://www.oncor.com/careers', 2, 2),
  ('Oracle', 'oracle', 'Software & Technology', 'https://www.oracle.com/careers/', 1, 3),
  ('Penguin Random House', 'penguin random house', 'Entertainment & Media', 'https://careers.penguinrandomhouse.com', 2, 2),
  ('PepsiCo', 'pepsico', 'Food & Beverage', 'https://www.pepsicojobs.com', 2, 2),
  ('Philadelphia Insurance Companies', 'philadelphia insurance', 'Insurance', 'https://www.phly.com/careers', 0, 4),
  ('Piper Sandler', 'piper sandler', 'Banks & Financial Services', 'https://www.pipersandler.com/careers', 2, 2),
  ('Pratt & Whitney', 'pratt and whitney', 'Aerospace & Defense', 'https://careers.rtx.com', 1, 3),
  ('Procter & Gamble', 'procter and gamble', 'Retail', 'https://www.pgcareers.com', 0, 4),
  ('Progressive', 'progressive', 'Insurance', 'https://careers.progressive.com', 0, 4),
  ('Prudential Financial', 'prudential financial', 'Insurance', 'https://jobs.prudential.com', 2, 2),
  ('Qualcomm', 'qualcomm', 'Electronics & Semiconductors', 'https://careers.qualcomm.com', 0, 4),
  ('Qualtrics', 'qualtrics', 'Software & Technology', 'https://www.qualtrics.com/careers/', 0, 4),
  ('Raymour & Flanigan Furniture And Mattresses', 'raymour and flanigan furniture and mattresses', 'Retail', 'https://careers.raymourflanigan.com', 2, 2),
  ('Republic National Distributing Company', 'republic national distributing', 'Food & Beverage', 'https://www.rndc-usa.com/careers', 1, 3),
  ('SAS Institute', 'sas institute', 'Software & Technology', 'https://www.sas.com/en_us/careers.html', 1, 3),
  ('Slalom Consulting', 'slalom consulting', 'Professional Services', 'https://www.slalom.com/careers', 1, 3),
  ('Southern Glazer''s Wine & Spirits, LLC', 'southern glazer s wine and spirits', 'Food & Beverage', 'https://www.southernglazers.com/careers', 1, 3),
  ('SpaceX', 'spacex', 'Aerospace & Defense', 'https://www.spacex.com/careers', 1, 3),
  ('Squarespace', 'squarespace', 'Software & Technology', 'https://www.squarespace.com/careers', 2, 2),
  ('Stop & Shop', 'stop and shop', 'Retail', 'https://stopandshop.com/pages/careers', 4, 0),
  ('Stryker', 'stryker', 'Medical Devices & Distribution', 'https://careers.stryker.com', 0, 4),
  ('Symetra', 'symetra', 'Insurance', 'https://www.symetra.com/careers', 1, 3),
  ('TD Bank', 'td bank', 'Banks & Financial Services', 'https://jobs.td.com', 3, 1),
  ('Tesla', 'tesla', 'Auto Manufacturers & Parts', 'https://www.tesla.com/careers', 1, 3),
  ('Texas Instruments', 'texas instruments', 'Electronics & Semiconductors', 'https://careers.ti.com', 0, 4),
  ('The Boston Consulting Group (BCG)', 'boston consulting bcg', 'Professional Services', 'https://careers.bcg.com', 1, 3),
  ('The Hershey Company', 'hershey', 'Food & Beverage', 'https://careers.thehersheycompany.com', 1, 3),
  ('The Home Depot', 'home depot', 'Retail', 'https://careers.homedepot.com', 1, 3),
  ('The Vanguard Group', 'vanguard', 'Banks & Financial Services', 'https://www.vanguardjobs.com', 1, 3),
  ('The Whiting-Turner Contracting Company', 'whiting turner contracting', 'Building & Construction', 'https://www.whiting-turner.com/careers', 2, 2),
  ('Toast', 'toast', 'Software & Technology', 'https://careers.toasttab.com', 1, 3),
  ('Trader Joe''s', 'trader joe s', 'Retail', 'https://www.traderjoes.com/home/careers', 1, 3),
  ('Travelers', 'travelers', 'Insurance', 'https://careers.travelers.com', 1, 3),
  ('TRIMEDX', 'trimedx', 'Medical Devices & Distribution', 'https://trimedx.com/careers', 4, 0),
  ('T. Rowe Price Group', 't rowe price', 'Banks & Financial Services', 'https://www.troweprice.com/careers', 1, 3),
  ('Tyler Technologies', 'tyler technologies', 'Information Technology Services', 'https://www.tylertech.com/careers', 0, 4),
  ('Unity', 'unity', 'Software & Technology', 'https://unity.com/careers', 2, 2),
  ('Universal Orlando Resort', 'universal orlando resort', 'Entertainment & Media', 'https://jobs.universalparks.com', 2, 2),
  ('University of Chicago Medicine', 'university of chicago medicine', 'Healthcare', 'https://www.uchicagomedicine.org/careers', 1, 3),
  ('Verkada', 'verkada', 'Electronics & Semiconductors', 'https://www.verkada.com/careers/', 3, 1),
  ('Walmart', 'walmart', 'Retail', 'https://careers.walmart.com', 3, 1),
  ('Wegmans', 'wegmans', 'Retail', 'https://jobs.wegmans.com', 1, 3),
  ('WellMed Medical Management', 'wellmed medical management', 'Healthcare', 'https://www.wellmedhealthcare.com/careers/', 4, 0),
  ('West Monroe', 'west monroe', 'Professional Services', 'https://www.westmonroe.com/careers', 0, 4),
  ('Whirlpool', 'whirlpool', 'Manufacturing', 'https://www.whirlpoolcareers.com', 2, 2),
  ('Whole Foods', 'whole foods', 'Retail', 'https://careers.wholefoodsmarket.com', 1, 3),
  ('Zendesk', 'zendesk', 'Software & Technology', 'https://www.zendesk.com/jobs/', 1, 3),
  ('Zillow', 'zillow', 'Real Estate', 'https://www.zillow.com/careers/', 3, 1)
ON CONFLICT (normalized_name) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  industry = EXCLUDED.industry,
  careers_url = EXCLUDED.careers_url,
  gold_badges = EXCLUDED.gold_badges,
  platinum_badges = EXCLUDED.platinum_badges,
  imported_at = now();

-- Live postings per employer name, for the Job Scout's ethics sweep.
CREATE OR REPLACE FUNCTION public.employer_listing_counts()
RETURNS TABLE (company_name TEXT, listings BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(j.company_name, o.name), count(*)
  FROM jobs j LEFT JOIN organizations o ON o.id = j.organization_id
  WHERE j.status = 'active'
    AND (j.valid_through IS NULL OR j.valid_through > now())
    AND coalesce(j.company_name, o.name) IS NOT NULL
  GROUP BY 1;
$$;
REVOKE EXECUTE ON FUNCTION public.employer_listing_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.employer_listing_counts() TO service_role;

CREATE OR REPLACE FUNCTION public.employer_rating_inputs()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ratings', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'source', r.source, 'company_name', r.company_name,
        'normalized_name', r.normalized_name, 'rank', r.rank, 'score', r.score))
      FROM company_ratings r), '[]'::jsonb),
    'ethics', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'company_key', e.company_key, 'company_name', e.company_name,
        'fair_pay_score', e.fair_pay_score, 'cultures_score', e.cultures_score,
        'honest_score', e.honest_score, 'wba_year', e.wba_year,
        'dol_checked', e.dol_checked, 'dol_wage_cases', e.dol_wage_cases,
        'dol_repeat_violator', e.dol_repeat_violator,
        'osha_serious_violations', e.osha_serious_violations))
      FROM employer_ethics e), '[]'::jsonb),
    'wywm', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'company_name', w.company_name, 'normalized_name', w.normalized_name,
        'gold', w.gold_badges, 'platinum', w.platinum_badges))
      FROM where_you_work_matters w), '[]'::jsonb),
    'aliases', coalesce((
      SELECT jsonb_agg(jsonb_build_object('name', c.name, 'rating_name', c.rating_name))
      FROM scout_companies c WHERE c.rating_name IS NOT NULL), '[]'::jsonb),
    'jobs', coalesce((
      SELECT jsonb_agg(jsonb_build_object('company', t.company, 'n', t.n))
      FROM (
        SELECT coalesce(j.company_name, o.name) AS company, count(*) AS n
        FROM jobs j LEFT JOIN organizations o ON o.id = j.organization_id
        WHERE j.status = 'active'
          AND (j.valid_through IS NULL OR j.valid_through > now())
          AND coalesce(j.company_name, o.name) IS NOT NULL
        GROUP BY 1
      ) t), '[]'::jsonb)
  );
$$;
-- Employer Ratings stay members-only (see 20260928000007).
REVOKE EXECUTE ON FUNCTION public.employer_rating_inputs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.employer_rating_inputs() TO authenticated;

-- Hourly employer ethics sweep (the job-scout function with {"sweep": true}).
-- Built from the existing savant-job-scout job so it calls the same project
-- URL with the same token, whichever project this runs on.
DO $do$
DECLARE
  scout_command TEXT;
BEGIN
  SELECT command INTO scout_command FROM cron.job WHERE jobname = 'savant-job-scout';
  IF scout_command IS NULL THEN
    RAISE NOTICE 'savant-job-scout is not scheduled; skipping the ethics sweep schedule';
    RETURN;
  END IF;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'savant-ethics-sweep';
  PERFORM cron.schedule(
    'savant-ethics-sweep',
    '7 * * * *',
    regexp_replace(scout_command, '''\{"companies":\s*\d+\}''', '''{"sweep": true}''')
  );
END
$do$;
