-- ============================================
-- Employee Self-Service Leave PIN
--
-- Lets a non-Supabase employee identify themselves to the
-- Employee Leave portal (src/pages/HR/EmployeeLeave.tsx) using
-- their Employee Number + a Leave PIN, mirroring the existing
-- billing credit-pin pattern (pgcrypto crypt()).
--
-- The PIN is stored ONLY as a bcrypt hash, is revoke-hidden from
-- anon/authenticated, and is verified server-side inside the
-- employee-leave-auth edge function via the security-definer RPC
-- below. The plaintext PIN is never read by the client.
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Leave PIN hash on the employee record.
ALTER TABLE public.fms_hr_employees
  ADD COLUMN IF NOT EXISTS leave_pin TEXT;

-- Hide the PIN hashes from the anon and authenticated (HR) clients.
-- Only the service_role (edge functions) and the security-definer
-- RPC below can read them.
REVOKE SELECT (leave_pin), UPDATE (leave_pin)
  ON public.fms_hr_employees FROM anon, authenticated;

-- ============================================
-- Server-side PIN verification
-- ============================================
-- SECURITY DEFINER so it can read the leave_pin column regardless of
-- the column-level revoke, and so the bcrypt comparison always runs in
-- Postgres (never shipped to the browser).
CREATE OR REPLACE FUNCTION public.fms_verify_employee_leave_pin(
  p_employee_number TEXT,
  p_pin TEXT
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(e)
  FROM (
    SELECT
      id,
      employee_number,
      first_name,
      last_name,
      email,
      department
    FROM public.fms_hr_employees
    WHERE upper(trim(employee_number)) = upper(trim(p_employee_number))
      AND leave_pin IS NOT NULL
      AND leave_pin = crypt(p_pin, leave_pin)
  ) e;
$$;

REVOKE ALL ON FUNCTION public.fms_verify_employee_leave_pin(TEXT, TEXT)
  FROM PUBLIC, anon;

-- The employee-leave-auth edge function runs with the service role.
GRANT EXECUTE ON FUNCTION public.fms_verify_employee_leave_pin(TEXT, TEXT)
  TO service_role;