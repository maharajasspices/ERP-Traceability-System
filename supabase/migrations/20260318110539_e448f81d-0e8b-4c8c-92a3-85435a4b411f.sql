
CREATE TABLE public.fms_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.fms_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FMS users can view all notes"
  ON public.fms_notes FOR SELECT
  TO authenticated
  USING (fms_has_access(auth.uid()));

CREATE POLICY "FMS users can create notes"
  ON public.fms_notes FOR INSERT
  TO authenticated
  WITH CHECK (fms_has_access(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "FMS users can delete their own notes"
  ON public.fms_notes FOR DELETE
  TO authenticated
  USING (fms_has_access(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "FMS admins can delete any notes"
  ON public.fms_notes FOR DELETE
  TO authenticated
  USING (fms_is_delete_admin(auth.uid()));
