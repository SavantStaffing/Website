-- =========================================================================
-- 1. Help assistant usage limits
--      help_assistant_use()   counts one question for the caller; refuses
--                             past 20 an hour or 60 a day. Only counts are
--                             kept, never the questions.
--
-- 2. Calendar
--      calendar_events        personal events (owner only)
--      calendar_feeds         a private token per person for the calendar
--                             feed (subscribe from Google, Outlook, Apple)
--      calendar_events_for()  everything on one person's calendar:
--                               - their personal events
--                               - coaching sessions (talent, their coach)
--                               - interviews (talent; recruiters at the
--                                 hiring company or who posted the job)
--                               - admins: every session and interview
--      my_calendar()          the same for the signed-in user
--      rotate_calendar_feed() new feed token (the old link stops working)
--
-- 3. Intro message for recruiters and coaches: what the role is, how the hub
--    is laid out, the dashboard, and where to get help. Sent when the role is
--    granted, and once now to existing recruiters and coaches.
--
-- Needs 20261005000008 (notifications.actions), 20261007000001 (chat_name)
-- and 20261007000002 (staff_welcome).
-- =========================================================================

-- ---------------------------------------------------------------- 1. help
CREATE TABLE public.help_assistant_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX help_assistant_usage_idx ON public.help_assistant_usage (user_id, asked_at DESC);
ALTER TABLE public.help_assistant_usage ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.help_assistant_usage TO service_role;

CREATE OR REPLACE FUNCTION public.help_assistant_use()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN
    RETURN 'signed_out';
  END IF;
  IF (SELECT count(*) FROM help_assistant_usage WHERE user_id = me AND asked_at > now() - interval '1 hour') >= 20 THEN
    RETURN 'hour';
  END IF;
  IF (SELECT count(*) FROM help_assistant_usage WHERE user_id = me AND asked_at > now() - interval '1 day') >= 60 THEN
    RETURN 'day';
  END IF;
  INSERT INTO help_assistant_usage (user_id) VALUES (me);
  DELETE FROM help_assistant_usage WHERE user_id = me AND asked_at < now() - interval '2 days';
  RETURN 'ok';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.help_assistant_use() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.help_assistant_use() TO authenticated;

