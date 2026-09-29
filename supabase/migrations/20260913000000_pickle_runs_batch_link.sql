-- ============================================================================
-- Link a pickle production run to the Batch Sheet batch that created it.
--
-- The existing Batch Sheet remains the single place where production batches
-- are created and started. This column only records which batch a pickle stage
-- workflow belongs to, so the Batch Sheet can display its pickle stages.
--
-- Only pickle batches (the pickle finished goods) get a run; all other batches
-- are unaffected. This is additive and safe to re-run.
-- ============================================================================

ALTER TABLE public.fms_pickle_runs
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.fms_production_batches(id) ON DELETE CASCADE;

-- One pickle run per Batch Sheet batch
CREATE UNIQUE INDEX IF NOT EXISTS idx_fms_pickle_runs_batch_id
  ON public.fms_pickle_runs(batch_id)
  WHERE batch_id IS NOT NULL;
