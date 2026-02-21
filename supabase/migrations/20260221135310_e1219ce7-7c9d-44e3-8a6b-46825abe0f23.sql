
-- Table exports_historique
CREATE TABLE public.exports_historique (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  nom_fichier VARCHAR(255) NOT NULL,
  type_export VARCHAR(50) NOT NULL DEFAULT 'Excel',
  type_donnees VARCHAR(50) NOT NULL DEFAULT 'Production',
  taille_fichier_kb INTEGER,
  nb_lignes INTEGER,
  filtres_appliques JSONB,
  fichier_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.exports_historique ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exports_select_own" ON public.exports_historique FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "exports_insert_own" ON public.exports_historique FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exports_delete_own" ON public.exports_historique FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_exports_user ON public.exports_historique(user_id, created_at DESC);

-- Table rapports_automatiques
CREATE TABLE public.rapports_automatiques (
  id SERIAL PRIMARY KEY,
  nom_rapport VARCHAR(255) NOT NULL,
  type_rapport VARCHAR(50) NOT NULL DEFAULT 'Mensuel',
  domaine_id INTEGER REFERENCES public.domaines(id),
  user_destinataire UUID,
  frequence_cron VARCHAR(50),
  dernier_envoi TIMESTAMP WITH TIME ZONE,
  prochain_envoi TIMESTAMP WITH TIME ZONE,
  template_rapport JSONB,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.rapports_automatiques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rapports_select" ON public.rapports_automatiques FOR SELECT 
  USING (auth.uid() = user_destinataire OR has_role(auth.uid(), 'responsable_central'::app_role));
CREATE POLICY "rapports_insert" ON public.rapports_automatiques FOR INSERT 
  WITH CHECK (auth.uid() = user_destinataire OR has_role(auth.uid(), 'responsable_central'::app_role));
CREATE POLICY "rapports_update" ON public.rapports_automatiques FOR UPDATE 
  USING (auth.uid() = user_destinataire OR has_role(auth.uid(), 'responsable_central'::app_role));
CREATE POLICY "rapports_delete" ON public.rapports_automatiques FOR DELETE 
  USING (auth.uid() = user_destinataire OR has_role(auth.uid(), 'responsable_central'::app_role));

CREATE INDEX idx_rapports_user ON public.rapports_automatiques(user_destinataire, actif);

-- Ajouter coordonnées GPS aux domaines
ALTER TABLE public.domaines ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.domaines ADD COLUMN IF NOT EXISTS longitude NUMERIC;
