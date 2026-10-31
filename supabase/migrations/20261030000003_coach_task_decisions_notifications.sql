ALTER TABLE public.coach_recommendations DROP CONSTRAINT coach_recommendations_status_check;
ALTER TABLE public.coach_recommendations ADD CONSTRAINT coach_recommendations_status_check CHECK (status IN ('recommended','accepted','declined','completed'));
CREATE OR REPLACE FUNCTION public.notify_coach_recommendation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE label text;
BEGIN
 label := CASE NEW.action WHEN 'build_workspace' THEN 'Build Workspace' WHEN 'independent_research' THEN 'Independent Research' WHEN 'internships' THEN 'Internships' ELSE 'Follow up' END;
 IF TG_OP = 'INSERT' THEN
   INSERT INTO public.notifications(user_id,kind,title,body,link)
   VALUES(NEW.talent_id,'coach_recommendation','Coach recommendation: '||label,
     CASE WHEN NEW.employer IS NOT NULL THEN NEW.employer||': ' ELSE '' END || COALESCE(NEW.note,'Review and accept or decline this action.'),'/talent/coach');
 ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('accepted','declined','completed') THEN
   INSERT INTO public.notifications(user_id,kind,title,body,link)
   VALUES(NEW.coach_id,'coach_recommendation','Talent '||NEW.status||': '||label,
     COALESCE(NEW.employer,NEW.note,'View the recommendation.'),'/coach/talent');
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER coach_recommendations_notify AFTER INSERT OR UPDATE OF status ON public.coach_recommendations
FOR EACH ROW EXECUTE FUNCTION public.notify_coach_recommendation();
-- Enforce that a talent can only transition a recommendation to accepted/declined and complete accepted tasks.
CREATE OR REPLACE FUNCTION public.protect_coach_recommendation_fields() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.talent_id IS DISTINCT FROM OLD.talent_id OR NEW.coach_id IS DISTINCT FROM OLD.coach_id
 OR NEW.action IS DISTINCT FROM OLD.action OR NEW.employer IS DISTINCT FROM OLD.employer OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
 RAISE EXCEPTION 'Recommendation identity cannot change'; END IF;
 IF auth.uid() = OLD.talent_id THEN
   IF NEW.note IS DISTINCT FROM OLD.note THEN RAISE EXCEPTION 'Talent cannot change coach notes'; END IF;
   IF NOT ((OLD.status='recommended' AND NEW.status IN ('accepted','declined'))
      OR (OLD.status='accepted' AND NEW.status='completed')
      OR (OLD.status='completed' AND NEW.status='accepted')
      OR NEW.status=OLD.status) THEN RAISE EXCEPTION 'Invalid task transition'; END IF;
 END IF;
 IF NEW.status='completed' THEN NEW.completed_at:=COALESCE(OLD.completed_at,now()); ELSE NEW.completed_at:=NULL; END IF;
 RETURN NEW;
END; $$;
