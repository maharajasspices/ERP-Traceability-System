
DROP POLICY "Users can view their own notifications" ON public.fms_notifications;
CREATE POLICY "Users can view their own notifications" ON public.fms_notifications
  FOR SELECT TO authenticated
  USING (fms_has_access(auth.uid()) AND user_id = auth.uid());

DROP POLICY "Users can update their own notifications" ON public.fms_notifications;
CREATE POLICY "Users can update their own notifications" ON public.fms_notifications
  FOR UPDATE TO authenticated
  USING (fms_has_access(auth.uid()) AND user_id = auth.uid());

DROP POLICY "FMS users can create notifications" ON public.fms_notifications;
CREATE POLICY "FMS users can create notifications" ON public.fms_notifications
  FOR INSERT TO authenticated
  WITH CHECK (fms_has_access(auth.uid()) AND user_id = auth.uid());
