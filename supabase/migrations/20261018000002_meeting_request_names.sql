-- Names on meeting requests. Talent can't read coach profiles (RLS), so the
-- request carries both names, filled in by the database on insert so a
-- client can't set them.
ALTER TABLE public.meeting_requests
  ADD COLUMN requester_name TEXT,
  ADD COLUMN talent_name TEXT;

CREATE OR REPLACE FUNCTION public.meeting_request_names()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.requester_name := public.chat_name(NEW.requester_id);
  NEW.talent_name := public.chat_name(NEW.talent_id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.meeting_request_names() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER meeting_requests_names
  BEFORE INSERT ON public.meeting_requests
  FOR EACH ROW EXECUTE FUNCTION public.meeting_request_names();
