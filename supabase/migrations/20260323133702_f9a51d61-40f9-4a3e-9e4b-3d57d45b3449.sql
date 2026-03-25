
-- Enum for process status
CREATE TYPE public.process_status AS ENUM ('regional', 'pendencias', 'certificado_termo', 'certificado', 'expirado');

-- Enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'distribuidor', 'vistoriador');

-- Enum for inspection result
CREATE TYPE public.inspection_result AS ENUM ('aprovado', 'pendencia', 'reprovado');

-- REGIONAIS
CREATE TABLE public.regionais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  municipio TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.regionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Regionais are viewable by authenticated users" ON public.regionais FOR SELECT TO authenticated USING (true);

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT NOT NULL,
  patente TEXT,
  regional_id UUID REFERENCES public.regionais(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- PROTOCOLOS
CREATE TABLE public.protocolos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  data_solicitacao DATE NOT NULL,
  tipo_servico TEXT,
  tipo_empresa TEXT,
  cnpj TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  solicitante TEXT,
  endereco TEXT NOT NULL,
  bairro TEXT NOT NULL,
  municipio TEXT NOT NULL,
  area NUMERIC,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.protocolos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Protocolos viewable by authenticated" ON public.protocolos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins distribuidores can insert protocolos" ON public.protocolos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'distribuidor'));
CREATE POLICY "Admins distribuidores can update protocolos" ON public.protocolos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'distribuidor'));

-- PROCESSOS
CREATE TABLE public.processos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  protocolo_id UUID NOT NULL REFERENCES public.protocolos(id) ON DELETE CASCADE,
  regional_id UUID REFERENCES public.regionais(id),
  vistoriador_id UUID REFERENCES auth.users(id),
  status process_status NOT NULL DEFAULT 'regional',
  data_prevista DATE,
  prazo_pausado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Processos viewable by authenticated" ON public.processos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins distribuidores manage processos" ON public.processos FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'distribuidor'));
CREATE POLICY "Vistoriadores update assigned processos" ON public.processos FOR UPDATE TO authenticated USING (auth.uid() = vistoriador_id);

-- VISTORIAS
CREATE TABLE public.vistorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  data_1_vistoria DATE,
  status_1_vistoria inspection_result,
  data_1_retorno DATE,
  data_2_vistoria DATE,
  status_2_vistoria inspection_result,
  data_2_retorno DATE,
  data_3_vistoria DATE,
  status_3_vistoria inspection_result,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vistorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vistorias viewable by authenticated" ON public.vistorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins distribuidores manage vistorias" ON public.vistorias FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'distribuidor'));
CREATE POLICY "Vistoriadores update own vistorias" ON public.vistorias FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.processos WHERE processos.id = vistorias.processo_id AND processos.vistoriador_id = auth.uid()));

-- PAUSAS
CREATE TABLE public.pausas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pausas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pausas viewable by authenticated" ON public.pausas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins distribuidores manage pausas" ON public.pausas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'distribuidor'));

-- TERMOS DE COMPROMISSO
CREATE TABLE public.termos_compromisso (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE UNIQUE,
  numero_termo TEXT NOT NULL,
  data_assinatura DATE NOT NULL,
  data_validade DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.termos_compromisso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Termos viewable by authenticated" ON public.termos_compromisso FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins distribuidores manage termos" ON public.termos_compromisso FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'distribuidor'));

-- NOTIFICAÇÕES
CREATE TABLE public.notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  processo_id UUID REFERENCES public.processos(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.notificacoes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notificacoes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'distribuidor'));

-- INDEXES
CREATE INDEX idx_protocolos_cnpj ON public.protocolos(cnpj);
CREATE INDEX idx_protocolos_municipio ON public.protocolos(municipio);
CREATE INDEX idx_processos_status ON public.processos(status);
CREATE INDEX idx_processos_vistoriador ON public.processos(vistoriador_id);
CREATE INDEX idx_processos_protocolo ON public.processos(protocolo_id);
CREATE INDEX idx_notificacoes_user ON public.notificacoes(user_id, lida);
CREATE INDEX idx_pausas_processo ON public.pausas(processo_id);

-- UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_protocolos_updated_at BEFORE UPDATE ON public.protocolos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_processos_updated_at BEFORE UPDATE ON public.processos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vistorias_updated_at BEFORE UPDATE ON public.vistorias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEED REGIONAIS
INSERT INTO public.regionais (nome, municipio) VALUES
  ('1ª Regional - Centro', 'Curitiba'),
  ('2ª Regional - Batel', 'Curitiba'),
  ('3ª Regional - CIC', 'Curitiba'),
  ('4ª Regional - Boa Vista', 'Curitiba'),
  ('5ª Regional - Cajuru', 'Curitiba');
