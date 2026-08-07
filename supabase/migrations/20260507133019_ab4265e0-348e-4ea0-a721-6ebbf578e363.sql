
-- 1. Hide credit_pin from client SELECT (column-level)
REVOKE SELECT (credit_pin) ON public.user_credits FROM anon, authenticated;

-- 2. Hide tracking_token from authenticated users; keep available to service role
REVOKE SELECT (tracking_token) ON public.orders FROM anon, authenticated;

-- 3. Restrict sc_audit_log INSERT to admin/manager/hr
DROP POLICY IF EXISTS "Authenticated can insert own audit log" ON public.sc_audit_log;
CREATE POLICY "Privileged users can insert audit log"
  ON public.sc_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.sc_is_admin(auth.uid())
      OR public.has_role(auth.uid(), 'hr'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
    )
  );

-- 4. Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated where appropriate.

-- Trigger-only / internal functions: revoke from both anon and authenticated
REVOKE EXECUTE ON FUNCTION public.track_order_history() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fms_enforce_activity_log_actor() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fms_enforce_audit_log_actor() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_employee_log_actor() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fms_link_invitation_on_signup() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fms_update_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_credit_balance() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_credit_pin_direct_update() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_order_financials() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_sensitive_access() FROM anon, authenticated, PUBLIC;

-- Role/permission helpers used in RLS: revoke from anon only (authenticated must keep EXECUTE)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sc_is_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sc_is_manager_or_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fms_has_role(uuid, public.fms_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fms_has_access(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fms_is_delete_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fms_generate_lot_number() FROM anon, PUBLIC;

-- Client-callable RPCs: revoke from anon, keep authenticated
REVOKE EXECUTE ON FUNCTION public.set_credit_pin(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_credit_pin(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_user_role(text, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_user_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_user_completely(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_employee_role(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_value_feedback_anonymous(uuid) FROM anon, PUBLIC;
