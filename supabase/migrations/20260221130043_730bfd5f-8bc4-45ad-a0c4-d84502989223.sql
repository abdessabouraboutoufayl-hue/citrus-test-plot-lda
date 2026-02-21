
-- =============================================
-- PHASE 3 : PHÉNOLOGIE
-- =============================================

-- Table principale phenologie
CREATE TABLE public.phenologie (
  id SERIAL PRIMARY KEY,
  domaine_id INTEGER NOT NULL REFERENCES domaines(id),
  campagne_id INTEGER NOT NULL REFERENCES campagnes(id),
  variete_id INTEGER NOT NULL REFERENCES varietes(id),
  
  date_observation DATE NOT NULL,
  observateur_nom VARCHAR(200) NOT NULL,
  
  -- STADE 1 : Repos végétatif
  stade_repos_date_debut DATE,
  stade_repos_observations TEXT,
  
  -- STADE 2 : Débourrement
  stade_debourrement_date_debut DATE,
  stade_debourrement_observations TEXT,
  
  -- STADE 3 : Boutons floraux visibles
  stade_boutons_floraux_date_debut DATE,
  stade_boutons_floraux_observations TEXT,
  
  -- STADE 4 : Pré-floraison
  stade_prefloraison_date_debut DATE,
  stade_prefloraison_observations TEXT,
  
  -- STADE 5 : FLORAISON (CRITIQUE)
  stade_floraison_date_debut DATE,
  stade_floraison_date_fin DATE,
  stade_floraison_intensite VARCHAR(20),
  stade_floraison_pct_arbres DECIMAL(5,2),
  stade_floraison_nb_fleurs_estime INTEGER,
  stade_floraison_observations TEXT,
  duree_floraison_jours INTEGER GENERATED ALWAYS AS (
    CASE WHEN stade_floraison_date_fin IS NOT NULL AND stade_floraison_date_debut IS NOT NULL
    THEN stade_floraison_date_fin - stade_floraison_date_debut
    ELSE NULL END
  ) STORED,
  
  -- STADE 6 : Chute pétales
  stade_chute_petales_date_debut DATE,
  stade_chute_petales_observations TEXT,
  
  -- STADE 7 : Nouaison
  stade_nouaison_date_debut DATE,
  stade_nouaison_taux_pct DECIMAL(5,2),
  stade_nouaison_observations TEXT,
  
  -- STADE 8 : CHUTE PHYSIOLOGIQUE (CRITIQUE)
  stade_chute_physio_date_debut DATE,
  stade_chute_physio_date_fin DATE,
  stade_chute_physio_intensite VARCHAR(20),
  stade_chute_physio_taux_pct DECIMAL(5,2),
  stade_chute_physio_observations TEXT,
  duree_chute_physio_jours INTEGER GENERATED ALWAYS AS (
    CASE WHEN stade_chute_physio_date_fin IS NOT NULL AND stade_chute_physio_date_debut IS NOT NULL
    THEN stade_chute_physio_date_fin - stade_chute_physio_date_debut
    ELSE NULL END
  ) STORED,
  
  -- STADE 9 : Grossissement fruits
  stade_grossissement_date_debut DATE,
  stade_grossissement_observations TEXT,
  
  -- STADE 10 : Véraison
  stade_veraison_date_debut DATE,
  stade_veraison_pct_fruits_colores DECIMAL(5,2),
  stade_veraison_observations TEXT,
  
  -- STADE 11 : Début maturité
  stade_debut_maturite_date DATE,
  stade_debut_maturite_observations TEXT,
  
  -- STADE 12 : Maturité récolte
  stade_maturite_recolte_date DATE,
  stade_maturite_recolte_observations TEXT,
  
  -- Durée totale cycle
  duree_totale_cycle_jours INTEGER GENERATED ALWAYS AS (
    CASE WHEN stade_maturite_recolte_date IS NOT NULL AND stade_debourrement_date_debut IS NOT NULL
    THEN stade_maturite_recolte_date - stade_debourrement_date_debut
    ELSE NULL END
  ) STORED,
  
  -- Alertes
  alerte_floraison_tardive BOOLEAN DEFAULT FALSE,
  alerte_chute_physio_intense BOOLEAN GENERATED ALWAYS AS (stade_chute_physio_taux_pct > 50) STORED,
  alerte_cycle_anormal BOOLEAN DEFAULT FALSE,
  
  -- Conditions environnementales
  conditions_meteo_generales TEXT,
  temperature_moyenne_periode DECIMAL(4,1),
  
  -- Rappels
  prochaine_observation_prevue DATE,
  notification_rappel_envoyee BOOLEAN DEFAULT FALSE,
  
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(domaine_id, campagne_id, variete_id)
);

