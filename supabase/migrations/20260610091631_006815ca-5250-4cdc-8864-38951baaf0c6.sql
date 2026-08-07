
-- Allow appropriate FMS roles to update receiving records (for corrections, COA editing, etc.)
CREATE POLICY "FMS users can update receiving records"
ON public.fms_receiving
FOR UPDATE
TO authenticated
USING (
  public.fms_has_role(auth.uid(), 'system_admin')
  OR public.fms_has_role(auth.uid(), 'production_supervisor')
  OR public.fms_has_role(auth.uid(), 'stores_operator')
)
WITH CHECK (
  public.fms_has_role(auth.uid(), 'system_admin')
  OR public.fms_has_role(auth.uid(), 'production_supervisor')
  OR public.fms_has_role(auth.uid(), 'stores_operator')
);

-- Allow appropriate FMS roles to update dispatch records
CREATE POLICY "FMS users can update dispatch records"
ON public.fms_dispatch
FOR UPDATE
TO authenticated
USING (
  public.fms_has_role(auth.uid(), 'system_admin')
  OR public.fms_has_role(auth.uid(), 'production_supervisor')
  OR public.fms_has_role(auth.uid(), 'dispatch_user')
)
WITH CHECK (
  public.fms_has_role(auth.uid(), 'system_admin')
  OR public.fms_has_role(auth.uid(), 'production_supervisor')
  OR public.fms_has_role(auth.uid(), 'dispatch_user')
);
