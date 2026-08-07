-- Validation trigger to prevent client-controlled financial field manipulation on orders
-- Ensures: non-negative values, credits_used <= balance, voucher_discount matches voucher, total is correct

CREATE OR REPLACE FUNCTION public.validate_order_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_balance numeric;
  v_voucher_record RECORD;
BEGIN
  -- Ensure financial fields are non-negative
  IF NEW.subtotal < 0 OR NEW.tax < 0 OR NEW.shipping_cost < 0 OR NEW.total < 0 THEN
    RAISE EXCEPTION 'Financial fields cannot be negative';
  END IF;

  IF COALESCE(NEW.credits_used, 0) < 0 OR COALESCE(NEW.voucher_discount, 0) < 0 THEN
    RAISE EXCEPTION 'Credits used and voucher discount cannot be negative';
  END IF;

  -- Validate credits_used against actual balance
  IF COALESCE(NEW.credits_used, 0) > 0 THEN
    SELECT COALESCE(balance, 0) INTO v_credit_balance
    FROM public.user_credits
    WHERE user_id = NEW.user_id;

    IF v_credit_balance IS NULL OR NEW.credits_used > v_credit_balance THEN
      RAISE EXCEPTION 'Credits used (%) exceeds available balance (%)', NEW.credits_used, COALESCE(v_credit_balance, 0);
    END IF;
  END IF;

  -- Validate voucher_discount against actual voucher if a code is provided
  IF COALESCE(NEW.voucher_discount, 0) > 0 THEN
    IF NEW.voucher_code IS NULL OR NEW.voucher_code = '' THEN
      RAISE EXCEPTION 'Voucher discount applied without a voucher code';
    END IF;

    SELECT * INTO v_voucher_record
    FROM public.voucher_codes
    WHERE code = NEW.voucher_code
      AND is_active = true
      AND redeemed_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid, inactive, or already redeemed voucher code: %', NEW.voucher_code;
    END IF;

    IF NEW.voucher_discount > v_voucher_record.amount THEN
      RAISE EXCEPTION 'Voucher discount (%) exceeds voucher value (%)', NEW.voucher_discount, v_voucher_record.amount;
    END IF;

    IF NEW.subtotal < v_voucher_record.minimum_order_total THEN
      RAISE EXCEPTION 'Order subtotal (%) does not meet minimum (%) for voucher', NEW.subtotal, v_voucher_record.minimum_order_total;
    END IF;
  END IF;

  -- Validate total calculation (allow 1 cent rounding tolerance)
  IF ABS(NEW.total - (NEW.subtotal + NEW.tax + NEW.shipping_cost - COALESCE(NEW.voucher_discount, 0) - COALESCE(NEW.credits_used, 0))) > 0.01 THEN
    RAISE EXCEPTION 'Order total (%) does not match calculated value (subtotal: % + tax: % + shipping: % - voucher: % - credits: %)',
      NEW.total, NEW.subtotal, NEW.tax, NEW.shipping_cost, COALESCE(NEW.voucher_discount, 0), COALESCE(NEW.credits_used, 0);
  END IF;

  IF NEW.total < 0 THEN
    RAISE EXCEPTION 'Order total cannot be negative';
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to orders table on INSERT
DROP TRIGGER IF EXISTS trg_validate_order_financials ON public.orders;
CREATE TRIGGER trg_validate_order_financials
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_financials();