-- Restrict newsletter_subscribers SELECT to admin only (was employee + admin)
DROP POLICY IF EXISTS "Employees can view all subscribers" ON public.newsletter_subscribers;

CREATE POLICY "Admins can view all subscribers"
ON public.newsletter_subscribers
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));