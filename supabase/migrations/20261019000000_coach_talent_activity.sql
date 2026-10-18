-- =========================================================================
-- A coach's view of one of their talent: what's been shared with them,
-- what they bookmarked, and where they are with applications. Read-only
-- for the coach (the talent's own removals show on both sides); the coach
-- can add to Shared, including links to jobs on other sites.
--
--   shared_jobs      job_id becomes optional; external_* hold an outside
--                    listing (one of the two is required)
--   read policies    assigned coaches read shared_jobs, saved_jobs and
--                    job_applications for their talent (public.is_assigned)
--   share_external_job()  a coach or admin shares an outside link
-- =========================================================================

ALTER TABLE public.shared_jobs
  ALTER COLUMN job_id DROP NOT NULL,
  ADD COLUMN external_url TEXT CHECK (char_length(external_url) <= 2000),
  ADD COLUMN external_title TEXT CHECK (char_length(external_title) <= 300),
  ADD COLUMN external_company TEXT CHECK (char_length(external_company) <= 200),
  ADD COLUMN external_location TEXT CHECK (char_length(external_location) <= 200),
  ADD CONSTRAINT shared_jobs_job_or_link CHECK (job_id IS NOT NULL OR external_url IS NOT NULL),
  ADD CONSTRAINT shared_jobs_talent_external_url_key UNIQUE (talent_id, external_url);

CREATE POLICY "Assigned coaches read shared jobs" ON public.shared_jobs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'career_coach') AND public.is_assigned(auth.uid(), talent_id));

CREATE POLICY "Assigned coaches read saved jobs" ON public.saved_jobs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'career_coach') AND public.is_assigned(auth.uid(), user_id));

CREATE POLICY "Assigned coaches read applications" ON public.job_applications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'career_coach') AND public.is_assigned(auth.uid(), applicant_id));

-- Share a job listed somewhere else. Sharing the same link again refreshes
-- it and moves it back to the top, like share_job().
CREATE OR REPLACE FUNCTION public.share_external_job(
  _talent_id UUID,
  _url TEXT,
  _title TEXT,
  _company TEXT DEFAULT NULL,
  _location TEXT DEFAULT NULL,
  _note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN := public.has_role(auth.uid(), 'admin');
  sender TEXT;
  clean_url TEXT := btrim(coalesce(_url, ''));
  clean_title TEXT := nullif(left(btrim(coalesce(_title, '')), 300), '');
  clean_company TEXT := nullif(left(btrim(coalesce(_company, '')), 200), '');
  clean_location TEXT := nullif(left(btrim(coalesce(_location, '')), 200), '');
  clean_note TEXT := nullif(left(btrim(coalesce(_note, '')), 500), '');
  new_id UUID;
BEGIN
  IF NOT (is_admin OR public.has_role(auth.uid(), 'career_coach')) THEN
    RAISE EXCEPTION 'Coaches and admins only' USING ERRCODE = '42501';
  END IF;
  IF NOT (is_admin OR public.is_assigned(auth.uid(), _talent_id))
     OR NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = _talent_id AND ur.role = 'talent') THEN
    RAISE EXCEPTION 'You can only send jobs to your own talent' USING ERRCODE = '42501';
  END IF;
  IF clean_url !~* '^https?://[^[:space:]]+$' OR char_length(clean_url) > 2000 THEN
    RAISE EXCEPTION 'Enter the full link, starting with https://' USING ERRCODE = '22023';
  END IF;
  IF clean_title IS NULL THEN
    RAISE EXCEPTION 'Add the job title' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(nullif(btrim(p.username), ''),
                  CASE WHEN is_admin THEN 'Savant' ELSE 'Your career coach' END)
    INTO sender
    FROM profiles p WHERE p.id = auth.uid();
  sender := coalesce(sender, CASE WHEN is_admin THEN 'Savant' ELSE 'Your career coach' END);

  INSERT INTO shared_jobs (talent_id, shared_by, shared_by_name, note,
                           external_url, external_title, external_company, external_location)
  VALUES (_talent_id, auth.uid(), sender, clean_note,
          clean_url, clean_title, clean_company, clean_location)
  ON CONFLICT (talent_id, external_url) DO UPDATE SET
    shared_by = EXCLUDED.shared_by,
    shared_by_name = EXCLUDED.shared_by_name,
    note = EXCLUDED.note,
    external_title = EXCLUDED.external_title,
    external_company = EXCLUDED.external_company,
    external_location = EXCLUDED.external_location,
    created_at = now()
  RETURNING id INTO new_id;

  INSERT INTO notifications (user_id, kind, title, body, link)
  VALUES (_talent_id, 'job_shared', sender || ' sent you a job',
          clean_title || coalesce(' at ' || clean_company, '') || coalesce(': ' || clean_note, ''),
          '/talent');

  RETURN new_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.share_external_job(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_external_job(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
