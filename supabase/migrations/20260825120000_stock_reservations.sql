-- Reserve & Net Stock feature
-- Adds reserved quantity tracking on stock levels and a reservations table
-- that links each reservation to a Batch Sheet and to the underlying LOT
-- (receiving record) for full traceability.
--
-- Stock flow:
--   * Batch created/approved  -> reserve (set aside; physical stock untouched)
--   * Batch cancelled         -> release reservation (free the set-aside)
--   * Production completed    -> consume reservation (becomes actual consumption)
--
-- Net Stock = quantity_on_hand - reserved_quantity
-- A Batch Sheet may never reserve more than the Net Stock available.

-- 1. Track reserved quantity on stock levels (real-time, per stock code)
ALTER TABLE public.fms_stock_levels
  ADD COLUMN IF NOT EXISTS reserved_quantity DECIMAL NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_fms_stock_levels_stock_code
  ON public.fms_stock_levels(stock_code_id);

-- 2. Reservations table: links a reservation to a Batch Sheet + a LOT
--    (receiving record). This is the traceability bridge between a batch and
--    the physical lots it has set aside.
CREATE TABLE IF NOT EXISTS public.fms_stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.fms_production_batches(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  stock_code_id UUID NOT NULL REFERENCES public.fms_stock_codes(id) ON DELETE CASCADE,
  receiving_record_id UUID REFERENCES public.fms_receiving(id) ON DELETE SET NULL,
  internal_lot_number TEXT,
  quantity_reserved DECIMAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'consumed', 'released')),
  reserved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reserved_by UUID,
  consumed_at TIMESTAMP WITH TIME ZONE,
  consumed_by UUID,
  released_at TIMESTAMP WITH TIME ZONE,
  released_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fms_stock_reservations_batch
  ON public.fms_stock_reservations(batch_id);
CREATE INDEX IF NOT EXISTS idx_fms_stock_reservations_stock
  ON public.fms_stock_reservations(stock_code_id);
CREATE INDEX IF NOT EXISTS idx_fms_stock_reservations_lot
  ON public.fms_stock_reservations(receiving_record_id);
CREATE INDEX IF NOT EXISTS idx_fms_stock_reservations_status
  ON public.fms_stock_reservations(status);

ALTER TABLE public.fms_stock_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FMS users can view stock reservations" ON public.fms_stock_reservations
  FOR SELECT USING (fms_has_access(auth.uid()));
CREATE POLICY "FMS users can manage stock reservations" ON public.fms_stock_reservations
  FOR ALL USING (fms_has_access(auth.uid()));
