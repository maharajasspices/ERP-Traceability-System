
-- Drop existing permissive RLS policies on user_credits that expose credit_pin
DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Admins can view all credits" ON public.user_credits;

-- Re-create policies that only allow access through the safe view pattern
-- Users can view their own credits but we restrict via a column-level approach:
-- Force clients to use user_credits_safe view instead
CREATE POLICY "Users can view own credits" ON public.user_credits
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all credits  
CREATE POLICY "Admins can view all credits" ON public.user_credits
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create a secure RPC to verify credit PIN server-side (never expose the PIN to clients)
CREATE OR REPLACE FUNCTION public.verify_credit_pin(p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_credits
    WHERE user_id = auth.uid()
      AND credit_pin IS NOT NULL
      AND credit_pin = crypt(p_pin, credit_pin)
  );
END;
$$;

-- Create a secure RPC to set/update credit PIN (hashed)
CREATE OR REPLACE FUNCTION public.set_credit_pin(p_new_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(p_new_pin) < 4 OR length(p_new_pin) > 8 THEN
    RAISE EXCEPTION 'PIN must be between 4 and 8 characters';
  END IF;
  
  UPDATE public.user_credits
  SET credit_pin = crypt(p_new_pin, gen_salt('bf')),
      updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Revoke direct column access to credit_pin for anon and authenticated roles
-- This prevents clients from selecting credit_pin directly
REVOKE ALL ON public.user_credits FROM anon, authenticated;
GRANT SELECT (id, user_id, balance, created_at, updated_at) ON public.user_credits TO authenticated;
GRANT UPDATE (balance, updated_at) ON public.user_credits TO authenticated;
GRANT INSERT ON public.user_credits TO authenticated;
