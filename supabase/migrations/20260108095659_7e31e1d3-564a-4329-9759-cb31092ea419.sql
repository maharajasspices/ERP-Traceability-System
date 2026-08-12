-- Add DELETE policies to all FMS tables that only allow the system admin (by email)
-- This enforces server-side what was previously only client-side

-- Create a helper function to check if user is the FMS delete admin
CREATE OR REPLACE FUNCTION public.fms_is_delete_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = _user_id 
    AND email = 'zulaigah.benjamin@maharajasspices.co.za'
  );
$$;

-- fms_suppliers - Add DELETE policy
CREATE POLICY "Only admin can delete suppliers"
ON public.fms_suppliers
FOR DELETE
USING (fms_is_delete_admin(auth.uid()));

-- fms_stock_codes - Add DELETE policy  
CREATE POLICY "Only admin can delete stock codes"
ON public.fms_stock_codes
FOR DELETE
USING (fms_is_delete_admin(auth.uid()));

-- fms_receiving - Add DELETE policy
CREATE POLICY "Only admin can delete receiving records"
ON public.fms_receiving
FOR DELETE
USING (fms_is_delete_admin(auth.uid()));

-- fms_bom - Add DELETE policy
CREATE POLICY "Only admin can delete BOMs"
ON public.fms_bom
FOR DELETE
USING (fms_is_delete_admin(auth.uid()));

-- fms_bom_components - Add DELETE policy
CREATE POLICY "Only admin can delete BOM components"
ON public.fms_bom_components
FOR DELETE
USING (fms_is_delete_admin(auth.uid()));

-- fms_production_batches - Add DELETE policy
CREATE POLICY "Only admin can delete production batches"
ON public.fms_production_batches
FOR DELETE
USING (fms_is_delete_admin(auth.uid()));

-- fms_materials_used - Add DELETE policy
CREATE POLICY "Only admin can delete materials used"
ON public.fms_materials_used
FOR DELETE
USING (fms_is_delete_admin(auth.uid()));

-- fms_dispatch - Add DELETE policy
CREATE POLICY "Only admin can delete dispatch records"
ON public.fms_dispatch
FOR DELETE
USING (fms_is_delete_admin(auth.uid()));

-- fms_dispatch_items - Add DELETE policy
CREATE POLICY "Only admin can delete dispatch items"
ON public.fms_dispatch_items
FOR DELETE
USING (fms_is_delete_admin(auth.uid()));