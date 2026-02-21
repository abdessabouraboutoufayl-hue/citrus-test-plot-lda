-- Add porte_greffe_id and nb_arbres to domaine_varietes
ALTER TABLE public.domaine_varietes
  ADD COLUMN porte_greffe_id INTEGER REFERENCES public.porte_greffes(id) ON DELETE CASCADE,
  ADD COLUMN nb_arbres INTEGER NOT NULL DEFAULT 5;

-- Drop old unique constraint (domaine_id, variete_id) and add new one including porte_greffe_id
ALTER TABLE public.domaine_varietes
  DROP CONSTRAINT IF EXISTS domaine_varietes_domaine_id_variete_id_key;

ALTER TABLE public.domaine_varietes
  ADD CONSTRAINT domaine_varietes_domaine_variete_pg_unique UNIQUE(domaine_id, variete_id, porte_greffe_id);