import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { toast } from 'sonner';
import { mapDatabaseError } from '@/lib/errorHandler';
import {
  supplierSchema,
  stockCodeSchema,
  receivingSchema,
  bomSchema,
  bomComponentSchema,
  productionBatchSchema,
  dispatchSchema,
  dispatchItemSchema,
} from '@/lib/fmsValidation';

// Types for FMS data
export interface FMSSupplier {
  id: string;
  code: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface FMSStockCode {
  id: string;
  stock_code: string;
  description: string;
  item_type: 'raw_material' | 'packaging' | 'work_in_progress' | 'finished_good';
  unit_of_measure: 'kg' | 'g' | 'litres' | 'ml' | 'units' | 'each';
  storage_condition: 'ambient' | 'chilled' | 'frozen';
  has_allergens: boolean;
  allergen_types: string[];
  approved_supplier_ids: string[];
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface FMSReceiving {
  id: string;
  internal_lot_number: string;
  received_at: string;
  stock_code_id: string;
  quantity_received: number;
  supplier_id: string;
  supplier_batch_number: string;
  manufacturing_date?: string;
  expiry_date: string;
  delivery_note_number?: string;
  quality_checks: Record<string, any>;
  status: 'accepted' | 'rejected' | 'partial' | 'pending';
  rejection_reason?: string;
  received_by: string;
  created_at: string;
  cost_price_per_kg?: number | null;
}

export interface FMSBOM {
  id: string;
  finished_good_id: string;
  version_number: number;
  effective_date: string;
  status: 'active' | 'obsolete';
  obsolete_reason?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  processing_steps?: { step_order: number; step_name: string; description?: string }[];
  organoleptic_parameters?: { name: string; expected_value: string }[];
  components?: FMSBOMComponent[];
}

export interface FMSBOMComponent {
  id: string;
  bom_id: string;
  material_stock_code_id: string;
  quantity_per_batch: number;
  created_at: string;
}

export interface FMSProductionBatch {
  id: string;
  batch_number: string;
  finished_good_id: string;
  bom_id: string;
  planned_batch_size: number;
  actual_quantity_produced?: number;
  product_size?: number;
  status: 'draft' | 'pre_weighing' | 'manufacturing' | 'in_progress' | 'closed' | 'cancelled';
  planned_production_date: string;
  production_start?: string;
  production_end?: string;
  production_instructions?: string;
  processing_steps: any[];
  quality_checks: any[];
  final_quality_checks?: any;
  pre_weigh_approved: boolean;
  pre_weigh_approved_by?: string;
  pre_weigh_approved_at?: string;
  pre_weigh_materials?: any[];
  scrap_waste?: number;
  waste_notes?: string;
  retention_sample_taken: boolean;
  operator_id: string;
  supervisor_id?: string;
  info_checker_name?: string;
  steps_checker_name?: string;
  quality_checker_name?: string;
  created_at: string;
  closed_at?: string;
}

export interface FMSDispatch {
  id: string;
  invoice_number: string;
  dispatch_date: string;
  customer_name: string;
  customer_id?: string;
  dispatched_by: string;
  created_at: string;
  items?: FMSDispatchItem[];
}

export interface FMSDispatchItem {
  id: string;
  dispatch_id: string;
  batch_id: string;
  quantity: number;
  created_at: string;
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const RATE_LIMIT_MAX_REQUESTS = 10;

// Validated Edge Function call with rate limiting
interface ValidatedRequestOptions {
  operation: 'insert' | 'update' | 'insert_many';
  table: string;
  data: unknown;
  id?: string;
}

// Custom hook for FMS data operations
export function useFMSData() {
  const { user, fmsUser } = useFMSAuth();
  const [suppliers, setSuppliers] = useState<FMSSupplier[]>([]);
  const [stockCodes, setStockCodes] = useState<FMSStockCode[]>([]);
  const [receivingRecords, setReceivingRecords] = useState<FMSReceiving[]>([]);
  const [boms, setBoms] = useState<FMSBOM[]>([]);
  const [productionBatches, setProductionBatches] = useState<FMSProductionBatch[]>([]);
  const [dispatchRecords, setDispatchRecords] = useState<FMSDispatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Rate limiting state
  const requestTimestamps = useRef<number[]>([]);

  // Check rate limit
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    // Remove timestamps outside the window
    requestTimestamps.current = requestTimestamps.current.filter(
      timestamp => now - timestamp < RATE_LIMIT_WINDOW
    );
    
    if (requestTimestamps.current.length >= RATE_LIMIT_MAX_REQUESTS) {
      return false;
    }
    
    requestTimestamps.current.push(now);
    return true;
  }, []);

  // Server-side validated request through Edge Function
  const validatedRequest = useCallback(async <T>(options: ValidatedRequestOptions): Promise<{ data: T | null; error: string | null }> => {
    // Check rate limit
    if (!checkRateLimit()) {
      return { data: null, error: 'Too many requests. Please wait a moment and try again.' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('fms-validate', {
        body: options,
      });

      if (error) {
        console.error('[FMS] Edge function error:', error);
        return { data: null, error: error.message || 'Server validation failed' };
      }

      if (!data?.success) {
        return { data: null, error: data?.error || 'Validation failed' };
      }

      return { data: data.data as T, error: null };
    } catch (err) {
      console.error('[FMS] Unexpected error:', err);
      return { data: null, error: 'An unexpected error occurred' };
    }
  }, [checkRateLimit]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!user) return;

    const fetchAllStockCodes = async (): Promise<FMSStockCode[]> => {
      const pageSize = 1000;
      let from = 0;
      const all: FMSStockCode[] = [];

      while (true) {
        const { data, error } = await supabase
          .from('fms_stock_codes')
          .select('*')
          .order('stock_code')
          .range(from, from + pageSize - 1);

        if (error) throw error;
        const page = (data || []) as FMSStockCode[];
        all.push(...page);

        if (page.length < pageSize) break;
        from += pageSize;
      }

      return all;
    };

    setLoading(true);
    try {
      const [suppliersRes, stockCodesData, receivingRes, bomsRes, batchesRes, dispatchRes] = await Promise.all([
        supabase.from('fms_suppliers').select('*').order('name'),
        fetchAllStockCodes(),
        supabase.from('fms_receiving').select('*').order('received_at', { ascending: false }),
        supabase.from('fms_bom').select('*, fms_bom_components(*)').order('created_at', { ascending: false }),
        supabase.from('fms_production_batches').select('*').order('created_at', { ascending: false }),
        supabase.from('fms_dispatch').select('*, fms_dispatch_items(*)').order('dispatch_date', { ascending: false }),
      ]);

      if (suppliersRes.data) setSuppliers(suppliersRes.data as FMSSupplier[]);
      setStockCodes(stockCodesData);
      if (receivingRes.data) setReceivingRecords(receivingRes.data as FMSReceiving[]);
      if (bomsRes.data) {
        const bomsWithComponents = bomsRes.data.map((bom: any) => ({
          ...bom,
          components: bom.fms_bom_components || [],
        }));
        setBoms(bomsWithComponents as FMSBOM[]);
      }
      if (batchesRes.data) setProductionBatches(batchesRes.data as FMSProductionBatch[]);
      if (dispatchRes.data) {
        const dispatchWithItems = dispatchRes.data.map((dispatch: any) => ({
          ...dispatch,
          items: dispatch.fms_dispatch_items || [],
        }));
        setDispatchRecords(dispatchWithItems as FMSDispatch[]);
      }
    } catch (error) {
      console.error('Error fetching FMS data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Supplier operations - validated through Edge Function
  const addSupplier = async (supplier: Omit<FMSSupplier, 'id' | 'created_at' | 'updated_at'>) => {
    // Client-side pre-validation for fast feedback
    const validation = supplierSchema.safeParse(supplier);
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return null;
    }

    // Server-side validated request
    const { data, error } = await validatedRequest<FMSSupplier>({
      operation: 'insert',
      table: 'fms_suppliers',
      data: supplier,
    });

    if (error) {
      console.error('[FMS] Add supplier error:', error);
      toast.error(error);
      return null;
    }

    if (data) {
      setSuppliers(prev => [...prev, data]);
      toast.success('Supplier added successfully');
    }
    return data;
  };

  const updateSupplier = async (id: string, updates: Partial<FMSSupplier>) => {
    // Client-side pre-validation
    const validation = supplierSchema.partial().safeParse(updates);
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return null;
    }

    // Server-side validated request
    const { data, error } = await validatedRequest<FMSSupplier>({
      operation: 'update',
      table: 'fms_suppliers',
      data: updates,
      id,
    });

    if (error) {
      console.error('[FMS] Update supplier error:', error);
      toast.error(error);
      return null;
    }

    if (data) {
      setSuppliers(prev => prev.map(s => s.id === id ? data : s));
      toast.success('Supplier updated successfully');
    }
    return data;
  };

  // Stock Code operations - validated through Edge Function
  const addStockCode = async (stockCode: Omit<FMSStockCode, 'id' | 'created_at' | 'updated_at'>) => {
    // Client-side pre-validation
    const validation = stockCodeSchema.safeParse(stockCode);
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return null;
    }

    // Server-side validated request
    const { data, error } = await validatedRequest<FMSStockCode>({
      operation: 'insert',
      table: 'fms_stock_codes',
      data: stockCode,
    });

    if (error) {
      console.error('[FMS] Add stock code error:', error);
      toast.error(error);
      return null;
    }

    if (data) {
      setStockCodes(prev => [...prev, data]);
      toast.success('Stock code added successfully');
    }
    return data;
  };

  const updateStockCode = async (id: string, updates: Partial<FMSStockCode>) => {
    const validation = stockCodeSchema.partial().safeParse(updates);
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return null;
    }

    // Server-side validated request
    const { data, error } = await validatedRequest<FMSStockCode>({
      operation: 'update',
      table: 'fms_stock_codes',
      data: updates,
      id,
    });

    if (error) {
      console.error('[FMS] Update stock code error:', error);
      toast.error(error);
      return null;
    }

    if (data) {
      setStockCodes(prev => prev.map(s => s.id === id ? data : s));
      toast.success('Stock code updated successfully');
    }
    return data;
  };

