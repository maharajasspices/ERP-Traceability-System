-- Harden contact_messages: explicitly block anon INSERT and add anon SELECT deny
-- RLS already denies by default, but explicit policies make intent clear

-- Block anon inserts explicitly
CREATE POLICY "Block anon contact inserts"
ON public.contact_messages
FOR INSERT
TO anon
WITH CHECK (false);

-- Block anon selects explicitly  
CREATE POLICY "Block anon contact reads"
ON public.contact_messages
FOR SELECT
TO anon
USING (false);