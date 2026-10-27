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
  bom_uses_percentage?: boolean;
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
  status: 'accepted' | 'declined' | 'partial' | 'pending';
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
  status: 'PENDING_RECEIPT' | 'PARTIALLY_RECEIVED' | 'CHECKED' | 'CANCELLED';
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  items: FMSStockOrderItem[];
}

export interface FMSBOM {
  id: string;
  finished_good_id: string;
  /** Legacy single finished-product link (kept for backward compatibility). */
  parent_finished_good_id?: string | null;
  /** Finished products this BOM version belongs to (from fms_bom_finished_goods). */
  parent_finished_good_ids?: string[];
  version_number: number;
  effective_date: string;
  status: 'active' | 'obsolete';
  obsolete_reason?: string;
  created_by: string;
  created_at: string;
  min_soaking_days?: number | null;
  max_soaking_days?: number | null;
  updated_at: string;
  processing_steps?: { step_order: number; step_name: string; description?: string }[];
  organoleptic_parameters?: { name: string; expected_value: string }[];
  components?: FMSBOMComponent[];
}

export interface FMSBOMFinishedGoodLink {
  bom_id: string;
  finished_good_id: string;
  created_at?: string;
}

/** Finished products a BOM version belongs to, derived from join rows. */
export const bomParentIds = (bom: Pick<FMSBOM, 'parent_finished_good_id' | 'parent_finished_good_ids'>): string[] => {
  const fromJoin = Array.isArray(bom.parent_finished_good_ids) ? bom.parent_finished_good_ids : [];
  if (fromJoin.length > 0) return Array.from(new Set(fromJoin.filter(Boolean)));
  return bom.parent_finished_good_id ? [bom.parent_finished_good_id] : [];
};

/** True when the BOM version is explicitly linked to the given finished good. */
export const bomBelongsTo = (
  bom: Pick<FMSBOM, 'parent_finished_good_id' | 'parent_finished_good_ids'>,
  finishedGoodId: string
): boolean => bomParentIds(bom).includes(finishedGoodId);

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
  /**
   * Best Before date for this batch's finished goods.
   *
   * Set by a person before the midnight print run. Many batches may carry the
   * exact same date - it is never unique and never used as an identifier.
   */
  best_before_date?: string | null;
  /** How many 30x30mm Best Before stickers to print for this batch. */
  sticker_copies?: number | null;
  created_at: string;
  closed_at?: string;
  finished_good_stock_credited: boolean;
}

export type FMSDispatchStatus = 'draft' | 'picking' | 'ready' | 'dispatched' | 'departed';

export interface FMSDispatch {
  id: string;
  /** Primary invoice label. Kept populated for single-invoice dispatches. */
  invoice_number: string;
  dispatch_date: string;
  customer_name: string;
  customer_id?: string;
  dispatched_by: string;
  status: FMSDispatchStatus;
  confirmed_at?: string | null;
  confirmed_by?: string | null;
  created_at: string;
  /** Truck registration number (e.g. ABC-123) */
  truck_plate?: string;
  /** Name of the driver assigned to this dispatch */
  driver_name?: string;
  /** Date and time when the truck departed */
  departed_at?: string | null;
  items?: FMSDispatchItem[];
  /** Every invoice grouped into this dispatch (one delivery). */
  invoices?: FMSDispatchInvoice[];
  /** What the customer invoiced, per product line. */
  requirements?: FMSDispatchRequirement[];
}

export interface FMSDispatchItem {
  id: string;
  dispatch_id: string;
  batch_id: string;
  /** Quantity actually shipped; written when the dispatch is confirmed. */
  quantity: number;
  quantity_required: number;
  quantity_scanned: number;
  scanned_by?: string | null;
  scanned_at?: string | null;
  created_at: string;
}

/** An invoice document uploaded against a dispatch. */
export interface FMSDispatchInvoice {
  id: string;
  dispatch_id: string;
  invoice_number: string;
  customer_name?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  created_at: string;
}

/**
 * One product line read off an uploaded invoice. This is the item a packer's
 * scan is verified against: `quantity_scanned` may never exceed
 * `quantity_required`.
 */
