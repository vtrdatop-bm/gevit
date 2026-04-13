-- Allow distribuidor users to update profiles, matching Users tab permissions
CREATE POLICY "Distribuidores update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'distribuidor'::app_role));
