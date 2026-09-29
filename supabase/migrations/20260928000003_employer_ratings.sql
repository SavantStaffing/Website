-- =========================================================================
-- Public Employer Ratings (/employer-ratings and the rating on job listings).
--
-- The rating itself is computed in src/lib/ratings/employer-rating.ts from
-- the inputs this function bundles. company_ratings and scout_companies stay
-- admin-only tables; this SECURITY DEFINER function exposes just the
-- published-ranking fields (JUST Capital rank, As You Sow score) and rating
-- aliases, alongside the already-public employer_ethics cache and open-job
-- counts per employer.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.employer_rating_inputs()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ratings', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'source', r.source, 'company_name', r.company_name,
        'normalized_name', r.normalized_name, 'rank', r.rank, 'score', r.score))
      FROM company_ratings r), '[]'::jsonb),
    'ethics', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'company_key', e.company_key, 'company_name', e.company_name,
        'fair_pay_score', e.fair_pay_score, 'cultures_score', e.cultures_score,
        'honest_score', e.honest_score, 'wba_year', e.wba_year,
        'dol_checked', e.dol_checked, 'dol_wage_cases', e.dol_wage_cases,
        'dol_repeat_violator', e.dol_repeat_violator,
        'osha_serious_violations', e.osha_serious_violations))
      FROM employer_ethics e), '[]'::jsonb),
    'aliases', coalesce((
      SELECT jsonb_agg(jsonb_build_object('name', c.name, 'rating_name', c.rating_name))
      FROM scout_companies c WHERE c.rating_name IS NOT NULL), '[]'::jsonb),
    'jobs', coalesce((
      SELECT jsonb_agg(jsonb_build_object('company', t.company, 'n', t.n))
      FROM (
        SELECT coalesce(j.company_name, o.name) AS company, count(*) AS n
        FROM jobs j LEFT JOIN organizations o ON o.id = j.organization_id
        WHERE j.status = 'active'
          AND (j.valid_through IS NULL OR j.valid_through > now())
          AND coalesce(j.company_name, o.name) IS NOT NULL
        GROUP BY 1
      ) t), '[]'::jsonb)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.employer_rating_inputs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employer_rating_inputs() TO anon, authenticated;
