
-- Permission profiles table
CREATE TABLE public.permission_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom character varying NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.permission_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permission_profiles_read" ON public.permission_profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'responsable_central'::app_role));
CREATE POLICY "permission_profiles_insert" ON public.permission_profiles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'responsable_central'::app_role));
CREATE POLICY "permission_profiles_update" ON public.permission_profiles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'responsable_central'::app_role));
CREATE POLICY "permission_profiles_delete" ON public.permission_profiles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'responsable_central'::app_role));

-- Profile permissions (sub-menu level)
CREATE TABLE public.profile_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.permission_profiles(id) ON DELETE CASCADE NOT NULL,
  module_key character varying NOT NULL,
  submenu_key character varying NOT NULL,
  can_access boolean DEFAULT true,
  UNIQUE(profile_id, module_key, submenu_key)
);

ALTER TABLE public.profile_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_permissions_read" ON public.profile_permissions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'responsable_central'::app_role));
CREATE POLICY "profile_permissions_insert" ON public.profile_permissions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'responsable_central'::app_role));
CREATE POLICY "profile_permissions_update" ON public.profile_permissions FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'responsable_central'::app_role));
CREATE POLICY "profile_permissions_delete" ON public.profile_permissions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'responsable_central'::app_role));

-- Add permission_profile_id to user_roles
ALTER TABLE public.user_roles ADD COLUMN permission_profile_id uuid REFERENCES public.permission_profiles(id) ON DELETE SET NULL;

-- Users need to read their own permissions
CREATE POLICY "profile_permissions_read_own" ON public.profile_permissions FOR SELECT TO authenticated 
USING (
  profile_id IN (
    SELECT permission_profile_id FROM public.user_roles WHERE user_id = auth.uid() AND permission_profile_id IS NOT NULL
  )
);

CREATE POLICY "permission_profiles_read_own" ON public.permission_profiles FOR SELECT TO authenticated 
USING (
  id IN (
    SELECT permission_profile_id FROM public.user_roles WHERE user_id = auth.uid() AND permission_profile_id IS NOT NULL
  )
);
