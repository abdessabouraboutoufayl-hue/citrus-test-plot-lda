
CREATE OR REPLACE FUNCTION public.compute_production_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  domaine_code VARCHAR(10);
BEGIN
  SELECT code INTO domaine_code FROM public.domaines WHERE id = NEW.domaine_id;
  NEW.code_arbre := domaine_code || '-L' || LPAD(NEW.ligne_numero::TEXT, 2, '0') || '-P' || LPAD(NEW.position_ligne::TEXT, 2, '0');
  IF NEW.nb_fruits_total > 0 THEN
    NEW.poids_moyen_fruit_g := ROUND((NEW.poids_total_kg * 1000.0) / NEW.nb_fruits_total, 2);
  ELSE
    NEW.poids_moyen_fruit_g := NULL;
  END IF;
  RETURN NEW;
END;
$function$;