  // Receiving operations - validated through Edge Function
  const addReceivingRecord = async (record: Omit<FMSReceiving, 'id' | 'created_at'>) => {
    const validation = receivingSchema.safeParse(record);
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return null;
    }

    // Server-side validated request
    const { data, error } = await validatedRequest<FMSReceiving>({
      operation: 'insert',
      table: 'fms_receiving',
      data: record,
    });

    if (error) {
      console.error('[FMS] Add receiving record error:', error);
      toast.error(error);
      return null;
    }

    if (data) {
      setReceivingRecords(prev => [data, ...prev]);
      toast.success('Receipt recorded successfully');
    }
    return data;
  };

  // BOM operations - validated through Edge Function
  const addBOM = async (bom: Omit<FMSBOM, 'id' | 'created_at' | 'updated_at'>, components: Omit<FMSBOMComponent, 'id' | 'bom_id' | 'created_at'>[]) => {
    // Validate BOM
    const bomValidation = bomSchema.safeParse(bom);
    if (!bomValidation.success) {
      toast.error(bomValidation.error.issues[0].message);
      return null;
    }

    // Validate each component
    for (const component of components) {
      const compValidation = bomComponentSchema.safeParse(component);
      if (!compValidation.success) {
        toast.error(`Component error: ${compValidation.error.issues[0].message}`);
        return null;
      }
    }

    // Server-side validated insert for BOM
    const { data: bomData, error: bomError } = await validatedRequest<FMSBOM>({
      operation: 'insert',
      table: 'fms_bom',
      data: bom,
    });

    if (bomError || !bomData) {
      console.error('[FMS] Create BOM error:', bomError);
      toast.error(bomError || 'Failed to create BOM');
      return null;
    }

    // Insert components directly via Supabase (validated on client-side already)
    const componentsWithBomId = components.map(c => ({ 
      bom_id: bomData.id,
      material_stock_code_id: c.material_stock_code_id,
      quantity_per_batch: c.quantity_per_batch,
    }));

    const { error: compError } = await supabase
      .from('fms_bom_components')
      .insert(componentsWithBomId);

    if (compError) {
      console.error('[FMS] Add BOM components error:', compError);
      toast.error('BOM created but failed to add components: ' + compError.message);
      await fetchData();
      return bomData;
    }

    await fetchData();
    toast.success('BOM created successfully with ' + components.length + ' components');
    return bomData;
  };

  const updateBOM = async (id: string, updates: Partial<FMSBOM>) => {
    const validation = bomSchema.partial().safeParse(updates);
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return null;
    }

    // Server-side validated request
    const { data, error } = await validatedRequest<FMSBOM>({
      operation: 'update',
      table: 'fms_bom',
      data: updates,
      id,
    });

    if (error) {
      console.error('[FMS] Update BOM error:', error);
      toast.error(error);
      return null;
    }

    if (data) {
      setBoms(prev => prev.map(b => b.id === id ? { ...b, ...data } : b));
    }
    return data;
  };

  // Production operations - validated through Edge Function
  const addProductionBatch = async (batch: Omit<FMSProductionBatch, 'id' | 'batch_number' | 'created_at'>) => {
    const validation = productionBatchSchema.safeParse(batch);
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return null;
    }

    // Server-side validated request
    const { data, error } = await validatedRequest<FMSProductionBatch>({
      operation: 'insert',
      table: 'fms_production_batches',
      data: batch,
    });

    if (error) {
      console.error('[FMS] Create batch error:', error);
      toast.error(error);
      return null;
    }

    if (data) {
      setProductionBatches(prev => [data, ...prev]);
      toast.success('Batch created successfully');
    }
    return data;
  };

  const updateProductionBatch = async (id: string, updates: Partial<FMSProductionBatch>) => {
    const validation = productionBatchSchema.partial().safeParse(updates);
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return null;
    }

    // Server-side validated request
    const { data, error } = await validatedRequest<FMSProductionBatch>({
      operation: 'update',
      table: 'fms_production_batches',
      data: updates,
      id,
    });

    if (error) {
      console.error('[FMS] Update batch error:', error);
      toast.error(error);
      return null;
    }

    if (data) {
      setProductionBatches(prev => prev.map(b => b.id === id ? data : b));
    }
    return data;
  };

  // Dispatch operations - validated through Edge Function
  const addDispatchRecord = async (dispatch: Omit<FMSDispatch, 'id' | 'created_at'>, items: Omit<FMSDispatchItem, 'id' | 'dispatch_id' | 'created_at'>[]) => {
    // Validate dispatch
    const dispatchValidation = dispatchSchema.safeParse(dispatch);
    if (!dispatchValidation.success) {
      toast.error(dispatchValidation.error.issues[0].message);
      return null;
    }

    // Validate each item
    for (const item of items) {
      const itemValidation = dispatchItemSchema.safeParse(item);
      if (!itemValidation.success) {
        toast.error(`Dispatch item error: ${itemValidation.error.issues[0].message}`);
        return null;
      }
    }

    // Server-side validated insert for dispatch
    const { data: dispatchData, error: dispatchError } = await validatedRequest<FMSDispatch>({
      operation: 'insert',
      table: 'fms_dispatch',
      data: dispatch,
    });

    if (dispatchError || !dispatchData) {
      console.error('[FMS] Create dispatch error:', dispatchError);
      toast.error(dispatchError || 'Failed to create dispatch');
      return null;
    }

    // Server-side validated insert for items
    const itemsWithDispatchId = items.map(i => ({ ...i, dispatch_id: dispatchData.id }));
    const { error: itemsError } = await validatedRequest<FMSDispatchItem[]>({
      operation: 'insert_many',
      table: 'fms_dispatch_items',
      data: itemsWithDispatchId,
    });

    if (itemsError) {
      console.error('[FMS] Add dispatch items error:', itemsError);
      toast.error(itemsError);
    }

    await fetchData();
    toast.success('Dispatch recorded successfully');
    return dispatchData;
  };

  // Helper functions
  const getStockCodeById = (id: string) => stockCodes.find(sc => sc.id === id);
  const getSupplierById = (id: string) => suppliers.find(s => s.id === id);
  const getBOMByFinishedGoodId = (finishedGoodId: string) => 
    boms.find(b => b.finished_good_id === finishedGoodId && b.status === 'active');

  // Generate lot number
  const generateLotNumber = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('fms_generate_lot_number');
    if (error || !data) {
      // Fallback
      const year = new Date().getFullYear();
      const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
      return `LOT-${year}-${random}`;
    }
    return data as string;
  };

  return {
    // Data
    suppliers,
    stockCodes,
    receivingRecords,
    boms,
    productionBatches,
    dispatchRecords,
    loading,
    
    // Refresh
    refreshData: fetchData,
    
    // Operations
    addSupplier,
    updateSupplier,
    addStockCode,
    updateStockCode,
    addReceivingRecord,
    addBOM,
    updateBOM,
    addProductionBatch,
    updateProductionBatch,
    addDispatchRecord,
    
    // Helpers
    getStockCodeById,
    getSupplierById,
    getBOMByFinishedGoodId,
    generateLotNumber,
  };
}

// Utility functions
export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const formatDateTime = (date: string | Date): string => {
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
