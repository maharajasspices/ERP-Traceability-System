-- Fix FMS audit/operational record actor forgery
-- 1. Add triggers to enforce user_id = auth.uid() server-side on audit tables
-- 2. Tighten INSERT policies on operational tables

-- Trigger: Force user_id to auth.uid() on fms_activity_log INSERT
CREATE OR REPLACE FUNCTION public.fms_enforce_activity_log_actor()
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

DROP TRIGGER IF EXISTS trg_enforce_activity_log_actor ON public.fms_activity_log;
CREATE TRIGGER trg_enforce_activity_log_actor
  BEFORE INSERT ON public.fms_activity_log
  FOR EACH ROW
  EXECUTE FUNCTION public.fms_enforce_activity_log_actor();

-- Trigger: Force user_id to auth.uid() on fms_audit_log INSERT
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

DROP TRIGGER IF EXISTS trg_enforce_audit_log_actor ON public.fms_audit_log;
CREATE TRIGGER trg_enforce_audit_log_actor
  BEFORE INSERT ON public.fms_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.fms_enforce_audit_log_actor();

-- Tighten fms_receiving INSERT policy: received_by must be auth.uid()
DROP POLICY IF EXISTS "FMS stores operators can create receiving records" ON public.fms_receiving;
CREATE POLICY "FMS stores operators can create receiving records"
ON public.fms_receiving
FOR INSERT
TO authenticated
WITH CHECK (fms_has_access(auth.uid()) AND received_by = auth.uid());

-- Tighten fms_dispatch INSERT policy: dispatched_by must be auth.uid()
DROP POLICY IF EXISTS "FMS dispatch users can create dispatch records" ON public.fms_dispatch;
CREATE POLICY "FMS dispatch users can create dispatch records"
ON public.fms_dispatch
FOR INSERT
TO authenticated
WITH CHECK (fms_has_access(auth.uid()) AND dispatched_by = auth.uid());