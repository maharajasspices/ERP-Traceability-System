-- =============================================================
-- fms_delete_stock_orders: SECURITY DEFINER helper so the app can
-- delete stock orders (and their uploaded invoice files) even if
-- row-level security would otherwise block the write. This makes
-- delete reliable from the frontend.
-- Idempotent. Deletes only the ids supplied.
-- =============================================================

CREATE OR REPLACE FUNCTION public.fms_delete_stock_orders(p_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove the uploaded invoice documents from the private storage bucket
  -- for the orders being deleted (best-effort; missing paths are fine).
  DELETE FROM storage.objects
  WHERE bucket_id = 'order-documents'
    AND name IN (
      SELECT invoice_file_path
      FROM public.fms_stock_orders
      WHERE id = ANY(p_ids)
        AND invoice_file_path IS NOT NULL
    );

  -- Delete the order headers; line items cascade via ON DELETE CASCADE.
  DELETE FROM public.fms_stock_orders
  WHERE id = ANY(p_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.fms_delete_stock_orders(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fms_delete_stock_orders(UUID[]) TO authenticated;