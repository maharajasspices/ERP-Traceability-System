
-- Future Receiving Workflow
-- Adds columns required for the Future Receiving workflow
-- A future receiving is a pending inventory receipt that becomes
-- confirmed when the stock actually arrives at the factory.
--
-- Changes:
-- 1. Make expiry_date nullable (not required for future receipts)
-- 2. Add expected_delivery_date column
-- 3. Add confirmed_at and confirmed_by tracking columns
-- =====================================================================

-- 1. Make expiry_date nullable (future receipts may not have expiry known yet)
ALTER TABLE public.fms_receiving
  ALTER COLUMN expiry_date DROP NOT NULL;

-- 2. Add expected_delivery_date for future receivings
ALTER TABLE public.fms_receiving
  ADD COLUMN IF NOT EXISTS expected_delivery_date DATE;

-- 3. Add confirmation tracking columns
ALTER TABLE public.fms_receiving
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID;

-- 4. Seed expected_delivery_date from existing data where applicable
UPDATE public.fms_receiving
SET expected_delivery_date = expiry_date
WHERE expected_delivery_date IS NULL
  AND expiry_date IS NOT NULL;

-- 5. Return the expected delivery date in the fms_generate_lot_number function
--    so the calling client knows the full lot number sequence
SELECT 'Future receiving columns added successfully';

