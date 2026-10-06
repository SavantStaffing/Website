-- =========================================================================
-- Coaches and admins send jobs to talent.
--
--   shared_jobs              one row per (job, talent): who sent it, an
--                            optional note. The talent sees it on their
--                            dashboard ("Shared with you") and gets a
--                            notification.
--   share_job_recipients()   who the caller may send a job to, for the Share
--                            menu: admins — every talent; coaches — the
--                            talent assigned to them (is_assigned()).
--   share_job()              sends one job to several talent, checking each.
--
-- Rows are only written through share_job(), so a coach can't reach talent
-- who aren't theirs. The talent can remove a shared job from their list.
-- =========================================================================

CREATE TABLE public.shared_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  talent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Kept on the row: talent can't read staff profiles.
  shared_by_name TEXT NOT NULL CHECK (char_length(shared_by_name) <= 200),
  note TEXT CHECK (char_length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, talent_id)
);
CREATE INDEX shared_jobs_talent_idx ON public.shared_jobs (talent_id, created_at DESC);
CREATE INDEX shared_jobs_shared_by_idx ON public.shared_jobs (shared_by);

GRANT SELECT, DELETE ON public.shared_jobs TO authenticated;
GRANT ALL ON public.shared_jobs TO service_role;
ALTER TABLE public.shared_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Talent read jobs shared with them" ON public.shared_jobs
  FOR SELECT TO authenticated USING (talent_id = auth.uid());
CREATE POLICY "Talent remove jobs shared with them" ON public.shared_jobs
  FOR DELETE TO authenticated USING (talent_id = auth.uid());
CREATE POLICY "Staff read jobs they shared" ON public.shared_jobs
  FOR SELECT TO authenticated USING (shared_by = auth.uid());
CREATE POLICY "Admins read shared jobs" ON public.shared_jobs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Who the caller may send _job_id to, and who already has it.
CREATE OR REPLACE FUNCTION public.share_job_recipients(_job_id UUID)
RETURNS TABLE (
  talent_id UUID,
  display_name TEXT,
  detail TEXT,
  already_shared BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN := public.has_role(auth.uid(), 'admin');
BEGIN
  IF NOT (is_admin OR public.has_role(auth.uid(), 'career_coach')) THEN
    RAISE EXCEPTION 'Coaches and admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id,
         coalesce(
           nullif(trim(coalesce(tp.first_name, '') || ' ' || coalesce(tp.last_name, '')), ''),
           p.username,
           p.email,
           'Talent'
         ),
         nullif(coalesce(tp.current_title, tp.headline, ''), ''),
         EXISTS (SELECT 1 FROM shared_jobs s WHERE s.job_id = _job_id AND s.talent_id = p.id)
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'talent'
  LEFT JOIN talent_profiles tp ON tp.user_id = p.id
  WHERE is_admin OR public.is_assigned(auth.uid(), p.id)
  ORDER BY 2;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.share_job_recipients(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_job_recipients(UUID) TO authenticated;

-- Send one job to several talent. Returns how many were sent; talent the
-- caller may not reach are refused, not skipped silently.
CREATE OR REPLACE FUNCTION public.share_job(_job_id UUID, _talent_ids UUID[], _note TEXT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN := public.has_role(auth.uid(), 'admin');
  sender TEXT;
  job_label TEXT;
  clean_note TEXT := nullif(left(btrim(coalesce(_note, '')), 500), '');
  sent INTEGER;
BEGIN
  IF NOT (is_admin OR public.has_role(auth.uid(), 'career_coach')) THEN
    RAISE EXCEPTION 'Coaches and admins only' USING ERRCODE = '42501';
  END IF;
  IF coalesce(array_length(_talent_ids, 1), 0) = 0 THEN
    RETURN 0;
  END IF;
  IF array_length(_talent_ids, 1) > 200 THEN
    RAISE EXCEPTION 'Send to at most 200 people at once' USING ERRCODE = '22023';
  END IF;

  SELECT j.title || coalesce(' at ' || coalesce(j.company_name, o.name), '')
    INTO job_label
    FROM jobs j LEFT JOIN organizations o ON o.id = j.organization_id
    WHERE j.id = _job_id;
  IF job_label IS NULL THEN
    RAISE EXCEPTION 'Job not found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(_talent_ids) t(id)
    WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = t.id AND ur.role = 'talent')
       OR NOT (is_admin OR public.is_assigned(auth.uid(), t.id))
  ) THEN
    RAISE EXCEPTION 'You can only send jobs to your own talent' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(nullif(btrim(p.username), ''),
                  CASE WHEN is_admin THEN 'Savant' ELSE 'Your career coach' END)
    INTO sender
    FROM profiles p WHERE p.id = auth.uid();
  sender := coalesce(sender, CASE WHEN is_admin THEN 'Savant' ELSE 'Your career coach' END);

  -- Sending again refreshes the note and moves it back to the top.
  INSERT INTO shared_jobs (job_id, talent_id, shared_by, shared_by_name, note)
  SELECT DISTINCT _job_id, t.id, auth.uid(), sender, clean_note
  FROM unnest(_talent_ids) t(id)
  ON CONFLICT (job_id, talent_id) DO UPDATE SET
    shared_by = EXCLUDED.shared_by,
    shared_by_name = EXCLUDED.shared_by_name,
    note = EXCLUDED.note,
    created_at = now();
  GET DIAGNOSTICS sent = ROW_COUNT;

  INSERT INTO notifications (user_id, kind, title, body, link)
  SELECT DISTINCT t.id, 'job_shared', sender || ' sent you a job',
         job_label || coalesce(': ' || clean_note, ''), '/talent'
  FROM unnest(_talent_ids) t(id);

  RETURN sent;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.share_job(UUID, UUID[], TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_job(UUID, UUID[], TEXT) TO authenticated;
