-- 1. Add trigger on order_items to overwrite price with actual product price
CREATE OR REPLACE FUNCTION public.validate_order_item_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_price numeric;
BEGIN
  SELECT price INTO v_product_price
  FROM public.products
  WHERE id = NEW.product_id;

  IF v_product_price IS NULL THEN
    RAISE EXCEPTION 'Product % not found', NEW.product_id;
  END IF;

  NEW.price := v_product_price;

  IF NEW.quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_order_item_price
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_item_price();

-- 2. Fix employee_logs INSERT policy to enforce employee_id = auth.uid()
DROP POLICY IF EXISTS "Employees can create logs" ON public.employee_logs;
CREATE POLICY "Employees can create logs"
ON public.employee_logs
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'employee'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND employee_id = auth.uid()
);

-- Also add a trigger to enforce employee_id server-side
CREATE OR REPLACE FUNCTION public.enforce_employee_log_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.employee_id := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_employee_log_actor
  BEFORE INSERT ON public.employee_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_employee_log_actor();