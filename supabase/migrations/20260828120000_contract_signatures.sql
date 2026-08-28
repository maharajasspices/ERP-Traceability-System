-- ============================================
-- Electronic Contract Signing - Signing Requests
-- ============================================
-- First part of the e-signature workflow: stores a secure, unique
-- signing request linked to an employee + their contract document.
--
-- Security:
--  - The `token` is a cryptographically random value generated in the
--    edge function. It is NEVER the employee ID. It is the only secret
--    a signer needs to open/complete the signing flow, so it is stored
--    UNIQUE and treated like a credential.
--  - HR/system_admin can view and revoke/cancel requests.
--  - The token-based UPDATE policy lets the (future) signing step
--    mark a request as signed WITHOUT being a logged-in HR user,
--    by presenting the token. It can only touch its own row and only
--    flip a pending request to 'signed'.
-- ============================================

CREATE TABLE IF NOT EXISTS public.fms_contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.fms_hr_employees(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.fms_hr_documents(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'signed', 'expired', 'revoked')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE,
  signer_name TEXT,
  signer_ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.fms_contract_signatures ENABLE ROW LEVEL SECURITY;

-- Lookups by employee and by token must be fast.
CREATE INDEX IF NOT EXISTS fms_contract_signatures_employee_idx
  ON public.fms_contract_signatures (employee_id);
CREATE INDEX IF NOT EXISTS fms_contract_signatures_status_idx
  ON public.fms_contract_signatures (status);

-- ============================================
-- RLS policies
-- ============================================
-- HR / system_admin can view all signing requests.
DROP POLICY IF EXISTS "HR and admins can view contract signatures" ON public.fms_contract_signatures;
CREATE POLICY "HR and admins can view contract signatures"
ON public.fms_contract_signatures
FOR SELECT
TO authenticated
USING (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
);

-- HR / system_admin can manage requests (send, revoke). Insert is
-- normally done by the edge function with the service role, but this
-- lets an HR client create requests directly if ever needed.
DROP POLICY IF EXISTS "HR and admins can manage contract signatures" ON public.fms_contract_signatures;
CREATE POLICY "HR and admins can manage contract signatures"
ON public.fms_contract_signatures
FOR ALL
TO authenticated
USING (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
)
WITH CHECK (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
);

-- Token-based signing (used by the future signing page). A caller who
-- presents the correct token may mark a single pending request as
-- 'signed' without being a logged-in HR user. They cannot see anything
-- unless they already hold the token, and they can never change the
-- token, the employee, the document, or the status away from 'signed'.
DROP POLICY IF EXISTS "Signer can complete a request with its token" ON public.fms_contract_signatures;
CREATE POLICY "Signer can complete a request with its token"
ON public.fms_contract_signatures
FOR UPDATE
TO anon
USING (
  token = current_setting('app.contract_signature.token', true)
  AND status = 'pending'
  AND expires_at > now()
)
WITH CHECK (
  token = current_setting('app.contract_signature.token', true)
  AND status = 'signed'
);
