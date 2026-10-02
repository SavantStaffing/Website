-- Partners Personnel's job board (jobs.partnerspersonnel.com) doesn't publish
-- posting dates, and the job feed leaves out listings without one. For that
-- board, use the date the Job Scout first saw the listing instead.
--
-- Done in the database rather than in the scanner so every scanner that
-- writes jobs (the job-scout Edge Function, the app's /api/scout/run, Lovable
-- Cloud's scheduler) gets it without a redeploy. first_seen_at defaults to
-- now() on insert and scans never send it, so it's the true first sighting.
-- Add a source to the list to give its undated listings the same treatment.

CREATE OR REPLACE FUNCTION public.jobs_first_seen_as_posted_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.posted_at IS NULL AND NEW.source = ANY (ARRAY['partners']) THEN
    NEW.posted_at := COALESCE(
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.posted_at END,
      NEW.first_seen_at,
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_first_seen_as_posted_at ON public.jobs;
CREATE TRIGGER jobs_first_seen_as_posted_at
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_first_seen_as_posted_at();

-- Listings already saved without a date.
UPDATE public.jobs
SET posted_at = first_seen_at
WHERE source = 'partners' AND posted_at IS NULL;
