
-- Add arbre_statut and arbre_inclus_calculs columns to production table
ALTER TABLE public.production 
ADD COLUMN IF NOT EXISTS arbre_statut character varying NOT NULL DEFAULT 'Normal',
ADD COLUMN IF NOT EXISTS arbre_inclus_calculs boolean NOT NULL DEFAULT true;

-- Update existing records
UPDATE public.production SET arbre_statut = 'Normal', arbre_inclus_calculs = true WHERE arbre_statut IS NULL;
