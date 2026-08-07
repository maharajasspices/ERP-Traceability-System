-- Clear all test data in correct order (respecting foreign keys)
-- First delete BOM components
DELETE FROM public.fms_bom_components;

-- Delete materials used
DELETE FROM public.fms_materials_used;

-- Delete dispatch items
DELETE FROM public.fms_dispatch_items;

-- Delete dispatch records
DELETE FROM public.fms_dispatch;

-- Delete production batches
DELETE FROM public.fms_production_batches;

-- Delete BOMs
DELETE FROM public.fms_bom;

-- Delete receiving records
DELETE FROM public.fms_receiving;

-- Clear activity log
DELETE FROM public.fms_activity_log;