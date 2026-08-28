-- =====================================================================
-- Stock Orders (Purchase Orders awaiting receipt) + Receipt confirmation
-- Flow: upload the invoice/order with line items -> when stock arrives,
-- tick the received line items and capture actual weights.
-- Idempotent.
-- =====================================================================

-- 1) Order header -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fms_stock_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES public.fms_suppliers(id),
  invoice_number TEXT,
  invoice_file_path TEXT,          -- path inside the 'order-documents' storage bucket
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'awaiting_receipt'
    CHECK (status IN ('awaiting_receipt', 'partial', 'received')),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2) Order line items (one row per material on the invoice) -----------
CREATE TABLE IF NOT EXISTS public.fms_stock_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.fms_stock_orders(id) ON DELETE CASCADE,
  stock_code_id UUID NOT NULL REFERENCES public.fms_stock_codes(id),
  quantity_ordered DECIMAL NOT NULL CHECK (quantity_ordered > 0),
  uom TEXT NOT NULL DEFAULT 'kg',
  -- Receipt confirmation (tick + weight)
  received BOOLEAN NOT NULL DEFAULT false,
  quantity_received DECIMAL CHECK (quantity_received > 0),
  received_lot_number TEXT,
  received_at TIMESTAMP WITH TIME ZONE,
  received_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_order_items_order
  ON public.fms_stock_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_orders_status
  ON public.fms_stock_orders(status);

-- 3) RLS ---------------------------------------------------------------
ALTER TABLE public.fms_stock_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fms_stock_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users manage stock orders" ON public.fms_stock_orders;
CREATE POLICY "Authenticated users manage stock orders"
  ON public.fms_stock_orders FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage stock order items" ON public.fms_stock_order_items;
CREATE POLICY "Authenticated users manage stock order items"
  ON public.fms_stock_order_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 4) Private storage bucket for uploaded invoice/order documents ------
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-documents', 'order-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users manage order documents" ON storage.objects;
CREATE POLICY "Authenticated users manage order documents"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'order-documents')
  WITH CHECK (bucket_id = 'order-documents');