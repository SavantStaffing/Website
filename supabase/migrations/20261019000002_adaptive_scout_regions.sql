-- =========================================================================
-- Adaptive regional scanning for the Job Scout.
--
--   The scout's region list (METROS in src/lib/scout/location.ts) stays as it
--   is: the metros marked active there are the baseline and keep scanning.
--   On top of that, a dormant metro switches on while at least one talent
--   whose home is there (talent_preferences.home_metro, set by the intake
--   form) has been active within scout_settings.region_active_days (21), and
--   switches off again once they all go quiet.
--
--   profiles.last_active_at   when the user last used the site. The app
--                             calls touch_last_active() on load and on each
--                             token refresh; it writes at most once an hour.
--   scout_region_overrides    an admin's manual switch per metro: 'on' scans
--                             it regardless of activity, 'off' never does
--                             (baseline metros included). No row = automatic.
--   scout_region_demand()     active talent per metro, for the scout and the
--                             admin Regional scanners page.
-- =========================================================================

ALTER TABLE public.profiles ADD COLUMN last_active_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.touch_last_active()
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE profiles SET last_active_at = now()
   WHERE id = auth.uid()
     AND (last_active_at IS NULL OR last_active_at < now() - interval '1 hour');
$$;
REVOKE EXECUTE ON FUNCTION public.touch_last_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_active() TO authenticated;

ALTER TABLE public.scout_settings
  ADD COLUMN region_active_days INTEGER NOT NULL DEFAULT 21
    CHECK (region_active_days BETWEEN 1 AND 365);

CREATE TABLE public.scout_region_overrides (
  metro TEXT PRIMARY KEY CHECK (char_length(metro) <= 80),
  mode TEXT NOT NULL CHECK (mode IN ('on', 'off')),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scout_region_overrides TO authenticated;
GRANT ALL ON public.scout_region_overrides TO service_role;
ALTER TABLE public.scout_region_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage region overrides" ON public.scout_region_overrides
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER scout_region_overrides_updated_at BEFORE UPDATE ON public.scout_region_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Activity is the later of the app's last_active_at and the last sign-in, so
-- talent who haven't opened the site since this shipped still count.
CREATE OR REPLACE FUNCTION public.scout_region_demand(_days INTEGER DEFAULT NULL)
RETURNS TABLE (metro TEXT, active_talent INTEGER, last_active_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  window_days INTEGER := coalesce(_days,
    (SELECT s.region_active_days FROM scout_settings s WHERE s.id = 1), 21);
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT tp.home_metro,
           count(*) FILTER (WHERE a.seen >= now() - make_interval(days => window_days))::INTEGER,
           max(a.seen)
      FROM talent_preferences tp
      JOIN user_roles ur ON ur.user_id = tp.user_id AND ur.role = 'talent'
      LEFT JOIN profiles p ON p.id = tp.user_id
      LEFT JOIN auth.users u ON u.id = tp.user_id
      CROSS JOIN LATERAL (SELECT greatest(p.last_active_at, u.last_sign_in_at) AS seen) a
     WHERE tp.home_metro IS NOT NULL
     GROUP BY tp.home_metro;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.scout_region_demand(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scout_region_demand(INTEGER) TO authenticated, service_role;
