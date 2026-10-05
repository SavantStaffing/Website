-- Fair-chance roles: jobs open to people with a felony conviction.
--
--   fair_chance_employers      the list that decides it. A row is either a job
--                              source (every listing from that source counts,
--                              e.g. the temp apps) or a company name.
--   jobs.fair_chance           set by trigger from that list on every write, so
--                              every scanner gets it without a redeploy.
--   jobs.fair_chance_override  an admin's yes/no for one listing; wins over the list.
--   talent_private_preferences the talent's "only show fair-chance roles" choice.
--                              Kept out of talent_preferences on purpose: admins
--                              and assigned coaches/recruiters can read that
--                              table, and nobody but the talent should be able
--                              to tell they ticked this.
--
-- To grow the list later:
--   INSERT INTO public.fair_chance_employers (kind, match_key, display_name)
--   VALUES ('company', 'acme logistics', 'Acme Logistics');
-- Listings re-flag themselves when the list changes.

CREATE TABLE public.fair_chance_employers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('source', 'company')),
  -- source: jobs.source. company: lower-cased, trimmed jobs.company_name.
  match_key TEXT NOT NULL CHECK (match_key = lower(btrim(match_key)) AND match_key <> ''),
  display_name TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, match_key)
);
GRANT SELECT ON public.fair_chance_employers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fair_chance_employers TO authenticated;
GRANT ALL ON public.fair_chance_employers TO service_role;
ALTER TABLE public.fair_chance_employers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads fair-chance employers" ON public.fair_chance_employers
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage fair-chance employers" ON public.fair_chance_employers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.fair_chance_employers (kind, match_key, display_name) VALUES
  ('source', 'bluecrew', 'Bluecrew'),
  ('source', 'instawork', 'Instawork'),
  ('source', 'workwhile', 'WorkWhile');

ALTER TABLE public.jobs
  ADD COLUMN fair_chance BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN fair_chance_override BOOLEAN;
CREATE INDEX jobs_fair_chance_idx ON public.jobs (fair_chance) WHERE fair_chance;

CREATE OR REPLACE FUNCTION public.is_fair_chance(_source TEXT, _company TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fair_chance_employers e
    WHERE (e.kind = 'source' AND e.match_key = lower(btrim(_source)))
       OR (e.kind = 'company' AND e.match_key = lower(btrim(_company)))
  );
$$;

CREATE OR REPLACE FUNCTION public.jobs_set_fair_chance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.fair_chance := COALESCE(
    NEW.fair_chance_override,
    public.is_fair_chance(NEW.source, NEW.company_name)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER jobs_set_fair_chance
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_set_fair_chance();

-- When the list changes, re-flag the listings it touches.
CREATE OR REPLACE FUNCTION public.fair_chance_reflag_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.jobs j
  SET fair_chance = public.is_fair_chance(j.source, j.company_name)
  WHERE j.fair_chance_override IS NULL
    AND j.fair_chance IS DISTINCT FROM public.is_fair_chance(j.source, j.company_name);
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fair_chance_reflag_jobs() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER fair_chance_employers_reflag_jobs
  AFTER INSERT OR UPDATE OR DELETE ON public.fair_chance_employers
  FOR EACH STATEMENT EXECUTE FUNCTION public.fair_chance_reflag_jobs();

-- Listings already saved.
UPDATE public.jobs SET fair_chance = true
WHERE public.is_fair_chance(source, company_name);

-- The talent's own choice; only they can read or change it.
CREATE TABLE public.talent_private_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fair_chance_only BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.talent_private_preferences TO authenticated;
GRANT ALL ON public.talent_private_preferences TO service_role;
ALTER TABLE public.talent_private_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Talent manage own private preferences" ON public.talent_private_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER talent_private_preferences_updated_at
  BEFORE UPDATE ON public.talent_private_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
