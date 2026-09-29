-- HR Warning meetings: scheduled disciplinary meetings from issued warnings.
-- HR must confirm or postpone them; surfaced on dashboard + header bell.
-- Depends on public.fms_hr_warnings (supabase/migrations/20260814010000_hr_warnings.sql).
-- Run this in Supabase Dashboard > SQL Editor if the table error persists.

-- 1) Ensure base table exists (idempotent, safe to re-run)
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

DROP TRIGGER IF EXISTS fms_hr_warnings_updated_at ON public.fms_hr_warnings;
CREATE TRIGGER fms_hr_warnings_updated_at
BEFORE UPDATE ON public.fms_hr_warnings
FOR EACH ROW EXECUTE FUNCTION public.fms_update_updated_at();

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

-- 2) Meeting reminder columns (added after base table)
ALTER TABLE public.fms_hr_warnings
  ADD COLUMN IF NOT EXISTS meeting_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS meeting_status TEXT NOT NULL DEFAULT 'none' CHECK (meeting_status IN ('none', 'pending', 'confirmed')),
  ADD COLUMN IF NOT EXISTS meeting_postponed_to TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS meeting_resolved_at TIMESTAMP WITH TIME ZONE,
  -- Columns used by the fms-hr-warning / fms-hr-meeting edge functions
  ADD COLUMN IF NOT EXISTS booking_token TEXT,
  ADD COLUMN IF NOT EXISTS meeting_requested BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS meeting_type TEXT CHECK (meeting_type IN ('in_person', 'online')),
  ADD COLUMN IF NOT EXISTS meeting_message TEXT;

CREATE INDEX IF NOT EXISTS fms_hr_warnings_booking_token_idx
  ON public.fms_hr_warnings (booking_token)
  WHERE booking_token IS NOT NULL;

-- Backfill: warnings that already carry a meeting date count as pending
UPDATE public.fms_hr_warnings
SET meeting_status = 'pending'
WHERE meeting_date IS NOT NULL AND meeting_status = 'none';

CREATE INDEX IF NOT EXISTS fms_hr_warnings_meeting_status_idx
  ON public.fms_hr_warnings (meeting_status)
  WHERE meeting_status = 'pending';
