alter table public.vistorias
  add column if not exists observacoes_1 text,
  add column if not exists observacoes_2 text,
  add column if not exists observacoes_3 text;