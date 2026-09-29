-- =========================================================================
-- Job-aggregator APIs for the Job Scout: Adzuna and Jooble
-- (src/lib/scout/aggregators.ts).
--
--   scout_api_usage           metered calls per source per UTC day. The scout
--                             reads it to stay inside each provider's limits
--                             (Adzuna 25/min, 250/day, 1,000/week, 2,500/month;
--                             Jooble 500 for the key's lifetime) and counts
--                             every call before sending it.
--   record_scout_api_request  atomic +1 that returns today's and the lifetime
--                             count, so two scans at once can't overspend.
--   scout_secrets             the API keys (service role only). Set them in the
--                             SQL editor; they're never committed:
--     UPDATE public.scout_secrets
--     SET adzuna_app_id = '…', adzuna_app_key = '…', jooble_api_key = '…'
--     WHERE id = 1;
-- =========================================================================

CREATE TABLE public.scout_api_usage (
  source TEXT NOT NULL CHECK (source IN ('adzuna', 'jooble')),
  day DATE NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0 CHECK (requests >= 0),
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, day)
);
GRANT SELECT ON public.scout_api_usage TO authenticated;
GRANT ALL ON public.scout_api_usage TO service_role;
ALTER TABLE public.scout_api_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read API usage" ON public.scout_api_usage
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.record_scout_api_request(p_source TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  today_count INTEGER;
  total_count BIGINT;
BEGIN
  INSERT INTO scout_api_usage (source, day, requests, last_request_at)
  VALUES (p_source, (now() AT TIME ZONE 'UTC')::date, 1, now())
  ON CONFLICT (source, day)
  DO UPDATE SET requests = scout_api_usage.requests + 1, last_request_at = now()
  RETURNING requests INTO today_count;

  SELECT sum(requests) INTO total_count FROM scout_api_usage WHERE source = p_source;
  RETURN jsonb_build_object('today', today_count, 'total', total_count);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_scout_api_request(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_scout_api_request(TEXT) TO service_role;

ALTER TABLE public.scout_secrets
  ADD COLUMN adzuna_app_id TEXT,
  ADD COLUMN adzuna_app_key TEXT,
  ADD COLUMN jooble_api_key TEXT;
