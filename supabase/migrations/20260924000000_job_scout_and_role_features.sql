-- =========================================================================
-- Job Scout Agent + role features from the architecture diagram.
--
--   Job Scout:  scout_companies (config table of companies + ATS endpoints),
--               scout_runs / scout_source_metrics (admin diagnostics),
--               new columns on jobs for ingested postings + ghost detection.
--   Talent:     talent_profiles (autofill + recruiter-facing profile),
--               talent_preferences (feed refine parameters), saved_answers,
--               autofill_plans.
--   Recruiter:  saved_talent, application_requests (→ notification to talent),
--               org permission levels + point of contact.
--   Shared:     notifications, contact_messages.
--
-- Same rule as the first migration: RLS is the authorization boundary, the
-- frontend's `can()` checks are presentation only.
-- =========================================================================

-- -------------------------------------------------------------------------
-- jobs: allow postings that came from the scout (no Savant poster / org)
-- -------------------------------------------------------------------------
ALTER TABLE public.jobs ALTER COLUMN posted_by DROP NOT NULL;
ALTER TABLE public.jobs ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.jobs
  ADD COLUMN source TEXT NOT NULL DEFAULT 'manual',          -- manual | greenhouse | lever | ashby | smartrecruiters | workable
  ADD COLUMN external_id TEXT,                               -- the ATS's own id for the posting
  ADD COLUMN scout_company_id UUID,                          -- FK added below, after scout_companies exists
  ADD COLUMN company_name TEXT,
  ADD COLUMN apply_url TEXT,
  ADD COLUMN department TEXT,
  ADD COLUMN industry TEXT,
  ADD COLUMN naics_code TEXT,
  ADD COLUMN employment_type TEXT,                           -- full_time | part_time | temporary | contract | internship
  ADD COLUMN seniority TEXT,                                 -- intern | entry | mid | senior | lead | executive
  ADD COLUMN remote BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN posted_at TIMESTAMPTZ,
  ADD COLUMN first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active',          -- active | closed | flagged
  ADD COLUMN ghost_score INTEGER NOT NULL DEFAULT 0,         -- 0–100, higher = more likely a ghost posting
  ADD COLUMN ghost_reasons TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN ghost_override BOOLEAN NOT NULL DEFAULT false,  -- admin said "this one is real"; never auto-flag again
  ADD COLUMN fingerprint TEXT;                               -- company+title+location hash, catches reposts

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_status_check CHECK (status IN ('active', 'closed', 'flagged')),
  ADD CONSTRAINT jobs_ghost_score_check CHECK (ghost_score BETWEEN 0 AND 100);

-- A plain constraint (not a partial index) so PostgREST upserts can target it.
-- NULL external_ids (manual postings) never collide with each other.
ALTER TABLE public.jobs ADD CONSTRAINT jobs_source_external_id_key UNIQUE (source, external_id);
CREATE INDEX jobs_status_posted_idx ON public.jobs (status, posted_at DESC);
CREATE INDEX jobs_fingerprint_idx ON public.jobs (fingerprint);

-- Talent and guests can't read organizations (RLS), so the company name a
-- feed shows lives on the job itself. Fill it from the org for Savant postings.
CREATE OR REPLACE FUNCTION public.fill_job_company_name()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.company_name IS NULL AND NEW.organization_id IS NOT NULL THEN
    SELECT name INTO NEW.company_name FROM public.organizations WHERE id = NEW.organization_id;
  END IF;
  IF NEW.posted_at IS NULL AND NEW.source = 'manual' THEN
    NEW.posted_at := now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fill_job_company_name() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER jobs_fill_company_name BEFORE INSERT OR UPDATE OF organization_id ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.fill_job_company_name();

-- Existing rows are Savant-posted; give them sane values.
UPDATE public.jobs j SET
  posted_at = coalesce(j.posted_at, j.created_at),
  company_name = coalesce(j.company_name, (SELECT o.name FROM public.organizations o WHERE o.id = j.organization_id));

