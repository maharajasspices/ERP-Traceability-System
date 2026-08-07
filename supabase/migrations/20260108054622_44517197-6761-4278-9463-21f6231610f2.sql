-- Add Tania as an FMS user (password will be set via Supabase Auth signup)
-- First, we need to check if the user exists in auth.users and add to fms_users

-- Note: The user needs to sign up first via Supabase Auth with email: tania.naicker@maharajasspices.co.za
-- After signup, we can add them to fms_users. For now, we'll prepare the entry.

-- Create a temporary function to add Tania after she signs up
CREATE OR REPLACE FUNCTION public.add_tania_as_fms_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Find Tania's user ID from auth.users
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'tania.naicker@maharajasspices.co.za';
  
  IF target_user_id IS NOT NULL THEN
    -- Insert or update fms_users entry
    INSERT INTO public.fms_users (user_id, name, role, is_active)
    VALUES (target_user_id, 'Tania Naicker', 'production_operator', true)
    ON CONFLICT (user_id) DO UPDATE
    SET name = 'Tania Naicker',
        role = 'production_operator',
        is_active = true,
        updated_at = now();
  END IF;
END;
$$;

-- Create trigger to automatically add Tania when she signs up
CREATE OR REPLACE FUNCTION public.handle_tania_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email = 'tania.naicker@maharajasspices.co.za' THEN
    INSERT INTO public.fms_users (user_id, name, role, is_active)
    VALUES (NEW.id, 'Tania Naicker', 'production_operator', true)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS on_tania_signup ON auth.users;
CREATE TRIGGER on_tania_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_tania_signup();