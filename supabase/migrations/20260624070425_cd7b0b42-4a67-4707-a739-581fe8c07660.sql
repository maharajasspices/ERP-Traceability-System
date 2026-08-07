
-- 1) Forum bucket INSERT policy: add extension whitelist
DROP POLICY IF EXISTS "Authenticated users can upload forum images" ON storage.objects;
CREATE POLICY "Authenticated users can upload forum images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'forum'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) IN ('jpg','jpeg','png','gif','webp')
);

-- 2) Newsletter subscribers: dedupe, add unique + email format check
DELETE FROM public.newsletter_subscribers a
USING public.newsletter_subscribers b
WHERE a.ctid < b.ctid
  AND lower(a.email) = lower(b.email);

UPDATE public.newsletter_subscribers SET email = lower(trim(email)) WHERE email <> lower(trim(email));

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_unique
  ON public.newsletter_subscribers (lower(email));

ALTER TABLE public.newsletter_subscribers
  DROP CONSTRAINT IF EXISTS newsletter_subscribers_email_format_chk;
ALTER TABLE public.newsletter_subscribers
  ADD CONSTRAINT newsletter_subscribers_email_format_chk
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- 3) user_credits: revoke column-level SELECT on credit_pin
REVOKE SELECT (credit_pin) ON public.user_credits FROM anon, authenticated;