-- -------------------------------------------------------------------------
-- organizations / profiles: recruiter permissions + company info
-- -------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN website TEXT,
  ADD COLUMN industry TEXT,
  ADD COLUMN naics_code TEXT,
  ADD COLUMN description TEXT,
  ADD COLUMN point_of_contact_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN org_permission TEXT NOT NULL DEFAULT 'member',  -- owner | manager | member | viewer
  ADD COLUMN email_notifications BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_org_permission_check
  CHECK (org_permission IN ('owner', 'manager', 'member', 'viewer'));

-- "Users update own profile" lets a user write any column of their own row,
-- which (before this migration) included organization_id — i.e. a user could
-- attach themselves to any company and read its applicants. Guard the
-- privileged columns: only an admin, or set_org_permission() below, may
-- change them.
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.org_permission IS DISTINCT FROM OLD.org_permission)
     AND auth.uid() IS NOT NULL                                   -- service role / SQL editor bypass
     AND NOT public.has_role(auth.uid(), 'admin')
     AND coalesce(current_setting('savant.permission_change', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Forbidden: organization and permission can only be changed by an admin or org owner';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_profile_privileged_columns() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_guard_privileged_columns BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- -------------------------------------------------------------------------
-- Job Scout: config + run history + per-source diagnostics
-- -------------------------------------------------------------------------
CREATE TABLE public.scout_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  careers_url TEXT,                        -- what the admin typed; the web scan reads this
  ats TEXT,                                -- greenhouse | lever | ashby | smartrecruiters | workable | NULL = not yet identified
  ats_token TEXT,                          -- board token / company slug the ATS endpoint takes
  industry TEXT,
  naics_code TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_scanned_at TIMESTAMPTZ,
  last_status TEXT,                        -- ok | no_ats | http_error | failed_audit
  last_error TEXT,
  last_pass_rate NUMERIC(5, 2),            -- auditor: % of postings that passed schema validation
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ats, ats_token)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scout_companies TO authenticated;
GRANT ALL ON public.scout_companies TO service_role;
ALTER TABLE public.scout_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage scout companies" ON public.scout_companies
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER scout_companies_updated_at BEFORE UPDATE ON public.scout_companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_scout_company_id_fkey
  FOREIGN KEY (scout_company_id) REFERENCES public.scout_companies(id) ON DELETE SET NULL;

-- Single-row settings for the scout (row id is always 1).
CREATE TABLE public.scout_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled_boards TEXT[] NOT NULL DEFAULT '{}',       -- linkedin | indeed | google | glassdoor | zip_recruiter
  board_queries JSONB NOT NULL DEFAULT '[]',          -- [{"search_term": "warehouse", "location": "Atlanta, GA"}]
  ghost_threshold INTEGER NOT NULL DEFAULT 50 CHECK (ghost_threshold BETWEEN 1 AND 100),
  audit_threshold NUMERIC(3, 2) NOT NULL DEFAULT 0.80 CHECK (audit_threshold BETWEEN 0 AND 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.scout_settings (id) VALUES (1);
GRANT SELECT, UPDATE ON public.scout_settings TO authenticated;
GRANT ALL ON public.scout_settings TO service_role;
ALTER TABLE public.scout_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage scout settings" ON public.scout_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER scout_settings_updated_at BEFORE UPDATE ON public.scout_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.scout_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger TEXT NOT NULL,                   -- manual | scheduled
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running',  -- running | succeeded | partial | failed
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  companies_scanned INTEGER NOT NULL DEFAULT 0,
  jobs_found INTEGER NOT NULL DEFAULT 0,
  jobs_inserted INTEGER NOT NULL DEFAULT 0,
  jobs_updated INTEGER NOT NULL DEFAULT 0,
  jobs_rejected INTEGER NOT NULL DEFAULT 0,
  jobs_flagged INTEGER NOT NULL DEFAULT 0,
  jobs_closed INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
GRANT SELECT ON public.scout_runs TO authenticated;
GRANT ALL ON public.scout_runs TO service_role;
ALTER TABLE public.scout_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read scout runs" ON public.scout_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.scout_source_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.scout_runs(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  successes INTEGER NOT NULL DEFAULT 0,
  rate_limited INTEGER NOT NULL DEFAULT 0,
  status_counts JSONB NOT NULL DEFAULT '{}',   -- {"200": 12, "404": 1}
  avg_response_ms INTEGER,
  p95_response_ms INTEGER,
  proxy TEXT,                                  -- null = direct connection
  jobs_ingested INTEGER NOT NULL DEFAULT 0,
  schema_failures INTEGER NOT NULL DEFAULT 0,
  field_fill_rates JSONB NOT NULL DEFAULT '{}', -- {"location": 0.98, "department": 0.61}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scout_source_metrics TO authenticated;
GRANT ALL ON public.scout_source_metrics TO service_role;
ALTER TABLE public.scout_source_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read scout metrics" ON public.scout_source_metrics
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX scout_source_metrics_run_idx ON public.scout_source_metrics (run_id);

-- -------------------------------------------------------------------------
-- Talent: profile (autofill + recruiter-facing), feed preferences
-- -------------------------------------------------------------------------
CREATE TABLE public.talent_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  headline TEXT,
  location TEXT,
  current_company TEXT,
  current_title TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  linkedin_url TEXT,
  github_url TEXT,
  portfolio_url TEXT,
  resume_text TEXT,
  work_authorized BOOLEAN,
  needs_sponsorship BOOLEAN,
  salary_expectation TEXT,
  earliest_start TEXT,
  visible_to_recruiters BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.talent_profiles TO authenticated;
GRANT ALL ON public.talent_profiles TO service_role;
ALTER TABLE public.talent_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Talent manage own profile" ON public.talent_profiles
  FOR ALL TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'talent'));
