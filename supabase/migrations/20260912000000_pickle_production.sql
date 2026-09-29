-- ============================================================
-- Pickle Production workflow (isolated from normal Batch Sheet)
-- ============================================================
-- A single "production run" is expanded recursively from the finished-good's
-- active BOM tree into a set of stages (each manufactured node) and stage
-- ingredients (each BOM component). WIP / finished output lots are recorded
-- as fms_receiving rows so the existing stock, lot and FIFO systems are reused.
--
-- Traceability chain: Run -> Stage -> Input Lot -> Container -> Output WIP Lot
--                     -> Finished Lot

-- 1. Allow internal production lots in fms_receiving.
--    WIP / finished goods are produced in-house and therefore have no external
--    supplier. Making these optional is backwards-compatible with existing rows.
ALTER TABLE public.fms_receiving ALTER COLUMN supplier_id DROP NOT NULL;
ALTER TABLE public.fms_receiving ALTER COLUMN supplier_batch_number DROP NOT NULL;
ALTER TABLE public.fms_receiving ALTER COLUMN expiry_date DROP NOT NULL;

-- 2. Production runs
CREATE SEQUENCE public.fms_pickle_run_number_seq START 1;

-- Auto run-number generator: PCK-YYYY-NNNNN
CREATE OR REPLACE FUNCTION public.fms_pickle_run_number()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'PCK-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.fms_pickle_run_number_seq')::TEXT, 5, '0')
$$;

CREATE TABLE public.fms_pickle_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_number TEXT NOT NULL UNIQUE DEFAULT public.fms_pickle_run_number(),
  finished_good_id UUID NOT NULL REFERENCES public.fms_stock_codes(id),
  planned_total_qty DECIMAL NOT NULL CHECK (planned_total_qty > 0),
  unit_of_measure TEXT NOT NULL DEFAULT 'kg',
  status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  notes TEXT,
  created_by UUID,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fms_pickle_runs_finished_good
  ON public.fms_pickle_runs(finished_good_id);

-- 3. Stages (one row per manufactured node in the BOM tree)
CREATE TABLE public.fms_pickle_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.fms_pickle_runs(id) ON DELETE CASCADE,
  stock_code_id UUID NOT NULL REFERENCES public.fms_stock_codes(id),
  parent_stage_id UUID REFERENCES public.fms_pickle_stages(id) ON DELETE CASCADE,
  stage_order INTEGER NOT NULL DEFAULT 0,
  is_root BOOLEAN NOT NULL DEFAULT false,
  required_qty DECIMAL NOT NULL DEFAULT 0,
  unit_of_measure TEXT NOT NULL DEFAULT 'kg',
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'READY', 'IN_PROGRESS', 'SOAKING', 'READY_FOR_NEXT_STAGE', 'COMPLETED', 'CANCELLED')),
  is_soaking BOOLEAN NOT NULL DEFAULT false,
  process_instructions TEXT,
  soaking_start_at TIMESTAMP WITH TIME ZONE,
  min_ready_date DATE,
  max_ready_date DATE,
  actual_ready_date DATE,
  elapsed_days INTEGER,
  container_id TEXT,
  output_lot_id UUID REFERENCES public.fms_receiving(id) ON DELETE SET NULL,
  completed_quantity DECIMAL,
  operator_id UUID,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fms_pickle_stages_run
  ON public.fms_pickle_stages(run_id);
CREATE INDEX IF NOT EXISTS idx_fms_pickle_stages_parent
  ON public.fms_pickle_stages(parent_stage_id);
CREATE INDEX IF NOT EXISTS idx_fms_pickle_stages_stock
  ON public.fms_pickle_stages(stock_code_id);

ALTER TABLE public.fms_pickle_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FMS users can view pickle stages"
  ON public.fms_pickle_stages FOR SELECT USING (fms_has_access(auth.uid()));
CREATE POLICY "FMS users can manage pickle stages"
  ON public.fms_pickle_stages FOR ALL USING (fms_has_access(auth.uid()));

-- 4. Stage ingredients (one row per active-BOM component)
CREATE TABLE public.fms_pickle_stage_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES public.fms_pickle_stages(id) ON DELETE CASCADE,
  material_stock_code_id UUID NOT NULL REFERENCES public.fms_stock_codes(id),
  source_type TEXT NOT NULL DEFAULT 'receiving' CHECK (source_type IN ('receiving', 'wip_stage')),
  source_stage_id UUID REFERENCES public.fms_pickle_stages(id) ON DELETE SET NULL,
  receiving_record_id UUID REFERENCES public.fms_receiving(id) ON DELETE SET NULL,
  internal_lot_number TEXT,
  required_qty DECIMAL NOT NULL DEFAULT 0,
  measured_qty DECIMAL,
  unit_of_measure TEXT NOT NULL DEFAULT 'kg',
  variance DECIMAL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'WEIGHED', 'COMPLETED')),
  operator_id UUID,
  measured_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fms_pickle_ingredients_stage
  ON public.fms_pickle_stage_ingredients(stage_id);
CREATE INDEX IF NOT EXISTS idx_fms_pickle_ingredients_material
  ON public.fms_pickle_stage_ingredients(material_stock_code_id);

ALTER TABLE public.fms_pickle_stage_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FMS users can view pickle stage ingredients"
  ON public.fms_pickle_stage_ingredients FOR SELECT USING (fms_has_access(auth.uid()));
CREATE POLICY "FMS users can manage pickle stage ingredients"
  ON public.fms_pickle_stage_ingredients FOR ALL USING (fms_has_access(auth.uid()));

-- 5. updated_at trigger
CREATE TRIGGER fms_pickle_runs_updated_at BEFORE UPDATE ON public.fms_pickle_runs
  FOR EACH ROW EXECUTE FUNCTION public.fms_update_updated_at();