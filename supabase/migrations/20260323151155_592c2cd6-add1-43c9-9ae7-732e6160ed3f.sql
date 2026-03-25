
CREATE TABLE public.regionais_municipios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regional_id uuid NOT NULL REFERENCES public.regionais(id) ON DELETE CASCADE,
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  UNIQUE(regional_id, municipio_id)
);

ALTER TABLE public.regionais_municipios ENABLE ROW LEVEL SECURITY;

-- Migrate existing data
INSERT INTO public.regionais_municipios (regional_id, municipio_id)
SELECT r.id, m.id FROM public.regionais r JOIN public.municipios m ON m.nome = r.municipio
WHERE r.municipio IS NOT NULL AND r.municipio != '';

-- Drop old column
ALTER TABLE public.regionais DROP COLUMN municipio;

-- RLS
CREATE POLICY "Admins manage regionais_municipios" ON public.regionais_municipios FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Regionais_municipios viewable by authenticated" ON public.regionais_municipios FOR SELECT TO authenticated USING (true);
