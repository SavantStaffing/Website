-- =========================================================================
-- /careers: two public feeds, both organised by industry.
--
--   career_programs — training, apprenticeships, certifications and similar
--                     programs run by other organisations.
--   career_events   — local job fairs, networking nights, workshops.
--
-- Nothing fills these yet. (source, external_id) is there so a later ingest
-- can upsert; rows an admin adds by hand use source 'manual' and no id.
-- `industry` uses the same sector names as jobs.industry.
-- =========================================================================

CREATE TABLE public.career_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) <= 300),
  provider TEXT CHECK (char_length(provider) <= 200),
  industry TEXT CHECK (char_length(industry) <= 100),
  program_type TEXT NOT NULL DEFAULT 'training'
    CHECK (program_type IN ('training', 'apprenticeship', 'certification', 'bootcamp', 'internship', 'fellowship', 'other')),
  location TEXT CHECK (char_length(location) <= 200),
  remote BOOLEAN NOT NULL DEFAULT false,
  description TEXT CHECK (char_length(description) <= 5000),
  url TEXT CHECK (char_length(url) <= 2000),
  cost_note TEXT CHECK (char_length(cost_note) <= 200),       -- "Free", "Paid, $22/hr", "$4,500"
  duration_note TEXT CHECK (char_length(duration_note) <= 200), -- "12 weeks, evenings"
  apply_by DATE,
  starts_on DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'draft')),
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);
CREATE INDEX career_programs_feed_idx ON public.career_programs (status, industry, created_at DESC);

CREATE TABLE public.career_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) <= 300),
  organizer TEXT CHECK (char_length(organizer) <= 200),
  industry TEXT CHECK (char_length(industry) <= 100),
  event_type TEXT NOT NULL DEFAULT 'networking'
    CHECK (event_type IN ('job_fair', 'networking', 'workshop', 'info_session', 'conference', 'other')),
  venue TEXT CHECK (char_length(venue) <= 200),
  location TEXT CHECK (char_length(location) <= 200),          -- "Oakland, CA"
  virtual BOOLEAN NOT NULL DEFAULT false,
  description TEXT CHECK (char_length(description) <= 5000),
  url TEXT CHECK (char_length(url) <= 2000),
  cost_note TEXT CHECK (char_length(cost_note) <= 200),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'draft')),
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);
CREATE INDEX career_events_feed_idx ON public.career_events (status, starts_at);

GRANT SELECT ON public.career_programs, public.career_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_programs, public.career_events TO authenticated;
GRANT ALL ON public.career_programs, public.career_events TO service_role;
ALTER TABLE public.career_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_events ENABLE ROW LEVEL SECURITY;

-- Anyone can read what's live; only admins see drafts or change anything.
CREATE POLICY "Public reads active programs" ON public.career_programs
  FOR SELECT TO anon, authenticated
  USING (status = 'active' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage programs" ON public.career_programs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public reads active events" ON public.career_events
  FOR SELECT TO anon, authenticated
  USING (status = 'active' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage events" ON public.career_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