-- Recruiters browse the talent feed; admins see everyone. Only visible profiles.
CREATE POLICY "Recruiters read visible talent" ON public.talent_profiles
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'recruiter') AND visible_to_recruiters)
  );
CREATE TRIGGER talent_profiles_updated_at BEFORE UPDATE ON public.talent_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.talent_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  positions TEXT[] NOT NULL DEFAULT '{}',        -- free-text titles, matched against job titles
  industries TEXT[] NOT NULL DEFAULT '{}',
  naics_codes TEXT[] NOT NULL DEFAULT '{}',
  locations TEXT[] NOT NULL DEFAULT '{}',
  employment_types TEXT[] NOT NULL DEFAULT '{}', -- full_time | part_time | temporary | contract | internship
  remote_ok BOOLEAN NOT NULL DEFAULT true,
  posted_within_days INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.talent_preferences TO authenticated;
GRANT ALL ON public.talent_preferences TO service_role;
ALTER TABLE public.talent_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Talent manage own preferences" ON public.talent_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read preferences" ON public.talent_preferences
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER talent_preferences_updated_at BEFORE UPDATE ON public.talent_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------
-- Autofill (ported from the Autofill prototype)
-- -------------------------------------------------------------------------
CREATE TABLE public.saved_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,                  -- normalized question label
  answer TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_answers TO authenticated;
GRANT ALL ON public.saved_answers TO service_role;
ALTER TABLE public.saved_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved answers" ON public.saved_answers
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.autofill_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  ats TEXT,
  job_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'filled',       -- filled | submitted
  fill_plan JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.autofill_plans TO authenticated;
