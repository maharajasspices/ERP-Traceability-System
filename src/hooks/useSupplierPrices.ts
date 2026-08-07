import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SupplierMaterialPrice {
  id: string;
  supplier_id: string;
  stock_code_id: string;
  cost_price_per_kg: number;
  currency: string;
  notes?: string | null;
  updated_at: string;
}

export function useSupplierPrices() {
  const [prices, setPrices] = useState<SupplierMaterialPrice[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fms_supplier_material_prices' as any)
      .select('*');
    if (!error && data) setPrices(data as unknown as SupplierMaterialPrice[]);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /**
   * Average price per kg for a given stock code across all suppliers that have it priced.
   * Returns null if no prices recorded.
   */
  const avgPriceForStockCode = useCallback((stockCodeId: string): number | null => {
    const list = prices.filter(p => p.stock_code_id === stockCodeId && p.cost_price_per_kg > 0);
    if (!list.length) return null;
    return list.reduce((s, p) => s + Number(p.cost_price_per_kg), 0) / list.length;
  }, [prices]);

  const pricesForSupplier = useCallback((supplierId: string) => {
    return prices.filter(p => p.supplier_id === supplierId);
  }, [prices]);

  return { prices, loading, refresh, avgPriceForStockCode, pricesForSupplier };
}

export const formatZAR = (v: number | null | undefined) => {
  if (v == null || isNaN(Number(v))) return '—';
  return `R${Number(v).toFixed(2)}`;
};
