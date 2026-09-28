-- =========================================================================
-- Inbox, Talent & Schedule, and admin alerts.
--
-- 1. Scheduling: coaches (and admins) set a session time on a service
--    request; recruiters set an interview time on an application. Both are
--    workflow fields — the existing service_requests guard only protects what
--    the talent submitted, and talent has no UPDATE policy on applications.
-- 2. Notifications for the people involved: the talent when a session or
--    interview is scheduled, a coach when an admin assigns them a request.
-- 3. Admin alerts: every admin gets an inbox message for every form filled
--    out on the site — registrations, contact messages, service sign-ups,
--    applications, recruiter invitations and recruiter job posts.
--
-- Notifications stay write-only for triggers (SECURITY DEFINER); the inbox
-- pages read the existing notifications table.
-- =========================================================================

ALTER TABLE public.service_requests
  ADD COLUMN scheduled_at TIMESTAMPTZ,
  ADD COLUMN schedule_note TEXT CHECK (char_length(schedule_note) <= 500);

ALTER TABLE public.job_applications
  ADD COLUMN interview_at TIMESTAMPTZ,
  ADD COLUMN interview_note TEXT CHECK (char_length(interview_note) <= 500);

CREATE INDEX service_requests_coach_idx ON public.service_requests (assigned_coach_id, scheduled_at);
CREATE INDEX job_applications_interview_idx ON public.job_applications (interview_at)
  WHERE interview_at IS NOT NULL;

