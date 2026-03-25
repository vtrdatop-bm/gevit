CREATE TABLE public.municipios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.municipios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Municipios viewable by authenticated"
  ON public.municipios FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage municipios"
  ON public.municipios FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Seed with Curitiba since regionais already reference it
INSERT INTO public.municipios (nome) VALUES ('Curitiba');