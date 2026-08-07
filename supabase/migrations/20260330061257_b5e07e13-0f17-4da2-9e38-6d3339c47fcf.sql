-- Fix 1: Restrict voucher_codes - replace broad ALL policy with specific per-operation policies
-- Only admins get full access; employees get read-only but cannot see unused codes

DROP POLICY IF EXISTS "Employees can manage voucher codes" ON public.voucher_codes;

-- Admins can do everything with voucher codes
CREATE POLICY "Admins can manage voucher codes"
ON public.voucher_codes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Employees can only view redeemed voucher codes (not unused/active ones)
CREATE POLICY "Employees can view redeemed vouchers"
ON public.voucher_codes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'employee'::app_role)
  AND redeemed_at IS NOT NULL
);

-- Fix 2: Tighten user_roles self-read to only return the role value, not expose structure
-- The current policy (auth.uid() = user_id) is actually correct and safe since
-- auth.uid() is injected by Supabase and cannot be spoofed via SQL injection.
-- However, we can remove self-read entirely since the app uses has_role() functions
-- which are SECURITY DEFINER and bypass RLS. Users don't need direct table access.

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;