-- ============================================
-- Contract Signing - Employee Signing Page
-- ============================================
-- Second part of the e-signature workflow: the employee-facing
-- /sign-contract page that completes a signing request.
--
-- Adds a column to store the drawn signature and marks requests as
-- completed via the sign-contract edge function (service role), which
-- validates the secure token and expiry server-side.
-- ============================================

ALTER TABLE public.fms_contract_signatures
  ADD COLUMN IF NOT EXISTS signature_data TEXT;
