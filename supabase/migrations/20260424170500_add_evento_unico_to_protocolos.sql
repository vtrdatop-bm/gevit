-- Adiciona a coluna evento_unico à tabela protocolos
ALTER TABLE public.protocolos
ADD COLUMN evento_unico boolean DEFAULT false;
