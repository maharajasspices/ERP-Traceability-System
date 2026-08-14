on hr log=-- HR Department Fixes - Add missing columns and storage bucket

-- 1) Add missing columns to fms_hr_employees
ALTER TABLE public.fms_hr_employees
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS system_role TEXT NOT NULL DEFAULT 'employee',
  ADD COLUMN IF NOT EXISTS supervisor TEXT,
  ADD COLUMN IF NOT EXISTS contract_signed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_signed_date DATE,
  ADD COLUMN IF NOT EXISTS termination_date DATE,
  ADD COLUMN IF NOT EXISTS termination_reason TEXT;

-- 2) Create HR documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('hr-documents', 'hr-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 3) Storage policies for HR documents bucket
DROP POLICY IF EXISTS "HR and admins can upload HR documents" ON storage.objects;
CREATE POLICY "HR and admins can upload HR documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'hr-documents'
  AND (public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
    OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role))
);

DROP POLICY IF EXISTS "HR and admins can view HR documents" ON storage.objects;
CREATE POLICY "HR and admins can view HR documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'hr-documents'
  AND (public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
    OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role))
);

DROP POLICY IF EXISTS "HR and admins can update HR documents" ON storage.objects;
CREATE POLICY "HR and admins can update HR documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'hr-documents'
  AND (public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
    OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role))
)
WITH CHECK (
  bucket_id = 'hr-documents'
  AND (public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
    OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role))
);

DROP POLICY IF EXISTS "HR and admins can delete HR documents" ON storage.objects;
CREATE POLICY "HR and admins can delete HR documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'hr-documents'
  AND (public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
    OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role))
);