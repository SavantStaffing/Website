-- =========================================================================
-- Tell career coaches about the Savant Coach extension (extension-coach/),
-- the way talent are told about Savant Apply: one Inbox notification with the
-- install steps and a button to the full guide at /coach/extension.
--
--   coach_extension_notice_insert(uid)  adds it once per coach
--   coach_extension_notice trigger      new coaches get it when the role is granted
--   backfill                            every current coach gets it now
--
-- Needs notifications.actions (20261005000008) and the coach role (20260926000000).
-- =========================================================================

CREATE OR REPLACE FUNCTION public.coach_extension_notice_insert(_uid UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM notifications WHERE user_id = _uid AND kind = 'coach_extension') THEN
    RETURN;
  END IF;
  INSERT INTO notifications (user_id, kind, title, body, link, actions)
  VALUES (
    _uid, 'coach_extension', 'Check job listings before you recommend them',
    'Savant Coach is a free browser extension that tells you Pass or No pass on a job listing, so you know whether it is a ghost listing before you send it to talent. It works on a single listing or on a Google Sheet of them.'
      || E'\n\n' || 'To install it (about 2 minutes, Chrome or Edge on a computer):'
      || E'\n' || '1. Download Savant Coach from the install guide and unzip it.'
      || E'\n' || '2. Open chrome://extensions and turn on Developer mode.'
      || E'\n' || '3. Click Load unpacked and choose the savant-coach folder.'
      || E'\n' || '4. Reload Savant and click the Savant Coach icon to open the side panel.'
      || E'\n\n' || 'It only reads pages and never changes them.',
    '/coach/extension',
    jsonb_build_array(
      jsonb_build_object('label', 'Install guide', 'to', '/coach/extension'),
      jsonb_build_object('label', 'Getting started', 'to', '/coach/welcome')
    )
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.coach_extension_notice_insert(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.coach_extension_notice()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.coach_extension_notice_insert(NEW.user_id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.coach_extension_notice() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER coach_extension_notice
  AFTER INSERT ON public.user_roles
  FOR EACH ROW WHEN (NEW.role = 'career_coach')
  EXECUTE FUNCTION public.coach_extension_notice();

-- Coaches already on Savant get it once now.
SELECT public.coach_extension_notice_insert(user_id)
FROM public.user_roles
WHERE role = 'career_coach';
