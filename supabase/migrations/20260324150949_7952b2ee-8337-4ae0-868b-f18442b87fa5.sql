-- Add login column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login text;

-- Update handle_new_user to also store login
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, nome_completo, patente, login)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', 'Usuário'),
    NEW.raw_user_meta_data->>'patente',
    split_part(NEW.email, '@', 1)
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'role', 'vistoriador')::app_role);
  
  RETURN NEW;
END;
$function$;

-- Backfill existing profiles: extract login from auth.users email
-- Using a security definer function to access auth.users
CREATE OR REPLACE FUNCTION public.backfill_logins()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles p
  SET login = split_part(u.email, '@', 1)
  FROM auth.users u
  WHERE p.user_id = u.id AND p.login IS NULL;
END;
$function$;

SELECT public.backfill_logins();

DROP FUNCTION public.backfill_logins();