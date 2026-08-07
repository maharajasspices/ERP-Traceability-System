-- Create audit log table for sensitive data access if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sensitive_data_access_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    user_email text,
    table_name text NOT NULL,
    action text NOT NULL,
    record_count integer,
    query_context text,
    ip_address text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on the audit log table
ALTER TABLE public.sensitive_data_access_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view the audit log (read-only - no one can delete/modify)
CREATE POLICY "Only admins can view sensitive data access logs"
ON public.sensitive_data_access_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow service role to insert audit logs
CREATE POLICY "Service role can insert audit logs"
ON public.sensitive_data_access_log
FOR INSERT
WITH CHECK (false);

-- Create function to log sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_user_email text;
BEGIN
    -- Get current user from auth context
    v_user_id := auth.uid();
    
    -- Get user email from auth.users if available
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = v_user_id;
    
    -- Log the access (using elevated privileges)
    INSERT INTO public.sensitive_data_access_log (
        user_id,
        user_email,
        table_name,
        action,
        record_count,
        query_context
    ) VALUES (
        v_user_id,
        v_user_email,
        TG_TABLE_NAME,
        TG_OP,
        1,
        'Admin accessed ' || TG_TABLE_NAME || ' table'
    );
    
    -- For SELECT triggers (AFTER), return null since we're not modifying anything
    RETURN NULL;
END;
$$;

-- Note: PostgreSQL doesn't support triggers on SELECT operations directly.
-- Instead, we'll add audit logging via the RLS policy mechanism by creating
-- a more sophisticated approach using a wrapper view.

-- However, since SELECT triggers aren't supported, we should document that
-- admin access to contact_messages should be done through application code
-- that logs the access. The most practical solution is to ensure the 
-- application layer logs all admin access to sensitive tables.

-- Add comment to document the audit requirement
COMMENT ON TABLE public.contact_messages IS 
'Sensitive customer contact information. Admin access should be logged via application layer using sensitive_data_access_log table.';