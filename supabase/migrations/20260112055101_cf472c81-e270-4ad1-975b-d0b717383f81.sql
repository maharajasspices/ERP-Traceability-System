-- Fix: Restrict forum_posts SELECT to authenticated users only
-- This prevents public access to user_id data

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view forum posts" ON forum_posts;

-- Create a new policy that requires authentication
CREATE POLICY "Authenticated users can view forum posts" 
  ON forum_posts 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);