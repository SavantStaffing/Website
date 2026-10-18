-- =========================================================================
-- Meeting requests: a coach asks one of their talent to meet.
--
--   kind 'intro'   — introductory meeting (no description needed)
--   kind 'general' — general meeting, with a description the coach writes
--
--   The coach offers exactly three times; the talent picks one (accepted,
--   chosen_at = that time) or says none work (declined, with an optional
--   note). The coach can cancel while it's pending or after it's accepted.
--   Accepted meetings appear on both people's calendars (calendar_events_for).
--
--   Only coaches assigned to the talent (public.is_assigned) can ask.
--   Responses and cancellations go through the functions below, so a
--   talent can only pick one of the offered times.
-- =========================================================================

CREATE TABLE public.meeting_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  talent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('intro', 'general')),
  description TEXT CHECK (char_length(description) <= 1000),
  options TIMESTAMPTZ[] NOT NULL CHECK (array_length(options, 1) = 3),
  duration_minutes INT NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 15 AND 240),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  chosen_at TIMESTAMPTZ,
  talent_note TEXT CHECK (char_length(talent_note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CHECK (kind = 'intro' OR nullif(btrim(description), '') IS NOT NULL),
  CHECK (status <> 'accepted' OR chosen_at = ANY (options))
);
CREATE INDEX meeting_requests_talent_idx ON public.meeting_requests (talent_id, status);
CREATE INDEX meeting_requests_requester_idx ON public.meeting_requests (requester_id, status);

ALTER TABLE public.meeting_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meeting_requests FROM anon, authenticated;
GRANT SELECT, INSERT ON public.meeting_requests TO authenticated;
GRANT ALL ON public.meeting_requests TO service_role;

CREATE POLICY "Participants and admins read meeting requests" ON public.meeting_requests
  FOR SELECT TO authenticated
  USING (auth.uid() IN (requester_id, talent_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Assigned coaches request meetings" ON public.meeting_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND status = 'pending'
    AND chosen_at IS NULL
    AND (public.has_role(auth.uid(), 'career_coach') OR public.has_role(auth.uid(), 'admin'))
    AND public.is_assigned(auth.uid(), talent_id)
    AND (SELECT bool_and(o > now()) FROM unnest(options) AS o)
  );

-- Talent: pick one of the offered times, or decline (_choice NULL).
CREATE OR REPLACE FUNCTION public.respond_meeting_request(_id UUID, _choice TIMESTAMPTZ, _note TEXT DEFAULT NULL)
RETURNS public.meeting_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.meeting_requests;
BEGIN
  SELECT * INTO r FROM public.meeting_requests WHERE id = _id FOR UPDATE;
  IF r.id IS NULL OR r.talent_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Meeting request not found';
  END IF;
  IF r.status <> 'pending' THEN
    RAISE EXCEPTION 'This request has already been answered';
  END IF;
  IF _choice IS NOT NULL AND NOT (_choice = ANY (r.options)) THEN
    RAISE EXCEPTION 'Pick one of the offered times';
  END IF;
  UPDATE public.meeting_requests
  SET status = CASE WHEN _choice IS NULL THEN 'declined' ELSE 'accepted' END,
      chosen_at = _choice,
      talent_note = nullif(left(btrim(coalesce(_note, '')), 500), ''),
      responded_at = now()
  WHERE id = _id
  RETURNING * INTO r;
  RETURN r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.respond_meeting_request(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_meeting_request(UUID, TIMESTAMPTZ, TEXT) TO authenticated;

-- Coach (or admin): cancel a pending or accepted request.
CREATE OR REPLACE FUNCTION public.cancel_meeting_request(_id UUID)
RETURNS public.meeting_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.meeting_requests;
BEGIN
  SELECT * INTO r FROM public.meeting_requests WHERE id = _id FOR UPDATE;
  IF r.id IS NULL OR NOT (r.requester_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Meeting request not found';
  END IF;
  IF r.status NOT IN ('pending', 'accepted') THEN
    RAISE EXCEPTION 'This request is already closed';
  END IF;
  UPDATE public.meeting_requests SET status = 'cancelled', responded_at = now()
  WHERE id = _id RETURNING * INTO r;
  RETURN r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cancel_meeting_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_meeting_request(UUID) TO authenticated;

-- Notifications both ways.
CREATE OR REPLACE FUNCTION public.notify_meeting_request()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  what TEXT := CASE NEW.kind WHEN 'intro' THEN 'Introductory meeting' ELSE 'Meeting' END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link, actions)
    VALUES (
      NEW.talent_id, 'meeting_request',
      what || ' request from ' || public.display_name(NEW.requester_id),
      coalesce(NEW.description || E'\n\n', '')
        || 'Options: ' || public.format_pt(NEW.options[1]) || ' · '
        || public.format_pt(NEW.options[2]) || ' · ' || public.format_pt(NEW.options[3]),
      '/talent',
      jsonb_build_array(jsonb_build_object('label', 'Choose a time', 'to', '/talent'))
    );
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'accepted' THEN
      INSERT INTO public.notifications (user_id, kind, title, body, link)
      VALUES (
        NEW.requester_id, 'meeting_accepted',
        public.display_name(NEW.talent_id) || ' accepted: ' || public.format_pt(NEW.chosen_at),
        what || '. It''s on your calendar.' || coalesce(E'\n\n' || NEW.talent_note, ''),
        '/coach/schedule'
      );
    ELSIF NEW.status = 'declined' THEN
      INSERT INTO public.notifications (user_id, kind, title, body, link)
      VALUES (
        NEW.requester_id, 'meeting_declined',
        public.display_name(NEW.talent_id) || ' couldn''t make those times',
        coalesce(NEW.talent_note, 'Send a new request with other times.'),
        '/coach/schedule'
      );
    ELSIF NEW.status = 'cancelled' THEN
      INSERT INTO public.notifications (user_id, kind, title, body, link)
      VALUES (
        NEW.talent_id, 'meeting_cancelled',
        what || ' with ' || public.display_name(NEW.requester_id) || ' was cancelled',
        CASE WHEN NEW.chosen_at IS NOT NULL THEN 'It was set for ' || public.format_pt(NEW.chosen_at) || '.' END,
        '/talent'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_meeting_request() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER meeting_requests_notify
  AFTER INSERT OR UPDATE ON public.meeting_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_meeting_request();

-- Accepted meetings on both calendars (same as 20261012000001, plus meetings).
CREATE OR REPLACE FUNCTION public.calendar_events_for(_uid UUID, _from TIMESTAMPTZ, _to TIMESTAMPTZ)
RETURNS TABLE(id TEXT, kind TEXT, title TEXT, starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, location TEXT, notes TEXT, link TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT _uid AS uid,
           public.has_role(_uid, 'admin') AS is_admin,
           public.chat_role(_uid) AS role,
           public.own_organization_id(_uid) AS org
  )
  SELECT 'event-' || e.id, 'event', e.title, e.starts_at, e.ends_at, e.location, e.notes, NULL::text
  FROM calendar_events e, me
  WHERE e.owner_id = me.uid AND e.starts_at < _to AND e.ends_at > _from

  UNION ALL
  SELECT 'session-' || r.id, 'session',
         CASE r.service
           WHEN 'career_programs' THEN 'Career program session'
           WHEN 'resume_building' THEN 'Resume Building session'
           WHEN 'interview_development' THEN 'Interview Development session'
           WHEN 'job_fairs' THEN 'Job Fairs session'
           ELSE 'Coaching session' END
           || CASE
                WHEN r.talent_id = me.uid AND r.assigned_coach_id IS NOT NULL THEN ' with ' || public.chat_name(r.assigned_coach_id)
                WHEN r.talent_id <> me.uid THEN ' with ' || public.chat_name(r.talent_id)
                ELSE '' END,
         r.scheduled_at, r.scheduled_at + interval '1 hour',
         substring(r.schedule_note FROM 'https?://[^[:space:]]+'),
         r.schedule_note,
         CASE WHEN me.role = 'career_coach' THEN '/coach/schedule'
              WHEN me.is_admin THEN '/admin/schedule'
              ELSE '/talent' END
  FROM service_requests r, me
  WHERE r.scheduled_at IS NOT NULL AND r.status <> 'cancelled'
    AND r.scheduled_at >= _from - interval '1 hour' AND r.scheduled_at < _to
    AND (r.talent_id = me.uid OR r.assigned_coach_id = me.uid OR me.is_admin)

  UNION ALL
  SELECT 'interview-' || a.id, 'interview',
         'Interview: ' || coalesce(j.title, 'role')
           || CASE WHEN a.applicant_id = me.uid
                   THEN coalesce(' at ' || j.company_name, '')
                   ELSE ' with ' || public.chat_name(a.applicant_id) END,
         a.interview_at, a.interview_at + interval '45 minutes',
         substring(a.interview_note FROM 'https?://[^[:space:]]+'),
         a.interview_note,
         CASE WHEN a.applicant_id = me.uid THEN '/talent/applications'
              WHEN me.is_admin THEN '/admin/schedule'
              ELSE '/recruiter/schedule' END
  FROM job_applications a
  JOIN jobs j ON j.id = a.job_id, me
  WHERE a.interview_at IS NOT NULL
    AND a.interview_at >= _from - interval '45 minutes' AND a.interview_at < _to
    AND (a.applicant_id = me.uid
         OR j.posted_by = me.uid
         OR (me.role = 'recruiter' AND me.org IS NOT NULL AND j.organization_id = me.org)
         OR me.is_admin)

  UNION ALL
  SELECT 'meeting-' || m.id, 'meeting',
         CASE m.kind WHEN 'intro' THEN 'Introductory meeting' ELSE 'Meeting' END
           || ' with ' || public.chat_name(CASE WHEN m.talent_id = me.uid THEN m.requester_id ELSE m.talent_id END),
         m.chosen_at, m.chosen_at + make_interval(mins => m.duration_minutes),
         substring(m.description FROM 'https?://[^[:space:]]+'),
         m.description,
         CASE WHEN m.talent_id = me.uid THEN '/talent' ELSE '/coach/schedule' END
  FROM meeting_requests m, me
  WHERE m.status = 'accepted' AND m.chosen_at IS NOT NULL
    AND m.chosen_at + make_interval(mins => m.duration_minutes) > _from AND m.chosen_at < _to
    AND (m.talent_id = me.uid OR m.requester_id = me.uid OR me.is_admin)
  ORDER BY 4
$$;
