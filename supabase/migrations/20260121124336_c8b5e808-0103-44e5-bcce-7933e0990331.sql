-- Add processing_steps and organoleptic_parameters columns to fms_bom table
-- These store the manufacturing steps and quality check parameters defined in the BOM

ALTER TABLE public.fms_bom 
ADD COLUMN IF NOT EXISTS processing_steps JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS organoleptic_parameters JSONB DEFAULT '[]'::jsonb;

-- Add pre_weigh_materials column to fms_production_batches if not exists
-- This stores the materials with their batch numbers for pre-weigh approval
ALTER TABLE public.fms_production_batches 
ADD COLUMN IF NOT EXISTS pre_weigh_materials JSONB DEFAULT '[]'::jsonb;

-- Add checker name fields to production batches for accountability
ALTER TABLE public.fms_production_batches
ADD COLUMN IF NOT EXISTS info_checker_name TEXT,
ADD COLUMN IF NOT EXISTS steps_checker_name TEXT,
ADD COLUMN IF NOT EXISTS quality_checker_name TEXT;

-- Add print_logo_url setting for admin to customize print documents
INSERT INTO public.fms_settings (setting_key, setting_value, description)
VALUES ('print_logo_url', '"/images/print-logo.png"', 'Logo URL for printed documents (admin can update)')
ON CONFLICT (setting_key) DO NOTHING;