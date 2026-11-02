-- Savant Coach extension: every ghost-listing check a coach runs.
-- Rows are written by the server (service role) after /api/coach/check; coaches and
-- admins can read them. A listing's facts are not personal data, so checks are shared
-- between coaches: a second coach opening the same posting reuses the AI review.
CREATE TABLE public.coach_listing_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  url_key text NOT NULL,                 -- host + path, lowercase, no query/hash/trailing slash
  title text,
  company text,
  location text,
  read_from text NOT NULL CHECK (read_from IN ('page', 'sheet')),
  verdict text NOT NULL CHECK (verdict IN ('pass', 'no_pass')),
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  result jsonb NOT NULL,                 -- the full verdict: signals, checks, summary
  desc_hash text,                        -- sha-256 of the description the AI reviewed
  llm_signals jsonb,                     -- verified AI signals; null = AI review not run
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX coach_listing_checks_url_idx ON public.coach_listing_checks (url_key, created_at DESC);
CREATE INDEX coach_listing_checks_coach_idx ON public.coach_listing_checks (coach_id, created_at DESC);

ALTER TABLE public.coach_listing_checks ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.coach_listing_checks TO authenticated;
GRANT ALL ON public.coach_listing_checks TO service_role;

CREATE POLICY "Coaches view listing checks" ON public.coach_listing_checks
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'career_coach') OR public.has_role(auth.uid(), 'admin')
  );
