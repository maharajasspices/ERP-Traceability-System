-- Migration: Add truck and driver tracking to dispatches
-- This migration adds columns to track which truck a dispatch is going to,
-- who the driver is, and when the truck departs.

-- 1) Add truck_plate, driver_name, and departed_at columns to fms_dispatch
ALTER TABLE public.fms_dispatch
  ADD COLUMN IF NOT EXISTS truck_plate TEXT,
  ADD COLUMN IF NOT EXISTS driver_name TEXT,
  ADD COLUMN IF NOT EXISTS departed_at TIMESTAMP WITH TIME ZONE;

-- 2) Add comment explaining the columns
COMMENT ON COLUMN public.fms_dispatch.truck_plate IS 'Truck registration number (e.g. ABC-123)';
COMMENT ON COLUMN public.fms_dispatch.driver_name IS 'Name of the driver assigned to this dispatch';
COMMENT ON COLUMN public.fms_dispatch.departed_at IS 'Date and time when the truck departed';

-- 3) Create index for truck plate lookups
CREATE INDEX IF NOT EXISTS idx_fms_dispatch_truck_plate ON public.fms_dispatch(truck_plate) WHERE truck_plate IS NOT NULL;

-- 4) Create index for departed_at lookups
CREATE INDEX IF NOT EXISTS idx_fms_dispatch_departed_at ON public.fms_dispatch(departed_at) WHERE departed_at IS NOT NULL;

-- 5) Update RLS policies to allow viewing truck/driver info
-- Existing policies should continue to work, but we add explicit allowances

-- Grant access to authenticated users for the new columns
GRANT SELECT (truck_plate, driver_name, departed_at) ON public.fms_dispatch TO authenticated;