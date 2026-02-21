
-- Create qualite_interne table
CREATE TABLE public.qualite_interne (
  id SERIAL PRIMARY KEY,
  domaine_id INTEGER NOT NULL REFERENCES domaines(id),
  campagne_id INTEGER NOT NULL REFERENCES campagnes(id),
  variete_id INTEGER NOT NULL REFERENCES varietes(id),
  porte_greffe_id INTEGER NOT NULL REFERENCES porte_greffes(id),
  
  date_analyse DATE NOT NULL,
  mois_analyse INTEGER GENERATED ALWAYS AS (EXTRACT(MONTH FROM date_analyse)::INTEGER) STORED,
  annee_analyse INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM date_analyse)::INTEGER) STORED,
  
  nb_fruits_echantillon INTEGER NOT NULL DEFAULT 10,
  
  -- Jus
  pct_jus DECIMAL(5,2),
  poids_jus_g DECIMAL(7,2),
  volume_jus_ml DECIMAL(7,2),
  
  -- Chimique
  brix_degres DECIMAL(5,2) NOT NULL,
  acidite_gl DECIMAL(5,3) NOT NULL,
  volume_naoh_ml DECIMAL(6,2),
  ratio_ea DECIMAL(6,2) GENERATED ALWAYS AS (brix_degres / NULLIF(acidite_gl, 0)) STORED,
  
  -- Pépins
  nb_pepins_echantillon_total INTEGER,
  moyenne_pepins_par_fruit DECIMAL(4,2) GENERATED ALWAYS AS (nb_pepins_echantillon_total::DECIMAL / NULLIF(nb_fruits_echantillon, 0)) STORED,
  nb_fruits_avec_pepins INTEGER,
  
  -- Fermeté
  moyenne_fermete_peau_kg_cm2 DECIMAL(5,2),
  moyenne_fermete_fruit_kg_cm2 DECIMAL(5,2),
  
  -- Granulation
  granulation_severe VARCHAR(10),
  granulation_legere VARCHAR(10),
  
  observations TEXT,
  photo_fruits_coupes_url TEXT,
  photo_legende TEXT,
  technicien_nom VARCHAR(200) NOT NULL,
  
  -- Workflow
  statut_validation VARCHAR(50) DEFAULT 'Brouillon',
  commentaires_validation TEXT,
  
  -- Alertes computed
  alerte_ea_faible BOOLEAN GENERATED ALWAYS AS (brix_degres / NULLIF(acidite_gl, 0) < 10) STORED,
  alerte_brix_hors_norme BOOLEAN GENERATED ALWAYS AS (brix_degres < 8 OR brix_degres > 16) STORED,
  alerte_granulation_severe BOOLEAN GENERATED ALWAYS AS (granulation_severe = 'Oui') STORED,
  maturite_optimale BOOLEAN GENERATED ALWAYS AS (brix_degres / NULLIF(acidite_gl, 0) >= 12) STORED,
  
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_offline_draft BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX idx_qualite_domaine_date ON qualite_interne(domaine_id, date_analyse DESC);
CREATE INDEX idx_qualite_variete_pg ON qualite_interne(variete_id, porte_greffe_id);
CREATE INDEX idx_qualite_statut ON qualite_interne(statut_validation);

-- Trigger for updated_at
CREATE TRIGGER update_qualite_interne_updated_at
BEFORE UPDATE ON public.qualite_interne
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.qualite_interne ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as production)
CREATE POLICY "qualite_select" ON public.qualite_interne FOR SELECT
USING (
  has_role(auth.uid(), 'responsable_central'::app_role) 
  OR has_role(auth.uid(), 'direction'::app_role) 
  OR (has_role(auth.uid(), 'responsable_domaine'::app_role) AND domaine_id = get_user_domaine_id(auth.uid()))
);

CREATE POLICY "qualite_insert" ON public.qualite_interne FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    has_role(auth.uid(), 'responsable_central'::app_role) 
    OR (has_role(auth.uid(), 'responsable_domaine'::app_role) AND domaine_id = get_user_domaine_id(auth.uid()))
  )
);

CREATE POLICY "qualite_update" ON public.qualite_interne FOR UPDATE
USING (
  has_role(auth.uid(), 'responsable_central'::app_role) 
  OR (has_role(auth.uid(), 'responsable_domaine'::app_role) AND domaine_id = get_user_domaine_id(auth.uid()) AND statut_validation IN ('Brouillon', 'Rejeté'))
);

CREATE POLICY "qualite_delete" ON public.qualite_interne FOR DELETE
USING (
  auth.uid() = user_id AND (
    has_role(auth.uid(), 'responsable_central'::app_role) 
    OR (has_role(auth.uid(), 'responsable_domaine'::app_role) AND domaine_id = get_user_domaine_id(auth.uid()) AND statut_validation = 'Brouillon')
  )
);

-- Also add the missing UPDATE policy for domaine_varietes
CREATE POLICY "domaine_varietes_update" ON public.domaine_varietes FOR UPDATE
USING (has_role(auth.uid(), 'responsable_central'::app_role));
