ALTER TABLE public.fms_production_batches DROP CONSTRAINT IF EXISTS fms_production_batches_status_check;

ALTER TABLE public.fms_production_batches ADD CONSTRAINT fms_production_batches_status_check 
CHECK (status IN ('draft', 'pre_weighing', 'manufacturing', 'in_progress', 'closed', 'cancelled'));