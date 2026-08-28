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
  manufacturing_date?: string | null;
  expiry_date?: string | null;
  delivery_note_number?: string;
  quality_checks: Record<string, any>;
  status: 'accepted' | 'rejected' | 'partial' | 'pending';
  rejection_reason?: string;
  received_by: string;
  created_at: string;
  cost_price_per_kg?: number | null;
}

export interface FMSStockOrderItem {
  id: string;
  order_id: string;
  stock_code_id: string;
  quantity_ordered: number;
  uom: string;
  received: boolean;
  quantity_received?: number | null;
  received_lot_number?: string | null;
  received_at?: string | null;
  received_by?: string | null;
  created_at: string;
}

export interface FMSStockOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  invoice_number?: string | null;
  invoice_file_path?: string | null;
  order_date: string;
  notes?: string | null;
  status: 'awaiting_receipt' | 'partial' | 'received';
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  items: FMSStockOrderItem[];
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

export interface FMSStockLevel {
  id: string;
  stock_code_id: string;
  quantity_on_hand: number;
  reserved_quantity: number;
  low_stock_threshold: number;
  updated_at: string;
}

export interface FMSStockMovement {
  id: string;
  stock_code_id: string;
  movement_type: 'receipt' | 'batch_usage' | 'adjustment' | 'reservation' | 'reservation_release';
  quantity_change: number;
  batch_id?: string;
  batch_number?: string;
  reference_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

// Reservation linking a Batch Sheet to the LOT (receiving record) it has set aside
export interface FMSStockReservation {
  id: string;
  batch_id: string;
  batch_number: string;
  stock_code_id: string;
  receiving_record_id?: string | null;
  internal_lot_number?: string | null;
  quantity_reserved: number;
  status: 'reserved' | 'consumed' | 'released';
  reserved_at?: string;
  reserved_by?: string | null;
  consumed_at?: string | null;
  consumed_by?: string | null;
  released_at?: string | null;
  released_by?: string | null;
  created_at: string;
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const RATE_LIMIT_MAX_REQUESTS = 10;

// Module-level cache to avoid re-fetching all data on every page navigation
// This significantly improves page load times across the app
interface FMSDataCache {
  suppliers: FMSSupplier[] | null;
  stockCodes: FMSStockCode[] | null;
  receivingRecords: FMSReceiving[] | null;
  boms: FMSBOM[] | null;
  productionBatches: FMSProductionBatch[] | null;
  dispatchRecords: FMSDispatch[] | null;
  stockLevels: FMSStockLevel[] | null;
  stockMovements: FMSStockMovement[] | null;
  stockReservations: FMSStockReservation[] | null;
  stockOrders: FMSStockOrder[] | null;
  fetchedAt: number | null;
  userId: string | null;
}

const dataCache: FMSDataCache = {
  suppliers: null,
  stockOrders: null,
  stockCodes: null,
  receivingRecords: null,
  boms: null,
  productionBatches: null,
  dispatchRecords: null,
  stockLevels: null,
  stockMovements: null,
  stockReservations: null,
  fetchedAt: null,
  userId: null,
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
  const [stockOrders, setStockOrders] = useState<FMSStockOrder[]>([]);
  const [boms, setBoms] = useState<FMSBOM[]>([]);
  const [productionBatches, setProductionBatches] = useState<FMSProductionBatch[]>([]);
  const [dispatchRecords, setDispatchRecords] = useState<FMSDispatch[]>([]);
  const [stockLevels, setStockLevels] = useState<FMSStockLevel[]>([]);
  const [stockMovements, setStockMovements] = useState<FMSStockMovement[]>([]);
  const [stockReservations, setStockReservations] = useState<FMSStockReservation[]>([]);
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
  // Falls back to direct database operations if the edge function is unavailable
  const validatedRequest = useCallback(async <T>(options: ValidatedRequestOptions): Promise<{ data: T | null; error: string | null }> => {
    // Check rate limit
    if (!checkRateLimit()) {
      return { data: null, error: 'Too many requests. Please wait a moment and try again.' };
    }

    // Fallback to direct database operations if edge function fails
    const fallbackDirect = async (): Promise<{ data: T | null; error: string | null }> => {
      console.warn('[FMS] Edge function unavailable, using direct DB fallback for', options.table);
      try {
        const table = options.table as any;
        if (options.operation === 'insert') {
          const { data, error } = await supabase.from(table).insert(options.data as any).select().single();
          if (error) return { data: null, error: error.message };
          return { data: data as T, error: null };
        }
        if (options.operation === 'update') {
          if (!options.id) return { data: null, error: 'ID required for update' };
          const { data, error } = await supabase.from(table).update(options.data as any).eq('id', options.id).select().single();
          if (error) return { data: null, error: error.message };
          return { data: data as T, error: null };
        }
        if (options.operation === 'insert_many') {
          const { data, error } = await supabase.from(table).insert(options.data as any).select();
          if (error) return { data: null, error: error.message };
          return { data: data as T, error: null };
        }
        return { data: null, error: 'Invalid operation' };
      } catch (err: any) {
        console.error('[FMS] Direct DB fallback error:', err);
        return { data: null, error: err?.message || 'Database operation failed' };
      }
    };

    try {
      const { data, error } = await supabase.functions.invoke('fms-validate', {
        body: options,
      });

      if (error) {
        console.error('[FMS] Edge function error:', error);
        // Edge function failed (non-2xx, not deployed, runtime error) - use direct fallback
        return await fallbackDirect();
      }

      if (!data?.success) {
        // If the edge function responded but validation failed, return the error
        return { data: null, error: data?.error || 'Validation failed' };
      }

      return { data: data.data as T, error: null };
    } catch (err) {
      console.error('[FMS] Unexpected error:', err);
      // Any unexpected error - use direct fallback
      return await fallbackDirect();
    }
  }, [checkRateLimit]);

  // Fetch all data
  const fetchData = useCallback(async (force = false) => {
    if (!user) return;

    // Check if we have a valid cache for this user
    const cacheValid = dataCache.fetchedAt !== null &&
      dataCache.userId === user.id &&
      Date.now() - dataCache.fetchedAt < CACHE_TTL &&
      !force;

    if (cacheValid && dataCache.suppliers && dataCache.stockCodes) {
      // Use cached data - instant load
      setSuppliers(dataCache.suppliers);
      setStockCodes(dataCache.stockCodes);
      if (dataCache.receivingRecords) setReceivingRecords(dataCache.receivingRecords);
      if (dataCache.stockOrders) setStockOrders(dataCache.stockOrders);
      if (dataCache.boms) setBoms(dataCache.boms);
      if (dataCache.productionBatches) setProductionBatches(dataCache.productionBatches);
      if (dataCache.dispatchRecords) setDispatchRecords(dataCache.dispatchRecords);
      if (dataCache.stockLevels) setStockLevels(dataCache.stockLevels);
      if (dataCache.stockMovements) setStockMovements(dataCache.stockMovements);
      if (dataCache.stockReservations) setStockReservations(dataCache.stockReservations);
      setLoading(false);
      return;
    }

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

    // Helper: try a DB query, fall back to local store when the DB is unavailable
    const dbOrLocal = async <T,>(
      query: () => PromiseLike<any>,
      local: () => T[]
    ): Promise<T[]> => {
      try {
        const { data, error } = await query();
        if (error) throw error;
        if (data) return data as T[];
        return local();
      } catch (err) {
        console.warn('[FMS] DB unavailable, using local fallback:', err);
        return local();
      }
    };

    try {
      // Stock codes
      const stockCodesData = await dbOrLocal<FMSStockCode>(
        () => fetchAllStockCodes().then((data) => ({ data, error: null })),
        () => []
      );
      setStockCodes(stockCodesData);

      const [suppliersRes, receivingRes, bomsRes, batchesRes, dispatchRes, stockLevelsRes, stockMovementsRes, stockReservationsRes, stockOrdersRes] = await Promise.all([
        dbOrLocal<FMSSupplier>(
          () => supabase.from('fms_suppliers').select('*').order('name').then((res: any) => ({ data: res.data, error: res.error })),
          () => []
        ),
        dbOrLocal<FMSReceiving>(
          () => supabase.from('fms_receiving').select('*').order('received_at', { ascending: false }).then((res: any) => ({ data: res.data, error: res.error })),
          () => []
        ),
        dbOrLocal<any>(
          () => supabase.from('fms_bom').select('*, fms_bom_components(*)').order('created_at', { ascending: false }).then((res: any) => ({ data: res.data, error: res.error })),
          () => []
        ),
        dbOrLocal<FMSProductionBatch>(
          () => supabase.from('fms_production_batches').select('*').order('created_at', { ascending: false }).then((res: any) => ({ data: res.data, error: res.error })),
          () => []
        ),
        dbOrLocal<any>(
          () => supabase.from('fms_dispatch').select('*, fms_dispatch_items(*)').order('dispatch_date', { ascending: false }).then((res: any) => ({ data: res.data, error: res.error })),
          () => []
        ),
        dbOrLocal<FMSStockLevel>(
          () => (supabase.from('fms_stock_levels' as any) as any).select('*').then((res: any) => ({ data: res.data, error: res.error })),
          () => []
        ),
        dbOrLocal<FMSStockMovement>(
          () => (supabase.from('fms_stock_movements' as any) as any).select('*').order('created_at', { ascending: false }).limit(500).then((res: any) => ({ data: res.data, error: res.error })),
          () => []
        ),
        dbOrLocal<FMSStockReservation>(
          () => (supabase.from('fms_stock_reservations' as any) as any).select('*').order('created_at', { ascending: false }).then((res: any) => ({ data: res.data, error: res.error })),
          () => []
        ),
        dbOrLocal<FMSStockOrder>(
          () => (supabase.from('fms_stock_orders' as any) as any)
            .select('*, fms_stock_order_items(*)')
            .order('created_at', { ascending: false })
            .then((res: any) => ({ data: res.data, error: res.error })),
          () => []
        ),
      ]);

      setSuppliers(suppliersRes);
      if (receivingRes) setReceivingRecords(receivingRes);
      if (bomsRes) {
        const bomsWithComponents = bomsRes.map((bom: any) => ({
          ...bom,
          components: bom.fms_bom_components || [],
        }));
        setBoms(bomsWithComponents as FMSBOM[]);
      }
      if (batchesRes) setProductionBatches(batchesRes);
      if (dispatchRes) {
        const dispatchWithItems = dispatchRes.map((dispatch: any) => ({
          ...dispatch,
          items: dispatch.fms_dispatch_items || [],
        }));
        setDispatchRecords(dispatchWithItems as FMSDispatch[]);
      }
      if (stockLevelsRes) setStockLevels(stockLevelsRes);
      if (stockMovementsRes) setStockMovements(stockMovementsRes);
      if (stockReservationsRes) setStockReservations(stockReservationsRes);
      if (stockOrdersRes) {
        setStockOrders(stockOrdersRes.map((o: any) => ({
          ...o,
          items: o.fms_stock_order_items || [],
        })) as FMSStockOrder[]);
      }

      // Store in cache
      dataCache.suppliers = suppliersRes;
      dataCache.stockCodes = stockCodesData;
      dataCache.receivingRecords = receivingRes;
      dataCache.boms = bomsRes.map((bom: any) => ({
        ...bom,
        components: bom.fms_bom_components || [],
      }));
      dataCache.productionBatches = batchesRes;
      dataCache.dispatchRecords = dispatchRes.map((dispatch: any) => ({
        ...dispatch,
        items: dispatch.fms_dispatch_items || [],
      }));
      dataCache.stockLevels = stockLevelsRes;
      dataCache.stockMovements = stockMovementsRes;
      dataCache.stockReservations = stockReservationsRes;
      dataCache.stockOrders = stockOrdersRes?.map((o: any) => ({
        ...o,
        items: o.fms_stock_order_items || [],
      })) ?? [];
      dataCache.fetchedAt = Date.now();
      dataCache.userId = user.id;
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
  const getReceivingById = (id: string | null | undefined) =>
    id ? receivingRecords.find(r => r.id === id) : undefined;
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

  // Add stock for a receipt (records movement + updates stock level)
  // Returns the new quantity on hand
  const addStockForReceipt = async (
    stockCodeId: string,
    quantity: number,
    referenceId: string,
    notes?: string
  ): Promise<number | null> => {
    try {
      const { data, error } = await (supabase.rpc as any)('fms_apply_stock_movement', {
        p_stock_code_id: stockCodeId,
        p_movement_type: 'receipt',
        p_quantity_change: quantity,
        p_reference_id: referenceId,
        p_notes: notes || `Receipt ${referenceId}`,
        p_created_by: user?.id || null,
      });
      
      if (error) {
        console.error('[FMS] Stock receipt error:', error);
        return null;
      }
      
      return Number(data ?? 0);
    } catch (err) {
      console.error('[FMS] Stock receipt unexpected error:', err);
      return null;
    }
  };

  // FIFO Lot Allocation - returns the oldest lots to consume from first
  const fifoAllocateLots = async (
    stockCodeId: string,
    quantityRequired: number
  ): Promise<{
    receiving_record_id: string;
    internal_lot_number: string;
    quantity_available: number;
    quantity_to_use: number;
    expiry_date: string | null;
  }[]> => {
    try {
      const { data, error } = await (supabase.rpc as any)('fms_fifo_allocate_lots', {
        p_stock_code_id: stockCodeId,
        p_quantity_required: quantityRequired,
      });
      
      if (error) {
        console.error('[FMS] FIFO allocation error:', error);
        return [];
      }
      
      return (data || []).map((row: any) => ({
        receiving_record_id: row.receiving_record_id,
        internal_lot_number: row.internal_lot_number,
        quantity_available: Number(row.quantity_available),
        quantity_to_use: Number(row.quantity_to_use),
        expiry_date: row.expiry_date,
      }));
    } catch (err) {
      console.error('[FMS] FIFO allocation unexpected error:', err);
      return [];
    }
  };

  // Record lot usage in fms_materials_used table (tracks which lot was consumed)
  const recordLotUsage = async (
    batchId: string,
    lotUsages: { receiving_record_id: string; quantity_used: number }[]
  ): Promise<boolean> => {
    try {
      const records = lotUsages.map(lu => ({
        batch_id: batchId,
        receiving_record_id: lu.receiving_record_id,
        quantity_used: lu.quantity_used,
      }));
      
      const { error } = await supabase
        .from('fms_materials_used')
        .insert(records as any);
      
      if (error) {
        console.error('[FMS] Record lot usage error:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[FMS] Record lot usage unexpected error:', err);
      return false;
    }
  };

  // Deduct stock for a batch (records movement + updates stock level)
  // Returns array of { stock_code_id, new_quantity, is_low } for each material
  const deductStockForBatch = async (
    materials: { stock_code_id: string; quantity: number }[],
    batchId: string,
    batchNumber: string
  ): Promise<{ stock_code_id: string; new_quantity: number; is_low: boolean }[]> => {
    const results: { stock_code_id: string; new_quantity: number; is_low: boolean }[] = [];
    
    for (const mat of materials) {
      try {
        const { data, error } = await (supabase.rpc as any)('fms_apply_stock_movement', {
          p_stock_code_id: mat.stock_code_id,
          p_movement_type: 'batch_usage',
          p_quantity_change: -mat.quantity,
          p_batch_id: batchId,
          p_batch_number: batchNumber,
          p_reference_id: batchNumber,
          p_notes: `Batch ${batchNumber} material usage`,
          p_created_by: user?.id || null,
        });
        
        if (error) {
          console.error('[FMS] Stock deduction error:', error);
          continue;
        }
        
        const newQty = Number(data ?? 0);
        const level = stockLevels.find(sl => sl.stock_code_id === mat.stock_code_id);
        const isLow = newQty < 0 || (level ? newQty <= level.low_stock_threshold : false);
        
        results.push({ stock_code_id: mat.stock_code_id, new_quantity: newQty, is_low: isLow });
      } catch (err) {
        console.error('[FMS] Stock deduction unexpected error:', err);
      }
    }
    
    // Refresh stock levels after deductions
    if (results.length > 0) {
      await fetchData(true);
    }
    
    return results;
  };

  // Reserve stock for a batch (set aside; physical stock NOT reduced).
  // Returns per-stock-code summary { stock_code_id, quantity_reserved, net_stock_after }.
  const reserveStockForBatch = async (
    batchId: string,
    batchNumber: string,
    reservations: { stock_code_id: string; receiving_record_id: string | null; internal_lot_number?: string | null; quantity: number }[]
  ): Promise<{ stock_code_id: string; quantity_reserved: number; net_stock_after: number }[] | null> => {
    try {
      const { data, error } = await (supabase.rpc as any)('fms_reserve_batch_stock', {
        p_batch_id: batchId,
        p_batch_number: batchNumber,
        p_reservations: reservations.map(r => ({
          stock_code_id: r.stock_code_id,
          receiving_record_id: r.receiving_record_id,
          internal_lot_number: r.internal_lot_number,
          quantity: r.quantity,
        })),
        p_created_by: user?.id || null,
      });

    if (error) {
  console.error('[FMS] Stock reserve error:', error);
  toast.error(`Stock reservation failed: ${error.message}`);
  return null;
}

      return (data || []).map((row: any) => ({
        stock_code_id: row.stock_code_id,
        quantity_reserved: Number(row.quantity_reserved),
        net_stock_after: Number(row.net_stock_after),
      }));
    } catch (err) {
      console.error('[FMS] Stock reserve unexpected error:', err);
      return null;
    }
  };

  // Release reservations for a batch (cancel). Returns per-stock-code summary.
  const releaseBatchReservations = async (
    batchId: string,
    batchNumber: string
  ): Promise<boolean> => {
    try {
      const { error } = await (supabase.rpc as any)('fms_release_batch_reservations', {
        p_batch_id: batchId,
        p_batch_number: batchNumber,
        p_created_by: user?.id || null,
      });

      if (error) {
        console.error('[FMS] Reservation release error:', error);
        return false;
      }

      await fetchData(true);
      return true;
    } catch (err) {
      console.error('[FMS] Reservation release unexpected error:', err);
      return false;
    }
  };

  // Consume reservations for a batch (production completed) - actual consumption.
  // Returns { stock_code_id, new_quantity_on_hand, is_low }[] for low-stock warnings.
  const consumeBatchReservations = async (
    batchId: string,
    batchNumber: string
    ): Promise<{ stock_code_id: string; new_quantity_on_hand: number; is_low: boolean }[]> => {
    const results: { stock_code_id: string; new_quantity_on_hand: number; is_low: boolean }[] = [];
    try {
      const { data, error } = await (supabase.rpc as any)('fms_consume_batch_reservations', {
        p_batch_id: batchId,
        p_batch_number: batchNumber,
        p_created_by: user?.id || null,
      });

            if (error) {
        console.error('[FMS] Stock consumption error:', error);
        toast.error(`Stock consumption failed: ${error.message}`);
        return results;
      }

      for (const row of (data || [])) {
        results.push({
          stock_code_id: row.stock_code_id,
          new_quantity_on_hand: Number(row.new_quantity_on_hand),
          is_low: Boolean(row.is_low),
        });
      }

      if (results.length === 0) {
        toast.warning('No active reservations found for this batch — stock was not consumed. Check that reservations were created when the batch was made.');
      }
    } catch (err) {
      console.error('[FMS] Stock consumption unexpected error:', err);
    } finally {
      // Always refresh so the UI reflects the current stock state,
      // even when the RPC returns 0 rows (e.g. legacy batches).
      await fetchData(true);
    }
    return results;
  };

  // Return the reservations for a given batch (for the view dialog traceability)
  const getReservationsForBatch = (batchId: string): FMSStockReservation[] =>
    stockReservations.filter(r => r.batch_id === batchId).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

  // Create a stock order (uploaded invoice/order) with its line items
  const createStockOrder = async (
    order: {
      po_number: string;
      supplier_id: string;
      invoice_number?: string;
      invoice_file_path?: string | null;
      order_date: string;
      notes?: string;
    },
    items: { stock_code_id: string; quantity_ordered: number; uom: string }[]
  ): Promise<boolean> => {
    try {
      const { data: header, error: headerError } = await (supabase
        .from('fms_stock_orders' as any) as any)
        .insert({ ...order, created_by: user?.id || null })
        .select('id')
        .single();
      if (headerError) throw headerError;

      const { error: itemsError } = await (supabase
        .from('fms_stock_order_items' as any) as any)
        .insert(items.map(it => ({ ...it, order_id: header.id })));
      if (itemsError) {
        // Roll back orphan header
        await (supabase.from('fms_stock_orders' as any) as any).delete().eq('id', header.id);
        throw itemsError;
      }

      toast.success(`Order ${order.po_number} created — awaiting receipt`);
      await fetchData(true);
      return true;
    } catch (err: any) {
      console.error('[FMS] createStockOrder error:', err);
      toast.error(mapDatabaseError(err) || 'Failed to create order');
      return false;
    }
  };

  return {
    // Data
    suppliers,
    stockCodes,
    receivingRecords,
    boms,
    productionBatches,
    dispatchRecords,
    stockLevels,
    stockMovements,
    stockReservations,
    stockOrders,
    loading,
    
    // Refresh (forces a fresh fetch, bypassing cache)
    refreshData: () => fetchData(true),
    
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
    deductStockForBatch,
    addStockForReceipt,
    fifoAllocateLots,
    recordLotUsage,
    reserveStockForBatch,
    releaseBatchReservations,
    consumeBatchReservations,
    getReservationsForBatch,

    // Stock orders (purchase orders awaiting receipt)
    createStockOrder,
    
    // Helpers
    getStockCodeById,
    getSupplierById,
    getReceivingById,
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