export interface FMSDispatchRequirement {
  id: string;
  dispatch_id: string;
  stock_code_id: string;
  stock_code: string;
  description?: string | null;
  uom?: string | null;
  invoice_number?: string | null;
  quantity_required: number;
  quantity_scanned: number;
  scanned_by?: string | null;
  scanned_at?: string | null;
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

// Record of a stock order emailed to a supplier (for Pending Delivery view)
export interface FMSSupplierOrderEmail {
  id: string;
  supplier_id: string;
  stock_code_id: string;
  quantity: number;
  notes?: string | null;
  status: 'pending' | 'received' | 'cancelled';
  emailed_at: string;
  emailed_by?: string | null;
  received_at?: string | null;
  created_at: string;
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
  supplierOrderEmails: FMSSupplierOrderEmail[] | null;
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
  supplierOrderEmails: null,
  fetchedAt: null,
  userId: null,
};

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// How often a cache-HIT mount may re-fetch supplier order emails. Every mount
// of any page calls fetchData(), so without this throttle each navigation
// fired an extra round trip against fms_supplier_order_emails.
const EMAILS_REFRESH_TTL = 30 * 1000;
let emailsFetchedAt = 0;

// The fetch currently in progress, if any. `useFMSData` is a plain hook rather
// than a context, so EVERY component that calls it mounts its own copy and
// fires its own fetchData() — and the Dashboard re-fires a forced fetch on a
// 60s timer. On a slow connection one fetch can outlive that interval, so
// without this the requests stack up and saturate the network. Sharing one
// in-flight promise turns N concurrent callers into a single fetch.
let inFlightFetch: Promise<void> | null = null;

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
  const [supplierOrderEmails, setSupplierOrderEmails] = useState<FMSSupplierOrderEmail[]>([]);
  const [loading, setLoading] = useState(true);
  // Cleared when the SECONDARY wave (dispatch, movements, reservations,
  // supplier order emails, stock orders) lands. Pages that render those
  // tables gate on `loading || secondaryLoading`; core-only pages gate on
  // `loading` and unblock as soon as wave 1 (stock codes, suppliers,
  // receiving, BOMs, batches, stock levels) finishes.
  const [secondaryLoading, setSecondaryLoading] = useState(true);



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
          const { data, error} = await (supabase.from(table) as any)
          .insert(options.data)
          .select()
          .single();

