-- Fix 1: Recreate product_ratings view with SECURITY INVOKER
-- This ensures the view uses the permissions of the querying user, not the view creator
DROP VIEW IF EXISTS public.product_ratings;

CREATE VIEW public.product_ratings
WITH (security_invoker = true)
AS
SELECT 
    product_id,
    avg(rating) AS average_rating,
    count(*) AS review_count
FROM product_reviews
GROUP BY product_id;

-- Fix 2: Add search_path to fms_generate_lot_number function to prevent schema injection
CREATE OR REPLACE FUNCTION public.fms_generate_lot_number()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT 'LOT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.fms_lot_number_seq')::TEXT, 5, '0')
$$;