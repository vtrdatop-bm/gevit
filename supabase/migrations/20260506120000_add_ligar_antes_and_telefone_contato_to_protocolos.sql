-- Adiciona colunas para contato prévio à tabela protocolos
ALTER TABLE public.protocolos
ADD COLUMN ligar_antes boolean DEFAULT false,
ADD COLUMN telefone_contato text;