-- Times in notification text are shown in Pacific time, where Savant operates.
CREATE OR REPLACE FUNCTION public.format_pt(ts TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT to_char(ts AT TIME ZONE 'America/Los_Angeles', 'Dy Mon FMDD, FMHH12:MI AM') || ' PT';
$$;

CREATE OR REPLACE FUNCTION public.display_name(uid UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(nullif(trim(coalesce(tp.first_name, '') || ' ' || coalesce(tp.last_name, '')), ''),
                  p.username, p.email, 'Someone')
  FROM public.profiles p LEFT JOIN public.talent_profiles tp ON tp.user_id = p.id
  WHERE p.id = uid;
$$;
REVOKE EXECUTE ON FUNCTION public.display_name(UUID) FROM PUBLIC, anon, authenticated;

-- -------------------------------------------------------------------------
-- Scheduling notifications
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_service_request_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  label TEXT := CASE NEW.service
    WHEN 'career_programs' THEN 'Career Programs'
    WHEN 'resume_building' THEN 'Resume Building'
    ELSE 'Interview Development' END;
BEGIN
  IF NEW.scheduled_at IS NOT NULL AND NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (
      NEW.talent_id, 'session_scheduled',
      label || ' session: ' || public.format_pt(NEW.scheduled_at),
      NEW.schedule_note,
      '/talent'
    );
  END IF;

  -- Someone else (an admin) handed this request to a coach.
  IF NEW.assigned_coach_id IS NOT NULL
     AND NEW.assigned_coach_id IS DISTINCT FROM OLD.assigned_coach_id
     AND NEW.assigned_coach_id IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (
      NEW.assigned_coach_id, 'service_request_assigned',
      'Assigned to you: ' || public.display_name(NEW.talent_id),
      label || coalesce(' — ' || NEW.program, '') || '.',
      '/coach/schedule'
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_service_request_schedule() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER service_requests_notify_schedule AFTER UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_service_request_schedule();

CREATE OR REPLACE FUNCTION public.notify_interview_scheduled()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  job_title TEXT;
  org_name TEXT;
BEGIN
  IF NEW.interview_at IS NOT NULL AND NEW.interview_at IS DISTINCT FROM OLD.interview_at THEN
    SELECT j.title, coalesce(o.name, j.company_name) INTO job_title, org_name
    FROM public.jobs j LEFT JOIN public.organizations o ON o.id = j.organization_id
    WHERE j.id = NEW.job_id;
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (
      NEW.applicant_id, 'interview_scheduled',
      'Interview: ' || coalesce(job_title, 'a role') || coalesce(' at ' || org_name, ''),
      public.format_pt(NEW.interview_at) || coalesce(E'\n\n' || NEW.interview_note, ''),
      '/talent/applications'
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_interview_scheduled() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER job_applications_notify_interview AFTER UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_interview_scheduled();

-- -------------------------------------------------------------------------
-- Admin alerts: one inbox message per form submission, to every admin
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_admins(_kind TEXT, _title TEXT, _body TEXT, _link TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.notifications (user_id, kind, title, body, link)
  SELECT ur.user_id, _kind, _title, _body, _link
  FROM public.user_roles ur WHERE ur.role = 'admin';
$$;
REVOKE EXECUTE ON FUNCTION public.notify_admins(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_alert_form()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requested TEXT;
  job_title TEXT;
  org_name TEXT;
BEGIN
  CASE TG_TABLE_NAME
  WHEN 'profiles' THEN
    -- Same role resolution as handle_new_user: only talent/recruiter can be self-chosen.
    SELECT u.raw_user_meta_data->>'role' INTO requested FROM auth.users u WHERE u.id = NEW.id;
    IF requested IS NULL OR requested NOT IN ('talent', 'recruiter') THEN
      requested := 'talent';
    END IF;
    PERFORM public.notify_admins(
      'admin_registration',
      'New ' || requested || ' registered',
      coalesce(NEW.username || ' · ', '') || coalesce(NEW.email, ''),
      '/admin/users');

  WHEN 'contact_messages' THEN
    PERFORM public.notify_admins(
      'admin_contact',
      'Contact form: ' || coalesce(NEW.topic, 'message') || ' — ' || NEW.name,
      NEW.email || E'\n\n' || left(NEW.message, 280),
      '/admin/messages');

  WHEN 'service_requests' THEN
    PERFORM public.notify_admins(
      'admin_service_request',
      'Service sign-up: ' || CASE NEW.service
        WHEN 'career_programs' THEN 'Career Programs'
        WHEN 'resume_building' THEN 'Resume Building'
        ELSE 'Interview Development' END,
      public.display_name(NEW.talent_id) || coalesce(' — ' || NEW.program, ''),
      '/admin/schedule');

  WHEN 'job_applications' THEN
    SELECT j.title, coalesce(o.name, j.company_name) INTO job_title, org_name
    FROM public.jobs j LEFT JOIN public.organizations o ON o.id = j.organization_id
    WHERE j.id = NEW.job_id;
    PERFORM public.notify_admins(
      'admin_application',
      'Application: ' || coalesce(job_title, 'a role') || coalesce(' at ' || org_name, ''),
      public.display_name(NEW.applicant_id) || ' · ' || NEW.status,
      '/admin/schedule');

  WHEN 'application_requests' THEN
    SELECT j.title INTO job_title FROM public.jobs j WHERE j.id = NEW.job_id;
    PERFORM public.notify_admins(
      'admin_application_request',
      'Recruiter invitation: ' || coalesce(job_title, 'a role'),
      public.display_name(NEW.recruiter_id) || ' invited ' || public.display_name(NEW.talent_id),
      '/admin/schedule');

  WHEN 'jobs' THEN
    -- Recruiter posts only; Job Scout imports would flood the inbox.
    IF NEW.source = 'manual' THEN
      SELECT o.name INTO org_name FROM public.organizations o WHERE o.id = NEW.organization_id;
      PERFORM public.notify_admins(
        'admin_job_posted',
        'Job posted: ' || NEW.title,
        coalesce(org_name, 'An organization') || ' · ' || public.display_name(NEW.posted_by),
        '/admin/jobs');
    END IF;
  END CASE;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_alert_form() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER profiles_admin_alert AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.admin_alert_form();
CREATE TRIGGER contact_messages_admin_alert AFTER INSERT ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.admin_alert_form();
CREATE TRIGGER service_requests_admin_alert AFTER INSERT ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.admin_alert_form();
CREATE TRIGGER job_applications_admin_alert AFTER INSERT ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.admin_alert_form();
CREATE TRIGGER application_requests_admin_alert AFTER INSERT ON public.application_requests
  FOR EACH ROW EXECUTE FUNCTION public.admin_alert_form();
CREATE TRIGGER jobs_admin_alert AFTER INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.admin_alert_form();
