-- ============================================
-- HR Department System
-- ============================================

-- 1) Add HR user role to the fms_role enum
ALTER TYPE public.fms_role ADD VALUE IF NOT EXISTS 'hr_user';

-- ============================================
-- HR Employees
-- ============================================
CREATE TABLE IF NOT EXISTS public.fms_hr_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  id_number TEXT,
  department TEXT,
  job_title TEXT,
  employment_type TEXT CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'temporary', 'intern')),
  start_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave', 'terminated')),
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.fms_hr_employees ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HR Attendance
-- ============================================
CREATE TABLE IF NOT EXISTS public.fms_hr_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.fms_hr_employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  time_in TIME,
  time_out TIME,
  hours_worked DECIMAL,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day', 'leave')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (employee_id, attendance_date)
);

ALTER TABLE public.fms_hr_attendance ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HR Leave Requests
-- ============================================
CREATE TABLE IF NOT EXISTS public.fms_hr_leave (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.fms_hr_employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'family_responsibility', 'study', 'unpaid', 'maternity', 'paternity')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.fms_hr_leave ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HR Documents (staff contracts, forms, records)
-- ============================================
CREATE TABLE IF NOT EXISTS public.fms_hr_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.fms_hr_employees(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.fms_hr_documents ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HR Settings
-- ============================================
CREATE TABLE IF NOT EXISTS public.fms_hr_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.fms_hr_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Triggers
-- ============================================
DROP TRIGGER IF EXISTS fms_hr_employees_updated_at ON public.fms_hr_employees;
CREATE TRIGGER fms_hr_employees_updated_at
BEFORE UPDATE ON public.fms_hr_employees
FOR EACH ROW EXECUTE FUNCTION public.fms_update_updated_at();

DROP TRIGGER IF EXISTS fms_hr_leave_updated_at ON public.fms_hr_leave;
CREATE TRIGGER fms_hr_leave_updated_at
BEFORE UPDATE ON public.fms_hr_leave
FOR EACH ROW EXECUTE FUNCTION public.fms_update_updated_at();

DROP TRIGGER IF EXISTS fms_hr_settings_updated_at ON public.fms_hr_settings;
CREATE TRIGGER fms_hr_settings_updated_at
BEFORE UPDATE ON public.fms_hr_settings
FOR EACH ROW EXECUTE FUNCTION public.fms_update_updated_at();

-- ============================================
-- RLS Policies - HR users and system admins have access
-- ============================================

-- HR Employees
DROP POLICY IF EXISTS "HR and admins can view employees" ON public.fms_hr_employees;
CREATE POLICY "HR and admins can view employees"
ON public.fms_hr_employees
FOR SELECT
TO authenticated
USING (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
);

DROP POLICY IF EXISTS "HR and admins can manage employees" ON public.fms_hr_employees;
CREATE POLICY "HR and admins can manage employees"
ON public.fms_hr_employees
FOR ALL
TO authenticated
USING (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
)
WITH CHECK (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
);

-- HR Attendance
DROP POLICY IF EXISTS "HR and admins can view attendance" ON public.fms_hr_attendance;
CREATE POLICY "HR and admins can view attendance"
ON public.fms_hr_attendance
FOR SELECT
TO authenticated
USING (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
);

DROP POLICY IF EXISTS "HR and admins can manage attendance" ON public.fms_hr_attendance;
CREATE POLICY "HR and admins can manage attendance"
ON public.fms_hr_attendance
FOR ALL
TO authenticated
USING (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
)
WITH CHECK (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
);

-- HR Leave
DROP POLICY IF EXISTS "HR and admins can view leave" ON public.fms_hr_leave;
CREATE POLICY "HR and admins can view leave"
ON public.fms_hr_leave
FOR SELECT
TO authenticated
USING (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
);

DROP POLICY IF EXISTS "HR and admins can manage leave" ON public.fms_hr_leave;
CREATE POLICY "HR and admins can manage leave"
ON public.fms_hr_leave
FOR ALL
TO authenticated
USING (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
)
WITH CHECK (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
);

-- HR Documents
DROP POLICY IF EXISTS "HR and admins can view documents" ON public.fms_hr_documents;
CREATE POLICY "HR and admins can view documents"
ON public.fms_hr_documents
FOR SELECT
TO authenticated
USING (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
);

DROP POLICY IF EXISTS "HR and admins can manage documents" ON public.fms_hr_documents;
CREATE POLICY "HR and admins can manage documents"
ON public.fms_hr_documents
FOR ALL
TO authenticated
USING (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
)
WITH CHECK (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
);

-- HR Settings
DROP POLICY IF EXISTS "HR and admins can view settings" ON public.fms_hr_settings;
CREATE POLICY "HR and admins can view settings"
ON public.fms_hr_settings
FOR SELECT
TO authenticated
USING (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
);

DROP POLICY IF EXISTS "HR and admins can manage settings" ON public.fms_hr_settings;
CREATE POLICY "HR and admins can manage settings"
ON public.fms_hr_settings
FOR ALL
TO authenticated
USING (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
)
WITH CHECK (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
);

-- ============================================
-- Default HR settings
-- ============================================
INSERT INTO public.fms_hr_settings (setting_key, setting_value, description) VALUES
('annual_leave_days', '21', 'Default annual leave days per year'),
('sick_leave_days', '30', 'Default sick leave days per year'),
('standard_work_hours', '8', 'Standard working hours per day'),
('company_leave_policy', '"Leave must be requested at least 2 weeks in advance unless it is sick leave."', 'Company leave policy text')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- Invitations for the 3 authorized HR users
-- (the existing fms_link_invitation_on_signup trigger provisions
--  the fms_users row automatically when the auth account signs up)
-- ============================================
INSERT INTO public.fms_user_invitations (email, name, role, status)
VALUES
  ('zulaigah.benjamin@maharajasspices.co.za', 'Zulaigah Benjamin', 'hr_user', 'pending'),
  ('bradly@maharajasspices.co.za', 'Bradly', 'hr_user', 'pending'),
  ('selena.veerannah@maharajasspices.co.za', 'Selena Veerannah', 'hr_user', 'pending')
ON CONFLICT (email) DO UPDATE SET
  role = 'hr_user',
  status = 'pending',
  updated_at = now();