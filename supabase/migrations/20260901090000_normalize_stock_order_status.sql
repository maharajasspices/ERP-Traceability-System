-- =====================================================================
-- Normalize stock order status values to match the CHECK constraint.
-- Codes previously wrote uppercase values (PENDING_RECEIPT etc.) which
-- violate the constraint and break receipt confirmation. Idempotent.
-- =====================================================================

-- 1) Fix any rows stored with legacy uppercase values
UPDATE public.fms_stock_orders
SET status = CASE status
  WHEN 'PENDING_RECEIPT' THEN 'PENDING_RECEIPT'
  WHEN 'PARTIALLY_RECEIVED' THEN 'partial'
  WHEN 'CHECKED' THEN 'received'
  WHEN 'CANCELLED' THEN 'cancelled'
  ELSE status
END
WHERE status IN ('PENDING_RECEIPT', 'PARTIALLY_RECEIVED', 'CHECKED', 'CANCELLED');

-- 2) Replace ANY existing status check constraint with one that accepts
--    both the canonical lowercase set and the legacy uppercase set, so
--    rows from old app versions and new app versions are both valid.
DO $$
DECLARE
  con_name TEXT;
BEGIN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.fms_stock_orders'::regclass
      AND c.contype = 'c'
      AND a.attname = 'status'
  LOOP
    EXECUTE format('ALTER TABLE public.fms_stock_orders DROP CONSTRAINT %I', con_name);
  END LOOP;
END $$;

ALTER TABLE public.fms_stock_orders
  ADD CONSTRAINT fms_stock_orders_status_check
  CHECK (
    status IN (
      'PENDING_RECEIPT', 'partial', 'received', 'cancelled',
      'PENDING_RECEIPT', 'PARTIALLY_RECEIVED', 'CHECKED', 'CANCELLED'
    )
  );

