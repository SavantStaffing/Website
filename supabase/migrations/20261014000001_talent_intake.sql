-- =========================================================================
-- Talent intake: the introductory form at /talent/intake.
--
--   talent_preferences gains the intake answers: industry and role (from the
--   site's lists, or "other" with their own words), home ZIP with the state
--   and metro area it falls in, how far they'll travel, and weekly
--   availability. The job feed refines itself to these when the talent
--   opens it.
--
--   Who can see it: the talent (edit), admins, and staff assigned to the
--   talent (read) — the existing talent_preferences policies already cover
--   this, so no new policies are needed.
--
--   Admins get an Inbox alert the first time a talent completes it.
-- =========================================================================

ALTER TABLE public.talent_preferences
  ADD COLUMN intake_industry TEXT CHECK (char_length(intake_industry) <= 60),
  ADD COLUMN intake_industry_other TEXT CHECK (char_length(intake_industry_other) <= 120),
  ADD COLUMN intake_role TEXT CHECK (char_length(intake_role) <= 60),
  ADD COLUMN intake_role_other TEXT CHECK (char_length(intake_role_other) <= 120),
  ADD COLUMN home_zip TEXT CHECK (home_zip ~ '^[0-9]{5}$'),
  ADD COLUMN home_state TEXT CHECK (home_state ~ '^[A-Z]{2}$'),
  ADD COLUMN home_metro TEXT CHECK (char_length(home_metro) <= 80),
  -- 25 or 50 = their metro area, 100 = their state, NULL = anywhere.
  ADD COLUMN travel_miles INTEGER CHECK (travel_miles IN (25, 50, 100)),
  -- {"mon": {"start": "09:00", "end": "17:00"}, "tue": null, ...}
  ADD COLUMN availability JSONB CHECK (availability IS NULL OR jsonb_typeof(availability) = 'object'),
  ADD COLUMN intake_completed_at TIMESTAMPTZ;

CREATE INDEX talent_preferences_intake_idx ON public.talent_preferences (intake_completed_at DESC)
  WHERE intake_completed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_talent_intake()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.intake_completed_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.intake_completed_at IS NULL) THEN
    PERFORM public.notify_admins(
      'talent_intake',
      'New talent intake: ' || public.display_name(NEW.user_id),
      concat_ws(' · ',
        coalesce(NEW.intake_industry_other, NEW.intake_industry),
        coalesce(NEW.intake_role_other, NEW.intake_role),
        coalesce(NEW.home_metro, NEW.home_state),
        CASE WHEN NEW.travel_miles IS NULL THEN 'anywhere' ELSE 'up to ' || NEW.travel_miles || ' mi' END),
      '/admin/intake'
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_talent_intake() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER notify_talent_intake
  AFTER INSERT OR UPDATE OF intake_completed_at ON public.talent_preferences
  FOR EACH ROW EXECUTE FUNCTION public.notify_talent_intake();
