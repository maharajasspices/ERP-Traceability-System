-- Fix admin delete checks: make fms_is_delete_admin SECURITY DEFINER so it can read auth.users
CREATE OR REPLACE FUNCTION public.fms_is_delete_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = _user_id
      AND email = 'aryan123qwer@gmail.com'
  );
$$;

-- Fix activity log SELECT policy: avoid direct auth.users access in RLS expression
DROP POLICY IF EXISTS "Only owner can view activity logs" ON public.fms_activity_log;
CREATE POLICY "Only admin can view activity logs"
ON public.fms_activity_log
FOR SELECT
USING (public.fms_is_delete_admin(auth.uid()));