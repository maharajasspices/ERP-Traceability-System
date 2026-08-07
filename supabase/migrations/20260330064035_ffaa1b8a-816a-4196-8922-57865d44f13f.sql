-- Remove the order_item price overwrite trigger since it breaks variant pricing.
-- The validate_order_financials trigger on orders already validates totals.
DROP TRIGGER IF EXISTS trg_validate_order_item_price ON public.order_items;
DROP FUNCTION IF EXISTS public.validate_order_item_price();