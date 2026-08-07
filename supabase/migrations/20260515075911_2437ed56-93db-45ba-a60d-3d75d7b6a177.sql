-- Helper: is user a qa_viewer?
CREATE OR REPLACE FUNCTION public.fms_is_qa_viewer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fms_users
    WHERE user_id = _user_id AND role = 'qa_viewer' AND is_active = true
  )
$$;

-- Tighten write policies to exclude qa_viewer

-- fms_receiving INSERT
DROP POLICY IF EXISTS "FMS stores operators can create receiving records" ON public.fms_receiving;
CREATE POLICY "FMS stores operators can create receiving records"
ON public.fms_receiving
FOR INSERT
TO authenticated
WITH CHECK (
  public.fms_has_access(auth.uid())
  AND received_by = auth.uid()
  AND NOT public.fms_is_qa_viewer(auth.uid())
);

-- fms_production_batches INSERT / UPDATE
DROP POLICY IF EXISTS "FMS operators can create production batches" ON public.fms_production_batches;
CREATE POLICY "FMS operators can create production batches"
ON public.fms_production_batches
FOR INSERT
WITH CHECK (
  public.fms_has_access(auth.uid())
  AND NOT public.fms_is_qa_viewer(auth.uid())
);

DROP POLICY IF EXISTS "FMS operators can update production batches" ON public.fms_production_batches;
CREATE POLICY "FMS operators can update production batches"
ON public.fms_production_batches
FOR UPDATE
USING (
  public.fms_has_access(auth.uid())
  AND NOT public.fms_is_qa_viewer(auth.uid())
);

-- fms_dispatch INSERT
DROP POLICY IF EXISTS "FMS dispatch users can create dispatch records" ON public.fms_dispatch;
CREATE POLICY "FMS dispatch users can create dispatch records"
ON public.fms_dispatch
FOR INSERT
TO authenticated
WITH CHECK (
  public.fms_has_access(auth.uid())
  AND dispatched_by = auth.uid()
  AND NOT public.fms_is_qa_viewer(auth.uid())
);

-- fms_dispatch_items INSERT
DROP POLICY IF EXISTS "FMS dispatch users can create dispatch items" ON public.fms_dispatch_items;
CREATE POLICY "FMS dispatch users can create dispatch items"
ON public.fms_dispatch_items
FOR INSERT
WITH CHECK (
  public.fms_has_access(auth.uid())
  AND NOT public.fms_is_qa_viewer(auth.uid())
);

-- fms_materials_used ALL -> split: SELECT for all, write blocked for qa_viewer
DROP POLICY IF EXISTS "FMS operators can manage materials used" ON public.fms_materials_used;
CREATE POLICY "FMS operators can manage materials used"
ON public.fms_materials_used
FOR ALL
USING (
  public.fms_has_access(auth.uid())
  AND NOT public.fms_is_qa_viewer(auth.uid())
)
WITH CHECK (
  public.fms_has_access(auth.uid())
  AND NOT public.fms_is_qa_viewer(auth.uid())
);

-- Create invitations for the two new users (linked on first sign-in by existing trigger)
INSERT INTO public.fms_user_invitations (email, name, role, status)
VALUES
  ('justin.perumal@maharajasspices.co.za', 'Justin Perumal', 'qa_viewer', 'pending'),
  ('nondumiso.sibeko@maharajasspices.co.za', 'Nondumiso Sibeko', 'qa_viewer', 'pending')
ON CONFLICT DO NOTHING;