-- Indexes
CREATE INDEX idx_pheno_domaine_campagne ON phenologie(domaine_id, campagne_id);
CREATE INDEX idx_pheno_variete ON phenologie(variete_id, date_observation DESC);
CREATE INDEX idx_pheno_floraison ON phenologie(stade_floraison_date_debut);
CREATE INDEX idx_pheno_rappels ON phenologie(prochaine_observation_prevue, notification_rappel_envoyee);

-- Table observations historique
CREATE TABLE public.phenologie_observations (
  id SERIAL PRIMARY KEY,
  phenologie_id INTEGER NOT NULL REFERENCES phenologie(id) ON DELETE CASCADE,
  date_observation DATE NOT NULL,
  stades_observes JSONB,
  notes TEXT,
  observateur_nom VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pheno_obs_phenologie ON phenologie_observations(phenologie_id, date_observation DESC);

-- RLS phenologie
ALTER TABLE public.phenologie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pheno_select" ON public.phenologie FOR SELECT
USING (
  has_role(auth.uid(), 'responsable_central'::app_role)
  OR has_role(auth.uid(), 'direction'::app_role)
  OR (has_role(auth.uid(), 'responsable_domaine'::app_role) AND domaine_id = get_user_domaine_id(auth.uid()))
);

CREATE POLICY "pheno_insert" ON public.phenologie FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    has_role(auth.uid(), 'responsable_central'::app_role)
    OR (has_role(auth.uid(), 'responsable_domaine'::app_role) AND domaine_id = get_user_domaine_id(auth.uid()))
  )
);

CREATE POLICY "pheno_update" ON public.phenologie FOR UPDATE
USING (
  has_role(auth.uid(), 'responsable_central'::app_role)
  OR (has_role(auth.uid(), 'responsable_domaine'::app_role) AND domaine_id = get_user_domaine_id(auth.uid()))
);

CREATE POLICY "pheno_delete" ON public.phenologie FOR DELETE
USING (
  auth.uid() = user_id
  AND (
    has_role(auth.uid(), 'responsable_central'::app_role)
    OR (has_role(auth.uid(), 'responsable_domaine'::app_role) AND domaine_id = get_user_domaine_id(auth.uid()))
  )
);

-- RLS phenologie_observations
ALTER TABLE public.phenologie_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pheno_obs_select" ON public.phenologie_observations FOR SELECT
USING (
  phenologie_id IN (SELECT id FROM public.phenologie)
);

CREATE POLICY "pheno_obs_insert" ON public.phenologie_observations FOR INSERT
WITH CHECK (
  phenologie_id IN (SELECT id FROM public.phenologie WHERE user_id = auth.uid())
);

CREATE POLICY "pheno_obs_delete" ON public.phenologie_observations FOR DELETE
USING (
  phenologie_id IN (SELECT id FROM public.phenologie WHERE user_id = auth.uid())
);

-- Trigger updated_at
CREATE TRIGGER update_phenologie_updated_at
BEFORE UPDATE ON public.phenologie
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger prochaine observation (rappel 15j)
CREATE OR REPLACE FUNCTION public.update_prochaine_observation()
RETURNS TRIGGER AS $$
BEGIN
  NEW.prochaine_observation_prevue := NEW.date_observation + INTERVAL '15 days';
  NEW.notification_rappel_envoyee := FALSE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_calc_prochaine_obs
BEFORE INSERT OR UPDATE ON public.phenologie
FOR EACH ROW EXECUTE FUNCTION public.update_prochaine_observation();

-- Trigger floraison tardive
CREATE OR REPLACE FUNCTION public.check_floraison_tardive()
RETURNS TRIGGER AS $$
DECLARE
  moyenne_hist INTEGER;
  ecart_jours INTEGER;
  current_doy INTEGER;
BEGIN
  IF NEW.stade_floraison_date_debut IS NOT NULL THEN
    SELECT AVG(EXTRACT(DOY FROM stade_floraison_date_debut))::INTEGER INTO moyenne_hist
    FROM public.phenologie
    WHERE variete_id = NEW.variete_id
      AND campagne_id != NEW.campagne_id
      AND stade_floraison_date_debut IS NOT NULL;
    
    IF moyenne_hist IS NOT NULL THEN
      current_doy := EXTRACT(DOY FROM NEW.stade_floraison_date_debut)::INTEGER;
      ecart_jours := current_doy - moyenne_hist;
      IF ecart_jours > 10 THEN
        NEW.alerte_floraison_tardive := TRUE;
      ELSE
        NEW.alerte_floraison_tardive := FALSE;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_check_floraison
BEFORE INSERT OR UPDATE ON public.phenologie
FOR EACH ROW EXECUTE FUNCTION public.check_floraison_tardive();
