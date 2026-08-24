-- Stock Levels & Movements Tracking
-- Tracks current stock on hand per stock code and a full audit trail of movements

-- Stock levels table (current quantity on hand per stock code)
CREATE TABLE public.fms_stock_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_code_id UUID NOT NULL REFERENCES public.fms_stock_codes(id) ON DELETE CASCADE,
  quantity_on_hand DECIMAL NOT NULL DEFAULT 0,
  low_stock_threshold DECIMAL NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(stock_code_id)
);

ALTER TABLE public.fms_stock_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FMS users can view stock levels" ON public.fms_stock_levels
FOR SELECT USING (fms_has_access(auth.uid()));

CREATE POLICY "FMS users can manage stock levels" ON public.fms_stock_levels
FOR ALL USING (fms_has_access(auth.uid()));

-- Stock movements table (audit trail: what, when, for what)
CREATE TABLE public.fms_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_code_id UUID NOT NULL REFERENCES public.fms_stock_codes(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('receipt', 'batch_usage', 'adjustment')),
  quantity_change DECIMAL NOT NULL, -- positive = stock in, negative = stock out
  batch_id UUID REFERENCES public.fms_production_batches(id) ON DELETE SET NULL,
  batch_number TEXT,
  reference_id TEXT, -- e.g. receiving lot number or batch number
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.fms_stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FMS users can view stock movements" ON public.fms_stock_movements
FOR SELECT USING (fms_has_access(auth.uid()));

CREATE POLICY "FMS users can create stock movements" ON public.fms_stock_movements
FOR INSERT WITH CHECK (fms_has_access(auth.uid()));

CREATE POLICY "FMS users can manage stock movements" ON public.fms_stock_movements
FOR ALL USING (fms_has_access(auth.uid()));

-- Function to apply a stock movement and update the stock level atomically
CREATE OR REPLACE FUNCTION public.fms_apply_stock_movement(
  p_stock_code_id UUID,
  p_movement_type TEXT,
  p_quantity_change DECIMAL,
  p_batch_id UUID DEFAULT NULL,
  p_batch_number TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
) RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_quantity DECIMAL;
BEGIN
  -- Insert the movement record
  INSERT INTO public.fms_stock_movements (
    stock_code_id, movement_type, quantity_change, batch_id, batch_number,
    reference_id, notes, created_by
  ) VALUES (
    p_stock_code_id, p_movement_type, p_quantity_change, p_batch_id, p_batch_number,
    p_reference_id, p_notes, p_created_by
  );

  -- Upsert the stock level
  INSERT INTO public.fms_stock_levels (stock_code_id, quantity_on_hand)
  VALUES (p_stock_code_id, p_quantity_change)
  ON CONFLICT (stock_code_id)
  DO UPDATE SET
    quantity_on_hand = public.fms_stock_levels.quantity_on_hand + p_quantity_change,
    updated_at = now();

  -- Return the new quantity
  SELECT quantity_on_hand INTO v_new_quantity
  FROM public.fms_stock_levels
  WHERE stock_code_id = p_stock_code_id;

  RETURN v_new_quantity;
END;
$$;

-- Seed stock levels from existing receiving records (initial stock on hand)
INSERT INTO public.fms_stock_levels (stock_code_id, quantity_on_hand)
SELECT stock_code_id, SUM(quantity_received) as quantity_on_hand
FROM public.fms_receiving
WHERE status = 'accepted'
GROUP BY stock_code_id
ON CONFLICT (stock_code_id) DO NOTHING;

-- Seed stock levels from existing materials used (deduct from on hand)
UPDATE public.fms_stock_levels sl
SET quantity_on_hand = sl.quantity_on_hand - COALESCE((
  SELECT SUM(mu.quantity_used)
  FROM public.fms_materials_used mu
  JOIN public.fms_receiving r ON r.id = mu.receiving_record_id
  WHERE r.stock_code_id = sl.stock_code_id
), 0),
updated_at = now();