-- Admin-only read model for /admin/diagnostics.
--
-- SECURITY DEFINER so it can read the scheduler's own tables
-- (cron.job_run_details, net._http_response), which admins can't query
-- directly, and aggregate everything in one round trip. It refuses any
-- caller who isn't an admin.
--
-- Returns, for the last p_hours: every scout run with its run time and a
-- "stalled" flag (still running after 10 minutes, i.e. killed by the Edge
-- Function time limit), the pg_cron dispatches, the HTTP results of those
-- dispatches, per-source request outcomes (blocked, rate limited, timed out,
-- server errors) with response times and fill rates, and each company's
-- latest scan result.
CREATE OR REPLACE FUNCTION public.admin_scout_diagnostics(p_hours INTEGER DEFAULT 24)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  hours INTEGER := greatest(1, least(coalesce(p_hours, 24), 24 * 90));
  since TIMESTAMPTZ := now() - make_interval(hours => hours);
  result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;

  WITH runs AS (
    SELECT r.*,
           extract(epoch FROM (coalesce(r.finished_at, now()) - r.started_at)) AS duration_s,
           (r.status = 'running' AND r.started_at < now() - interval '10 minutes') AS stalled
    FROM scout_runs r
    WHERE r.started_at >= since
  ),
  metrics AS (
    SELECT m.* FROM scout_source_metrics m JOIN runs r ON r.id = m.run_id
  ),
  codes AS (
    SELECT m.source, c.key AS code, sum(c.value::INT) AS n
    FROM metrics m, jsonb_each_text(m.status_counts) c
    GROUP BY 1, 2
  ),
  sources AS (
    SELECT m.source,
           count(DISTINCT m.run_id) AS runs,
           sum(m.requests) AS requests,
           sum(m.successes) AS successes,
           sum(m.jobs_ingested) AS ingested,
           sum(m.schema_failures) AS schema_failures,
           round(sum(m.avg_response_ms::NUMERIC * m.requests) FILTER (WHERE m.avg_response_ms IS NOT NULL)
                 / nullif(sum(m.requests) FILTER (WHERE m.avg_response_ms IS NOT NULL), 0)) AS avg_ms,
           max(m.p95_response_ms) AS p95_ms,
           max(m.created_at) AS last_seen
    FROM metrics m
    GROUP BY m.source
  )
  SELECT jsonb_build_object(
    'window_hours', hours,
    'generated_at', now(),
    'runs', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'trigger', trigger, 'status', status, 'started_at', started_at,
        'finished_at', finished_at, 'duration_s', round(duration_s::NUMERIC, 1), 'stalled', stalled,
        'companies_scanned', companies_scanned, 'jobs_found', jobs_found,
        'jobs_inserted', jobs_inserted, 'jobs_updated', jobs_updated,
        'jobs_rejected', jobs_rejected, 'jobs_flagged', jobs_flagged,
        'jobs_closed', jobs_closed, 'error', error) ORDER BY started_at DESC)
      FROM runs), '[]'::JSONB),
    'sources', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'source', s.source, 'runs', s.runs, 'requests', s.requests, 'successes', s.successes,
        'ingested', s.ingested, 'schema_failures', s.schema_failures,
        'avg_ms', s.avg_ms, 'p95_ms', s.p95_ms, 'last_seen', s.last_seen,
        'status_counts', coalesce((SELECT jsonb_object_agg(c.code, c.n) FROM codes c WHERE c.source = s.source), '{}'::JSONB),
        'fill_rates', coalesce((SELECT l.field_fill_rates FROM metrics l
                                WHERE l.source = s.source AND l.jobs_ingested > 0
                                ORDER BY l.created_at DESC LIMIT 1), '{}'::JSONB),
        'live_jobs', (SELECT count(*) FROM jobs j WHERE j.source = s.source AND j.status = 'active'),
        'flagged_jobs', (SELECT count(*) FROM jobs j WHERE j.source = s.source AND j.status = 'flagged'))
        ORDER BY s.source)
      FROM sources s), '[]'::JSONB),
    'cron_schedule', (SELECT schedule FROM cron.job WHERE jobname = 'savant-job-scout'),
    'cron', coalesce((
      SELECT jsonb_agg(x.c ORDER BY x.start_time DESC) FROM (
        SELECT d.start_time,
               jsonb_build_object('status', d.status, 'start_time', d.start_time,
                                  'end_time', d.end_time, 'message', left(d.return_message, 300)) AS c
        FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
        WHERE j.jobname = 'savant-job-scout' AND d.start_time >= since
        ORDER BY d.start_time DESC LIMIT 500) x), '[]'::JSONB),
    -- pg_net keeps responses for about six hours, so this covers at most that.
    'dispatch', coalesce((
      SELECT jsonb_object_agg(x.k, x.n) FROM (
        SELECT CASE WHEN r.timed_out THEN 'timeout'
                    WHEN r.error_msg IS NOT NULL THEN 'error'
                    ELSE r.status_code::TEXT END AS k, count(*) AS n
        FROM net._http_response r WHERE r.created >= since GROUP BY 1) x), '{}'::JSONB),
    'companies', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'ats', c.ats, 'enabled', c.enabled,
        'last_status', c.last_status, 'last_error', c.last_error,
        'last_scanned_at', c.last_scanned_at) ORDER BY c.name)
      FROM scout_companies c), '[]'::JSONB)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_scout_diagnostics(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_scout_diagnostics(INTEGER) TO authenticated;