GRANT ALL ON public.autofill_plans TO service_role;
ALTER TABLE public.autofill_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own autofill plans" ON public.autofill_plans
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- -------------------------------------------------------------------------
-- Recruiter: saved talent, application requests
-- -------------------------------------------------------------------------
CREATE TABLE public.saved_talent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  talent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recruiter_id, talent_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_talent TO authenticated;
GRANT ALL ON public.saved_talent TO service_role;
ALTER TABLE public.saved_talent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters manage own saved talent" ON public.saved_talent
  FOR ALL TO authenticated USING (recruiter_id = auth.uid())
  WITH CHECK (recruiter_id = auth.uid() AND public.has_role(auth.uid(), 'recruiter'));

CREATE TABLE public.application_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  talent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | accepted | declined
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE (job_id, talent_id),
  CONSTRAINT application_requests_status_check CHECK (status IN ('pending', 'accepted', 'declined'))
);
GRANT SELECT, INSERT, UPDATE ON public.application_requests TO authenticated;
GRANT ALL ON public.application_requests TO service_role;
ALTER TABLE public.application_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties read application requests" ON public.application_requests
  FOR SELECT TO authenticated USING (
    talent_id = auth.uid()
    OR recruiter_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id
        AND j.organization_id = public.own_organization_id(auth.uid())
        AND public.has_role(auth.uid(), 'recruiter')
    )
  );
-- A recruiter can only request an application for their own org's job, and
-- only from a talent whose profile is visible to recruiters.
CREATE POLICY "Recruiters request applications" ON public.application_requests
  FOR INSERT TO authenticated WITH CHECK (
    recruiter_id = auth.uid()
    AND public.has_role(auth.uid(), 'recruiter')
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id AND j.organization_id = public.own_organization_id(auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.talent_profiles tp
      WHERE tp.user_id = talent_id AND tp.visible_to_recruiters
    )
  );
CREATE POLICY "Talent responds to requests" ON public.application_requests
  FOR UPDATE TO authenticated USING (talent_id = auth.uid()) WITH CHECK (talent_id = auth.uid());

-- Recruiters can see the base profile (email/phone) of talent who accepted
-- one of their org's application requests — same rule as applicants.
CREATE POLICY "Recruiters read talent who accepted requests" ON public.profiles
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'recruiter')
    AND EXISTS (
      SELECT 1 FROM public.application_requests ar
      JOIN public.jobs j ON j.id = ar.job_id
      WHERE ar.talent_id = profiles.id
        AND ar.status = 'accepted'
        AND j.organization_id = public.own_organization_id(auth.uid())
    )
  );

-- -------------------------------------------------------------------------
-- Notifications — only ever written by SECURITY DEFINER triggers
-- -------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users mark own notifications read" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_application_request()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  job_title TEXT;
  org_name TEXT;
BEGIN
  SELECT j.title, o.name INTO job_title, org_name
  FROM public.jobs j LEFT JOIN public.organizations o ON o.id = j.organization_id
  WHERE j.id = NEW.job_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (
      NEW.talent_id, 'application_request',
      coalesce(org_name, 'A recruiter') || ' invited you to apply',
      'Role: ' || coalesce(job_title, 'a role') || coalesce(E'\n\n' || NEW.message, ''),
      '/talent'
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status AND NEW.status IN ('accepted', 'declined') THEN
    NEW.responded_at := now();
    INSERT INTO public.notifications (user_id, kind, title, link)
    VALUES (
      NEW.recruiter_id, 'application_request_' || NEW.status,
      'Your invitation for ' || coalesce(job_title, 'a role') || ' was ' || NEW.status,
      '/recruiter'
    );
    -- Accepting an invitation is applying.
    IF NEW.status = 'accepted' THEN
      INSERT INTO public.job_applications (job_id, applicant_id, status)
      VALUES (NEW.job_id, NEW.talent_id, 'submitted')
      ON CONFLICT (job_id, applicant_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_application_request() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER application_requests_insert_notify
  AFTER INSERT ON public.application_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_application_request();
CREATE TRIGGER application_requests_update_notify
  BEFORE UPDATE ON public.application_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_application_request();

-- -------------------------------------------------------------------------
-- Org permissions: owners/managers edit company info and team permissions
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.own_org_permission(_user_id UUID)
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT org_permission FROM public.profiles WHERE id = _user_id
$$;
REVOKE EXECUTE ON FUNCTION public.own_org_permission(uuid) FROM PUBLIC, anon;

-- The first migration only granted SELECT, so even the admin "manage
-- organizations" policy couldn't insert. RLS still decides who may write.
GRANT INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
CREATE POLICY "Org owners and managers edit company info" ON public.organizations
  FOR UPDATE TO authenticated USING (
    id = public.own_organization_id(auth.uid())
    AND public.has_role(auth.uid(), 'recruiter')
    AND public.own_org_permission(auth.uid()) IN ('owner', 'manager')
  ) WITH CHECK (id = public.own_organization_id(auth.uid()));

-- Teammates can see each other (needed for the permissions screen).
CREATE POLICY "Recruiters read own org teammates" ON public.profiles
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'recruiter')
    AND organization_id IS NOT NULL
    AND organization_id = public.own_organization_id(auth.uid())
  );

