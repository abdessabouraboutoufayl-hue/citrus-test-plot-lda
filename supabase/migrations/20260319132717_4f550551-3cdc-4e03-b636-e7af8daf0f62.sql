-- Fix production UPDATE: add WITH CHECK that allows status transitions
DROP POLICY IF EXISTS "production_update" ON public.production;
CREATE POLICY "production_update" ON public.production
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'responsable_central'::app_role)
  OR (
    has_role(auth.uid(), 'responsable_domaine'::app_role)
    AND domaine_id = get_user_domaine_id(auth.uid())
    AND statut_validation::text = ANY (ARRAY['Brouillon', 'Rejeté'])
  )
)
WITH CHECK (
  has_role(auth.uid(), 'responsable_central'::app_role)
  OR (
    has_role(auth.uid(), 'responsable_domaine'::app_role)
    AND domaine_id = get_user_domaine_id(auth.uid())
  )
);

-- Fix qualite_interne UPDATE: add WITH CHECK that allows status transitions
DROP POLICY IF EXISTS "qualite_update" ON public.qualite_interne;
CREATE POLICY "qualite_update" ON public.qualite_interne
FOR UPDATE
USING (
  has_role(auth.uid(), 'responsable_central'::app_role)
  OR (
    has_role(auth.uid(), 'responsable_domaine'::app_role)
    AND domaine_id = get_user_domaine_id(auth.uid())
    AND statut_validation::text = ANY (ARRAY['Brouillon', 'Rejeté'])
  )
)
WITH CHECK (
  has_role(auth.uid(), 'responsable_central'::app_role)
  OR (
    has_role(auth.uid(), 'responsable_domaine'::app_role)
    AND domaine_id = get_user_domaine_id(auth.uid())
  )
);