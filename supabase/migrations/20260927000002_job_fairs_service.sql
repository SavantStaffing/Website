-- Preparation: a fourth service, Job Fairs, that talent can sign up for.
ALTER TABLE public.service_requests DROP CONSTRAINT IF EXISTS service_requests_service_check;
ALTER TABLE public.service_requests ADD CONSTRAINT service_requests_service_check
  CHECK (service IN ('career_programs', 'resume_building', 'interview_development', 'job_fairs'));
