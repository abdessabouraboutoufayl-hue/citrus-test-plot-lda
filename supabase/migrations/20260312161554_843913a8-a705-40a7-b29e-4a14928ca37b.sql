
-- Table header: une observation = une session de saisie
CREATE TABLE public.observations_phenologie (
  id SERIAL PRIMARY KEY,
  domaine_id INT NOT NULL REFERENCES public.domaines(id),
  campagne_id INT NOT NULL REFERENCES public.campagnes(id),
  date_observation DATE NOT NULL,
  user_id UUID NOT NULL,
  observateur_nom VARCHAR(200) NOT NULL,
  date_reference_cycle DATE,
  nb_codes_saisis INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Détails par variété dans une observation
CREATE TABLE public.phenologie_details (
  id SERIAL PRIMARY KEY,
  observation_id INT NOT NULL REFERENCES public.observations_phenologie(id) ON DELETE CASCADE,
  variete_id INT NOT NULL REFERENCES public.varietes(id),
  stade_precedent VARCHAR(50),
  stade_phenologique VARCHAR(50) NOT NULL,
  date_stade DATE,
  observations TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rappels par domaine/campagne
CREATE TABLE public.rappels_phenologie (
  id SERIAL PRIMARY KEY,
  domaine_id INT NOT NULL REFERENCES public.domaines(id),
  campagne_id INT NOT NULL REFERENCES public.campagnes(id),
  derniere_observation DATE,
  prochaine_observation_due DATE,
  notification_envoyee BOOLEAN DEFAULT FALSE,
  UNIQUE(domaine_id, campagne_id)
);

-- RLS
ALTER TABLE public.observations_phenologie ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phenologie_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rappels_phenologie ENABLE ROW LEVEL SECURITY;

-- observations_phenologie policies
CREATE POLICY "obs_pheno_select" ON public.observations_phenologie FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'responsable_central') OR 
    has_role(auth.uid(), 'direction') OR 
    (has_role(auth.uid(), 'responsable_domaine') AND domaine_id = get_user_domaine_id(auth.uid()))
  );

CREATE POLICY "obs_pheno_insert" ON public.observations_phenologie FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND (
      has_role(auth.uid(), 'responsable_central') OR 
      (has_role(auth.uid(), 'responsable_domaine') AND domaine_id = get_user_domaine_id(auth.uid()))
    )
  );

CREATE POLICY "obs_pheno_update" ON public.observations_phenologie FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'responsable_central') OR 
    (has_role(auth.uid(), 'responsable_domaine') AND domaine_id = get_user_domaine_id(auth.uid()))
  );

CREATE POLICY "obs_pheno_delete" ON public.observations_phenologie FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id AND has_role(auth.uid(), 'responsable_central')
  );

-- phenologie_details policies  
CREATE POLICY "pheno_details_select" ON public.phenologie_details FOR SELECT TO authenticated
  USING (
    observation_id IN (SELECT id FROM public.observations_phenologie)
  );

CREATE POLICY "pheno_details_insert" ON public.phenologie_details FOR INSERT TO authenticated
  WITH CHECK (
    observation_id IN (SELECT id FROM public.observations_phenologie WHERE user_id = auth.uid())
  );

CREATE POLICY "pheno_details_update" ON public.phenologie_details FOR UPDATE TO authenticated
  USING (
    observation_id IN (SELECT id FROM public.observations_phenologie WHERE user_id = auth.uid() OR has_role(auth.uid(), 'responsable_central'))
  );

CREATE POLICY "pheno_details_delete" ON public.phenologie_details FOR DELETE TO authenticated
  USING (
    observation_id IN (SELECT id FROM public.observations_phenologie WHERE user_id = auth.uid() AND has_role(auth.uid(), 'responsable_central'))
  );

-- rappels_phenologie policies
CREATE POLICY "rappels_pheno_select" ON public.rappels_phenologie FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'responsable_central') OR 
    has_role(auth.uid(), 'direction') OR 
    (has_role(auth.uid(), 'responsable_domaine') AND domaine_id = get_user_domaine_id(auth.uid()))
  );

CREATE POLICY "rappels_pheno_manage" ON public.rappels_phenologie FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'responsable_central'))
  WITH CHECK (has_role(auth.uid(), 'responsable_central'));

-- Trigger to update rappels after observation insert
CREATE OR REPLACE FUNCTION public.update_rappel_phenologie()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
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
$$;

CREATE TRIGGER trg_update_rappel_phenologie
  AFTER INSERT ON public.observations_phenologie
  FOR EACH ROW EXECUTE FUNCTION public.update_rappel_phenologie();

-- Trigger to count nb_codes_saisis
CREATE OR REPLACE FUNCTION public.update_nb_codes_saisis()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.observations_phenologie 
  SET nb_codes_saisis = (SELECT COUNT(*) FROM public.phenologie_details WHERE observation_id = NEW.observation_id)
  WHERE id = NEW.observation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_nb_codes
  AFTER INSERT OR DELETE ON public.phenologie_details
  FOR EACH ROW EXECUTE FUNCTION public.update_nb_codes_saisis();
