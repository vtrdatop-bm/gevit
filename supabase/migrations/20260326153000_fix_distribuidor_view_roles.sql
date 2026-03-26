CREATE POLICY "Distribuidores can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'distribuidor'::app_role));
