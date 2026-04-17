-- Allow vistoriadores to update their protocol's geographical coordinates via a specific RPC
-- to avoid giving them full update permission on the protocolos table.

CREATE OR REPLACE FUNCTION public.update_protocolo_coordinates(p_id UUID, p_latitude DOUBLE PRECISION, p_longitude DOUBLE PRECISION)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica permissão (Admin, Distribuidor ou Vistoriador designado ao processo do protocolo)
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'distribuidor') OR
    EXISTS (
      SELECT 1 FROM public.processos 
      WHERE processos.protocolo_id = p_id 
      AND processos.vistoriador_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar essas coordenadas ou registro não encontrado.';
  END IF;

  UPDATE public.protocolos
  SET latitude = p_latitude, longitude = p_longitude, updated_at = now()
  WHERE id = p_id;

  RETURN TRUE;
END;
$$;
