
-- fms_receiving: allow qa_viewer to create receiving records
DROP POLICY IF EXISTS "FMS stores operators can create receiving records" ON public.fms_receiving;
CREATE POLICY "FMS stores operators can create receiving records"
ON public.fms_receiving
FOR INSERT
TO authenticated
WITH CHECK (fms_has_access(auth.uid()) AND received_by = auth.uid());

-- fms_production_batches: allow qa_viewer to create and update batches
DROP POLICY IF EXISTS "FMS operators can create production batches" ON public.fms_production_batches;
CREATE POLICY "FMS operators can create production batches"
ON public.fms_production_batches
FOR INSERT
WITH CHECK (fms_has_access(auth.uid()));

DROP POLICY IF EXISTS "FMS operators can update production batches" ON public.fms_production_batches;
CREATE POLICY "FMS operators can update production batches"
ON public.fms_production_batches
FOR UPDATE
USING (fms_has_access(auth.uid()));

-- fms_materials_used: allow qa_viewer to manage materials used in batches
DROP POLICY IF EXISTS "FMS operators can manage materials used" ON public.fms_materials_used;
CREATE POLICY "FMS operators can manage materials used"
ON public.fms_materials_used
FOR ALL
USING (fms_has_access(auth.uid()))
WITH CHECK (fms_has_access(auth.uid()));
