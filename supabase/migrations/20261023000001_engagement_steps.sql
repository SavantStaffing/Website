-- =========================================================================
-- Engagement progress: where each talent is in each Savant service.
--
--   Services and their steps (keys match src/lib/talent/engagement.ts):
--     intro      Intro / Consultation   meeting, questionnaire, initiation
--     resume     Resume Building        upload, template, refine
--     interview  Interview Practice     session_1, session_2, additional
--     scout      Job Scout              preferences, listings
--
--   A row means the step is complete; no row means incomplete. Marking a step
--   inserts a row, un-marking deletes it.
--
--   Read:  the talent themselves, admins, and a coach assigned to the talent
--          (public.is_assigned).
--   Write: admins, and a coach assigned to the talent.
--
--   Two steps are worked out from data the talent already provides, not stored
--   here: resume/upload (a résumé file on their profile) and
--   scout/preferences (their intake is complete). engagement_auto() reports
--   both to whoever may see this talent's progress, since admins can't read
--   talent_profiles directly.
-- =========================================================================
CREATE TABLE public.engagement_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  step TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (talent_id, service, step),
  CHECK ((service, step) IN (
    ('intro', 'meeting'), ('intro', 'questionnaire'), ('intro', 'initiation'),
    ('resume', 'upload'), ('resume', 'template'), ('resume', 'refine'),
    ('interview', 'session_1'), ('interview', 'session_2'), ('interview', 'additional'),
    ('scout', 'preferences'), ('scout', 'listings')
  ))
);
CREATE INDEX engagement_steps_talent_idx ON public.engagement_steps (talent_id);

REVOKE ALL ON public.engagement_steps FROM anon, authenticated;  -- undo Supabase's default grants
GRANT SELECT, INSERT, DELETE ON public.engagement_steps TO authenticated;
GRANT ALL ON public.engagement_steps TO service_role;
ALTER TABLE public.engagement_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Talent read own engagement" ON public.engagement_steps
  FOR SELECT TO authenticated USING (talent_id = auth.uid());
CREATE POLICY "Admins read engagement" ON public.engagement_steps
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Assigned coaches read engagement" ON public.engagement_steps
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'career_coach') AND public.is_assigned(auth.uid(), talent_id)
  );

CREATE POLICY "Admins mark engagement" ON public.engagement_steps
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') AND completed_by = auth.uid()
  );
CREATE POLICY "Assigned coaches mark engagement" ON public.engagement_steps
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'career_coach')
    AND public.is_assigned(auth.uid(), talent_id)
    AND completed_by = auth.uid()
  );

CREATE POLICY "Admins unmark engagement" ON public.engagement_steps
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Assigned coaches unmark engagement" ON public.engagement_steps
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'career_coach') AND public.is_assigned(auth.uid(), talent_id)
  );

-- The two automatic steps, for the talent, admins, and the talent's assigned coach.
CREATE OR REPLACE FUNCTION public.engagement_auto(_talent UUID)
RETURNS TABLE (resume_uploaded BOOLEAN, intake_done BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    _talent = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'career_coach') AND public.is_assigned(auth.uid(), _talent))
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT
    EXISTS (SELECT 1 FROM public.talent_profiles
            WHERE user_id = _talent AND coalesce(resume_path, '') <> ''),
    EXISTS (SELECT 1 FROM public.talent_preferences
            WHERE user_id = _talent AND intake_completed_at IS NOT NULL);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.engagement_auto(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.engagement_auto(UUID) TO authenticated;
