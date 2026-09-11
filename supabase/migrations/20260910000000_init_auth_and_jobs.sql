
-- =========================================================================
-- Types
-- =========================================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'talent', 'recruiter');

-- =========================================================================
-- Tables (all created before any RLS policy, since several policies below
-- reference more than one of these tables)
-- =========================================================================

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  location TEXT,
  type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.jobs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, applicant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_applications TO authenticated;
GRANT ALL ON public.job_applications TO service_role;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_jobs TO authenticated;
GRANT ALL ON public.saved_jobs TO service_role;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- Functions — the only places role/org membership are actually decided
-- =========================================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.own_organization_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id
$$;
REVOKE EXECUTE ON FUNCTION public.own_organization_id(uuid) FROM PUBLIC, anon;

-- Auto-create profile + role on signup. Role is taken from the signup form
-- (stored in auth.users.raw_user_meta_data->>'role' by supabase.auth.signUp),
-- defaulting to talent if omitted. Admin is never self-assignable here —
-- promote a user through the admin role-management page, which re-verifies
-- admin status server-side independently of this trigger.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requested_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'username')
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    requested_role := (NEW.raw_user_meta_data->>'role')::public.app_role;
  EXCEPTION WHEN OTHERS THEN
    requested_role := NULL;
  END;

  IF requested_role IS NULL OR requested_role = 'admin' THEN
    requested_role := 'talent';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, requested_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- Row Level Security — the real authorization boundary. The frontend's
-- role checks are a UX convenience; these policies are what actually stop
-- an unauthorized request, direct API call included.
-- =========================================================================

-- organizations: admins manage all; a member reads only their own org
CREATE POLICY "Admins manage organizations" ON public.organizations
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members read own organization" ON public.organizations
  FOR SELECT TO authenticated USING (id = public.own_organization_id(auth.uid()));

-- profiles: self, admin, or a recruiter viewing a talent who applied to their org's job
CREATE POLICY "Users read authorized profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    auth.uid() = id
    OR public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'recruiter')
      AND EXISTS (
        SELECT 1 FROM public.job_applications ja
        JOIN public.jobs j ON j.id = ja.job_id
        WHERE ja.applicant_id = profiles.id
          AND j.organization_id = public.own_organization_id(auth.uid())
      )
    )
  );
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles: read own or admin; write ADMIN ONLY. This is what makes role
-- escalation impossible from the client — no policy here ever lets a user
-- grant themselves a role, no matter what the frontend sends.
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- jobs: public read; write scoped to the recruiter's own organization (not just
-- their own postings — any recruiter on the same org/team can manage it, which
-- is what lets a future "team member" role slot in without a schema rewrite)
CREATE POLICY "Anyone reads jobs" ON public.jobs
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Recruiters post jobs for own org" ON public.jobs
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'recruiter')
    AND posted_by = auth.uid()
    AND organization_id IS NOT NULL
    AND organization_id = public.own_organization_id(auth.uid())
  );
CREATE POLICY "Recruiters manage own org jobs" ON public.jobs
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'recruiter') AND organization_id = public.own_organization_id(auth.uid()))
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'recruiter') AND organization_id = public.own_organization_id(auth.uid()))
  );
CREATE POLICY "Recruiters delete own org jobs" ON public.jobs
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'recruiter') AND organization_id = public.own_organization_id(auth.uid()))
  );

-- job_applications: applicant, admin, or a recruiter whose org owns the job
CREATE POLICY "Applicants and org recruiters read applications" ON public.job_applications
  FOR SELECT TO authenticated USING (
    applicant_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id
        AND j.organization_id = public.own_organization_id(auth.uid())
        AND public.has_role(auth.uid(), 'recruiter')
    )
  );
CREATE POLICY "Talent applies" ON public.job_applications
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'talent') AND applicant_id = auth.uid());
CREATE POLICY "Org recruiters update application status" ON public.job_applications
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id
        AND j.organization_id = public.own_organization_id(auth.uid())
        AND public.has_role(auth.uid(), 'recruiter')
    )
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id
        AND j.organization_id = public.own_organization_id(auth.uid())
        AND public.has_role(auth.uid(), 'recruiter')
    )
  );
CREATE POLICY "Applicants withdraw own applications" ON public.job_applications
  FOR DELETE TO authenticated USING (applicant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- saved_jobs: strictly own rows, and only a talent account can create one
CREATE POLICY "Users manage own saved jobs" ON public.saved_jobs
  FOR ALL TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'talent'));
