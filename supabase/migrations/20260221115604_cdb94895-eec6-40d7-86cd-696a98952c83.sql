
-- Junction table: domaine <-> variétés
CREATE TABLE public.domaine_varietes (
  id SERIAL PRIMARY KEY,
  domaine_id INTEGER NOT NULL REFERENCES public.domaines(id) ON DELETE CASCADE,
  variete_id INTEGER NOT NULL REFERENCES public.varietes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(domaine_id, variete_id)
);

ALTER TABLE public.domaine_varietes ENABLE ROW LEVEL SECURITY;

-- Read: authenticated users can see all
CREATE POLICY "domaine_varietes_read" ON public.domaine_varietes FOR SELECT TO authenticated USING (true);

-- CUD: only responsable_central
CREATE POLICY "domaine_varietes_insert" ON public.domaine_varietes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'responsable_central'));
CREATE POLICY "domaine_varietes_delete" ON public.domaine_varietes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'responsable_central'));

-- Allow responsable_central to manage domaines
CREATE POLICY "domaines_insert" ON public.domaines FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'responsable_central'));
CREATE POLICY "domaines_update" ON public.domaines FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'responsable_central'));
CREATE POLICY "domaines_delete" ON public.domaines FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'responsable_central'));

-- Allow responsable_central to manage varietes
CREATE POLICY "varietes_insert" ON public.varietes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'responsable_central'));
CREATE POLICY "varietes_update" ON public.varietes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'responsable_central'));
CREATE POLICY "varietes_delete" ON public.varietes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'responsable_central'));

-- Allow responsable_central to manage user_roles
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'responsable_central'));
CREATE POLICY "user_roles_update" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'responsable_central'));
CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'responsable_central'));

-- Allow responsable_central to read all user_roles
CREATE POLICY "user_roles_read_all" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'responsable_central'));

-- Allow responsable_central to read all profiles
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'responsable_central'));
