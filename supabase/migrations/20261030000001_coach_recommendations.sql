-- Coach recommendations visible to the assigned coach and the talent.
CREATE TABLE public.coach_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('build_workspace','independent_research','internships','follow_up')),
  employer text,
  note text CHECK (char_length(note) <= 1000),
  status text NOT NULL DEFAULT 'recommended' CHECK (status IN ('recommended','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT follow_up_employer_required CHECK ((action = 'follow_up' AND NULLIF(btrim(employer),'') IS NOT NULL) OR (action <> 'follow_up' AND employer IS NULL)),
  CONSTRAINT employer_length CHECK (char_length(employer) <= 200)
);
CREATE INDEX coach_recommendations_talent_idx ON public.coach_recommendations(talent_id, created_at DESC);
ALTER TABLE public.coach_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Talent views recommendations" ON public.coach_recommendations
  FOR SELECT TO authenticated USING (auth.uid() = talent_id);
CREATE POLICY "Assigned coaches view recommendations" ON public.coach_recommendations
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'career_coach') AND public.is_assigned(auth.uid(), talent_id)
  );
CREATE POLICY "Assigned coaches create recommendations" ON public.coach_recommendations
  FOR INSERT TO authenticated WITH CHECK (
    coach_id = auth.uid() AND public.has_role(auth.uid(), 'career_coach')
    AND public.is_assigned(auth.uid(), talent_id)
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = talent_id AND role = 'talent')
    AND status = 'recommended' AND completed_at IS NULL
  );
CREATE POLICY "Assigned coaches edit own recommendations" ON public.coach_recommendations
  FOR UPDATE TO authenticated
  USING (coach_id = auth.uid() AND public.has_role(auth.uid(), 'career_coach') AND public.is_assigned(auth.uid(), talent_id))
  WITH CHECK (coach_id = auth.uid() AND public.has_role(auth.uid(), 'career_coach') AND public.is_assigned(auth.uid(), talent_id));
CREATE POLICY "Talent completes recommendations" ON public.coach_recommendations
  FOR UPDATE TO authenticated USING (talent_id = auth.uid()) WITH CHECK (talent_id = auth.uid());
CREATE POLICY "Assigned coaches delete own recommendations" ON public.coach_recommendations
  FOR DELETE TO authenticated USING (coach_id = auth.uid() AND public.has_role(auth.uid(), 'career_coach') AND public.is_assigned(auth.uid(), talent_id));
-- Protect immutable ownership/action fields even when talent marks a task completed.
CREATE FUNCTION public.protect_coach_recommendation_fields() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.talent_id IS DISTINCT FROM OLD.talent_id
    OR NEW.coach_id IS DISTINCT FROM OLD.coach_id OR NEW.action IS DISTINCT FROM OLD.action
    OR NEW.employer IS DISTINCT FROM OLD.employer OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
   RAISE EXCEPTION 'Recommendation identity and action cannot change';
 END IF;
 IF auth.uid() = OLD.talent_id AND (NEW.note IS DISTINCT FROM OLD.note) THEN
   RAISE EXCEPTION 'Talent cannot change coach notes';
 END IF;
 IF NEW.status = 'completed' THEN NEW.completed_at := coalesce(NEW.completed_at, now());
 ELSE NEW.completed_at := NULL; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER protect_coach_recommendation_fields BEFORE UPDATE ON public.coach_recommendations
FOR EACH ROW EXECUTE FUNCTION public.protect_coach_recommendation_fields();
