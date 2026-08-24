-- FIFO Lot Allocation Function
-- Returns the specific lots (receiving records) to consume from, in FIFO order
-- FIFO = earliest expiry date first, then earliest received date first
-- Takes into account already-used quantities from fms_materials_used

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
    SELECT 
      r.id,
      r.internal_lot_number,
      r.quantity_received - COALESCE(SUM(mu.quantity_used), 0) AS net_available,
      r.expiry_date,
      r.received_at
    FROM public.fms_receiving r
    LEFT JOIN public.fms_materials_used mu ON mu.receiving_record_id = r.id
    WHERE r.stock_code_id = p_stock_code_id
      AND r.status = 'accepted'
    GROUP BY r.id, r.internal_lot_number, r.quantity_received, r.expiry_date, r.received_at
    HAVING r.quantity_received - COALESCE(SUM(mu.quantity_used), 0) > 0
    ORDER BY 
      r.expiry_date ASC NULLS LAST,  -- Earliest expiry first
      r.received_at ASC               -- Oldest received first
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