-- ============================================================
-- BOM <-> finished-product links as a JOIN TABLE (many-to-many)
-- ============================================================
-- One BOM version can belong to MULTIPLE finished products, e.g.
--   WPIC001 v2 -> { APIC002, APIC003 }
-- The legacy single column parent_finished_good_id is kept for backward
-- compatibility and kept in sync (first link, or NULL when unlinked).
-- The Batch Sheet treats a BOM as in-scope for a finished good when a
-- join row exists for it (falling back to the legacy column).
-- ============================================================

ALTER TABLE public.fms_bom
  ADD COLUMN IF NOT EXISTS parent_finished_good_id UUID REFERENCES public.fms_stock_codes(id);

CREATE INDEX IF NOT EXISTS idx_fms_bom_parent_finished_good_id
  ON public.fms_bom(parent_finished_good_id);

COMMENT ON COLUMN public.fms_bom.parent_finished_good_id IS
  'Legacy single finished-product link (kept for backward compatibility). Source of truth is fms_bom_finished_goods.';

-- Join table: which finished products a BOM version belongs to.
CREATE TABLE IF NOT EXISTS public.fms_bom_finished_goods (
  bom_id UUID NOT NULL REFERENCES public.fms_bom(id) ON DELETE CASCADE,
  finished_good_id UUID NOT NULL REFERENCES public.fms_stock_codes(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (bom_id, finished_good_id)
);

CREATE INDEX IF NOT EXISTS idx_fms_bom_finished_goods_fg
  ON public.fms_bom_finished_goods(finished_good_id);

COMMENT ON TABLE public.fms_bom_finished_goods IS
  'Finished products a BOM version belongs to. Batch Sheet expands a WIP stage when a row exists for the batch finished good (or the legacy parent_finished_good_id matches).';

-- Backfill join rows from the legacy single links.
INSERT INTO public.fms_bom_finished_goods (bom_id, finished_good_id)
SELECT id, parent_finished_good_id
FROM public.fms_bom
WHERE parent_finished_good_id IS NOT NULL
ON CONFLICT (bom_id, finished_good_id) DO NOTHING;

-- Backfill from the interim array column, if that variant was ever applied,
-- then drop it: the join table is the source of truth going forward.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fms_bom'
      AND column_name = 'parent_finished_good_ids'
  ) THEN
    INSERT INTO public.fms_bom_finished_goods (bom_id, finished_good_id)
    SELECT b.id, link_id
    FROM public.fms_bom AS b
    CROSS JOIN LATERAL unnest(b.parent_finished_good_ids) AS link_id
    WHERE link_id IS NOT NULL
    ON CONFLICT (bom_id, finished_good_id) DO NOTHING;

    ALTER TABLE public.fms_bom DROP COLUMN parent_finished_good_ids;
  END IF;
END
$$;

ALTER TABLE public.fms_bom_finished_goods ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fms_bom_finished_goods'
      AND policyname = 'FMS users can view BOM finished-good links'
  ) THEN
    CREATE POLICY "FMS users can view BOM finished-good links"
      ON public.fms_bom_finished_goods
      FOR SELECT USING (fms_has_access(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fms_bom_finished_goods'
      AND policyname = 'FMS admins and supervisors can manage BOM finished-good links'
  ) THEN
    CREATE POLICY "FMS admins and supervisors can manage BOM finished-good links"
      ON public.fms_bom_finished_goods
      FOR ALL USING (fms_has_role(auth.uid(), 'system_admin') OR fms_has_role(auth.uid(), 'production_supervisor'));
  END IF;
END
$$;
