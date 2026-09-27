-- Highly rated employers for the Professional feed. Each passes the equity
-- filter (JUST Capital top 50; As You Sow >= 40% where listed) and has a job
-- board the scout reads. Boards identified 2026-09-27.
INSERT INTO public.scout_companies (name, careers_url, ats, ats_token, industry, naics_code, rating_name)
SELECT v.name, v.careers_url, v.ats, v.ats_token, v.industry, v.naics_code, v.rating_name
FROM (VALUES
  ('HP Inc', 'https://hp.wd5.myworkdayjobs.com/ExternalCareerSite', 'workday',
   'hp.wd5.myworkdayjobs.com/hp/ExternalCareerSite', 'Manufacturing', '31', NULL),
  ('NVIDIA', 'https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite', 'workday',
   'nvidia.wd5.myworkdayjobs.com/nvidia/NVIDIAExternalCareerSite', 'Manufacturing', '31', NULL),
  ('AMD', 'https://careers.amd.com/careers-home/jobs', 'jsonld',
   'https://careers.amd.com/careers-home/jobs', 'Manufacturing', '31', 'Advanced Micro Devices'),
  ('Zillow Group', 'https://zillow.wd5.myworkdayjobs.com/Zillow_Group_External', 'workday',
   'zillow.wd5.myworkdayjobs.com/zillow/Zillow_Group_External', 'Real Estate', '53', NULL),
  ('Mastercard', 'https://mastercard.wd1.myworkdayjobs.com/CorporateCareers', 'workday',
   'mastercard.wd1.myworkdayjobs.com/mastercard/CorporateCareers', 'Finance and Insurance', '52', NULL),
  ('Micron Technology', 'https://micron.wd1.myworkdayjobs.com/External', 'workday',
   'micron.wd1.myworkdayjobs.com/micron/External', 'Manufacturing', '31', NULL)
) AS v(name, careers_url, ats, ats_token, industry, naics_code, rating_name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.scout_companies c WHERE lower(c.name) = lower(v.name)
);
