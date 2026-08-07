
-- Allow production_supervisor to manage settings
CREATE POLICY "FMS supervisors can manage settings"
ON public.fms_settings
FOR ALL
TO authenticated
USING (fms_has_role(auth.uid(), 'production_supervisor'::fms_role))
WITH CHECK (fms_has_role(auth.uid(), 'production_supervisor'::fms_role));

-- Allow supervisors to view all users
CREATE POLICY "Supervisors can view all users"
ON public.fms_users
FOR SELECT
TO authenticated
USING (fms_has_role(auth.uid(), 'production_supervisor'::fms_role));

-- Allow supervisors to update users but only limited roles and cannot elevate to admin/supervisor
CREATE POLICY "Supervisors can update limited users"
ON public.fms_users
FOR UPDATE
TO authenticated
USING (
  fms_has_role(auth.uid(), 'production_supervisor'::fms_role)
  AND role IN ('production_operator','stores_operator','dispatch_user')
)
WITH CHECK (
  fms_has_role(auth.uid(), 'production_supervisor'::fms_role)
  AND role IN ('production_operator','stores_operator','dispatch_user')
);

-- Invitations: allow supervisors to view/create/update with limited roles
CREATE POLICY "Supervisors can view invitations"
ON public.fms_user_invitations
FOR SELECT
TO authenticated
USING (fms_has_role(auth.uid(), 'production_supervisor'::fms_role));

CREATE POLICY "Supervisors can create limited invitations"
ON public.fms_user_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  fms_has_role(auth.uid(), 'production_supervisor'::fms_role)
  AND role IN ('production_operator','stores_operator','dispatch_user')
);

CREATE POLICY "Supervisors can update limited invitations"
ON public.fms_user_invitations
FOR UPDATE
TO authenticated
USING (
  fms_has_role(auth.uid(), 'production_supervisor'::fms_role)
  AND role IN ('production_operator','stores_operator','dispatch_user')
)
WITH CHECK (
  fms_has_role(auth.uid(), 'production_supervisor'::fms_role)
  AND role IN ('production_operator','stores_operator','dispatch_user')
);

-- Drop activity log table entirely (feature being removed)
DROP TABLE IF EXISTS public.fms_activity_log CASCADE;
