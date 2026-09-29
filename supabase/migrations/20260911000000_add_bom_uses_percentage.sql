-- Add bom_uses_percentage flag to fms_stock_codes
-- When true, the BOM for this product stores component quantities as fractions of 100
-- (quantity_per_batch = entered_percentage / 100) rather than as per-batch uom quantities.
-- Existing rows default to false, preserving current behaviour.
ALTER TABLE public.fms_stock_codes
  ADD COLUMN bom_uses_percentage BOOLEAN NOT NULL DEFAULT false;