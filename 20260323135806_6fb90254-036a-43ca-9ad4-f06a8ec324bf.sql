CREATE POLICY "Admins manage regionais"
  ON public.regionais FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));