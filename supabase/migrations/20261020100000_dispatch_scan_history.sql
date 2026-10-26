-- Dispatch scan history table
-- ============================
-- The dispatch QR scanning workflow (public.fms_record_dispatch_scan and
-- public.fms_undo_dispatch_scan, restored by
-- 20261020110000_restore_dispatch_scan_functions.sql) writes one row per
-- verified packer scan into public.fms_dispatch_scan_history.
--
-- Those two RPCs were captured in a migration, but the table they depend on
-- was not. Replaying this repository against an empty database therefore
-- produced a broken scan workflow: the RPCs could not record a scan, nor
-- read one back to undo it, because the table did not exist.
--
-- This migration creates the table and its security model. It is written to
-- be safe on a database where the table already exists (production already
-- has it), so every object is reconciled rather than blindly created.
--
-- Column shape (matches the live database exactly):
--   id             uuid primary key, generated
--   dispatch_id    uuid -> fms_dispatch(id)              on delete cascade
--   requirement_id uuid -> fms_dispatch_requirements(id) on delete cascade
--   batch_id       uuid nullable, no foreign key
--   scanned_by     uuid nullable, the packer who performed the scan
--   scanned_at     timestamptz not null, default now()
--   undone_at      timestamptz nullable, set when the scan is undone

-- 1) Table ------------------------------------------------------------------
-- The column list below is the authoritative definition for a fresh database.
CREATE TABLE IF NOT EXISTS public.fms_dispatch_scan_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id    UUID NOT NULL REFERENCES public.fms_dispatch(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES public.fms_dispatch_requirements(id) ON DELETE CASCADE,
  batch_id       UUID,
  scanned_by     UUID,
  scanned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  undone_at      TIMESTAMPTZ
);

-- 2) Column reconciliation --------------------------------------------------
-- CREATE TABLE IF NOT EXISTS is a no-op on an existing table, so add any
-- column that a previously created (partial) table is missing.
ALTER TABLE public.fms_dispatch_scan_history
  ADD COLUMN IF NOT EXISTS id             UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS dispatch_id    UUID,
  ADD COLUMN IF NOT EXISTS requirement_id UUID,
  ADD COLUMN IF NOT EXISTS batch_id       UUID,
  ADD COLUMN IF NOT EXISTS scanned_by     UUID,
  ADD COLUMN IF NOT EXISTS scanned_at     TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS undone_at      TIMESTAMPTZ;

-- Restore the generated-id and created-at defaults if they were lost.
ALTER TABLE public.fms_dispatch_scan_history
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.fms_dispatch_scan_history
  ALTER COLUMN scanned_at SET DEFAULT now();

-- Backfill nulls left behind by a partially created table, then tighten the
-- NOT NULL constraints. Each guard keeps the migration safe on a table that
-- still holds rows the constraint cannot be applied to.
DO $$
BEGIN
  UPDATE public.fms_dispatch_scan_history
  SET id = gen_random_uuid()
  WHERE id IS NULL;

  UPDATE public.fms_dispatch_scan_history
  SET scanned_at = now()
  WHERE scanned_at IS NULL;

  IF NOT EXISTS (SELECT 1 FROM public.fms_dispatch_scan_history WHERE id IS NULL) THEN
    ALTER TABLE public.fms_dispatch_scan_history ALTER COLUMN id SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.fms_dispatch_scan_history WHERE dispatch_id IS NULL) THEN
    ALTER TABLE public.fms_dispatch_scan_history ALTER COLUMN dispatch_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.fms_dispatch_scan_history WHERE requirement_id IS NULL) THEN
    ALTER TABLE public.fms_dispatch_scan_history ALTER COLUMN requirement_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.fms_dispatch_scan_history WHERE scanned_at IS NULL) THEN
    ALTER TABLE public.fms_dispatch_scan_history ALTER COLUMN scanned_at SET NOT NULL;
  END IF;
END $$;


-- 3) Primary key -----------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'fms_dispatch_scan_history'
      AND c.contype = 'p'
  ) THEN
    ALTER TABLE public.fms_dispatch_scan_history
      ADD CONSTRAINT fms_dispatch_scan_history_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- 4) Foreign keys ----------------------------------------------------------
-- A scan belongs to a dispatch and to an invoice line; both are removed
-- when the parent row goes away.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fms_dispatch_scan_history_dispatch_id_fkey'
      AND contype = 'f'
  ) THEN
    ALTER TABLE public.fms_dispatch_scan_history
      ADD CONSTRAINT fms_dispatch_scan_history_dispatch_id_fkey
      FOREIGN KEY (dispatch_id)
      REFERENCES public.fms_dispatch(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fms_dispatch_scan_history_requirement_id_fkey'
      AND contype = 'f'
  ) THEN
    ALTER TABLE public.fms_dispatch_scan_history
      ADD CONSTRAINT fms_dispatch_scan_history_requirement_id_fkey
      FOREIGN KEY (requirement_id)
      REFERENCES public.fms_dispatch_requirements(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 5) Indexes ----------------------------------------------------------------
-- The undo RPC finds the most recent not-yet-undone scan for a requirement
-- (ORDER BY scanned_at DESC), so index the lookup the same way.
CREATE INDEX IF NOT EXISTS idx_dispatch_scan_history_requirement
  ON public.fms_dispatch_scan_history (requirement_id, scanned_at DESC);


-- 6) Row level security ----------------------------------------------------
ALTER TABLE public.fms_dispatch_scan_history ENABLE ROW LEVEL SECURITY;

-- Everyone with FMS access may read the scan history.
DROP POLICY IF EXISTS "FMS users can view dispatch scan history"
  ON public.fms_dispatch_scan_history;
CREATE POLICY "FMS users can view dispatch scan history"
  ON public.fms_dispatch_scan_history
  FOR SELECT TO authenticated
  USING (fms_has_access(auth.uid()));

-- Only packers may log a scan; read-only QA viewers are excluded.
DROP POLICY IF EXISTS "FMS dispatch users can record scan history"
  ON public.fms_dispatch_scan_history;
CREATE POLICY "FMS dispatch users can record scan history"
  ON public.fms_dispatch_scan_history
  FOR INSERT TO authenticated
  WITH CHECK (fms_has_access(auth.uid()) AND NOT fms_is_qa_viewer(auth.uid()));

-- Undoing a scan marks the history row as undone.
DROP POLICY IF EXISTS "FMS dispatch users can undo scans"
  ON public.fms_dispatch_scan_history;
CREATE POLICY "FMS dispatch users can undo scans"
  ON public.fms_dispatch_scan_history
  FOR UPDATE TO authenticated
  USING (fms_has_access(auth.uid()) AND NOT fms_is_qa_viewer(auth.uid()))
  WITH CHECK (fms_has_access(auth.uid()) AND NOT fms_is_qa_viewer(auth.uid()));

-- 7) Grants ----------------------------------------------------------------
-- Mirror the table privileges the live database exposes. The RPCs run as
-- SECURITY DEFINER, so the table grants only matter for direct access.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.fms_dispatch_scan_history TO authenticated;

GRANT ALL
  ON public.fms_dispatch_scan_history TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.fms_dispatch_scan_history TO anon;
