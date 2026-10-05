-- =========================================================================
-- Talent can track applications to jobs that aren't in Savant's feed by
-- pasting the posting's URL, and can archive any application on their list.
--
-- A pasted application has no job_id; its title/company are read from the
-- page and stored on the row. Recruiters never see these rows: their read
-- policy joins through jobs, which a pasted application doesn't have.
-- =========================================================================

ALTER TABLE public.job_applications ALTER COLUMN job_id DROP NOT NULL;

ALTER TABLE public.job_applications
  ADD COLUMN external_url TEXT CHECK (char_length(external_url) <= 2000),
  ADD COLUMN external_title TEXT CHECK (char_length(external_title) <= 300),
  ADD COLUMN external_company TEXT CHECK (char_length(external_company) <= 200),
  ADD COLUMN external_location TEXT CHECK (char_length(external_location) <= 200),
  ADD COLUMN archived_at TIMESTAMPTZ,
  ADD CONSTRAINT job_applications_job_or_url_check
    CHECK (job_id IS NOT NULL OR external_url IS NOT NULL),
  ADD CONSTRAINT job_applications_applicant_external_url_key
    UNIQUE (applicant_id, external_url);

-- Talent have no UPDATE policy on job_applications (status belongs to
-- recruiters), so archiving goes through this function, which can only
-- touch archived_at on the caller's own row.
CREATE OR REPLACE FUNCTION public.set_application_archived(application_id UUID, archived BOOLEAN)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.job_applications
  SET archived_at = CASE WHEN archived THEN now() ELSE NULL END
  WHERE id = application_id AND applicant_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.set_application_archived(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_application_archived(UUID, BOOLEAN) TO authenticated;

-- The "Completed" button: the talent finished applying on the company's site.
-- Only moves tracked/started → submitted, so it can never overwrite a status
-- a recruiter has set.
CREATE OR REPLACE FUNCTION public.mark_application_completed(application_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.job_applications
  SET status = 'submitted'
  WHERE id = application_id AND applicant_id = auth.uid() AND status IN ('tracked', 'started');
$$;
REVOKE EXECUTE ON FUNCTION public.mark_application_completed(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_application_completed(UUID) TO authenticated;
