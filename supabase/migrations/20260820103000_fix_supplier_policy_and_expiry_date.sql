-- fms_receiving.expiry_date stays NOT NULL: expiry date is required for
-- traceability. The receiving workflow now always supplies a real expiry date.

-- Expand supplier management policy:
-- All FMS users can add/update suppliers (validation is enforced via the fms-validate edge function)
-- Only system_admin can delete (delete policy remains separate)
DROP POLICY IF EXISTS "FMS admins and supervisors can manage suppliers" ON public.fms_suppliers;

CREATE POLICY "FMS users can manage suppliers" ON public.fms_suppliers
FOR ALL USING (
  fms_has_role(auth.uid(), 'system_admin') OR
  fms_has_role(auth.uid(), 'production_supervisor') OR
  fms_has_role(auth.uid(), 'stores_operator') OR
  fms_has_role(auth.uid(), 'production_operator')
);