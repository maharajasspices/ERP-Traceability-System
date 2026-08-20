-- ============================================
-- FIX: User Management RLS Policies
-- Ensures all policies for fms_users and fms_user_invitations
-- exist in the live database (some may not have been applied)
-- ============================================

-- -------- fms_users policies --------

-- FMS users can view their own profile
DROP POLICY IF EXISTS "FMS users can view their own profile" ON public.fms_users;
CREATE POLICY "FMS users can view their own profile"
ON public.fms_users FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- FMS admins can view all users
DROP POLICY IF EXISTS "FMS admins can view all users" ON public.fms_users;
CREATE POLICY "FMS admins can view all users"
ON public.fms_users FOR SELECT
TO authenticated
USING (fms_has_role(auth.uid(), 'system_admin'::fms_role));

-- FMS admins can manage all users (ALL = insert/update/delete/select)
DROP POLICY IF EXISTS "FMS admins can manage users" ON public.fms_users;
CREATE POLICY "FMS admins can manage users"
ON public.fms_users FOR ALL
TO authenticated
USING (fms_has_role(auth.uid(), 'system_admin'::fms_role))
WITH CHECK (fms_has_role(auth.uid(), 'system_admin'::fms_role));

-- Production supervisors can view all users
DROP POLICY IF EXISTS "Supervisors can view all users" ON public.fms_users;
CREATE POLICY "Supervisors can view all users"
ON public.fms_users FOR SELECT
TO authenticated
USING (fms_has_role(auth.uid(), 'production_supervisor'::fms_role));

-- Production supervisors can update limited-role users
DROP POLICY IF EXISTS "Supervisors can update limited users" ON public.fms_users;
CREATE POLICY "Supervisors can update limited users"
ON public.fms_users FOR UPDATE
TO authenticated
USING (
  fms_has_role(auth.uid(), 'production_supervisor'::fms_role)
  AND role IN ('production_operator','stores_operator','dispatch_user')
)
WITH CHECK (
  fms_has_role(auth.uid(), 'production_supervisor'::fms_role)
  AND role IN ('production_operator','stores_operator','dispatch_user')
);

-- -------- fms_user_invitations policies --------

-- Admins can view all invitations
DROP POLICY IF EXISTS "Admins can view invitations" ON public.fms_user_invitations;
CREATE POLICY "Admins can view invitations"
ON public.fms_user_invitations FOR SELECT
TO authenticated
USING (fms_has_role(auth.uid(), 'system_admin'::fms_role));

-- Admins can create invitations
DROP POLICY IF EXISTS "Admins can create invitations" ON public.fms_user_invitations;
CREATE POLICY "Admins can create invitations"
ON public.fms_user_invitations FOR INSERT
TO authenticated
WITH CHECK (fms_has_role(auth.uid(), 'system_admin'::fms_role));

-- Admins can update invitations
DROP POLICY IF EXISTS "Admins can update invitations" ON public.fms_user_invitations;
CREATE POLICY "Admins can update invitations"
ON public.fms_user_invitations FOR UPDATE
TO authenticated
USING (fms_has_role(auth.uid(), 'system_admin'::fms_role))
WITH CHECK (fms_has_role(auth.uid(), 'system_admin'::fms_role));

-- Admins can delete invitations
DROP POLICY IF EXISTS "Admins can delete invitations" ON public.fms_user_invitations;
CREATE POLICY "Admins can delete invitations"
ON public.fms_user_invitations FOR DELETE
TO authenticated
USING (fms_has_role(auth.uid(), 'system_admin'::fms_role));

-- Production supervisors can view invitations
DROP POLICY IF EXISTS "Supervisors can view invitations" ON public.fms_user_invitations;
CREATE POLICY "Supervisors can view invitations"
ON public.fms_user_invitations FOR SELECT
TO authenticated
USING (fms_has_role(auth.uid(), 'production_supervisor'::fms_role));

-- Production supervisors can create limited-role invitations
DROP POLICY IF EXISTS "Supervisors can create limited invitations" ON public.fms_user_invitations;
CREATE POLICY "Supervisors can create limited invitations"
ON public.fms_user_invitations FOR INSERT
TO authenticated
WITH CHECK (
  fms_has_role(auth.uid(), 'production_supervisor'::fms_role)
  AND role IN ('production_operator','stores_operator','dispatch_user')
);

-- Production supervisors can update limited-role invitations
DROP POLICY IF EXISTS "Supervisors can update limited invitations" ON public.fms_user_invitations;
CREATE POLICY "Supervisors can update limited invitations"
ON public.fms_user_invitations FOR UPDATE
TO authenticated
USING (
  fms_has_role(auth.uid(), 'production_supervisor'::fms_role)
  AND role IN ('production_operator','stores_operator','dispatch_user')
)
WITH CHECK (
  fms_has_role(auth.uid(), 'production_supervisor'::fms_role)
  AND role IN ('production_operator','stores_operator','dispatch_user')
);
</｜｜DSML｜｜>