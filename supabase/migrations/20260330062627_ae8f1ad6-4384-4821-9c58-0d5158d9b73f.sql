-- Tighten FMS activity_log and audit_log INSERT policies to require user_id = auth.uid()
-- Also enhance triggers to populate user_email and user_name from fms_users server-side

-- 1. Tighten INSERT policies
DROP POLICY IF EXISTS "All FMS users can create activity logs" ON public.fms_activity_log;
CREATE POLICY "All FMS users can create activity logs"
ON public.fms_activity_log
FOR INSERT
TO authenticated
WITH CHECK (fms_has_access(auth.uid()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "All FMS users can create audit logs" ON public.fms_audit_log;
CREATE POLICY "All FMS users can create audit logs"
ON public.fms_audit_log
FOR INSERT
TO authenticated
WITH CHECK (fms_has_access(auth.uid()) AND user_id = auth.uid());

-- 2. Enhance activity log trigger to also enforce user_email and user_name from fms_users
CREATE OR REPLACE FUNCTION public.fms_enforce_activity_log_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_email text;
BEGIN
  NEW.user_id := auth.uid();
  
  SELECT fu.name INTO v_name
  FROM public.fms_users fu
  WHERE fu.user_id = auth.uid() AND fu.is_active = true;
  
  SELECT au.email INTO v_email
  FROM auth.users au
  WHERE au.id = auth.uid();
  
  IF v_name IS NOT NULL THEN
    NEW.user_name := v_name;
  END IF;
  IF v_email IS NOT NULL THEN
    NEW.user_email := v_email;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Enhance audit log trigger to enforce user_id
CREATE OR REPLACE FUNCTION public.fms_enforce_audit_log_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;