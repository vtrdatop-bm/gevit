-- Adiciona a coluna data_evento à tabela protocolos
ALTER TABLE public.protocolos
ADD COLUMN data_evento date;