-- 3. Make the FIFO lot allocator reservation-aware (and fix a latent JOIN
--    multiplication bug). Reserved stock must not be handed to another batch.
--    Net available per lot = received - consumed - reserved
CREATE OR REPLACE FUNCTION public.fms_fifo_allocate_lots(
  p_stock_code_id UUID,
  p_quantity_required DECIMAL
) RETURNS TABLE(
  receiving_record_id UUID,
  internal_lot_number TEXT,
  quantity_available DECIMAL,
  quantity_to_use DECIMAL,
  expiry_date DATE,
  received_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining DECIMAL := p_quantity_required;
  v_lot_record RECORD;
BEGIN
  -- Return nothing if no quantity required
  IF p_quantity_required <= 0 THEN
    RETURN;
  END IF;

  FOR v_lot_record IN
    WITH lot_net AS (
      SELECT
        r.id,
        r.internal_lot_number,
        r.quantity_received
          - COALESCE((SELECT SUM(mu.quantity_used) FROM public.fms_materials_used mu WHERE mu.receiving_record_id = r.id), 0)
          - COALESCE((SELECT SUM(sr.quantity_reserved) FROM public.fms_stock_reservations sr WHERE sr.receiving_record_id = r.id AND sr.status = 'reserved'), 0)
          AS net_available,
        r.expiry_date,
        r.received_at
      FROM public.fms_receiving r
      WHERE r.stock_code_id = p_stock_code_id
        AND r.status = 'accepted'
    )
    SELECT ln.id, ln.internal_lot_number, ln.net_available, ln.expiry_date, ln.received_at
    FROM lot_net ln
    WHERE ln.net_available > 0
    ORDER BY
      expiry_date ASC NULLS LAST,
      received_at ASC
  LOOP
    IF v_remaining <= 0 THEN
      EXIT;
    END IF;

    receiving_record_id := v_lot_record.id;
    internal_lot_number := v_lot_record.internal_lot_number;
    quantity_available := v_lot_record.net_available;
    quantity_to_use := LEAST(v_lot_record.net_available, v_remaining);
    expiry_date := v_lot_record.expiry_date;
    received_at := v_lot_record.received_at;

    v_remaining := v_remaining - quantity_to_use;

    RETURN NEXT;
  END LOOP;
END;
$$;
-- 4. Extend the movement audit trail with reservation lifecycle events.
--    Drop any existing check on movement_type (find it dynamically to be safe
--    regardless of its auto-generated name) and replace with the expanded list.
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_catalog.pg_constraint con
  WHERE con.connamespace = 'public'::regnamespace
    AND con.conrelid = 'public.fms_stock_movements'::regclass
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%movement_type%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.fms_stock_movements DROP CONSTRAINT %I', cname);
  END IF;
END;
$$;

ALTER TABLE public.fms_stock_movements
  ADD CONSTRAINT fms_stock_movements_movement_type_check
  CHECK (movement_type IN ('receipt', 'batch_usage', 'adjustment', 'reservation', 'reservation_release'));
-- 5. Reserve stock for a batch (set aside; physical stock is NOT reduced).
--    Validates that the total reserved for a stock code never exceeds the Net
--    Stock (quantity_on_hand - reserved_quantity). Raises a user-defined
--    exception when there is not enough net stock.
CREATE OR REPLACE FUNCTION public.fms_reserve_batch_stock(
  p_batch_id UUID,
  p_batch_number TEXT,
  p_reservations JSONB,
  p_created_by UUID DEFAULT NULL
) RETURNS TABLE(
  stock_code_id UUID,
  quantity_reserved DECIMAL,
  net_stock_after DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_code RECORD;
  r_res RECORD;
  v_total DECIMAL;
  v_on_hand DECIMAL;
  v_reserved DECIMAL;
  v_net_stock DECIMAL;
BEGIN
  -- Pass 1: validate per stock code (atomic via row lock) that we are not
  -- reserving more than the available Net Stock.
  FOR r_code IN
    SELECT x.stock_code_id, SUM(x.quantity) AS total
    FROM jsonb_to_recordset(p_reservations)
      AS x(stock_code_id UUID, receiving_record_id UUID, internal_lot_number TEXT, quantity DECIMAL)
    GROUP BY x.stock_code_id
    ORDER BY x.stock_code_id
  LOOP
    v_total := r_code.total;
    SELECT sl.quantity_on_hand, sl.reserved_quantity
      INTO v_on_hand, v_reserved
    FROM public.fms_stock_levels sl
    WHERE sl.stock_code_id = r_code.stock_code_id
    FOR UPDATE;

    IF v_total > (v_on_hand - v_reserved) THEN
      RAISE EXCEPTION 'Insufficient net stock for stock code %: trying to reserve % but only % available (net)',
        r_code.stock_code_id, v_total, (v_on_hand - v_reserved)
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Pass 2: create reservation records (one per lot) and bump reserved_quantity.
  FOR r_res IN
    SELECT x.stock_code_id, x.receiving_record_id, x.internal_lot_number, x.quantity
    FROM jsonb_to_recordset(p_reservations)
      AS x(stock_code_id UUID, receiving_record_id UUID, internal_lot_number TEXT, quantity DECIMAL)
    ORDER BY x.stock_code_id, x.receiving_record_id
  LOOP
    INSERT INTO public.fms_stock_reservations (
      batch_id, batch_number, stock_code_id, receiving_record_id,
      internal_lot_number, quantity_reserved, reserved_by, status
    ) VALUES (
      p_batch_id, p_batch_number, r_res.stock_code_id, r_res.receiving_record_id,
      r_res.internal_lot_number, r_res.quantity, p_created_by, 'reserved'
    );

    UPDATE public.fms_stock_levels sl
    SET reserved_quantity = sl.reserved_quantity + r_res.quantity,
        updated_at = now()
    WHERE sl.stock_code_id = r_res.stock_code_id;
  END LOOP;

  -- Pass 3: audit trail + return summary (per stock code)
  FOR r_res IN
    SELECT sr.stock_code_id, SUM(sr.quantity_reserved) AS total
    FROM public.fms_stock_reservations sr
    WHERE sr.batch_id = p_batch_id AND sr.status = 'reserved'
    GROUP BY sr.stock_code_id
  LOOP
    INSERT INTO public.fms_stock_movements (
      stock_code_id, movement_type, quantity_change, batch_id, batch_number,
      reference_id, notes, created_by
    ) VALUES (
      r_res.stock_code_id, 'reservation', r_res.total,
      p_batch_id, p_batch_number, p_batch_number,
      format('Batch %s reserved %s units', p_batch_number, r_res.total),
      p_created_by
    );

    SELECT sl.quantity_on_hand - sl.reserved_quantity INTO v_net_stock
    FROM public.fms_stock_levels sl
    WHERE sl.stock_code_id = r_res.stock_code_id;

    stock_code_id := r_res.stock_code_id;
    quantity_reserved := r_res.total;
    net_stock_after := v_net_stock;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;
-- 6. Release reservations for a batch (used when a batch is cancelled).
--    Reserved stock is freed; physical stock is NOT touched (it was never
--    deducted).
CREATE OR REPLACE FUNCTION public.fms_release_batch_reservations(
  p_batch_id UUID,
  p_batch_number TEXT,
  p_created_by UUID DEFAULT NULL
) RETURNS TABLE(
  stock_code_id UUID,
  quantity_released DECIMAL,
  net_stock_after DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_rec RECORD;
  v_released DECIMAL;
  v_net_stock DECIMAL;
BEGIN
  FOR r_rec IN
    SELECT sr.stock_code_id, SUM(sr.quantity_reserved) AS total
    FROM public.fms_stock_reservations sr
    WHERE sr.batch_id = p_batch_id AND sr.status = 'reserved'
    GROUP BY sr.stock_code_id
  LOOP
    v_released := r_rec.total;

    UPDATE public.fms_stock_reservations sr
    SET status = 'released', released_by = p_created_by, released_at = now()
    WHERE sr.batch_id = p_batch_id
      AND sr.stock_code_id = r_rec.stock_code_id
      AND sr.status = 'reserved';

    UPDATE public.fms_stock_levels sl
    SET reserved_quantity = sl.reserved_quantity - v_released,
        updated_at = now()
    WHERE sl.stock_code_id = r_rec.stock_code_id;

    INSERT INTO public.fms_stock_movements (
      stock_code_id, movement_type, quantity_change, batch_id, batch_number,
      reference_id, notes, created_by
    ) VALUES (
      r_rec.stock_code_id, 'reservation_release', -v_released,
      p_batch_id, p_batch_number, p_batch_number,
      format('Batch %s released %s units of reserved stock', p_batch_number, v_released),
      p_created_by
    );

    SELECT sl.quantity_on_hand - sl.reserved_quantity INTO v_net_stock
    FROM public.fms_stock_levels sl
    WHERE sl.stock_code_id = r_rec.stock_code_id;

    stock_code_id := r_rec.stock_code_id;
    quantity_released := v_released;
    net_stock_after := v_net_stock;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;
-- 7. Consume reservations for a batch (used when production is completed).
--    The reserved set-aside becomes actual stock consumption:
--      * a lot-level fms_materials_used record is created (traceability)
--      * reserved_quantity is released and quantity_on_hand is decremented
--      * a 'batch_usage' movement is recorded (physical consumption)
--    Batches with no active reservations (legacy batches) are a no-op here.
CREATE OR REPLACE FUNCTION public.fms_consume_batch_reservations(
  p_batch_id UUID,
  p_batch_number TEXT,
  p_created_by UUID DEFAULT NULL
) RETURNS TABLE(
  stock_code_id UUID,
  new_quantity_on_hand DECIMAL,
  is_low BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_lot RECORD;
  r_low RECORD;
  v_qty_on_hand DECIMAL;
  v_low_stock_threshold DECIMAL;
BEGIN
  -- Consume each reserved lot
  FOR r_lot IN
    SELECT sr.id, sr.stock_code_id, sr.receiving_record_id, sr.internal_lot_number, sr.quantity_reserved
    FROM public.fms_stock_reservations sr
    WHERE sr.batch_id = p_batch_id AND sr.status = 'reserved'
    ORDER BY sr.stock_code_id, sr.receiving_record_id
  LOOP
    -- Lot-level traceability record (which lot was actually consumed)
    INSERT INTO public.fms_materials_used (batch_id, receiving_record_id, quantity_used)
    VALUES (p_batch_id, r_lot.receiving_record_id, r_lot.quantity_reserved);

    -- Release the reservation hold and consume the physical stock
    UPDATE public.fms_stock_reservations
    SET status = 'consumed', consumed_by = p_created_by, consumed_at = now()
    WHERE id = r_lot.id;

    UPDATE public.fms_stock_levels sl
    SET quantity_on_hand = sl.quantity_on_hand - r_lot.quantity_reserved,
        reserved_quantity = sl.reserved_quantity - r_lot.quantity_reserved,
        updated_at = now()
    WHERE sl.stock_code_id = r_lot.stock_code_id;

    -- Audit trail: actual physical consumption
    INSERT INTO public.fms_stock_movements (
      stock_code_id, movement_type, quantity_change, batch_id, batch_number,
      reference_id, notes, created_by
    ) VALUES (
      r_lot.stock_code_id, 'batch_usage', -r_lot.quantity_reserved,
      p_batch_id, p_batch_number,
      r_lot.internal_lot_number,
      format('Batch %s consumed %s units from lot %s', p_batch_number, r_lot.quantity_reserved, r_lot.internal_lot_number),
      p_created_by
    );
  END LOOP;

  -- Return low-stock summary per stock code consumed for this batch
  FOR r_low IN
    SELECT DISTINCT sr.stock_code_id
    FROM public.fms_stock_reservations sr
    WHERE sr.batch_id = p_batch_id AND sr.status = 'consumed'
  LOOP
    SELECT sl.quantity_on_hand, sl.low_stock_threshold
      INTO v_qty_on_hand, v_low_stock_threshold
    FROM public.fms_stock_levels sl
    WHERE sl.stock_code_id = r_low.stock_code_id
    FOR UPDATE;

    stock_code_id := r_low.stock_code_id;
    new_quantity_on_hand := v_qty_on_hand;
    is_low := (v_qty_on_hand < 0 OR v_qty_on_hand <= v_low_stock_threshold);
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;
