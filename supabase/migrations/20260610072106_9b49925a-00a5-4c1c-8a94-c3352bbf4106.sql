
-- Supplier-specific material cost prices (manual input, per kg)
CREATE TABLE public.fms_supplier_material_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.fms_suppliers(id) ON DELETE CASCADE,
  stock_code_id UUID NOT NULL REFERENCES public.fms_stock_codes(id) ON DELETE CASCADE,
  cost_price_per_kg NUMERIC(12,4) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  notes TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, stock_code_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fms_supplier_material_prices TO authenticated;
GRANT ALL ON public.fms_supplier_material_prices TO service_role;

ALTER TABLE public.fms_supplier_material_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FMS users can view material prices"
  ON public.fms_supplier_material_prices FOR SELECT TO authenticated
  USING (public.fms_has_access(auth.uid()));

CREATE POLICY "FMS users can insert material prices"
  ON public.fms_supplier_material_prices FOR INSERT TO authenticated
  WITH CHECK (public.fms_has_access(auth.uid()));

CREATE POLICY "FMS users can update material prices"
  ON public.fms_supplier_material_prices FOR UPDATE TO authenticated
  USING (public.fms_has_access(auth.uid()))
  WITH CHECK (public.fms_has_access(auth.uid()));

CREATE POLICY "Admins can delete material prices"
  ON public.fms_supplier_material_prices FOR DELETE TO authenticated
  USING (public.fms_is_delete_admin(auth.uid()));

CREATE TRIGGER trg_fms_supplier_material_prices_updated
  BEFORE UPDATE ON public.fms_supplier_material_prices
  FOR EACH ROW EXECUTE FUNCTION public.fms_update_updated_at();

-- Snapshot the cost price at time of receiving (editable later)
ALTER TABLE public.fms_receiving
  ADD COLUMN IF NOT EXISTS cost_price_per_kg NUMERIC(12,4);
