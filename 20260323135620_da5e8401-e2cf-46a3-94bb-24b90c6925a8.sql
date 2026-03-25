CREATE TABLE public.bairros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  municipio text NOT NULL,
  regional_id uuid REFERENCES public.regionais(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bairros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bairros viewable by authenticated"
  ON public.bairros FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage bairros"
  ON public.bairros FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));
