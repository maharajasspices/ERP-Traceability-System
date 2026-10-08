-- =====================================================================
-- Print queue: per-batch best-before date, per-job sticker copies,
-- and the duplicate guard for queued print jobs.
--
-- IMPORTANT CONTEXT
-- fms_print_queue ALREADY EXISTS in the database. It was created directly
-- there and has never had a migration file. This migration therefore only
-- ADDS what is missing and never recreates or drops the table.
--
-- The rules encoded here:
--   * A best_before_date belongs to ONE batch. Many batches may legitimately
--     share the same date, so the date is NEVER unique and is NEVER used as
--     an identifier or a grouping key.
--   * A batch may hold one pending BATCH_SHEET job AND one pending
--     BEST_BEFORE_STICKER job. They are separate documents and both allowed.
--   * Two pending jobs of the SAME document type for the same batch are not
--     allowed. PRINTED / FAILED rows are history and never block anything.
-- =====================================================================

-- 1) Per-batch sticker settings ------------------------------------------
ALTER TABLE public.fms_production_batches
  ADD COLUMN IF NOT EXISTS best_before_date DATE,
  ADD COLUMN IF NOT EXISTS sticker_copies    INTEGER NOT NULL DEFAULT 4;

-- 2) Per-job snapshot ----------------------------------------------------
-- copies is snapshotted at queue time so a queued job is immutable: changing
-- the batch default later must not change what a pending job will print.
-- failure_reason records why the print agent refused or failed a job.
ALTER TABLE public.fms_print_queue
  ADD COLUMN IF NOT EXISTS copies         INTEGER,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- 3) Widen the status / document_type checks ----------------------------
-- The existing constraints (if any) are dropped by lookup rather than by
-- name, because the auto-generated names are not guaranteed. FAILED is added
-- so a job the agent cannot print becomes visible instead of retrying forever.
DO $$
DECLARE
  v_name TEXT;
BEGIN
  FOR v_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute a
      ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.fms_print_queue'::regclass
      AND con.contype = 'c'
      AND a.attname = 'status'
  LOOP
    EXECUTE format('ALTER TABLE public.fms_print_queue DROP CONSTRAINT %I', v_name);
  END LOOP;

  FOR v_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute a
      ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.fms_print_queue'::regclass
      AND con.contype = 'c'
      AND a.attname = 'document_type'
  LOOP
    EXECUTE format('ALTER TABLE public.fms_print_queue DROP CONSTRAINT %I', v_name);
  END LOOP;
END $$;

ALTER TABLE public.fms_print_queue
  ADD CONSTRAINT fms_print_queue_status_check
    CHECK (status IN ('QUEUED', 'PRINTING', 'PRINTED', 'FAILED')),
  ADD CONSTRAINT fms_print_queue_document_type_check
    CHECK (document_type IN ('BATCH_SHEET', 'BEST_BEFORE_STICKER'));

-- 4) Resolve any pre-existing duplicate active jobs ----------------------
-- Nothing has ever consumed this queue, so every existing row is still
-- QUEUED and a batch may have been queued more than once by repeated clicks.
-- The unique index below would fail on those, so the older duplicates are
-- retired first (newest job of each pair survives).
UPDATE public.fms_print_queue older
   SET status = 'FAILED',
       failure_reason = COALESCE(older.failure_reason,
                                 'Retired duplicate before the print queue duplicate guard was added')
  FROM public.fms_print_queue newer
 WHERE older.batch_id IS NOT NULL
   AND older.batch_id = newer.batch_id
   AND older.document_type = newer.document_type
   AND older.status IN ('QUEUED', 'PRINTING')
   AND newer.status IN ('QUEUED', 'PRINTING')
   AND (older.created_at, older.id) < (newer.created_at, newer.id);

-- 5) The duplicate guard -------------------------------------------------
-- Deliberately NOT unique on the date: two batches sharing a best-before
-- date each get their own sticker job. The guard is on the BATCH and the
-- DOCUMENT TYPE, and only across ACTIVE rows.
CREATE UNIQUE INDEX IF NOT EXISTS fms_print_queue_active_uniq
  ON public.fms_print_queue (batch_id, document_type)
  WHERE status IN ('QUEUED', 'PRINTING');

CREATE INDEX IF NOT EXISTS idx_fms_print_queue_pending
  ON public.fms_print_queue (status, created_at);

-- 6) RLS -----------------------------------------------------------------
-- INSERT already works today (the Dashboard queues batch sheets), but the
-- Save & Queue flow also UPDATEs a pending job when the date or copy count
-- is edited, so UPDATE and DELETE are made explicit.
ALTER TABLE public.fms_print_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FMS users can update print queue" ON public.fms_print_queue;
CREATE POLICY "FMS users can update print queue"
  ON public.fms_print_queue
  FOR UPDATE TO authenticated
  USING (fms_has_access(auth.uid()))
  WITH CHECK (fms_has_access(auth.uid()));

DROP POLICY IF EXISTS "FMS users can delete print queue" ON public.fms_print_queue;
CREATE POLICY "FMS users can delete print queue"
  ON public.fms_print_queue
  FOR DELETE TO authenticated
  USING (fms_has_access(auth.uid()));