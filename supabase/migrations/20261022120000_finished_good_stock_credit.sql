-- Finished-good stock credit on production close
-- ================================================
-- When a standard production batch is closed, credit actual_quantity_produced
-- to the batch's finished_good_id as a 'receipt' stock movement, exactly once.
--
-- Problem: fms_apply_stock_movement blindly inserts a movement on every call,
-- and fms_stock_movements has no uniqueness guard on (batch, movement). A
-- repeated close or a retried request would credit the finished good twice,
-- inflating finished-good stock on hand.
--
-- Fix (smallest safe schema change):
--   1. finished_good_stock_credited flag on fms_production_batches (idempotency flag).
--   2. fms_credit_finished_good_production RPC: locks the batch row (FOR UPDATE),
--      returns early if already credited, otherwise posts the receipt movement and
--      updates stock level via the existing fms_apply_stock_movement, then sets
--      the flag. All in one transaction, so repeated closes and retries are safe.
--   3. Defensive partial unique index: never two finished-good receipt movements
--      for the same batch, even if something bypasses the RPC.

-- 1. Idempotency flag: has the finished-good receipt already been posted?
ALTER TABLE public.fms_production_batches
  ADD COLUMN IF NOT EXISTS finished_good_stock_credited BOOLEAN NOT NULL DEFAULT false;

-- 2. Secure, idempotent finished-good credit.
--    The credited quantity is read from the batch's recorded
--    actual_quantity_produced, never from a client-supplied value.
--    Only the batch id is accepted from the caller; all other values
--    are derived from the database or the authenticated session.
CREATE OR REPLACE FUNCTION public.fms_credit_finished_good_production(
 p_batch_id UUID
) RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_finished_good_id UUID;
  v_credited BOOLEAN;
  v_actual_quantity DECIMAL;
  v_batch_status TEXT;
  v_batch_number TEXT;
  v_new_quantity DECIMAL;
BEGIN
  -- Require an authenticated, authorized caller before touching stock.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated: auth.uid() is null';
  END IF;

  IF NOT COALESCE(public.fms_has_access(auth.uid()), false) THEN
    RAISE EXCEPTION 'Unauthorized: no FMS access for user %', auth.uid();
  END IF;

  -- Lock the batch row so repeated closes / retried requests serialize.
  SELECT finished_good_id, finished_good_stock_credited, actual_quantity_produced, status, batch_number
    INTO v_finished_good_id, v_credited, v_actual_quantity, v_batch_status, v_batch_number
    FROM public.fms_production_batches
   WHERE id = p_batch_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production batch % not found', p_batch_id;
  END IF;

  -- Require a closed batch with a valid finished good.
  IF v_batch_status <> 'closed' THEN
    RAISE EXCEPTION 'Production batch % is not closed (status: %)', p_batch_id, v_batch_status;
  END IF;

  IF v_finished_good_id IS NULL THEN
    RAISE EXCEPTION 'Production batch % has no finished_good_id', p_batch_id;
  END IF;

  -- Use the batch's recorded actual_quantity_produced, not a client value.
  IF v_actual_quantity IS NULL OR v_actual_quantity <= 0 THEN
    RETURN 0;
  END IF;

  -- Already credited? No-op -- safe for repeated closes and retries.
  IF v_credited THEN
    SELECT quantity_on_hand INTO v_new_quantity
      FROM public.fms_stock_levels
     WHERE stock_code_id = v_finished_good_id;
    RETURN COALESCE(v_new_quantity, 0);
  END IF;

  -- Post the finished-good receipt using the existing atomic movement mechanism.
  PERFORM public.fms_apply_stock_movement(
    p_stock_code_id := v_finished_good_id,
    p_movement_type := 'receipt',
    p_quantity_change := v_actual_quantity,
    p_batch_id := p_batch_id,
    p_batch_number := v_batch_number,
    p_reference_id := format('finished_good:%s', v_batch_number),
    p_notes := format('Finished goods produced by batch %s', v_batch_number),
    p_created_by := auth.uid()
  );

  -- Mark the batch as credited so any further close is a no-op.
  UPDATE public.fms_production_batches
     SET finished_good_stock_credited = true
   WHERE id = p_batch_id;

  SELECT quantity_on_hand INTO v_new_quantity
    FROM public.fms_stock_levels
   WHERE stock_code_id = v_finished_good_id;

  RETURN COALESCE(v_new_quantity, 0);
END;
$$;

-- Restrict EXECUTE to authenticated users only; no public or anon access.
REVOKE ALL ON FUNCTION public.fms_credit_finished_good_production(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fms_credit_finished_good_production(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.fms_credit_finished_good_production(UUID) TO authenticated;

-- 3. Belt-and-braces constraint: at most one finished-good receipt per batch.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fms_stock_movements_one_fg_receipt_per_batch
  ON public.fms_stock_movements (batch_id)
  WHERE movement_type = 'receipt'
    AND reference_id ~ '^finished_good:';