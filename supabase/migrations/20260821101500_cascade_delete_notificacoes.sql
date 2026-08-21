ALTER TABLE public.notificacoes 
DROP CONSTRAINT notificacoes_processo_id_fkey,
ADD CONSTRAINT notificacoes_processo_id_fkey 
  FOREIGN KEY (processo_id) 
  REFERENCES public.processos(id) 
  ON DELETE CASCADE;