-- ---------------------------------------------------------------- 2. calendar
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  location TEXT CHECK (char_length(location) <= 500),
  notes TEXT CHECK (char_length(notes) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at AND ends_at - starts_at <= interval '7 days')
);
CREATE INDEX calendar_events_owner_idx ON public.calendar_events (owner_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their events" ON public.calendar_events
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.calendar_feeds (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.calendar_feeds TO authenticated;
GRANT ALL ON public.calendar_feeds TO service_role;
ALTER TABLE public.calendar_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own calendar feed" ON public.calendar_feeds
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Creates the caller's feed token, or replaces it (the old link stops working).
CREATE OR REPLACE FUNCTION public.rotate_calendar_feed()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t TEXT := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO calendar_feeds (user_id, token) VALUES (auth.uid(), t)
  ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token, created_at = now();
  RETURN t;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rotate_calendar_feed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_calendar_feed() TO authenticated;

-- Everything on one person's calendar between two times. Only the server
-- (feed) and my_calendar() call it.
CREATE OR REPLACE FUNCTION public.calendar_events_for(_uid UUID, _from TIMESTAMPTZ, _to TIMESTAMPTZ)
RETURNS TABLE (
  id TEXT,
  kind TEXT,
  title TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  location TEXT,
  notes TEXT,
  link TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT _uid AS uid,
           public.has_role(_uid, 'admin') AS is_admin,
           public.chat_role(_uid) AS role,
           public.own_organization_id(_uid) AS org
  )
  -- Personal events
  SELECT 'event-' || e.id, 'event', e.title, e.starts_at, e.ends_at, e.location, e.notes, NULL::text
  FROM calendar_events e, me
  WHERE e.owner_id = me.uid AND e.starts_at < _to AND e.ends_at > _from

  UNION ALL
  -- Coaching sessions
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
  -- Interviews
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
  ORDER BY 4
$$;
REVOKE EXECUTE ON FUNCTION public.calendar_events_for(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calendar_events_for(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION public.my_calendar(_from TIMESTAMPTZ, _to TIMESTAMPTZ)
RETURNS TABLE (
  id TEXT,
  kind TEXT,
  title TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  location TEXT,
  notes TEXT,
  link TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.calendar_events_for(auth.uid(), _from, least(_to, _from + interval '400 days'))
  WHERE auth.uid() IS NOT NULL
$$;
REVOKE EXECUTE ON FUNCTION public.my_calendar(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_calendar(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ---------------------------------------------------------------- 3. intro
CREATE OR REPLACE FUNCTION public.staff_intro_insert(_uid UUID, _role public.app_role)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM notifications WHERE user_id = _uid AND kind = 'intro_' || _role::text) THEN
    RETURN;
  END IF;
  IF _role = 'recruiter' THEN
    INSERT INTO notifications (user_id, kind, title, body, link, actions)
    VALUES (
      _uid, 'intro_recruiter', 'Your recruiter hub: the essentials',
      'Your role: find and hire talent for your company through Savant.'
        || E'\n\n' || 'Core workflows:'
        || E'\n' || '1. Post jobs (Jobs → Post a job). Applications arrive under Applications.'
        || E'\n' || '2. Find talent in the Talent Feed; save people and see talent assigned to you.'
        || E'\n' || '3. Request applications and résumés: Request application on a talent card, or ask in Chat.'
        || E'\n' || '4. Schedule interviews: move applicants to Interviewing, then set the time on Talent & Schedule.'
        || E'\n' || '5. Request documents in Chat; talent reply with files attached.'
        || E'\n\n' || 'Navigating: the menu on the left of your hub has every page. Your Dashboard shows your company''s listings and hires; Inbox has notifications; Calendar has your interviews and syncs to Google, Outlook or Apple.'
        || E'\n\n' || 'Help: Getting started walks through each step, and Help answers questions any time.',
      '/recruiter/welcome',
      jsonb_build_array(
        jsonb_build_object('label', 'Getting started', 'to', '/recruiter/welcome'),
        jsonb_build_object('label', 'Help', 'to', '/recruiter/help'),
        jsonb_build_object('label', 'Dashboard', 'to', '/recruiter')
      )
    );
  ELSIF _role = 'career_coach' THEN
    INSERT INTO notifications (user_id, kind, title, body, link, actions)
    VALUES (
      _uid, 'intro_career_coach', 'Your coach hub: the essentials',
      'Your role: work one-on-one with talent on résumés, interviews, job fairs and career programs. Every career program runs with a coach.'
        || E'\n\n' || 'Core workflows:'
        || E'\n' || '1. Pick up the service requests assigned to you (Service Requests → Start).'
        || E'\n' || '2. Find talent to coach and click Request to coach; Savant''s team approves.'
        || E'\n' || '3. Hold an intro meeting (questionnaire, career trajectory, profile optimization) on Zoom or Google Meet.'
        || E'\n' || '4. Schedule sessions on Talent & Schedule; they appear on both Calendars.'
        || E'\n' || '5. Exchange résumé drafts in Chat and send suitable jobs with Send to talent.'
        || E'\n\n' || 'Navigating: the menu on the left of your hub has every page. Service Requests is your dashboard; Inbox has notifications; Calendar has your sessions and syncs to Google, Outlook or Apple.'
        || E'\n\n' || 'Help: Getting started walks through each step, and Help answers questions any time.',
      '/coach/welcome',
      jsonb_build_array(
        jsonb_build_object('label', 'Getting started', 'to', '/coach/welcome'),
        jsonb_build_object('label', 'Help', 'to', '/coach/help'),
        jsonb_build_object('label', 'Service requests', 'to', '/coach')
      )
    );
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.staff_intro_insert(UUID, public.app_role) FROM PUBLIC, anon, authenticated;

-- New recruiters and coaches: the short welcome (20261007000002) plus this intro.
CREATE OR REPLACE FUNCTION public.staff_intro()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.staff_intro_insert(NEW.user_id, NEW.role);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.staff_intro() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER staff_intro
  AFTER INSERT ON public.user_roles
  FOR EACH ROW WHEN (NEW.role IN ('recruiter', 'career_coach'))
  EXECUTE FUNCTION public.staff_intro();

-- Existing recruiters and coaches get it once now.
SELECT public.staff_intro_insert(user_id, role)
FROM public.user_roles
WHERE role IN ('recruiter', 'career_coach');
