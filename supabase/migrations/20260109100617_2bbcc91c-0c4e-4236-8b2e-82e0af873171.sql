-- Remove user-specific provisioning triggers and functions
-- These create security risks by automatically granting access

-- Drop the trigger first (depends on the function)
DROP TRIGGER IF EXISTS on_tania_signup ON auth.users;

-- Drop the user-specific provisioning functions
DROP FUNCTION IF EXISTS public.handle_tania_signup();
DROP FUNCTION IF EXISTS public.add_tania_as_fms_user();