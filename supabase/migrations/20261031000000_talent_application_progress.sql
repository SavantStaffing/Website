-- Separate talent-managed progress from recruiter-controlled application status.
ALTER TABLE public.job_applications
 ADD COLUMN IF NOT EXISTS talent_progress TEXT
 CHECK (talent_progress IN ('incomplete', 'in_progress', 'complete'));
UPDATE public.job_applications
 SET talent_progress = CASE WHEN status IN ('tracked','started') THEN 'incomplete' ELSE 'complete' END
 WHERE talent_progress IS NULL;
ALTER TABLE public.job_applications ALTER COLUMN talent_progress SET DEFAULT 'incomplete';
ALTER TABLE public.job_applications ALTER COLUMN talent_progress SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_application_talent_progress(application_id UUID, progress TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
 IF progress NOT IN ('incomplete', 'in_progress', 'complete') OR progress IS NULL THEN
  RAISE EXCEPTION 'Invalid application progress';
 END IF;
 UPDATE public.job_applications SET talent_progress = progress
 WHERE id = application_id AND applicant_id = auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_application_talent_progress(UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_application_talent_progress(UUID,TEXT) TO authenticated;
