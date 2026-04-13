-- Allow distribuidor users to update profiles, matching Users tab permissions
DROP POLICY IF EXISTS "Distribuidores update profiles" ON public.profiles;

CREATE POLICY "Distribuidores update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'distribuidor'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'distribuidor'::app_role));
