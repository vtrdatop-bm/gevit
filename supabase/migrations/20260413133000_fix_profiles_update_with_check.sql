-- Ensure profile updates are effectively allowed for authorized roles
-- and validated with explicit WITH CHECK clauses.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users update own profile'
  ) THEN
    ALTER POLICY "Users update own profile"
    ON public.profiles
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  ELSE
    CREATE POLICY "Users update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admins update all profiles'
  ) THEN
    ALTER POLICY "Admins update all profiles"
    ON public.profiles
    USING (public.has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  ELSE
    CREATE POLICY "Admins update all profiles"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Distribuidores update profiles'
  ) THEN
    ALTER POLICY "Distribuidores update profiles"
    ON public.profiles
    USING (public.has_role(auth.uid(), 'distribuidor'::app_role))
    WITH CHECK (public.has_role(auth.uid(), 'distribuidor'::app_role));
  ELSE
    CREATE POLICY "Distribuidores update profiles"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'distribuidor'::app_role))
    WITH CHECK (public.has_role(auth.uid(), 'distribuidor'::app_role));
  END IF;
END $$;