          if (error) return { data: null, error: error.message };
          return { data: data as T, error: null };
        }
        if (options.operation === 'update') {
          if (!options.id) return { data: null, error: 'ID required for update' };
         const { data, error} = await (supabase.from (table) as any)
         .update(options.data)
         .eq('id', options.id)
         .select()
         .single()
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
    // No authenticated user means there is nothing to fetch. We MUST still
    // clear `loading` here: it initialises to true, so returning early without
    // it left every page gated on `loading` spinning forever (most visibly
    // after sign-out, and on first render before the session resolves).
    if (!user) {
      setLoading(false);
      setSecondaryLoading(false);
      return;
    }

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
      if (dataCache.supplierOrderEmails) setSupplierOrderEmails(dataCache.supplierOrderEmails);
      setLoading(false);
      setSecondaryLoading(false);

      // Refresh supplier order emails in the background so the Pending
      // Delivery tab stays up to date after emails are sent. Throttled to
      // EMAILS_REFRESH_TTL: this branch runs on EVERY cache-hit mount, so
      // without the throttle every navigation fired an extra round trip.
      // Guarded: this runs outside the main try/finally below, so a
      // network throw here would otherwise reject out of fetchData.
      if (Date.now() - emailsFetchedAt >= EMAILS_REFRESH_TTL) {
        emailsFetchedAt = Date.now();
        try {
          const { data: emailsData, error: emailsError } = await supabase
            .from('fms_supplier_order_emails')
            .select('*')
            .order('emailed_at', { ascending: false });
          if (emailsError) {
            console.error('[FMS] supplier_order_emails fetch error:', emailsError);
          } else if (emailsData) {
            setSupplierOrderEmails(emailsData as FMSSupplierOrderEmail[]);
          }
        } catch (emailsErr) {
          console.error('[FMS] supplier_order_emails fetch failed:', emailsErr);
        }
      }

      return;
    }

    // Another component (or the Dashboard's 60s forced refresh) is already
    // fetching. Join it rather than stack a duplicate request, then pick the
    // shared result up through the normal cache path above.
    if (inFlightFetch) {
      await inFlightFetch;
      if (dataCache.fetchedAt !== null && dataCache.userId === user.id) {
        return fetchData(false);
      }
      // Shared fetch failed (or belonged to another user) — do not leave this
      // instance stuck on a spinner.
      setLoading(false);
      setSecondaryLoading(false);
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

    setLoading(true);

    // Publish this fetch so concurrent callers (another mounted component, or
    // the Dashboard's 60s forced refresh) can join it instead of starting
    // their own identical request. Assigned synchronously, before the first
    // await, so no caller can slip past this check.
    let signalFetchDone!: () => void;
    inFlightFetch = new Promise<void>((resolve) => {
      signalFetchDone = resolve;
    });

    try {
      // BOM <-> finished-good links (one BOM version -> many FGs).
      //
      // This used to issue its OWN query against fms_bom (selecting id and
      // finished_good_id) purely to build this map. The main BOM fetch in the
      // Promise.all below already returns those same rows and columns, so the
      // extra request bought nothing except another serial round trip on every
      // cold load. The map is now built from `bomsRes` once it arrives.
      let linksByBom = new Map<string, string[]>();
      const withJoinLinks = (bom: any): FMSBOM => {
        const ids = linksByBom.get(bom.id);
        return {
          ...bom,
          parent_finished_good_ids: ids && ids.length > 0 ? ids : undefined,
          components: bom.fms_bom_components || bom.components || [],
        } as FMSBOM;
      };
      const buildJoinLinks = (
        rows: Array<{ id?: string | null; finished_good_id?: string | null }>,
      ): Map<string, string[]> => {
        const map = new Map<string, string[]>();
        for (const row of rows || []) {
          if (!row?.id || !row?.finished_good_id) continue;
          const list = map.get(row.id) || [];
          if (!list.includes(row.finished_good_id)) list.push(row.finished_good_id);
          map.set(row.id, list);
        }
        return map;
      };

      // Two waves, not one. Pages that only need core tables (stock codes,
      // suppliers, receiving, BOMs, batches, stock levels) gate on `loading`,
      // which is cleared after wave 1 below; pages that render dispatch,
      // movements, reservations, emails or orders gate on
      // `loading || secondaryLoading` and wait for wave 2 as well.
      const [stockCodesRes, suppliersRes, receivingRes, bomsRes, batchesRes, stockLevelsRes] = await Promise.all([

        dbOrLocal<FMSStockCode>(
          () => fetchAllStockCodes().then((data) => ({ data, error: null })),
          () => []
        ),
        dbOrLocal<FMSSupplier>(
          () => supabase.from('fms_suppliers').select('*').order('name').then((res: any) => ({ data: res.data, error: res.error })),
          () => []
        ),
        dbOrLocal<FMSReceiving>(
          // Paginated like stock codes and batches: a single page silently
          // caps at 1000 rows, and received_at DESC means the OLDEST
          // receivings would be the ones dropped - understating any
          // receiving-window total (e.g. the Stock Recon report).
          async () => {
            const pageSize = 1000;
            let from = 0;
            const all: FMSReceiving[] = [];

            while (true) {
              const { data, error } = await supabase
                .from('fms_receiving')
                .select('*')
                .order('received_at', { ascending: false })
                .range(from, from + pageSize - 1);

              if (error) throw error;

              const page = (data || []) as FMSReceiving[];
              all.push(...page);

              if (page.length < pageSize) break;

              from += pageSize;
            }

            return {
              data: all,
              error: null,
            };
          },
          () => []
        ),
        dbOrLocal<any>(
          () => supabase.from('fms_bom').select('*, fms_bom_components(*)').order('created_at', { ascending: false }).then((res: any) => ({ data: res.data, error: res.error })),
          () => []
        ),

        dbOrLocal<FMSProductionBatch>(
          async () => {
            const pageSize = 1000;
            let from = 0;
            const all: FMSProductionBatch[] = [];

            while (true) {
              const { data, error } = await supabase
                .from('fms_production_batches')
                .select('*')
                .order('created_at', { ascending: false })
                .range(from, from + pageSize - 1);

              if (error) throw error;

              const page = (data || []) as FMSProductionBatch[];
              all.push(...page);

              if (page.length < pageSize) break;

              from += pageSize;
            }  

            return {
              data: all,
              error: null,
            };
          },
          () => []
        ),

        dbOrLocal<FMSStockLevel>(
          () => (supabase.from('fms_stock_levels' as any) as any).select('*').then((res: any) => ({ data: res.data, error: res.error })),
          () => []
        ),
      ]);

      setStockCodes(stockCodesRes);
      // Build the BOM link map from the SAME rows the main BOM fetch already
      // returned — the old dedicated `linksRes` query was a duplicate request.
      // Must happen before anything maps through withJoinLinks below.
      linksByBom = buildJoinLinks(bomsRes);
      setSuppliers(suppliersRes);
      if (receivingRes) setReceivingRecords(receivingRes);
      if (bomsRes) {
        setBoms(bomsRes.map((bom: any) => withJoinLinks(bom)));
      }
      setProductionBatches(batchesRes);
      if (stockLevelsRes) setStockLevels(stockLevelsRes);
      // Wave 1 done: unblock every page that gates on core data only.
      setLoading(false);

      // Wave 2: extended tables. Pages that render these gate on
      // `loading || secondaryLoading`; everyone else is already interactive.
      const [dispatchRes, stockMovementsRes, stockReservationsRes, supplierOrderEmailsRes, stockOrdersRes] = await Promise.all([
        dbOrLocal<any>(
          // The invoice/requirement child tables are fetched SEPARATELY from
          // the dispatch header. Joining them here would mean that if those
          // tables do not exist yet (migration not applied) the WHOLE dispatch
          // list silently disappears. Fetching them separately degrades to an
          // empty picking list instead of taking the page down.
          async () => {
            const base = await supabase
              .from('fms_dispatch')
              .select('*, fms_dispatch_items(*)')
              .order('dispatch_date', { ascending: false });

            if (base.error || !base.data) {
              return { data: base.data, error: base.error };
            }

            const ids = base.data.map((d: any) => d.id);
            let invoices: any[] = [];
            let requirements: any[] = [];

            if (ids.length > 0) {
              const [invRes, reqRes] = await Promise.all([
                (supabase.from('fms_dispatch_invoices' as any) as any).select('*').in('dispatch_id', ids),
                (supabase.from('fms_dispatch_requirements' as any) as any).select('*').in('dispatch_id', ids),
              ]);

              if (invRes.error) {
                console.warn(
                  '[FMS] fms_dispatch_invoices unavailable - has the dispatch migration been applied?',
                  invRes.error,
                );
              } else {
                invoices = invRes.data ?? [];
              }

              if (reqRes.error) {
                console.warn(
                  '[FMS] fms_dispatch_requirements unavailable - has the dispatch migration been applied?',
                  reqRes.error,
                );
              } else {
                requirements = reqRes.data ?? [];
              }
            }

            const enriched = base.data.map((d: any) => ({
              ...d,
              fms_dispatch_invoices: invoices.filter((i) => i.dispatch_id === d.id),
              fms_dispatch_requirements: requirements.filter((r) => r.dispatch_id === d.id),
            }));

            return { data: enriched, error: null };
          },
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
        dbOrLocal<FMSSupplierOrderEmail>(
          () => supabase
            .from('fms_supplier_order_emails')
            .select('*')
            .order('emailed_at', { ascending: false })
            .then((res: any) => ({ data: res.data, error: res.error })),
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

      if (dispatchRes) {
        const dispatchWithItems = dispatchRes.map(withDispatchRelations);
        setDispatchRecords(dispatchWithItems as FMSDispatch[]);
      }
      if (stockMovementsRes) setStockMovements(stockMovementsRes);
      if (stockReservationsRes) setStockReservations(stockReservationsRes);
      if (supplierOrderEmailsRes) setSupplierOrderEmails(supplierOrderEmailsRes as FMSSupplierOrderEmail[]);
      if (stockOrdersRes) {
        setStockOrders(stockOrdersRes.map((o: any) => ({
          ...o,
          items: o.fms_stock_order_items || [],
        })) as FMSStockOrder[]);
      }

      // Store in cache
      dataCache.suppliers = suppliersRes;
      dataCache.stockCodes = stockCodesRes;
      dataCache.receivingRecords = receivingRes;
      if (bomsRes) {
        dataCache.boms = bomsRes.map((bom: any) => withJoinLinks(bom));
      }
       
      dataCache.productionBatches = batchesRes;
      dataCache.dispatchRecords = dispatchRes.map(withDispatchRelations);
      dataCache.stockLevels = stockLevelsRes;
      dataCache.stockMovements = stockMovementsRes;
      dataCache.stockReservations = stockReservationsRes;
      dataCache.supplierOrderEmails = supplierOrderEmailsRes ?? [];
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
      setSecondaryLoading(false);
      // Clear BEFORE resolving: joiners re-enter fetchData() immediately and
      // must not see a stale in-flight promise.
      inFlightFetch = null;
      signalFetchDone();
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

const loadSupplierOrderEmails = async () => {
  try {
    const { data, error } = await supabase
      .from('fms_supplier_order_emails')
      .select('*')
      .order('emailed_at', { ascending: false });

    if (error) {
      console.error('[FMS] supplier_order_emails fetch error:', error);
      return [];
    }

    const rows = (data || []) as FMSSupplierOrderEmail[];
    setSupplierOrderEmails(rows);
    return rows;
  } catch (err) {
    console.error('[FMS] supplier_order_emails fetch failed:', err);
    return [];
  }
};
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

  // BOM <-> finished-good links (join table fms_bom_finished_goods).
  // Replaces the whole link set for one BOM version, then keeps the legacy
  // single column in sync (first link, or NULL when unlinked) so older code
  // paths keep working. No new BOM version is created.
  const setBomFinishedGoods = async (bomId: string, finishedGoodIds: string[]): Promise<boolean> => {
    const unique = Array.from(new Set((finishedGoodIds || []).filter(Boolean)));
    try {
      const del = await (supabase.from('fms_bom_finished_goods' as any) as any)
        .delete()
        .eq('bom_id', bomId);
      if (del?.error) throw del.error;
      if (unique.length > 0) {
        const ins = await (supabase.from('fms_bom_finished_goods' as any) as any)
          .insert(unique.map((fgId) => ({ bom_id: bomId, finished_good_id: fgId })));
        if (ins?.error) throw ins.error;
      }
      const legacy = unique.length > 0 ? unique[0] : null;
      const upd = await (supabase.from('fms_bom') as any)
        .update({ parent_finished_good_id: legacy })
        .eq('id', bomId);
      if (upd?.error) throw upd.error;
      setBoms((prev) => prev.map((b) =>
        b.id === bomId
          ? { ...b, parent_finished_good_id: legacy, parent_finished_good_ids: unique }
          : b
      ));
      return true;
    } catch (err: any) {
      const msg = err?.message || 'Unknown database error';
      const code = err?.code ? ` (code ${err.code})` : '';
      const hint = /relation.*does not exist|table.*does not exist|PGRST205|42P01/i.test(msg)
        ? ' — the fms_bom_finished_goods table is missing. Apply supabase/migrations/20260921000000_bom_parent_finished_good.sql first.'
        : '';
      console.error('[FMS] setBomFinishedGoods error:', err);
      toast.error(`Failed to save finished-product links: ${msg}${code}${hint}`);
      return false;
    }
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
  const addDispatchRecord = async (dispatch: Omit<FMSDispatch, 'id' | 'created_at' | 'items' | 'invoices' | 'requirements'>, items: Omit<FMSDispatchItem, 'id' | 'dispatch_id' | 'created_at'>[]) => {
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

  /**
   * Create a dispatch from one or more uploaded customer invoices.
   *
   * This is the entry point for the invoice-upload flow: the lady groups the
   * invoices that belong to one delivery, the parsed invoice lines become the
   * picking requirements, and the dispatch starts in 'picking' so packers can
   * scan against it.
   *
   * Rolls back cleanly: if the requirement insert fails the dispatch header is
   * removed again, so a half-created dispatch is never left behind.
   */
  const createDispatchFromInvoices = async (params: {
    invoiceNumbers: string[];
    customerName: string;
    /** Uploaded document, stored in the existing 'order-documents' bucket. */
    file?: File | null;
    requirements: Array<{
      stock_code_id: string;
      stock_code: string;
      description?: string | null;
      uom?: string | null;
      invoice_number?: string | null;
      quantity_required: number;
    }>;
    dispatchedBy: string;
  }): Promise<FMSDispatch | null> => {
    const { invoiceNumbers, customerName, file, requirements, dispatchedBy } = params;

    if (invoiceNumbers.length === 0) {
      toast.error('Add at least one invoice number');
      return null;
    }
    if (requirements.length === 0) {
      toast.error('The invoice has no product lines that match your stock codes');
      return null;
    }

    // Store the invoice document first so a storage failure is reported before
    // any rows are written.
    let filePath: string | null = null;
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      filePath = `dispatch/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('order-documents')
        .upload(filePath, file, { contentType: file.type || 'application/octet-stream' });
      if (uploadError) {
        console.error('[FMS] Dispatch invoice upload error:', uploadError);
        toast.warning(`Invoice file could not be uploaded (${uploadError.message}). The dispatch will be created without the file.`);
        filePath = null;
      }
    }

    const { data: dispatchData, error: dispatchError } = await (supabase as any)
      .from('fms_dispatch')
      .insert({
        // The first invoice stays on the header so the existing list column,
        // search and QR labels keep working unchanged.
        invoice_number: invoiceNumbers[0],
        dispatch_date: new Date().toISOString(),
        customer_name: customerName,
        dispatched_by: dispatchedBy,
        status: 'picking',
      })
      .select()
      .single();

    if (dispatchError || !dispatchData) {
      console.error('[FMS] Create dispatch from invoice error:', dispatchError);

      // PGRST204 / 42P01 mean the database is missing the dispatch migration.
      // That is a deployment problem, not a user error, so say exactly what to
      // run instead of surfacing a raw PostgREST message.
      const raw = String(dispatchError?.message ?? dispatchError ?? '');
      if (/PGRST204|42P01|status.*column|schema cache/i.test(raw)) {
        toast.error(
          'Dispatch tables are not up to date. Apply the migration 20260922000000_dispatch_invoice_workflow.sql in the Supabase SQL Editor, then reload.',
          { duration: 12000 },
        );
      } else {
        toast.error(raw || 'Failed to create dispatch');
      }
      return null;
    }

    const dispatchId = dispatchData.id;

     const { error: invoiceError } = await (supabase as any)
       .from('fms_dispatch_invoices')
       .insert(
         invoiceNumbers.map((number) => ({
           dispatch_id: dispatchId,
           invoice_number: number,
           customer_name: customerName || null,
           file_path: filePath,
           file_name: file?.name || null,
         })),
       );
     if (invoiceError) {
       console.error('[FMS] Attach dispatch invoices error:', invoiceError);
      }

    const { error: reqError } = await (supabase as any)
      .from('fms_dispatch_requirements')
      .insert(
        requirements.map((req) => ({
          dispatch_id: dispatchId,
          stock_code_id: req.stock_code_id,
          stock_code: req.stock_code,
          description: req.description ?? null,
          uom: req.uom ?? null,
          invoice_number: req.invoice_number ?? invoiceNumbers[0],
          quantity_required: req.quantity_required,
          quantity_scanned: 0,
        })),
      );

    if (reqError) {
      console.error('[FMS] Create dispatch requirements error:', reqError);
      toast.error(reqError.message || 'Failed to save the invoice lines');
      // Roll the half-made dispatch back so it cannot linger without requirements.
      await (supabase as any).from('fms_dispatch').delete().eq('id', dispatchId);
      await fetchData();
      return null;
    }

    await fetchData();
    return dispatchData as FMSDispatch;
  };

  /**
   * Record one verified packer scan against a requirement line.
   *
   * The over-scan guard is applied HERE (so the operator gets a useful message)
   * and again by the `trg_fms_guard_requirement_scan` trigger in the database
   * (so two packers scanning simultaneously cannot over-fulfil a line).
   */
 


 const recordDispatchScan = async (
  requirement: FMSDispatchRequirement,
  scannedBy: string,
  batchId?: string,
 ): Promise<{ ok: boolean; quantity_scanned?: number; reason?: string}> => {
  const { data, error } = await (supabase as any).rpc(
    'fms_record_dispatch_scan',
    {
      p_requirement_id: requirement.id,
      p_batch_id: batchId ?? null,
    }
  );
  if (error) {
    console.error('[FMS] Record dispatch scan error:', error);
    return {
      ok: false,
      reason: error.message || 'Could not save the scan',
    };
 };
 if (!data?.ok) {
  return {
    ok: false,
    reason: data?.reason || 'Could not save the scan,'
  };
 };
 await fetchData();

 return {
  ok: true,
  quantity_scanned:data.quantity_scanned
 };
};
  

  /* Undo a single scan (picker picked the wrong item to scan). */
const undoDispatchScan = async (
  requirement: FMSDispatchRequirement,
): Promise<boolean> => {
  const { data, error } = await (supabase as any).rpc(
    'fms_undo_dispatch_scan',
    {
      p_requirement_id: requirement.id,
    },
  );

  if (error) {
    console.error('[FMS] Undo dispatch scan error:', error);
    toast.error(error.message || 'Could not undo the scan');
    return false;
  }

  if (!data?.ok) {
    toast.error(data?.reason || 'Could not undo the scan');
    return false;
  }

  await fetchData();
  toast.info('One scan removed');
  return true;
};


  /**
   * Explicitly confirm a dispatch. This is the ONLY operation that moves a
   * dispatch to 'dispatched' - scanning never does.
   *
   * The shipped quantity written onto each batch pick is the quantity actually
   * scanned, so Traceability reflects what physically left the building.
   */

   
const confirmDispatch = async (
  dispatchId: string,
  confirmedBy: string,
): Promise<boolean> => {
  try {
    // Check for incomplete lines before calling the database.
    const { data: reqs, error: reqError } = await (supabase as any)
      .from('fms_dispatch_requirements')
      .select('quantity_required, quantity_scanned')
      .eq('dispatch_id', dispatchId);

    if (reqError) {
      console.error('[FMS] Load dispatch requirements error:', reqError);
      toast.error('Could not verify dispatch quantities.');
      return false;
    }

    const outstanding = (reqs || []).filter(
      (r: any) => (r.quantity_scanned ?? 0) < (r.quantity_required ?? 0),
    );

    if (outstanding.length > 0) {
      toast.error(
        `${outstanding.length} line(s) are still short. Scan everything on the invoice before confirming.`,
      );
      return false;
    }

    // Stock deduction and dispatch confirmation happen together in Supabase.
    const { error: confirmError } = await (supabase as any).rpc(
      'fms_confirm_dispatch_and_deduct',
      { p_dispatch_id: dispatchId },
    );

    if (confirmError) {
      console.error('[FMS] Confirm dispatch error:', confirmError);
      toast.error(confirmError.message || 'Failed to confirm dispatch.');
      return false;
    }
    await fetchData();
    toast.success('Dispatch confirmed and stock updated.');
    return true;
  } catch (error: any) {
    console.error('[FMS] Confirm dispatch error:', error);
    toast.error(error?.message || 'Failed to confirm dispatch.');
    return false;
  }
};

/** Mark a dispatch truck as departed with driver name and timestamp. */
  const markTruckDeparted = async (dispatchId: string, driverName: string): Promise<boolean> => {
    try {
      const { error } = await (supabase as any)
        .from('fms_dispatch')
        .update({ 
          status: 'departed' as FMSDispatchStatus,
          driver_name: driverName,
          departed_at: new Date().toISOString()
        })
        .eq('id', dispatchId);

      if (error) {
        console.error('[FMS] Mark truck departed error:', error);
        toast.error(error.message || 'Failed to mark truck as departed.');
        return false;
      }

      await fetchData();
      toast.success('Truck marked as departed.');
      return true;
    } catch (error: any) {
      console.error('[FMS] Mark truck departed error:', error);
      toast.error(error?.message || 'Failed to mark truck as departed.');
      return false;
    }
  };

  /** Move a dispatch back into picking so corrections can be scanned. */
  const reopenDispatch = async (dispatchId: string): Promise<boolean> => {
    const { error } = await (supabase as any)
      .from('fms_dispatch')
      .update({ status: 'picking' })
      .eq('id', dispatchId);
    if (error) {
      toast.error(error.message || 'Failed to reopen the dispatch');
      return false;
    }
    await fetchData();
    return true;
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

  // Record stock order emails sent to suppliers (Pending Delivery tracking)
  const addSupplierOrderEmails = async (
    entries: { supplier_id: string; stock_code_id: string; quantity: number; notes?: string | null }[]
  ) => {
    if (entries.length === 0) return [];
    try {
      const { data, error } = await (supabase.from('fms_supplier_order_emails' as any) as any)
        .insert(entries.map(e => ({
          supplier_id: e.supplier_id,
          stock_code_id: e.stock_code_id,
          quantity: e.quantity,
          notes: e.notes || null,
          status: 'pending',
          emailed_by: user?.id || null,
        })))
        .select();

      if (error) {
        console.error('[FMS] Record supplier order email error:', error);
        return [];
      }

      const rows = (data || []) as FMSSupplierOrderEmail[];
      if (rows.length > 0) {
        setSupplierOrderEmails(prev => [...rows, ...prev]);
      }
      return rows;
    } catch (err) {
      console.error('[FMS] Record supplier order email unexpected error:', err);
      return [];
    }
  };

  const updateSupplierOrderEmailStatus = async (
    id: string,
    status: 'received' | 'cancelled'
  ) => {
    const patch: any = { status };
    if (status === 'received') patch.received_at = new Date().toISOString();

    const { data, error } = await (supabase.from('fms_supplier_order_emails' as any) as any)
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[FMS] Update supplier order email error:', error);
      toast.error(error.message || 'Failed to update');
      return null;
    }

    if (data) {
      setSupplierOrderEmails(prev => prev.map(e => (e.id === id ? data : e)));
    }
    return data as FMSSupplierOrderEmail;
  };

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
      .insert({
        ...order,
        created_by: user?.id || null,
        status: 'PENDING_RECEIPT',
      })
      .select('id')
      .single();

    if (headerError) throw headerError;

    const { error: itemsError } = await (supabase
      .from('fms_stock_order_items' as any) as any)
      .insert(items.map(it => ({ ...it, order_id: header.id })));

    if (itemsError) {
      // Roll back orphan header
      await (supabase.from('fms_stock_orders' as any) as any)
        .delete()
        .eq('id', header.id);
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
    supplierOrderEmails,
    stockOrders,
    loading,
    secondaryLoading,
    
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
    setBomFinishedGoods,
    addProductionBatch,
    updateProductionBatch,
    addDispatchRecord,
    createDispatchFromInvoices,
    recordDispatchScan,
    undoDispatchScan,
    confirmDispatch,
    reopenDispatch,
    deductStockForBatch,
    addStockForReceipt,
    fifoAllocateLots,
    recordLotUsage,
    reserveStockForBatch,
    releaseBatchReservations,
    consumeBatchReservations,
    getReservationsForBatch,
    addSupplierOrderEmails,
    updateSupplierOrderEmailStatus,

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

/**
 * Flatten the joined child rows that Supabase returns under their table names
 * onto the dispatch record, so callers use `record.items` / `record.requirements`
 * exactly as they did before the join was widened.
 *
 * Also back-fills the scanned counters for dispatches created before those
 * columns existed, so a legacy row can never read as "over-scanned".
 */
const withDispatchRelations = (dispatch: any) => {
  const items: any[] = (dispatch.fms_dispatch_items || []).map((item: any) => ({
    ...item,
    quantity_required: item.quantity_required ?? 0,
    quantity_scanned: item.quantity_scanned ?? 0,
  }));

  const requirements: any[] = (dispatch.fms_dispatch_requirements || []).map((req: any) => ({
    ...req,
    quantity_scanned: req.quantity_scanned ?? 0,
  }));

  return {
    ...dispatch,
    status: (dispatch.status || 'dispatched') as FMSDispatchStatus,
    items,
    invoices: dispatch.fms_dispatch_invoices || [],
    requirements,
  };
};

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
