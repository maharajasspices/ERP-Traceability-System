-- Fix fms_is_delete_admin to use fms_users table (FMS-isolated) instead of auth.users with hardcoded email
CREATE OR REPLACE FUNCTION public.fms_is_delete_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fms_users
    WHERE user_id = _user_id
      AND role = 'system_admin'
      AND is_active = true
  )
$$;