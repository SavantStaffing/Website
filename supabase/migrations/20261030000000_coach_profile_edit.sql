-- Edit professional information only; never account details or recruiter visibility.
CREATE OR REPLACE FUNCTION public.coach_update_talent_profile(_talent_id uuid, _changes jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  permitted text[] := ARRAY['first_name','last_name','headline','location','current_title','current_company','linkedin_url','github_url','portfolio_url','salary_expectation','earliest_start','resume_text','skills','work_authorized','needs_sponsorship'];
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'career_coach')
     OR NOT public.is_assigned(auth.uid(), _talent_id)
     OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _talent_id AND role = 'talent') THEN
    RAISE EXCEPTION 'An active coach assignment is required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_changes) <> 'object'
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(_changes) AS k WHERE k <> ALL(permitted)) THEN
    RAISE EXCEPTION 'Invalid profile fields' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(_changes) AS j(k,v) WHERE
       (k = 'skills' AND jsonb_typeof(v) <> 'array')
       OR (k IN ('work_authorized','needs_sponsorship') AND jsonb_typeof(v) NOT IN ('boolean','null'))
       OR (k NOT IN ('skills','work_authorized','needs_sponsorship') AND jsonb_typeof(v) NOT IN ('string','null')))
     OR EXISTS (SELECT 1 FROM jsonb_each_text(_changes) AS j(k,v) WHERE
       (k IN ('first_name','last_name','salary_expectation','earliest_start') AND length(v)>80)
       OR (k='headline' AND length(v)>160)
       OR (k IN ('location','current_title','current_company') AND length(v)>120)
       OR (k IN ('linkedin_url','github_url','portfolio_url') AND length(v)>500)
       OR (k='resume_text' AND length(v)>60000)) THEN
    RAISE EXCEPTION 'Invalid profile value' USING ERRCODE = '22023';
  END IF;
  UPDATE public.talent_profiles AS tp SET
    first_name = CASE WHEN _changes?'first_name' THEN _changes->>'first_name' ELSE tp.first_name END,
    last_name = CASE WHEN _changes?'last_name' THEN _changes->>'last_name' ELSE tp.last_name END,
    headline = CASE WHEN _changes?'headline' THEN _changes->>'headline' ELSE tp.headline END,
    location = CASE WHEN _changes?'location' THEN _changes->>'location' ELSE tp.location END,
    current_title = CASE WHEN _changes?'current_title' THEN _changes->>'current_title' ELSE tp.current_title END,
    current_company = CASE WHEN _changes?'current_company' THEN _changes->>'current_company' ELSE tp.current_company END,
    linkedin_url = CASE WHEN _changes?'linkedin_url' THEN _changes->>'linkedin_url' ELSE tp.linkedin_url END,
    github_url = CASE WHEN _changes?'github_url' THEN _changes->>'github_url' ELSE tp.github_url END,
    portfolio_url = CASE WHEN _changes?'portfolio_url' THEN _changes->>'portfolio_url' ELSE tp.portfolio_url END,
    salary_expectation = CASE WHEN _changes?'salary_expectation' THEN _changes->>'salary_expectation' ELSE tp.salary_expectation END,
    earliest_start = CASE WHEN _changes?'earliest_start' THEN _changes->>'earliest_start' ELSE tp.earliest_start END,
    resume_text = CASE WHEN _changes?'resume_text' THEN _changes->>'resume_text' ELSE tp.resume_text END,
    skills = CASE WHEN _changes?'skills' THEN ARRAY(SELECT jsonb_array_elements_text(_changes->'skills')) ELSE tp.skills END,
    work_authorized = CASE WHEN _changes?'work_authorized' THEN (_changes->>'work_authorized')::boolean ELSE tp.work_authorized END,
    needs_sponsorship = CASE WHEN _changes?'needs_sponsorship' THEN (_changes->>'needs_sponsorship')::boolean ELSE tp.needs_sponsorship END
  WHERE tp.user_id = _talent_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talent profile not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.coach_update_talent_profile(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_update_talent_profile(uuid,jsonb) TO authenticated;
