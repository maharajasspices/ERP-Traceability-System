-- Update Tania's role to production_supervisor so she can create BOMs
UPDATE fms_users 
SET role = 'production_supervisor', updated_at = now() 
WHERE user_id = '7638dde2-7ba6-4dde-9181-7bd0bd496b22';