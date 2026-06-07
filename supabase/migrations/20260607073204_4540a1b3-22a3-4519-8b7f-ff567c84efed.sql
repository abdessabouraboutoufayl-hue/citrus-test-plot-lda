
GRANT SELECT ON public.campagnes TO anon;
GRANT SELECT ON public.varietes TO anon;
GRANT SELECT ON public.porte_greffes TO anon;
GRANT SELECT ON public.types_varietes TO anon;
GRANT SELECT ON public.domaines TO anon;
GRANT SELECT ON public.domaine_varietes TO anon;

CREATE POLICY "campagnes_read_anon" ON public.campagnes FOR SELECT TO anon USING (true);
CREATE POLICY "varietes_read_anon" ON public.varietes FOR SELECT TO anon USING (true);
CREATE POLICY "porte_greffes_read_anon" ON public.porte_greffes FOR SELECT TO anon USING (true);
CREATE POLICY "types_varietes_read_anon" ON public.types_varietes FOR SELECT TO anon USING (true);
CREATE POLICY "domaines_read_anon" ON public.domaines FOR SELECT TO anon USING (true);
CREATE POLICY "domaine_varietes_read_anon" ON public.domaine_varietes FOR SELECT TO anon USING (true);
