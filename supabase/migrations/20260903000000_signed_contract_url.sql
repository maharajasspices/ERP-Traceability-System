-- ============================================
-- Signed Contract URL
-- ============================================
-- Adds a column to store the URL of the signed contract PDF
-- (with the signature embedded) on the employee record.
-- ============================================

ALTER TABLE public.fms_hr_employees
  ADD COLUMN IF NOT EXISTS signed_contract_url TEXT;

-- ============================================
-- Fix: Clear any stale/incorrect signed_contract_url values
-- that point to non-PDF files (e.g. CSV files from testing).
-- ============================================
-- UPDATE public.fms_hr_employees
--   SET signed_contract_url = NULL
--   WHERE signed_contract_url IS NOT NULL
--     AND signed_contract_url NOT LIKE '%.pdf';
--
-- Uncomment the above UPDATE to clear bad data, then re-sign
-- the contract to generate a correct PDF URL.