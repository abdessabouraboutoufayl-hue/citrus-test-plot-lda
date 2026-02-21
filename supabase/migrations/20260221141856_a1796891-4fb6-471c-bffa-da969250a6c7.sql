
-- Add a JSONB column to store GeoJSON polygon data for trial plot boundaries
ALTER TABLE public.domaines ADD COLUMN superficie_geojson jsonb DEFAULT NULL;

-- Add a numeric column for computed area in hectares
ALTER TABLE public.domaines ADD COLUMN superficie_ha numeric DEFAULT NULL;
