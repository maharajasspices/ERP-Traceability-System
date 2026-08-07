-- 1) Add new view-only role
ALTER TYPE public.fms_role ADD VALUE IF NOT EXISTS 'qa_viewer';
