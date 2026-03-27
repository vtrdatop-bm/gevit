-- Drop unused columns from protocolos table
ALTER TABLE public.protocolos 
DROP COLUMN IF EXISTS tipo_servico,
DROP COLUMN IF EXISTS tipo_empresa,
DROP COLUMN IF EXISTS solicitante;
