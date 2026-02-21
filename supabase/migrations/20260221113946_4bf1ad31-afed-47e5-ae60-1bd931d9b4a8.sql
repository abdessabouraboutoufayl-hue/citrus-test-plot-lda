
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('responsable_domaine', 'responsable_central', 'direction');

-- 1. domaines
CREATE TABLE public.domaines (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(100) UNIQUE NOT NULL,
  code VARCHAR(10) UNIQUE NOT NULL,
  region VARCHAR(100) NOT NULL,
  responsable_nom VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.domaines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domaines_read_all" ON public.domaines FOR SELECT TO authenticated USING (true);

-- 2. types_varietes
CREATE TABLE public.types_varietes (
  id SERIAL PRIMARY KEY,
  type_nom VARCHAR(100) NOT NULL,
  type_code VARCHAR(10) NOT NULL,
  couleur_badge VARCHAR(7),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.types_varietes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "types_varietes_read_all" ON public.types_varietes FOR SELECT TO authenticated USING (true);

-- 3. varietes
CREATE TABLE public.varietes (
  id SERIAL PRIMARY KEY,
  type_id INTEGER REFERENCES public.types_varietes(id),
  code_variete VARCHAR(10) UNIQUE NOT NULL,
  nom_commercial VARCHAR(200),
  statut VARCHAR(50) DEFAULT 'Actif',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.varietes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "varietes_read_all" ON public.varietes FOR SELECT TO authenticated USING (true);

-- 4. porte_greffes
CREATE TABLE public.porte_greffes (
  id SERIAL PRIMARY KEY,
  nom_pg VARCHAR(100) NOT NULL,
  code_pg VARCHAR(10) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.porte_greffes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "porte_greffes_read_all" ON public.porte_greffes FOR SELECT TO authenticated USING (true);

-- 5. campagnes
CREATE TABLE public.campagnes (
  id SERIAL PRIMARY KEY,
  code_campagne VARCHAR(20) UNIQUE NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  statut VARCHAR(50) DEFAULT 'En cours',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.campagnes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campagnes_read_all" ON public.campagnes FOR SELECT TO authenticated USING (true);

-- 6. user_roles (separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  domaine_id INTEGER REFERENCES public.domaines(id),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 7. profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  nom_complet VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Security definer functions for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_domaine_id(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT domaine_id FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- 8. production (main table)
CREATE TABLE public.production (
  id SERIAL PRIMARY KEY,
  domaine_id INTEGER NOT NULL REFERENCES public.domaines(id),
  campagne_id INTEGER NOT NULL REFERENCES public.campagnes(id),
  variete_id INTEGER NOT NULL REFERENCES public.varietes(id),
  porte_greffe_id INTEGER NOT NULL REFERENCES public.porte_greffes(id),
  ligne_numero INTEGER NOT NULL CHECK (ligne_numero BETWEEN 1 AND 20),
  position_ligne INTEGER NOT NULL CHECK (position_ligne BETWEEN 1 AND 25),
  code_arbre VARCHAR(50),
  date_recolte DATE NOT NULL,
  poids_total_kg DECIMAL(8,3) NOT NULL CHECK (poids_total_kg > 0),
  nb_fruits_total INTEGER NOT NULL CHECK (nb_fruits_total > 0),
  poids_moyen_fruit_g DECIMAL(6,2),
  calibre_moyen_mm DECIMAL(5,2),
  taux_declassement_pct DECIMAL(5,2) CHECK (taux_declassement_pct BETWEEN 0 AND 100),
  qualite_globale VARCHAR(20) CHECK (qualite_globale IN ('A','B','C','Hors norme')),
  photo_url TEXT,
  photo_legende TEXT,
  recoltant_nom VARCHAR(200),
  observations TEXT,
  statut_validation VARCHAR(50) DEFAULT 'Brouillon' CHECK (statut_validation IN ('Brouillon','Soumis','Validé','Rejeté')),
  commentaires_validation TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_offline_draft BOOLEAN DEFAULT FALSE,
  UNIQUE(domaine_id, campagne_id, ligne_numero, position_ligne)
);

CREATE INDEX idx_prod_domaine ON public.production(domaine_id, campagne_id);
CREATE INDEX idx_prod_statut ON public.production(statut_validation);

ALTER TABLE public.production ENABLE ROW LEVEL SECURITY;

-- RLS for production using security definer functions
CREATE POLICY "production_select" ON public.production FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'responsable_central') OR
  public.has_role(auth.uid(), 'direction') OR
  (public.has_role(auth.uid(), 'responsable_domaine') AND domaine_id = public.get_user_domaine_id(auth.uid()))
);

CREATE POLICY "production_insert" ON public.production FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id AND (
    public.has_role(auth.uid(), 'responsable_central') OR
    (public.has_role(auth.uid(), 'responsable_domaine') AND domaine_id = public.get_user_domaine_id(auth.uid()))
  )
);

CREATE POLICY "production_update" ON public.production FOR UPDATE TO authenticated
USING (
  (public.has_role(auth.uid(), 'responsable_central')) OR
  (public.has_role(auth.uid(), 'responsable_domaine') AND domaine_id = public.get_user_domaine_id(auth.uid()) AND statut_validation IN ('Brouillon','Rejeté'))
);

CREATE POLICY "production_delete" ON public.production FOR DELETE TO authenticated
USING (
  auth.uid() = user_id AND (
    public.has_role(auth.uid(), 'responsable_central') OR
    (public.has_role(auth.uid(), 'responsable_domaine') AND domaine_id = public.get_user_domaine_id(auth.uid()) AND statut_validation = 'Brouillon')
  )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_production_updated_at
BEFORE UPDATE ON public.production
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to compute code_arbre and poids_moyen on insert/update
CREATE OR REPLACE FUNCTION public.compute_production_fields()
RETURNS TRIGGER AS $$
DECLARE
  domaine_code VARCHAR(10);
BEGIN
  SELECT code INTO domaine_code FROM public.domaines WHERE id = NEW.domaine_id;
  NEW.code_arbre := domaine_code || '-L' || LPAD(NEW.ligne_numero::TEXT, 2, '0') || '-P' || LPAD(NEW.position_ligne::TEXT, 2, '0');
  NEW.poids_moyen_fruit_g := ROUND((NEW.poids_total_kg * 1000.0) / NEW.nb_fruits_total, 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER compute_production_fields_trigger
BEFORE INSERT OR UPDATE ON public.production
FOR EACH ROW EXECUTE FUNCTION public.compute_production_fields();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for photos
INSERT INTO storage.buckets (id, name, public) VALUES ('production-photos', 'production-photos', true);

CREATE POLICY "auth_upload_photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'production-photos');

CREATE POLICY "public_read_photos" ON storage.objects FOR SELECT
USING (bucket_id = 'production-photos');

CREATE POLICY "auth_update_photos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'production-photos');

CREATE POLICY "auth_delete_photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'production-photos');
