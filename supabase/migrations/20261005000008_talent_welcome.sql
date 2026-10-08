-- =========================================================================
-- Welcome messages for new talent.
--
--   notifications.actions   optional buttons on a notification:
--                           [{"label": "Explore jobs", "to": "/talent/jobs"}].
--                           "to" is a site path, optionally with a #section.
--   talent_welcome()        when an account becomes talent (sign-up, email or
--                           Google), adds two on-site notifications, once:
--                             1. Welcome to Savant
--                             2. Three ways to get started, with a button each
-- =========================================================================

ALTER TABLE public.notifications
  ADD COLUMN actions JSONB CHECK (actions IS NULL OR jsonb_typeof(actions) = 'array');

CREATE OR REPLACE FUNCTION public.talent_welcome()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  who TEXT;
BEGIN
  -- Once per person, whichever way they became talent.
  IF EXISTS (SELECT 1 FROM notifications WHERE user_id = NEW.user_id AND kind = 'welcome') THEN
    RETURN NEW;
  END IF;

  SELECT nullif(btrim(username), '') INTO who FROM profiles WHERE id = NEW.user_id;

  -- Inbox lists newest first, so the welcome is written a moment after the steps.
  INSERT INTO notifications (user_id, kind, title, body, link, actions, created_at)
  VALUES (
    NEW.user_id,
    'getting_started',
    'Three ways to get started',
    '1. Upload your résumé and fill out your professional profile. Recruiters find you through it, and Savant Apply uses it to fill in applications for you.'
      || E'\n\n'
      || '2. Request a career coach. Coaches work with you one-on-one on your résumé (built on Yale University''s résumé template and structured to pass the applicant tracking systems employers use to screen applications), interview practice and job fairs. A coach is required for every career program.'
      || E'\n\n'
      || '3. Explore jobs from employers we''ve checked for fair pay, how they treat their people and their labor record.',
    '/talent',
    jsonb_build_array(
      jsonb_build_object('label', 'Complete your profile', 'to', '/talent/profile'),
      jsonb_build_object('label', 'Request a coach', 'to', '/preparation#career-programs'),
      jsonb_build_object('label', 'Explore jobs', 'to', '/talent/jobs')
    ),
    now()
  );

  INSERT INTO notifications (user_id, kind, title, body, link, created_at)
  VALUES (
    NEW.user_id,
    'welcome',
    'Welcome to Savant' || coalesce(', ' || who, '') || '!',
    'Thanks for joining. Savant connects you with jobs from employers we''ve vetted, and with career coaches who help you land them. Your dashboard keeps your applications, saved jobs and coaching in one place.',
    '/talent',
    now() + interval '1 second'
  );
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.talent_welcome() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER talent_welcome
  AFTER INSERT ON public.user_roles
  FOR EACH ROW WHEN (NEW.role = 'talent')
  EXECUTE FUNCTION public.talent_welcome();
