-- Pending Receiving Protection
-- ==============================
-- 1. Idempotency flag: has stock already been applied for this pending receiving record?
ALTER TABLE public.fms_receiving
  ADD COLUMN IF NOT EXISTS stock_applied BOOLEAN NOT NULL DEFAULT false;

-- 2. Defensive unique index: never two receipt movements for the same receiving record.
-- We use reference_id to identify the receiving record (internal_lot_number pattern).
CREATE UNIQUE INDEX IF NOT EXISTS idx_fms_stock_movements_one_receipt_per_lot
  ON public.fms_stock_movements (reference_id)
  WHERE movement_type = 'receipt'
    AND reference_id IS NOT NULL
    AND reference_id != '';

-- 3. Secure, idempotent stock application for pending receiving.
--    Only called once per receiving record. On repeated calls it is a no-op.
CREATE OR REPLACE FUNCTION public.fms_apply_stock_movement_idempotent(
  p_stock_code_id UUID,
  p_movement_type TEXT,
  p_quantity_change DECIMAL,
  p_receiving_record_id UUID,
  p_batch_id UUID DEFAULT NULL,
  p_batch_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
) RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_quantity DECIMAL;
  v_already_applied BOOLEAN;
BEGIN
  -- Lock the receiving record so repeated calls / retries serialize.
  SELECT stock_applied INTO v_already_applied
    FROM public.fms_receiving
   WHERE id = p_receiving_record_id
   FOR UPDATE;

  IF v_already_applied THEN
    -- Already applied: return current stock level, no-op.
    SELECT quantity_on_hand INTO v_new_quantity
      FROM public.fms_stock_levels
     WHERE stock_code_id = p_stock_code_id;
    RETURN COALESCE(v_new_quantity, 0);
  END IF;

  -- Insert the movement record (will be blocked by unique index if somehow duplicated).
  INSERT INTO public.fms_stock_movements (
    stock_code_id, movement_type, quantity_change, batch_id, batch_number,
    reference_id, notes, created_by
  ) VALUES (
    p_stock_code_id, p_movement_type, p_quantity_change, p_batch_id, p_batch_number,
    p_receiving_record_id::TEXT, p_notes, p_created_by
  );

  -- Upsert the stock level
  INSERT INTO public.fms_stock_levels (stock_code_id, quantity_on_hand)
  VALUES (p_stock_code_id, p_quantity_change)
  ON CONFLICT (stock_code_id)
  DO UPDATE SET
    quantity_on_hand = public.fms_stock_levels.quantity_on_hand + p_quantity_change,
    updated_at = now();

  -- Mark the receiving record as having had stock applied.
  UPDATE public.fms_receiving
     SET stock_applied = true
   WHERE id = p_receiving_record_id;

  -- Return the new quantity
  SELECT quantity_on_hand INTO v_new_quantity
  FROM public.fms_stock_levels
  WHERE stock_code_id = p_stock_code_id;

  RETURN COALESCE(v_new_quantity, 0);
END;
$$;

-- Revoke public/anon access; only authenticated users can apply stock.
REVOKE ALL ON FUNCTION public.fms_apply_stock_movement_idempotent(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fms_apply_stock_movement_idempotent(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.fms_apply_stock_movement_idempotent(UUID) TO authenticated;