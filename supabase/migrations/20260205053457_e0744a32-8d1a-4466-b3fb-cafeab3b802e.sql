-- Fix 1: Restrict profiles table - only admins can view all profiles, users can view their own
DROP POLICY IF EXISTS "Employees can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Users can only view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Only admins can view all profiles (not employees)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Restrict contact_messages - only admins can view, not all employees
DROP POLICY IF EXISTS "Employees can view contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Employees can update contact messages" ON public.contact_messages;

-- Only admins can view contact messages
CREATE POLICY "Admins can view contact messages"
ON public.contact_messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update contact messages
CREATE POLICY "Admins can update contact messages"
ON public.contact_messages
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));