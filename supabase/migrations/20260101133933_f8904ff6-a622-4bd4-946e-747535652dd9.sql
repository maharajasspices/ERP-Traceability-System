-- Insert the authorized FMS user (aryan123qwer@gmail.com) with system_admin role
INSERT INTO public.fms_users (user_id, name, role, is_active)
VALUES (
  'f4cacdbe-0c43-43c4-a75f-d151c19d7f18',
  'Aryan Inderlall',
  'system_admin',
  true
)
ON CONFLICT (user_id) DO UPDATE SET
  role = 'system_admin',
  is_active = true,
  updated_at = now();