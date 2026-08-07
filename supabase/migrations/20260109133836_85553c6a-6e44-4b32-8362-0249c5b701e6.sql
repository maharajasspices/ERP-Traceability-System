-- Create fms_user_invitations table for secure user provisioning
CREATE TABLE public.fms_user_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role fms_role NOT NULL DEFAULT 'production_operator',
  invited_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.fms_user_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can view all invitations
CREATE POLICY "Admins can view invitations"
ON public.fms_user_invitations
FOR SELECT
TO authenticated
USING (public.fms_has_role(auth.uid(), 'system_admin'::fms_role));

-- Admins can create invitations
CREATE POLICY "Admins can create invitations"
ON public.fms_user_invitations
FOR INSERT
TO authenticated
WITH CHECK (public.fms_has_role(auth.uid(), 'system_admin'::fms_role));

-- Admins can update invitations
CREATE POLICY "Admins can update invitations"
ON public.fms_user_invitations
FOR UPDATE
TO authenticated
USING (public.fms_has_role(auth.uid(), 'system_admin'::fms_role));

-- Admins can delete invitations
CREATE POLICY "Admins can delete invitations"
ON public.fms_user_invitations
FOR DELETE
TO authenticated
USING (public.fms_has_role(auth.uid(), 'system_admin'::fms_role));

-- Create trigger for updated_at
CREATE TRIGGER update_fms_user_invitations_updated_at
BEFORE UPDATE ON public.fms_user_invitations
FOR EACH ROW
EXECUTE FUNCTION public.fms_update_updated_at();

-- Create function to link invitation to user on signup
CREATE OR REPLACE FUNCTION public.fms_link_invitation_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Check if there's a pending invitation for this email
  SELECT * INTO invitation_record
  FROM public.fms_user_invitations
  WHERE email = LOWER(NEW.email)
    AND status = 'pending';
  
  IF FOUND THEN
    -- Create the FMS user with the real auth user ID
    INSERT INTO public.fms_users (user_id, name, role, is_active)
    VALUES (NEW.id, invitation_record.name, invitation_record.role, true)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Mark invitation as accepted
    UPDATE public.fms_user_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = invitation_record.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run on new user signup
CREATE TRIGGER fms_handle_user_invitation
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.fms_link_invitation_on_signup();