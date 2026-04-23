-- Permite que admin ou distribuidor excluam registros da tabela protocolos
DROP POLICY IF EXISTS "Permitir delete para admin ou distribuidor" ON public.protocolos;

CREATE POLICY "Permitir delete para admin ou distribuidor"
ON public.protocolos
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'distribuidor'::app_role)
);
