
-- 1) Restrict write access on fms_supplier_material_prices to admins/supervisors
DROP POLICY IF EXISTS "FMS users can insert supplier material prices" ON public.fms_supplier_material_prices;
DROP POLICY IF EXISTS "FMS users can update supplier material prices" ON public.fms_supplier_material_prices;
DROP POLICY IF EXISTS "fms_supplier_material_prices_insert" ON public.fms_supplier_material_prices;
DROP POLICY IF EXISTS "fms_supplier_material_prices_update" ON public.fms_supplier_material_prices;
DROP POLICY IF EXISTS "Authenticated FMS users can insert prices" ON public.fms_supplier_material_prices;
DROP POLICY IF EXISTS "Authenticated FMS users can update prices" ON public.fms_supplier_material_prices;

CREATE POLICY "Admins and supervisors can insert supplier material prices"
ON public.fms_supplier_material_prices
FOR INSERT
TO authenticated
WITH CHECK (
  public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
  OR public.fms_has_role(auth.uid(), 'production_supervisor'::fms_role)
);

CREATE POLICY "Admins and supervisors can update supplier material prices"
ON public.fms_supplier_material_prices
FOR UPDATE
TO authenticated
USING (
  public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
  OR public.fms_has_role(auth.uid(), 'production_supervisor'::fms_role)
)
WITH CHECK (
  public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
  OR public.fms_has_role(auth.uid(), 'production_supervisor'::fms_role)
);

-- 2) Hide credit_pin hash column from clients (anon/authenticated)
--    The set_credit_pin() and verify_credit_pin() SECURITY DEFINER functions
--    continue to operate on the column with elevated privileges.
REVOKE SELECT (credit_pin) ON public.user_credits FROM anon;
REVOKE SELECT (credit_pin) ON public.user_credits FROM authenticated;
REVOKE UPDATE (credit_pin), INSERT (credit_pin) ON public.user_credits FROM anon;
REVOKE UPDATE (credit_pin), INSERT (credit_pin) ON public.user_credits FROM authenticated;
