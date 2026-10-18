-- =========================================================================
-- Coaches can read résumés before assignment, for talent who keep their
-- profile visible (talent_profiles.visible_to_recruiters, the same switch
-- recruiters' talent feed honours). Contact fields stay assignment-only.
--
--   coach_can_see_resume(_talent)  coach/admin + talent visible
--   coach_talent_resume(_talent)   the résumé text and file path
--   storage policy                 signed links for those files
--   coach_talent_directory()       gains has_resume
-- =========================================================================

CREATE OR REPLACE FUNCTION public.coach_can_see_resume(_talent UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (public.has_role(auth.uid(), 'career_coach') OR public.has_role(auth.uid(), 'admin'))
     AND EXISTS (
       SELECT 1 FROM public.talent_profiles tp
       JOIN public.user_roles ur ON ur.user_id = tp.user_id AND ur.role = 'talent'
       WHERE tp.user_id = _talent AND tp.visible_to_recruiters
     )
$$;
REVOKE EXECUTE ON FUNCTION public.coach_can_see_resume(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_can_see_resume(UUID) TO authenticated;

-- Same check for a résumé folder name (storage paths are "<talent id>/<file>").
CREATE OR REPLACE FUNCTION public.coach_can_see_resume_folder(_folder TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN _folder ~ '^[0-9a-f-]{36}$'
              THEN public.coach_can_see_resume(_folder::uuid)
              ELSE false END
$$;
REVOKE EXECUTE ON FUNCTION public.coach_can_see_resume_folder(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_can_see_resume_folder(TEXT) TO authenticated;

CREATE POLICY "Coaches read visible talent resumes" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'resumes'
    AND public.coach_can_see_resume_folder((storage.foldername(name))[1])
  );

CREATE OR REPLACE FUNCTION public.coach_talent_resume(_talent UUID)
RETURNS TABLE(resume_text TEXT, resume_path TEXT, resume_filename TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.coach_can_see_resume(_talent) THEN
    RAISE EXCEPTION 'This résumé isn''t available' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT tp.resume_text, tp.resume_path, tp.resume_filename
  FROM public.talent_profiles tp WHERE tp.user_id = _talent;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.coach_talent_resume(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_talent_resume(UUID) TO authenticated;

-- The return type changes, so drop and recreate.
DROP FUNCTION public.coach_talent_directory();
CREATE FUNCTION public.coach_talent_directory()
RETURNS TABLE(talent_id UUID, display_name TEXT, headline TEXT, current_title TEXT, location TEXT,
              skills TEXT[], joined_at TIMESTAMPTZ, assignment_status TEXT, has_resume BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'career_coach') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Coaches only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id,
         coalesce(
           nullif(trim(coalesce(tp.first_name, '') || ' ' || coalesce(left(tp.last_name, 1) || '.', '')), ''),
           'Talent'
         ),
         tp.headline, tp.current_title, tp.location, coalesce(tp.skills, '{}'::TEXT[]), p.created_at,
         CASE
           WHEN public.is_assigned(auth.uid(), p.id) THEN 'active'
           ELSE (SELECT a.status FROM public.talent_assignments a
                 WHERE a.talent_id = p.id AND a.staff_id = auth.uid())
         END,
         coalesce(tp.visible_to_recruiters, false)
           AND (tp.resume_path IS NOT NULL OR nullif(btrim(tp.resume_text), '') IS NOT NULL)
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'talent'
  LEFT JOIN public.talent_profiles tp ON tp.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.coach_talent_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_talent_directory() TO authenticated;
