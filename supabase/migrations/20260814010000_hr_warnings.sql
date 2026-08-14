-- HR Warnings table - for issuing disciplinary warnings to employees

CREATE TABLE IF NOT EXISTS public.fms_hr_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.fms_hr_employees(id) ON DELETE CASCADE,
  warning_type TEXT NOT NULL CHECK (warning_type IN ('verbal', 'written', 'final', 'other')),
  reason TEXT NOT NULL,
  details TEXT,
  issued_by UUID NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'acknowledged', 'disputed', 'resolved')),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.fms_hr_warnings ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS fms_hr_warnings_updated_at ON public.fms_hr_warnings;
CREATE TRIGGER fms_hr_warnings_updated_at
BEFORE UPDATE ON public.fms_hr_warnings
FOR EACH ROW EXECUTE FUNCTION public.fms_update_updated_at();

-- RLS Policies - HR users and system admins have access
DROP POLICY IF EXISTS "HR and admins can view warnings" ON public.fms_hr_warnings;
CREATE POLICY "HR and admins can view warnings"
ON public.fms_hr_warnings
FOR SELECT
TO authenticated
USING (
  public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
  OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
);

DROP POLICY IF EXISTS "HR and admins can manage warnings" ON public.fms_hr_warnings;
CREATE POLICY "HR and admins can manage warnings"
ON public.fms_hr_warnings
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