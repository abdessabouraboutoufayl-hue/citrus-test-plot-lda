
-- 1. Create seuils_qualite table
CREATE TABLE public.seuils_qualite (
  id SERIAL PRIMARY KEY,
  code_variete VARCHAR(10) NOT NULL,
  poids_min DECIMAL(5,2),
  poids_optimal_min DECIMAL(5,2),
  poids_optimal_max DECIMAL(5,2),
  poids_max DECIMAL(5,2),
  poids_critique DECIMAL(5,2),
  fruits_min INTEGER DEFAULT 100,
  fruits_max INTEGER DEFAULT 1000,
  poids_moy_min DECIMAL(5,2) DEFAULT 80,
  poids_moy_optimal_min DECIMAL(5,2) DEFAULT 120,
  poids_moy_optimal_max DECIMAL(5,2) DEFAULT 160,
  poids_moy_max DECIMAL(5,2) DEFAULT 200,
  declassement_acceptable DECIMAL(5,2) DEFAULT 15,
  declassement_critique DECIMAL(5,2) DEFAULT 25,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.seuils_qualite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seuils_read_all" ON public.seuils_qualite FOR SELECT USING (true);
CREATE POLICY "seuils_manage_central" ON public.seuils_qualite FOR ALL USING (public.has_role(auth.uid(), 'responsable_central'::app_role));

-- Pre-fill with statistical values
INSERT INTO public.seuils_qualite (code_variete, poids_min, poids_optimal_min, poids_optimal_max, poids_max, poids_critique) VALUES
('041', 35, 45, 55, 60, 70),
('068', 30, 38, 50, 55, 65),
('084', 75, 90, 110, 120, 135),
('101', 35, 43, 55, 60, 70),
('126', 40, 48, 62, 70, 80),
('135', 45, 55, 67, 75, 85);

-- 2. Add alert columns to production
ALTER TABLE public.production ADD COLUMN IF NOT EXISTS alerte_poids_aberrant BOOLEAN DEFAULT FALSE;
ALTER TABLE public.production ADD COLUMN IF NOT EXISTS alerte_poids_critique BOOLEAN DEFAULT FALSE;
ALTER TABLE public.production ADD COLUMN IF NOT EXISTS alerte_fruits_anormal BOOLEAN DEFAULT FALSE;
ALTER TABLE public.production ADD COLUMN IF NOT EXISTS alerte_poids_moyen_anormal BOOLEAN DEFAULT FALSE;
ALTER TABLE public.production ADD COLUMN IF NOT EXISTS alerte_declassement_critique BOOLEAN DEFAULT FALSE;
ALTER TABLE public.production ADD COLUMN IF NOT EXISTS niveau_alerte VARCHAR(20) DEFAULT 'ok';

CREATE INDEX IF NOT EXISTS idx_production_alertes ON public.production(niveau_alerte, statut_validation);
CREATE INDEX IF NOT EXISTS idx_production_alertes_domaine ON public.production(statut_validation, niveau_alerte, domaine_id);

-- 3. Anomaly detection trigger
CREATE OR REPLACE FUNCTION public.detect_anomalies_production()
RETURNS TRIGGER AS $$
DECLARE
  seuils RECORD;
  poids_moy DECIMAL(6,2);
  niveau TEXT := 'ok';
  v_code VARCHAR(10);
BEGIN
  -- Reset alerts
  NEW.alerte_poids_aberrant := FALSE;
  NEW.alerte_poids_critique := FALSE;
  NEW.alerte_fruits_anormal := FALSE;
  NEW.alerte_poids_moyen_anormal := FALSE;
  NEW.alerte_declassement_critique := FALSE;

  -- Skip non-normal trees
  IF NEW.arbre_statut != 'Normal' THEN
    NEW.niveau_alerte := 'ok';
    RETURN NEW;
  END IF;

  -- Get variete code
  SELECT code_variete INTO v_code FROM public.varietes WHERE id = NEW.variete_id;

  -- Get thresholds
  SELECT * INTO seuils FROM public.seuils_qualite WHERE code_variete = v_code;

  IF seuils IS NULL THEN
    NEW.niveau_alerte := 'ok';
    RETURN NEW;
  END IF;

  -- Compute average fruit weight
  IF NEW.nb_fruits_total > 0 THEN
    poids_moy := (NEW.poids_total_kg * 1000.0) / NEW.nb_fruits_total;
  END IF;

  -- Check total weight
  IF seuils.poids_critique IS NOT NULL AND NEW.poids_total_kg > seuils.poids_critique THEN
    NEW.alerte_poids_critique := TRUE;
    niveau := 'critique';
  ELSIF (seuils.poids_max IS NOT NULL AND NEW.poids_total_kg > seuils.poids_max) OR (seuils.poids_min IS NOT NULL AND NEW.poids_total_kg < seuils.poids_min) THEN
    NEW.alerte_poids_aberrant := TRUE;
    IF niveau != 'critique' THEN niveau := 'attention'; END IF;
  END IF;

  -- Check fruits count
  IF (seuils.fruits_min IS NOT NULL AND NEW.nb_fruits_total < seuils.fruits_min) OR (seuils.fruits_max IS NOT NULL AND NEW.nb_fruits_total > seuils.fruits_max) THEN
    NEW.alerte_fruits_anormal := TRUE;
    IF niveau = 'ok' THEN niveau := 'attention'; END IF;
  END IF;

  -- Check average fruit weight
  IF poids_moy IS NOT NULL AND ((seuils.poids_moy_min IS NOT NULL AND poids_moy < seuils.poids_moy_min) OR (seuils.poids_moy_max IS NOT NULL AND poids_moy > seuils.poids_moy_max)) THEN
    NEW.alerte_poids_moyen_anormal := TRUE;
    IF niveau = 'ok' THEN niveau := 'mineur'; END IF;
  END IF;

  -- Check declassement
  IF NEW.taux_declassement_pct IS NOT NULL THEN
    IF seuils.declassement_critique IS NOT NULL AND NEW.taux_declassement_pct > seuils.declassement_critique THEN
      NEW.alerte_declassement_critique := TRUE;
      niveau := 'critique';
    ELSIF seuils.declassement_acceptable IS NOT NULL AND NEW.taux_declassement_pct > seuils.declassement_acceptable THEN
      IF niveau = 'ok' THEN niveau := 'mineur'; END IF;
    END IF;
  END IF;

  NEW.niveau_alerte := niveau;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_detect_anomalies
BEFORE INSERT OR UPDATE ON public.production
FOR EACH ROW EXECUTE FUNCTION public.detect_anomalies_production();
