-- =========================================================================
-- Seed /careers → Programs from the "Bay Area Career Programs" sheet.
--
-- Save as supabase/migrations/20261005000003_seed_career_programs.sql
--
-- Each row is keyed on (source, external_id), so re-running this updates the
-- rows in place instead of duplicating them. The sheet has no links, so `url`
-- is left NULL and the "Learn more" button stays hidden until one is added.
-- =========================================================================

INSERT INTO public.career_programs
  (source, external_id, industry, title, provider, location, remote,
   program_type, duration_note, cost_note, description)
VALUES
  -- Biomanufacturing ------------------------------------------------------
  ('bay-area-sheet', 'biomanufacturing-laney', 'Biomanufacturing',
   'Biomanufacturing Certificate of Achievement', 'Laney College', 'Oakland, CA', false,
   'certification', '1 year', '~$736 · FAFSA',
   'Leads to: Biomanufacturing Technician ($72,900–$95,200/yr) — average growth (+3-4%); steady Bay Area biotech/pharma demand.'),

  -- Radiology -------------------------------------------------------------
  ('bay-area-sheet', 'radiology-foothill', 'Radiology',
   'Radiologic Tech & Sonography', 'Foothill College', 'Los Altos, CA', false,
   'training', '23 months', '~$3,500 · FAFSA',
   'Leads to: Radiologic Technologist ($141,800–$154,900/yr) — average growth (+3-4%); ~12,900 US openings/yr. Diagnostic Medical Sonographer ($160,300–$173,200/yr) — Bright Outlook, +7%+ growth; ~5,800 US openings/yr.'),
  ('bay-area-sheet', 'radiology-ccsf', 'Radiology',
   'Radiologic Tech & Sonography', 'City College of San Francisco (CCSF)', 'San Francisco, CA', false,
   'training', '24 months', '~$2,500 · Free for SF residents (Free City Program)',
   'Leads to: Radiologic Technologist ($141,800–$154,900/yr) — average growth (+3-4%); ~12,900 US openings/yr. Diagnostic Medical Sonographer ($160,300–$173,200/yr) — Bright Outlook, +7%+ growth; ~5,800 US openings/yr.'),

  -- Dental Hygiene & Assisting --------------------------------------------
  ('bay-area-sheet', 'dental-assisting-alameda', 'Dental Hygiene & Assisting',
   'Dental Assisting', 'College of Alameda', 'Alameda, CA', false,
   'training', '12 months', '~$1,800',
   'Roles in this field: Dental Assistant ($64,400–$74,600/yr) — faster than average (+5-6%); ~52,900 US openings/yr. Dental Hygienist, RDH ($140,000–$146,800/yr) — Bright Outlook, +7%+ growth; ~15,300 US openings/yr.'),

  -- Information & Technology ----------------------------------------------
  ('bay-area-sheet', 'data-analytics-deanza', 'Information & Technology',
   'Data Analytics & Business Intelligence', 'De Anza College', 'Cupertino, CA', false,
   'training', '2-3 semesters', '~$1,500',
   'Leads to: Data/Business Intelligence Analyst ($123,300–$142,000/yr) — Bright Outlook, +7%+ growth; ~87,200 US openings/yr.'),
  ('bay-area-sheet', 'salesforce-calbright', 'Information & Technology',
   'Salesforce & CRM Platform Administration', 'Calbright College', 'California (statewide)', true,
   'training', '3-6 months', '$0 · Free for CA residents',
   'Leads to: Salesforce/CRM Administrator ($89,400–$93,600/yr) — slight national decline (-1%) but steady local demand; ~40,800 US openings/yr (replacement).'),
  ('bay-area-sheet', 'salesforce-mission', 'Information & Technology',
   'Salesforce & CRM Platform Administration', 'Mission College', 'Santa Clara, CA', false,
   'training', '1 semester', '~$500',
   'Leads to: Salesforce/CRM Administrator ($89,400–$93,600/yr) — slight national decline (-1%) but steady local demand; ~40,800 US openings/yr (replacement).'),
  ('bay-area-sheet', 'cybersecurity-ohlone', 'Information & Technology',
   'Cybersecurity / Network Operations', 'Ohlone College', 'Fremont, CA', false,
   'training', '6-12 months', '~$2,300',
   'Leads to: Cybersecurity/Network Analyst ($129,700–$176,100/yr) — Info Security: Bright Outlook +7%+; Network Admin roles flat but stable openings.'),
  ('bay-area-sheet', 'cybersecurity-dvc', 'Information & Technology',
   'Cybersecurity / Network Operations', 'Diablo Valley College', 'Pleasant Hill, CA', false,
   'training', '2 semesters', '~$1,400',
   'Leads to: Cybersecurity/Network Analyst ($129,700–$176,100/yr) — Info Security: Bright Outlook +7%+; Network Admin roles flat but stable openings.'),
  ('bay-area-sheet', 'medical-coding-ccsf', 'Information & Technology',
   'Medical Coding & Health Information Technology', 'City College of San Francisco (CCSF)', 'San Francisco, CA', false,
   'training', '2-3 semesters', '~$1,800 · Free for SF residents (Free City Program)',
   'Leads to: Medical Coding/Health Info Technician ($74,400–$86,900/yr) — Bright Outlook, +7%+ growth; ~14,200 US openings/yr.'),

  -- Supply Chain & Logistics ----------------------------------------------
  ('bay-area-sheet', 'supply-chain-skyline', 'Supply Chain & Logistics',
   'Supply Chain & Automated Logistics', 'Skyline College', 'San Bruno, CA', false,
   'training', '2 semesters', '~$1,300',
   'Leads to: Logistics/Supply Chain Coordinator ($76,500–$76,900/yr) — Bay Area wages ~22% above CA median; steady demand. Logistician/Supply Chain Analyst ($101,000–$115,600/yr) — Bright Outlook, +7%+ growth; ~26,400 US openings/yr. Buyer/Purchasing Agent ($93,600–$101,500/yr) — faster than average (+5-6%); ~52,200 US openings/yr.'),
  ('bay-area-sheet', 'supply-chain-mission', 'Supply Chain & Logistics',
   'Supply Chain & Automated Logistics', 'Mission College', 'Santa Clara, CA', false,
   'training', '2 semesters', '~$1,000',
   'Leads to: Logistics/Supply Chain Coordinator ($76,500–$76,900/yr) — Bay Area wages ~22% above CA median; steady demand. Logistician/Supply Chain Analyst ($101,000–$115,600/yr) — Bright Outlook, +7%+ growth; ~26,400 US openings/yr. Buyer/Purchasing Agent ($93,600–$101,500/yr) — faster than average (+5-6%); ~52,200 US openings/yr.'),

  -- Legal -----------------------------------------------------------------
  ('bay-area-sheet', 'paralegal-sfsu', 'Legal',
   'Paralegal Program', 'San Francisco State University (SFSU)', 'San Francisco, CA', false,
   'training', '1 year', '$9,000 · FAFSA',
   'Leads to: Paralegal/Legal Assistant ($84,000–$99,250/yr) — flat nationally but ~39,300 US openings/yr (turnover); strong Bay Area pay premium.'),

  -- Trades ----------------------------------------------------------------
  ('bay-area-sheet', 'hvacr-laney', 'Trades',
   'HVAC/R Technology', 'Laney College', 'Oakland, CA', false,
   'training', '8-12 months', '$2,400-$3,200 · FAFSA',
   'Leads to: HVAC/R Technician ($78,500–$82,050/yr) — Bright Outlook, +7%+ growth; ~40,100 US openings/yr.'),
  ('bay-area-sheet', 'hvacr-sjcc', 'Trades',
   'HVAC/R Technology', 'San Jose City College', 'San Jose, CA', false,
   'training', '2 semesters', '~$1,200 · FAFSA',
   'Leads to: HVAC/R Technician ($78,500–$82,050/yr) — Bright Outlook, +7%+ growth; ~40,100 US openings/yr.'),
  ('bay-area-sheet', 'construction-cypress-mandela', 'Trades',
   'Construction Pre-Apprenticeship', 'Cypress Mandela Inc.', 'Oakland, CA', false,
   'apprenticeship', '16 weeks', 'Free',
   'Leads to: Construction Laborer ($68,500–$72,600/yr) — much faster than average, +7%+; ~129,400 US openings/yr.')

ON CONFLICT (source, external_id) DO UPDATE SET
  industry      = EXCLUDED.industry,
  title         = EXCLUDED.title,
  provider      = EXCLUDED.provider,
  location      = EXCLUDED.location,
  remote        = EXCLUDED.remote,
  program_type  = EXCLUDED.program_type,
  duration_note = EXCLUDED.duration_note,
  cost_note     = EXCLUDED.cost_note,
  description   = EXCLUDED.description,
  updated_at    = now();
