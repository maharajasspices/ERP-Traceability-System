
-- Restore dispatch scan RPCs and secure their execution permissions.

CREATE OR REPLACE FUNCTION public.fms_record_dispatch_scan(
  p_requirement_id uuid,
  p_batch_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_req public.fms_dispatch_requirements%ROWTYPE;
  v_status text;
  v_next integer;
BEGIN
  IF v_user IS NULL
     OR NOT public.fms_has_access(v_user)
     OR public.fms_is_qa_viewer(v_user) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Access denied');
  END IF;

  SELECT * INTO v_req
  FROM public.fms_dispatch_requirements
  WHERE id = p_requirement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Invoice line not found');
  END IF;

  SELECT status INTO v_status
  FROM public.fms_dispatch
  WHERE id = v_req.dispatch_id;

  IF v_status IS NULL OR v_status = 'dispatched' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'This dispatch is already closed');
  END IF;

  IF COALESCE(v_req.quantity_scanned, 0)
     >= COALESCE(v_req.quantity_required, 0) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'All required units have already been scanned'
    );
  END IF;

  v_next := COALESCE(v_req.quantity_scanned, 0) + 1;

  IF p_batch_id IS NOT NULL THEN
    INSERT INTO public.fms_dispatch_items (
      dispatch_id, batch_id, quantity, quantity_required,
      quantity_scanned, scanned_by, scanned_at
    )
    VALUES (
      v_req.dispatch_id, p_batch_id, 0, 0, 1, v_user, now()
    )
    ON CONFLICT (dispatch_id, batch_id)
    DO UPDATE SET
      quantity_scanned = public.fms_dispatch_items.quantity_scanned + 1,
      scanned_by = EXCLUDED.scanned_by,
      scanned_at = EXCLUDED.scanned_at;
  END IF;

  INSERT INTO public.fms_dispatch_scan_history (
    dispatch_id, requirement_id, batch_id, scanned_by, scanned_at
  )
  VALUES (v_req.dispatch_id, v_req.id, p_batch_id, v_user, now());

  UPDATE public.fms_dispatch_requirements
  SET quantity_scanned = v_next,
      scanned_by = v_user,
      scanned_at = now()
  WHERE id = v_req.id;

  RETURN jsonb_build_object('ok', true, 'quantity_scanned', v_next);
END;
$function$;


CREATE OR REPLACE FUNCTION public.fms_undo_dispatch_scan(
  p_requirement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_req public.fms_dispatch_requirements%ROWTYPE;
  v_status text;
  v_history_id uuid;
  v_batch_id uuid;
  v_next integer;
  v_rows integer;
BEGIN
  IF v_user IS NULL
     OR NOT public.fms_has_access(v_user)
     OR public.fms_is_qa_viewer(v_user) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Access denied');
  END IF;

  SELECT * INTO v_req
  FROM public.fms_dispatch_requirements
  WHERE id = p_requirement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Invoice line not found');
  END IF;

  SELECT status INTO v_status
  FROM public.fms_dispatch
  WHERE id = v_req.dispatch_id;

  IF v_status IS NULL OR v_status = 'dispatched' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'This dispatch is already closed');
  END IF;

  IF COALESCE(v_req.quantity_scanned, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'There are no scans to undo');
  END IF;

  SELECT id, batch_id
  INTO v_history_id, v_batch_id
  FROM public.fms_dispatch_scan_history
  WHERE requirement_id = v_req.id
    AND undone_at IS NULL
  ORDER BY scanned_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_history_id IS NOT NULL AND v_batch_id IS NOT NULL THEN
    UPDATE public.fms_dispatch_items
    SET quantity_scanned = GREATEST(quantity_scanned - 1, 0)
    WHERE dispatch_id = v_req.dispatch_id
      AND batch_id = v_batch_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'Batch scan record not found; nothing was changed'
      );
    END IF;
  END IF;

  IF v_history_id IS NOT NULL THEN
    UPDATE public.fms_dispatch_scan_history
    SET undone_at = now()
    WHERE id = v_history_id;
  END IF;

  v_next := COALESCE(v_req.quantity_scanned, 0) - 1;

  UPDATE public.fms_dispatch_requirements
  SET quantity_scanned = v_next
  WHERE id = v_req.id;

  RETURN jsonb_build_object('ok', true, 'quantity_scanned', v_next);
END;
$function$;


-- Remove anonymous execution while preserving signed-in and service access.
REVOKE ALL ON FUNCTION
  public.fms_record_dispatch_scan(uuid, uuid)
  FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION
  public.fms_undo_dispatch_scan(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.fms_record_dispatch_scan(uuid, uuid)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.fms_undo_dispatch_scan(uuid)
  TO authenticated, service_role;
