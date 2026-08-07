
-- 1) Hide credit_pin from client SELECTs via column-level privileges
REVOKE SELECT (credit_pin) ON public.user_credits FROM anon, authenticated;
REVOKE UPDATE (credit_pin) ON public.user_credits FROM anon, authenticated;

-- 2) Hide tracking_token on orders from client SELECTs
REVOKE SELECT (tracking_token) ON public.orders FROM anon, authenticated;

-- 3) Tighten forum storage INSERT to require user-owned folder
DROP POLICY IF EXISTS "Authenticated users can upload forum images" ON storage.objects;
CREATE POLICY "Authenticated users can upload forum images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'forum'
  AND auth.uid() IS NOT NULL
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
