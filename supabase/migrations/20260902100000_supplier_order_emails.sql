-- =====================================================================
-- Supplier order emails: record every stock order emailed to a supplier
-- so the app can show "Pending Delivery" (who we emailed, for what,
-- and how much) until the stock arrives.
-- Idempotent.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.fms_supplier_order_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.fms_suppliers(id) ON DELETE CASCADE,
  stock_code_id UUID NOT NULL REFERENCES public.fms_stock_codes(id) ON DELETE CASCADE,
  quantity DECIMAL NOT NULL CHECK (quantity > 0),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'received', 'cancelled')),
  emailed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  emailed_by UUID,
  received_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fms_supplier_order_emails_supplier
  ON public.fms_supplier_order_emails(supplier_id);
CREATE INDEX IF NOT EXISTS idx_fms_supplier_order_emails_stock
  ON public.fms_supplier_order_emails(stock_code_id);
CREATE INDEX IF NOT EXISTS idx_fms_supplier_order_emails_status
  ON public.fms_supplier_order_emails(status);

ALTER TABLE public.fms_supplier_order_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FMS users can view supplier order emails" ON public.fms_supplier_order_emails;
CREATE POLICY "FMS users can view supplier order emails"
  ON public.fms_supplier_order_emails
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "FMS users can create supplier order emails" ON public.fms_supplier_order_emails;
CREATE POLICY "FMS users can create supplier order emails"
  ON public.fms_supplier_order_emails
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "FMS users can update supplier order emails" ON public.fms_supplier_order_emails;
CREATE POLICY "FMS users can update supplier order emails"
  ON public.fms_supplier_order_emails
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "FMS users can delete supplier order emails" ON public.fms_supplier_order_emails;
CREATE POLICY "FMS users can delete supplier order emails"
  ON public.fms_supplier_order_emails
  FOR DELETE TO authenticated
  USING (true);