-- Changing a teammate's permission goes through this function; it's the only
-- non-admin path past guard_profile_privileged_columns().
CREATE OR REPLACE FUNCTION public.set_org_permission(_target UUID, _permission TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  caller_org UUID := public.own_organization_id(auth.uid());
BEGIN
  IF _permission NOT IN ('owner', 'manager', 'member', 'viewer') THEN
    RAISE EXCEPTION 'Invalid permission';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'recruiter') AND public.own_org_permission(auth.uid()) = 'owner')
  ) THEN
    RAISE EXCEPTION 'Forbidden: only an organization owner can change permissions';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin')
     AND (SELECT organization_id FROM public.profiles WHERE id = _target) IS DISTINCT FROM caller_org THEN
    RAISE EXCEPTION 'Forbidden: user is not on your team';
  END IF;
  PERFORM set_config('savant.permission_change', 'on', true);
  UPDATE public.profiles SET org_permission = _permission WHERE id = _target;
  PERFORM set_config('savant.permission_change', '', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_org_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_org_permission(uuid, text) TO authenticated;

-- -------------------------------------------------------------------------
-- Contact page
-- -------------------------------------------------------------------------
CREATE TABLE public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  company TEXT CHECK (char_length(company) <= 160),
  topic TEXT CHECK (char_length(topic) <= 60),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  handled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone sends a contact message" ON public.contact_messages
  FOR INSERT TO anon, authenticated WITH CHECK (handled = false);
CREATE POLICY "Admins manage contact messages" ON public.contact_messages
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Viewers are read-only: re-create the recruiter job-write policies from the
-- first migration with a permission check added.
DROP POLICY "Recruiters post jobs for own org" ON public.jobs;
DROP POLICY "Recruiters manage own org jobs" ON public.jobs;
DROP POLICY "Recruiters delete own org jobs" ON public.jobs;

CREATE POLICY "Recruiters post jobs for own org" ON public.jobs
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'recruiter')
    AND public.own_org_permission(auth.uid()) <> 'viewer'
    AND posted_by = auth.uid()
    AND source = 'manual'
    AND organization_id IS NOT NULL
    AND organization_id = public.own_organization_id(auth.uid())
  );
CREATE POLICY "Recruiters manage own org jobs" ON public.jobs
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'recruiter')
      AND public.own_org_permission(auth.uid()) <> 'viewer'
      AND organization_id = public.own_organization_id(auth.uid())
    )
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'recruiter')
      AND public.own_org_permission(auth.uid()) <> 'viewer'
      AND organization_id = public.own_organization_id(auth.uid())
    )
  );
CREATE POLICY "Recruiters delete own org jobs" ON public.jobs
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'recruiter')
      AND public.own_org_permission(auth.uid()) <> 'viewer'
      AND organization_id = public.own_organization_id(auth.uid())
    )
  );
