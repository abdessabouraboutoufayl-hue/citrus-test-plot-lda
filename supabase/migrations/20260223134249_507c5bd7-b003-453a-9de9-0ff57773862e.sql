
-- Drop the old constraint that's too restrictive
ALTER TABLE public.production DROP CONSTRAINT IF EXISTS production_domaine_id_campagne_id_ligne_numero_position_lig_key;

-- Create the correct unique constraint including variete and porte_greffe
ALTER TABLE public.production ADD CONSTRAINT production_unique_arbre 
  UNIQUE (domaine_id, campagne_id, variete_id, porte_greffe_id, ligne_numero, position_ligne);
