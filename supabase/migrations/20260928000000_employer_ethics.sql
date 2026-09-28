-- =========================================================================
-- Employer ethics, fetched live at validation (src/lib/scout/ethics.ts)
--
--   employer_ethics  cache of each employer's lookup, refreshed after 30 days:
--                    World Benchmarking Alliance Social Benchmark themes via
--                    Wikirate (CC BY 4.0), scaled 0–100 —
--                      fair_pay_score  (Theme B, provide & promote decent work)
--                      cultures_score  (Theme A, respect human rights)
--                      honest_score    (Theme C, act ethically)
--                    plus U.S. Department of Labor records at Bay Area
--                    addresses over the last 5 years (WHD wage cases, OSHA).
--   jobs.*_score     copied onto each posting for the feed filter / badges.
--   scout_settings   optional cutoffs; NULL = don't gate on that score.
--   scout_secrets    API keys for the scheduled scanner (service role only).
-- =========================================================================

CREATE TABLE public.employer_ethics (
  company_key TEXT PRIMARY KEY,                 -- normalized company name
  company_name TEXT NOT NULL,
  wikirate_company TEXT,
  wba_year INTEGER,
  fair_pay_score NUMERIC(5, 1) CHECK (fair_pay_score BETWEEN 0 AND 100),
  cultures_score NUMERIC(5, 1) CHECK (cultures_score BETWEEN 0 AND 100),
  honest_score NUMERIC(5, 1) CHECK (honest_score BETWEEN 0 AND 100),
  dol_checked BOOLEAN NOT NULL DEFAULT false,
  dol_wage_cases INTEGER NOT NULL DEFAULT 0,
  dol_back_wages NUMERIC(14, 2) NOT NULL DEFAULT 0,
  dol_employees_owed INTEGER NOT NULL DEFAULT 0,
  dol_repeat_violator BOOLEAN NOT NULL DEFAULT false,
  osha_inspections INTEGER NOT NULL DEFAULT 0,
  osha_serious_violations INTEGER NOT NULL DEFAULT 0,
  osha_penalties NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sources TEXT[] NOT NULL DEFAULT '{}',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.employer_ethics TO anon, authenticated;
GRANT ALL ON public.employer_ethics TO service_role;
ALTER TABLE public.employer_ethics ENABLE ROW LEVEL SECURITY;
-- Public-record data shown alongside jobs; anyone may read it.
CREATE POLICY "Employer ethics are public" ON public.employer_ethics
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.jobs
  ADD COLUMN fair_pay_score NUMERIC(5, 1),
  ADD COLUMN cultures_score NUMERIC(5, 1),
  ADD COLUMN honest_score NUMERIC(5, 1),
  ADD COLUMN ethics_summary JSONB;              -- WBA year + DOL/OSHA counts, for display

ALTER TABLE public.scout_settings
  ADD COLUMN ethics_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN ethics_min_fair_pay NUMERIC(5, 1),
  ADD COLUMN ethics_min_cultures NUMERIC(5, 1),
  ADD COLUMN ethics_min_honest NUMERIC(5, 1);

CREATE TABLE public.scout_secrets (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  dol_api_key TEXT,
  wikirate_api_key TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
REVOKE ALL ON public.scout_secrets FROM anon, authenticated;
GRANT ALL ON public.scout_secrets TO service_role;
ALTER TABLE public.scout_secrets ENABLE ROW LEVEL SECURITY;  -- no policies: service role only
INSERT INTO public.scout_secrets (id) VALUES (1) ON CONFLICT DO NOTHING;
