-- Fix 1: Restrict forum_topics SELECT to authenticated users only
-- This prevents exposing user_id fields to the public internet
DROP POLICY IF EXISTS "Anyone can view forum topics" ON public.forum_topics;

CREATE POLICY "Authenticated users can view forum topics"
ON public.forum_topics
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Fix 2: Add RLS policy on product_ratings view
-- The product_ratings is a VIEW, so we need to ensure security_invoker is set
-- First, let's check if there's an existing view definition and recreate with security_invoker

-- Drop and recreate the view with security_invoker = true
-- This ensures queries against the view respect the caller's permissions
DROP VIEW IF EXISTS public.product_ratings;

CREATE VIEW public.product_ratings
WITH (security_invoker = true)
AS
SELECT 
  product_id,
  COUNT(*) AS review_count,
  AVG(rating)::numeric AS average_rating
FROM public.product_reviews
GROUP BY product_id;