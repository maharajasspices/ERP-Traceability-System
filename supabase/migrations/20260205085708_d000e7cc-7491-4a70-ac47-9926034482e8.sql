-- Fix profiles table: Remove employee access and clean up duplicate policies
-- This follows the principle of least privilege - only admins should see all profiles

-- Drop the employee policy that allows viewing all profiles
DROP POLICY IF EXISTS "Employees view profiles" ON public.profiles;

-- Drop duplicate user view policies (keeping one)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Verify the remaining policies are correct:
-- 1. "Admins can view all profiles" - for admin access
-- 2. "Users can view their own profile" - for self access
-- 3. "Users can update their own profile" - for self updates

-- Add INSERT policy for new user profiles (created by auth trigger)
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);