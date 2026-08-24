-- Fix fms_stock_codes RLS to allow all active FMS users to manage stock codes
DROP POLICY IF EXISTS "FMS admins and supervisors can manage stock codes" ON public.fms_stock_codes;

CREATE POLICY "FMS users can manage stock codes" ON public.fms_stock_codes
FOR ALL USING (fms_has_access(auth.uid()))
WITH CHECK (fms_has_access(auth.uid()));

-- Keep DELETE admin-only for safety
DROP POLICY IF EXISTS "Only admin can delete stock codes" ON public.fms_stock_codes;
CREATE POLICY "Only admin can delete stock codes"
ON public.fms_stock_codes
FOR DELETE
USING (fms_has_role(auth.uid(), 'system_admin'));