-- =====================================================================
-- Dispatch invoice upload + scan verification
--
-- Turns Dispatch from "one row already shipped" into a verifiable flow:
--
--   Upload invoice  ->  fms_dispatch_requirements (what the customer ordered)
--   TOVI scan       ->  quantity_scanned, guarded by quantity_required
--   All fulfilled   ->  status 'ready'
--   Lady confirms   ->  status 'dispatched'
--
-- Design notes:
--  * ONE row per uploaded invoice in fms_dispatch_invoices, so a single
--    dispatch can group several invoices for one delivery.
--  * ONE row per invoice LINE in fms_dispatch_requirements. Deliberately
--    NOT unique on (dispatch_id, stock_code_id): the same product can appear
--    on two different invoices and each occurrence must stay traceable back
--    to its own invoice.
--  * fms_dispatch_items stays the BATCH-level "which production batch is
--    being picked" record, now with its own scanned counter.
-- =====================================================================

-- 1) Dispatch lifecycle status -----------------------------------------
ALTER TABLE public.fms_dispatch
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'picking', 'ready', 'dispatched')),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID;

-- 2) Allow ONE dispatch to group SEVERAL invoices ------------------------
-- fms_dispatch.invoice_number was TEXT NOT NULL UNIQUE, which made a
-- multi-invoice dispatch impossible. The unique constraint is dropped by
-- name lookup (the auto-generated name is not guaranteed across a
-- dump/restore), but the column is kept and still populated for
-- single-invoice dispatches so existing records and QR labels keep working.
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  FOR v_constraint IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute a
      ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.fms_dispatch'::regclass
      AND con.contype = 'u'
      AND a.attname = 'invoice_number'
  LOOP
    EXECUTE format('ALTER TABLE public.fms_dispatch DROP CONSTRAINT %I', v_constraint);
  END LOOP;
END $$;

-- Backfill legacy rows (created before status existed) to 'dispatched'.
UPDATE public.fms_dispatch
SET status = 'dispatched', confirmed_at = COALESCE(dispatch_date, created_at)
WHERE confirmed_at IS NULL;

-- 3) Uploaded invoice documents attached to a dispatch -------------------
CREATE TABLE IF NOT EXISTS public.fms_dispatch_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES public.fms_dispatch(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  customer_name TEXT,
  file_path TEXT,                 -- path inside the 'order-documents' bucket
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (dispatch_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_fms_dispatch_invoices_dispatch
  ON public.fms_dispatch_invoices(dispatch_id);

-- 4) Requirements read off the uploaded invoice (PRODUCT level) ----------
CREATE TABLE IF NOT EXISTS public.fms_dispatch_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES public.fms_dispatch(id) ON DELETE CASCADE,
  stock_code_id UUID NOT NULL REFERENCES public.fms_stock_codes(id),
  stock_code TEXT NOT NULL,
  description TEXT,
  uom TEXT,
  invoice_number TEXT,            -- which uploaded invoice this line came from
  quantity_required INTEGER NOT NULL CHECK (quantity_required > 0),
  quantity_scanned INTEGER NOT NULL DEFAULT 0 CHECK (quantity_scanned >= 0),
  scanned_by UUID,
  scanned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fms_dispatch_requirements_dispatch
  ON public.fms_dispatch_requirements(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_fms_dispatch_requirements_stock
  ON public.fms_dispatch_requirements(dispatch_id, stock_code_id);

-- 5) Batch-level pick records get a scanned counter ----------------------
-- quantity                  = quantity actually shipped (set at confirm time)
-- quantity_required/scanned = the verification pair
ALTER TABLE public.fms_dispatch_items
  ADD COLUMN IF NOT EXISTS quantity_required INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_scanned INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scanned_by UUID,
  ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMP WITH TIME ZONE;

-- Prevent the same production batch being listed twice on one dispatch.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fms_dispatch_items_dispatch_batch
  ON public.fms_dispatch_items(dispatch_id, batch_id);

-- 6) RLS ----------------------------------------------------------------
ALTER TABLE public.fms_dispatch_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fms_dispatch_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FMS users can view dispatch invoices" ON public.fms_dispatch_invoices;
CREATE POLICY "FMS users can view dispatch invoices"
  ON public.fms_dispatch_invoices
  FOR SELECT USING (fms_has_access(auth.uid()));

DROP POLICY IF EXISTS "FMS users can create dispatch invoices" ON public.fms_dispatch_invoices;
CREATE POLICY "FMS users can create dispatch invoices"
  ON public.fms_dispatch_invoices
  FOR INSERT TO authenticated
  WITH CHECK (fms_has_access(auth.uid()));

DROP POLICY IF EXISTS "FMS users can update dispatch invoices" ON public.fms_dispatch_invoices;
CREATE POLICY "FMS users can update dispatch invoices"
  ON public.fms_dispatch_invoices
  FOR UPDATE TO authenticated
  USING (fms_has_access(auth.uid()))
  WITH CHECK (fms_has_access(auth.uid()));

DROP POLICY IF EXISTS "FMS users can delete dispatch invoices" ON public.fms_dispatch_invoices;
CREATE POLICY "FMS users can delete dispatch invoices"
  ON public.fms_dispatch_invoices
  FOR DELETE TO authenticated
  USING (fms_has_access(auth.uid()));

DROP POLICY IF EXISTS "FMS users can view dispatch requirements" ON public.fms_dispatch_requirements;
CREATE POLICY "FMS users can view dispatch requirements"
  ON public.fms_dispatch_requirements
  FOR SELECT USING (fms_has_access(auth.uid()));

DROP POLICY IF EXISTS "FMS users can create dispatch requirements" ON public.fms_dispatch_requirements;
CREATE POLICY "FMS users can create dispatch requirements"
  ON public.fms_dispatch_requirements
  FOR INSERT TO authenticated
  WITH CHECK (fms_has_access(auth.uid()));

DROP POLICY IF EXISTS "FMS users can update dispatch requirements" ON public.fms_dispatch_requirements;
CREATE POLICY "FMS users can update dispatch requirements"
  ON public.fms_dispatch_requirements
  FOR UPDATE TO authenticated
  USING (fms_has_access(auth.uid()))
  WITH CHECK (fms_has_access(auth.uid()));

DROP POLICY IF EXISTS "FMS users can delete dispatch requirements" ON public.fms_dispatch_requirements;
CREATE POLICY "FMS users can delete dispatch requirements"
  ON public.fms_dispatch_requirements
  FOR DELETE TO authenticated
  USING (fms_has_access(auth.uid()));

-- 7) Guard rail: a scan may never push quantity_scanned past quantity_required.
-- The application checks this too, but enforcing it in the database means two
-- packers scanning the same line at the same moment cannot over-fulfil.
CREATE OR REPLACE FUNCTION public.fms_guard_requirement_scan()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.quantity_scanned < 0 THEN
    RAISE EXCEPTION 'Scanned quantity cannot be negative';
  END IF;

  IF NEW.quantity_required > 0 AND NEW.quantity_scanned > NEW.quantity_required THEN
    RAISE EXCEPTION
      'Scan would exceed the invoiced quantity for % (% scanned, % required)',
      NEW.stock_code, NEW.quantity_scanned, NEW.quantity_required
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fms_guard_requirement_scan ON public.fms_dispatch_requirements;
CREATE TRIGGER trg_fms_guard_requirement_scan
  BEFORE INSERT OR UPDATE ON public.fms_dispatch_requirements
  FOR EACH ROW EXECUTE FUNCTION public.fms_guard_requirement_scan();

