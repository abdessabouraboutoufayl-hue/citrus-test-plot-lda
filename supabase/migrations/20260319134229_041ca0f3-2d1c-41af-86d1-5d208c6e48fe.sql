
CREATE OR REPLACE FUNCTION public.update_rappel_phenologie()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.rappels_phenologie (domaine_id, campagne_id, derniere_observation, prochaine_observation_due, notification_envoyee)
  VALUES (NEW.domaine_id, NEW.campagne_id, NEW.date_observation, NEW.date_observation + INTERVAL '15 days', FALSE)
  ON CONFLICT (domaine_id, campagne_id) 
  DO UPDATE SET 
    derniere_observation = NEW.date_observation,
    prochaine_observation_due = NEW.date_observation + INTERVAL '15 days',
    notification_envoyee = FALSE;
  RETURN NEW;
END;
$function$;
