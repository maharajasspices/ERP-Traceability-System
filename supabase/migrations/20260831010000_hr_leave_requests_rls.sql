-- ============================================
-- HR Leave Requests - access for HR / System Admins
--
-- The fms_leave_requests table is created outside this repo (in the
-- deployed Supabase project) and, like every Supabase dashboard table,
-- has ROW LEVEL SECURITY enabled with NO policies. That means the
-- authenticated HR/System-Admin client (HRDashboard, HR Leave page)
-- is silently denied and can never see the pending requests.
--
-- This migration restores access for the roles that manage leave:
--   - SELECT  so the dashboard + Leave page can list requests,
--   - UPDATE  so Approve / Reject can set status + hr_comment.
--
-- Employees do NOT get direct table access: they submit / list leave
-- through the employee-leave edge functions, which use the service
-- role key, so no employee RLS policy is added here.
--
-- The whole block is guarded on the table existing, because the table is
-- provisioned outside this repo and may not be present in every env.
-- ============================================

DO $$
BEGIN
  IF to_regclass('public.fms_leave_requests') IS NOT NULL THEN
    ALTER TABLE public.fms_leave_requests ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "HR and admins can view leave requests" ON public.fms_leave_requests;
    CREATE POLICY "HR and admins can view leave requests"
    ON public.fms_leave_requests
    FOR SELECT
    TO authenticated
    USING (
      public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
      OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
    );

    DROP POLICY IF EXISTS "HR and admins can update leave requests" ON public.fms_leave_requests;
    CREATE POLICY "HR and admins can update leave requests"
    ON public.fms_leave_requests
    FOR UPDATE
    TO authenticated
    USING (
      public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
      OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
    )
    WITH CHECK (
      public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
      OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
    );
  END IF;
END
$$;

