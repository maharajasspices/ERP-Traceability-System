import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { formatDateTime, useFMSData } from '@/hooks/useFMSData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Play, CheckCircle, Timer, Loader2, QrCode, Printer, Download } from 'lucide-react';
import { generateQRCodeImage } from '@/lib/qrCodeUtils';


/* --------------------------------------------------------------------------
 * Pickle Batch Workflow
 *
 * The existing Batch Sheet stays the single place where production batches are
 * created and started. For the pickle finished goods it also renders the
 * multi-day stage workflow (brines, soaking, WIP stages) underneath the batch
 * header once the batch has been started.
 *
 * Nothing here is hard-coded to APIC002 or to a fixed list of stages: the stage
 * tree is generated from the finished product's active BOM dependency tree.
 * ------------------------------------------------------------------------ */

export interface PickleRun {
  id: string;
  run_number: string;
  batch_id?: string | null;
  finished_good_id: string;
  planned_total_qty: number;
  unit_of_measure: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  notes?: string | null;
  created_by?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface PickleStage {
  id: string;
  run_id: string;
  stock_code_id: string;
  parent_stage_id?: string | null;
  stage_order: number;
  is_root: boolean;
  required_qty: number;
  unit_of_measure: string;
  status: 'NOT_STARTED' | 'READY' | 'IN_PROGRESS' | 'SOAKING' | 'READY_FOR_NEXT_STAGE' | 'COMPLETED' | 'CANCELLED';
  is_soaking: boolean;
  process_instructions?: string | null;
  soaking_start_at?: string | null;
  min_ready_date?: string | null;
  max_ready_date?: string | null;
  min_ready_at?: string | null;
  max_ready_at?: string | null;
  actual_ready_date?: string | null;
  elapsed_days?: number | null;
  container_id?: string | null;
  output_lot_id?: string | null;
  completed_quantity?: number | null;
  operator_id?: string | null;
  verified: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface PickleIngredient {
  id: string;
  stage_id: string;
  material_stock_code_id: string;
  source_type: 'receiving' | 'wip_stage';
  source_stage_id?: string | null;
  receiving_record_id?: string | null;
  internal_lot_number?: string | null;
  required_qty: number;
  measured_qty?: number | null;
  unit_of_measure: string;
  variance?: number | null;
  status: 'PENDING' | 'WEIGHED' | 'COMPLETED';
  operator_id?: string | null;
  measured_at?: string | null;
  created_at: string;
}

interface FMSOperator { id: string; user_id: string; name: string; role: string; is_active: boolean; }


export const PICKLE_PRODUCT_NAMES = [
  'Carrot & Onion',
  'Mild Vegetable',
  'Hot Vegetable',
  'Extra Hot Vegetable',
  'Lime & Lemon',
  'Curried Chillies',
  'Crushed Chillies',
];

const normalizeName = (value?: string | null): string =>
  (value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** True when the stock code is one of the pickle finished products. */
export const isPickleProduct = (
  stockCode?: { stock_code?: string | null; description?: string | null } | null,
): boolean => {
  if (!stockCode) return false;
  const haystacks = [normalizeName(stockCode.description), normalizeName(stockCode.stock_code)];
  return PICKLE_PRODUCT_NAMES.some((name) => {
    const needle = normalizeName(name);
    if (!needle) return false;
    return haystacks.some((h) => h === needle || h.includes(needle));
  });
};

/** True when a production batch is for one of the pickle finished products. */
export const isPickleBatch = (
  batch: { finished_good_id?: string | null } | null | undefined,
  getStockCodeById: (id: string) => any,
): boolean => {
  if (!batch?.finished_good_id) return false;
  return isPickleProduct(getStockCodeById(batch.finished_good_id));
};

const STAGE_LABEL: Record<PickleStage['status'], string> = {
  NOT_STARTED: 'Not started',
  READY: 'Ready',
  IN_PROGRESS: 'In progress',
  SOAKING: 'Soaking',
  READY_FOR_NEXT_STAGE: 'Ready for next stage',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STAGE_BADGE: Record<PickleStage['status'], string> = {
  NOT_STARTED: 'badge-inactive',
  READY: 'badge-inactive',
  IN_PROGRESS: 'badge-active',
  SOAKING: 'badge-active',
  READY_FOR_NEXT_STAGE: 'badge-active',
  COMPLETED: 'badge-active',
  CANCELLED: 'badge-inactive',
};

const fmtNum = (n: number | null | undefined, digits = 2): string =>
  n == null || isNaN(Number(n)) ? '—' : Number(n).toFixed(digits).replace(/\.?0+$/, '');

const daysBetween = (a: string, b: string): number => {
  const da = new Date(a); da.setHours(0, 0, 0, 0);
  const db = new Date(b); db.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((db.getTime() - da.getTime()) / 86400000) + 1);
};


export interface PlanIngredient {
  materialId: string;
  qty: number;
  uom: string;
  isWip: boolean;
}

export interface PlanStage {
  stockCodeId: string;
  parentKey: string | null;
  depth: number;
  totalQty: number;
  ingredients: PlanIngredient[];
  instructions: string | null;
  unit: string;
}

export function buildPickleBatchPlan(
  stockCodes: any[],
  boms: any[],
  finishedGoodId: string,
  plannedQty: number
): PlanStage[] {
  const getStockCode = (id: string) => stockCodes.find((sc) => sc.id === id);
  const code = (id: string) => getStockCode(id)?.stock_code || id;
  // Trace/log helper for diagnosing stage-tree scope decisions. Uses
  // console.log (NOT console.debug) so the lines are visible by default in
  // devtools — filter the console for "[PickleBatchPlan]".
  const trace = (...args: any[]) => console.log('[PickleBatchPlan]', ...args);
  const compList = (bom: any) =>
    (bom.components || []).map((c: any) => `${code(c.material_stock_code_id)}:${c.quantity_per_batch}`).join(', ');
  trace(`root=${code(finishedGoodId)} qty=${plannedQty}`);

  // Scope rule: the fms_bom_finished_goods join table defines the pickle
  // production tree. A component is only expanded into its own production
  // stage when its active BOM is EXPLICITLY linked to the batch's finished
  // product (a join row for the root finished good — falling back to the
  // legacy parent_finished_good_id column). There is
  // deliberately NO fallback to an unrelated active BOM — a component that
  // merely happens to have some BOM (e.g. a bulk blend made for other
  // products) stays a required ingredient of its parent stage instead.
  //
  // Percentage normalisation: percentage BOMs have mixed storage conventions
  // in the wild (whole percentages like 40 vs fractions like 0.4 where the
  // create-form divides by 100 on save). pctOf() treats values > 1 as whole
  // percentages and values <= 1 as fractions, so WPIC004 = 40% of WPIC009's
  // 50 kg = 20 kg and WPIC001 = 60% of WPIC004's 20 kg = 12 kg either way.
  const pctOf = (v: number) => {
  const n = Number(v) || 0;
  return n / 100;
};


  const parentIdsOf = (b: any): string[] => {
    const fromJoin = Array.isArray((b as any)?.parent_finished_good_ids)
      ? (b as any).parent_finished_good_ids.filter(Boolean)
      : [];
    if (fromJoin.length > 0) return Array.from(new Set(fromJoin));
    return (b as any)?.parent_finished_good_id ? [(b as any).parent_finished_good_id] : [];
  };
  const parentLabels = (b: any) => {
    const ids = parentIdsOf(b);
    return ids.length > 0 ? ids.map((id: string) => code(id)).join('+') : 'null';
  };
  const isLive = (b: any) => (b.status ?? 'active') !== 'obsolete';
  const getExplicitBomFor = (productId: string) => {
    const active = boms
      .filter((b: any) => b.finished_good_id === productId && isLive(b))
      .sort((a: any, b: any) => (Number(b.version_number) || 0) - (Number(a.version_number) || 0));
    const linked = active.find((b: any) => parentIdsOf(b).includes(finishedGoodId)) || null;
    trace(
      `resolve ${code(productId)} (id ${productId}): ${active.length} active BOM(s) in memory`
      + (active.length > 0 ? ` [${active.map((b: any) => `v${b.version_number} id=${b.id} status=${b.status} parents=${parentLabels(b)} comps=[${compList(b)}]`).join(' | ')}]` : '')
    );
    if (active.length > 0 && !linked) {
      trace(`BOM scope for ${code(productId)}: NONE linked to ${code(finishedGoodId)} -> not expanded, stays an ingredient`);
    }
    return linked;
  };
  const getBomForProduct = (productId: string) => {
    // Root finished good: its own BOM is always the tree root (self-linked or
    // unlinked — the FG does not need a parent link to itself).
    if (productId === finishedGoodId) {
      const active = boms.filter((b: any) => b.finished_good_id === productId && b.status === 'active');
      const bom = getExplicitBomFor(productId) || active[0] || null;
      trace(`root BOM for ${code(productId)}: ${bom ? `v${bom.version_number} (id ${bom.id})` : 'NONE'}`);
      return bom;
    }
    const bom = getExplicitBomFor(productId);
    if (bom) {
      trace(`BOM for ${code(productId)}: v${bom.version_number} (id ${bom.id}), parents=${parentLabels(bom)}, components=[${compList(bom)}]`);
    }
    return bom;
  };
  const hasOwnBom = (id: string): boolean => {
    const bom = getBomForProduct(id) as any;
    const ok = !!bom && Array.isArray(bom.components) && bom.components.length > 0;
    if (!ok) trace(`hasOwnBom(${code(id)}) = false -> NOT expanded into its own stage`);
    return ok;
  };

  interface PlanNode {
    stockCodeId: string;
    parentKey: string | null;
    depth: number;
    /** Root-level inputs carry an explicit quantity; child WIPs are fed via their parents' percentages. */
    inputs: { fromKey: string | null; qty: number }[];
    comps: { materialId: string; value: number; frac: number; uom: string; isWip: boolean }[];
    instructions: string | null;
    unit: string;
  }
  const plan = new Map<string, PlanNode>();

  const build = (stockCodeId: string, fromKey: string | null, fromQty: number, depth: number): void => {
    let node = plan.get(stockCodeId);
    if (!node) {
      const stock = getStockCode(stockCodeId);
      const bomAny = getBomForProduct(stockCodeId) as any;
      const instructions = (bomAny && Array.isArray(bomAny.processing_steps) && bomAny.processing_steps.length > 0)
        ? bomAny.processing_steps.map((s: any) => `${s.step_name}${s.description ? ': ' + s.description : ''}`).join('\n')
        : null;
      node = {
        stockCodeId,
        parentKey: fromKey,
        depth,
        inputs: [],
        comps: [],
        instructions,
        unit: stock?.unit_of_measure || 'kg',
      };
      plan.set(stockCodeId, node);
      if (bomAny && Array.isArray(bomAny.components)) {
        for (const comp of bomAny.components) {
          const mat = getStockCode(comp.material_stock_code_id);
          // A component with its own active BOM is manufactured in-house and
          // becomes its own WIP stage — follow its BOM recursively.
          const isWip = !!mat && hasOwnBom(comp.material_stock_code_id);
          trace(
            `component ${code(comp.material_stock_code_id)} of ${code(stockCodeId)}:`
            + ` value=${comp.quantity_per_batch} (interpreted as ${isWip ? 'percentage of parent stage total' : 'percentage of parent stage total'})`
            + ` -> ${isWip ? 'own production stage' : 'required ingredient'}`
          );
         node.comps.push({
          materialId: comp.material_stock_code_id,
          value: Number(comp.quantity_per_batch) || 0,
          frac: pctOf(comp.quantity_per_batch),
          uom: mat?.unit_of_measure || 'kg',
          isWip,
        });
          if (isWip) build(comp.material_stock_code_id, stockCodeId, 0, depth + 1);
        }
      }
    } else if (node.parentKey === null && fromKey !== null) {
      node.parentKey = fromKey;
    }
    if (depth > node.depth) node.depth = depth;
    // One input edge per parent -> keeps shared WIPs deduplicated while
    // preserving every consumer's contribution.
    node.inputs.push({ fromKey, qty: fromQty });
  };

  build(finishedGoodId, null, plannedQty, 0);

  // Resolve each stage's total quantity with memoised recursion so quantities
  // flow parent -> child through the percentage relationships and are combined
  // across all parents of a shared WIP.
  const totalCache = new Map<string, number>();
  const totalOf = (id: string, stack: Set<string>): number => {
    const cached = totalCache.get(id);
    if (cached !== undefined) return cached;
    const node = plan.get(id);
    if (!node || stack.has(id)) return 0; // cycle guard
    stack.add(id);
    let total = node.inputs.reduce((sum, i) => sum + i.qty, 0);
    for (const parent of plan.values()) {
      for (const comp of parent.comps) {
        if (comp.isWip && comp.materialId === id && parent.stockCodeId !== id) {
          const parentTotal = totalOf(parent.stockCodeId, stack);
          const contrib = comp.frac * parentTotal;
          trace(`qty ${code(parent.stockCodeId)} -> ${code(id)}: frac ${comp.frac} (stored ${comp.value}) × parent ${parentTotal} = ${contrib}`);
          total += contrib;
        }
      }
    }
    stack.delete(id);
    totalCache.set(id, total);
    return total;
  };

  return Array.from(plan.values()).map((node) => {
    const totalQty = totalOf(node.stockCodeId, new Set());
    trace(`stage ${code(node.stockCodeId)} total = ${totalQty} (parent ${node.parentKey ? code(node.parentKey) : 'root'}), ingredient qty = frac × total`);
    const ingredients = node.comps.map((comp) => ({
      materialId: comp.materialId,
      qty: comp.frac * totalQty,
      uom: comp.uom,
      isWip: comp.isWip,
    }));
    trace(
      `plan ${code(node.stockCodeId)}: total ${totalQty} | ` +
      ingredients.map((ing) => `${code(ing.materialId)}=${ing.qty}${ing.isWip ? ' (WIP stage)' : ''}`).join(', ')
    );
    return {
      stockCodeId: node.stockCodeId,
      parentKey: node.parentKey,
      depth: node.depth,
      totalQty,
      ingredients,
      instructions: node.instructions,
      unit: node.unit,
    };
  });
}

/**
 * Flatten a percentage BOM tree into the deduplicated raw-material
 * requirements for one batch (WIP sub-assemblies are produced internally and
 * excluded). Used by the Batch Sheet for pre-weigh quantities, reservations
 * and stock checks.
 */
export function computeBatchMaterialRequirements(
  stockCodes: any[],
  boms: any[],
  finishedGoodId: string,
  plannedQty: number
): { stock_code_id: string; quantity: number }[] {
  const totals = new Map<string, number>();
  for (const stage of buildPickleBatchPlan(stockCodes, boms, finishedGoodId, plannedQty)) {
    for (const ing of stage.ingredients) {
      if (ing.isWip) continue;
      totals.set(ing.materialId, (totals.get(ing.materialId) || 0) + ing.qty);
    }
  }
  return Array.from(totals.entries()).map(([stock_code_id, quantity]) => ({ stock_code_id, quantity }));
}

/* --------------------------------------------------------------------------
 * Fresh BOM fetch for pickle planning.
 *
 * The shared FMS context caches BOMs for up to 5 minutes, so the `boms`
 * array on BatchSheet can predate a just-saved parent_finished_good_id link.
 * Planning (and the stored-run scope check) against stale BOMs is what drops
 * linked WIPs like WPIC004/WPIC001 out of the tree. This fetches the current
 * BOM headers + components straight from Supabase; callers fall back to the
 * passed-in `boms` if the fetch fails.
 * ------------------------------------------------------------------------ */
export async function fetchFreshBomsForPlan(): Promise<any[] | null> {
  try {
    const { data: bomsData, error } = await (
      supabase.from('fms_bom' as any) as any
    )
      .select('*, fms_bom_components(*)')
      .order('created_at', { ascending: false });

    if (error || !bomsData) return null;

    return (bomsData as any[]).map((bom: any) => {
      const parentIds: string[] = [];

      if (bom.finished_good_id) {
        parentIds.push(bom.finished_good_id);
      }

      if (
        bom.parent_finished_good_id &&
        !parentIds.includes(bom.parent_finished_good_id)
      ) {
        parentIds.push(bom.parent_finished_good_id);
      }

      return {
        ...bom,
        parent_finished_good_ids:
          parentIds.length > 0 ? parentIds : undefined,
        components: bom.fms_bom_components || [],
      };
    });
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------------------
 * Generate the pickle run + stage tree for a Batch Sheet batch.
 * Idempotent: an existing run for the batch is reused.
 * ------------------------------------------------------------------------ */
export interface EnsurePickleRunParams {
  batch: any;
  stockCodes: any[];
  boms: any[];
  userId?: string | null;
}

export async function ensurePickleRunForBatch({
  batch,
  stockCodes,
  boms,
  userId,
}: EnsurePickleRunParams): Promise<string | null> {
  if (!batch?.id) return null;

  const getStockCode = (id: string) => stockCodes.find((sc) => sc.id === id);
  // Always plan against fresh BOM headers/links — the shared FMS context can
  // hold BOMs cached from before a parent_finished_good_id link was saved,
  // which would silently drop linked WIPs (e.g. WPIC004/WPIC001) from the
  // tree. Fall back to the passed-in boms only if the fetch fails.
  const liveBoms = (await fetchFreshBomsForPlan()) ?? boms;
  const getActiveBom = (id: string) => liveBoms.find((b: any) => b.finished_good_id === id && b.status === 'active');

  try {
    // Regenerate: remove any previously generated run/stages/ingredients for
    // this batch so incorrectly generated stages are never reused.
    const { data: existingRows, error: existingErr } = await (supabase.from('fms_pickle_runs' as any) as any)
      .select('id')
      .eq('batch_id', batch.id);
    if (!existingErr && existingRows && existingRows.length > 0) {
      for (const old of existingRows as { id: string }[]) {
        const oldId = old.id;
        const { data: oldStages } = await (supabase.from('fms_pickle_stages' as any) as any)
          .select('id').eq('run_id', oldId);
        const oldIds = (oldStages || []).map((s: any) => s.id);
        if (oldIds.length > 0) {
          for (const sid of oldIds) {
            await (supabase.from('fms_pickle_stage_ingredients' as any) as any).delete().eq('stage_id', sid);
          }
          await (supabase.from('fms_pickle_stages' as any) as any).delete().eq('run_id', oldId);
        }
        await (supabase.from('fms_pickle_runs' as any) as any).delete().eq('id', oldId);
      }
    }

    const finishedGood = getStockCode(batch.finished_good_id);
    const plannedQty = Number(batch.planned_batch_size) || 0;

    if (!finishedGood || plannedQty <= 0) return null;
    if (!getActiveBom(batch.finished_good_id)) {
      toast.error(`${finishedGood.stock_code} has no active BOM — pickle stages could not be generated.`);
      return null;
    }

    const { data: runRow, error: runErr } = await (supabase.from('fms_pickle_runs' as any) as any)
      .insert({
        run_number: batch.batch_number,
        batch_id: batch.id,
        finished_good_id: batch.finished_good_id,
        planned_total_qty: plannedQty,
        unit_of_measure: finishedGood.unit_of_measure || 'kg',
        status: 'IN_PROGRESS',
        notes: `Generated from Batch Sheet ${batch.batch_number}`,
        created_by: userId || null,
        started_at: batch.production_start || new Date().toISOString(),
      })
      .select()
      .single();
    if (runErr || !runRow) throw new Error(runErr?.message || 'Failed to create pickle run');

    // Build the stage plan from the finished good's BOM dependency tree:
    // recursive parent -> child expansion, percentage quantities
    // (parentQty × value / 100) and shared WIPs deduplicated into one stage
    // with combined required quantities.
    const planStages = buildPickleBatchPlan(stockCodes, liveBoms, batch.finished_good_id, plannedQty);

    // Dependency order for the Batch Sheet: deepest WIP stages first and the
    // final product last (stage_order). Stages are inserted parents-first so
    // the parent_stage_id foreign keys resolve.
    const byDepthDesc = planStages.slice().sort((a, b) => b.depth - a.depth);
    const stageOrderByKey = new Map<string, number>();
    byDepthDesc.forEach((n, idx) => stageOrderByKey.set(n.stockCodeId, idx + 1));
    const byDepth = planStages.slice().sort((a, b) => a.depth - b.depth);

    /* -------------------------------------------------------------------
     * Phase 3 — robust two-pass stage creation.
     * Pass 1: insert ALL planned stages with parent_stage_id: null (no FK
     *         ordering problems, even for shared WIPs or diamond/cycle-ish
     *         dependency graphs).
     * Pass 2: once every stage row exists, update each stage's
     *         parent_stage_id to the real dependency parent.
     * Pass 3: only then insert the stage ingredient rows (so their
     *         source_stage_id references resolve too).
     * ----------------------------------------------------------------- */
    const stageIdByKey = new Map<string, string>();

    // Pass 1 — insert every planned stage with parent_stage_id: null
    for (const node of byDepth) {
      const { data: stageRow, error: stageErr } = await (supabase.from('fms_pickle_stages' as any) as any)
        .insert({
          run_id: runRow.id,
          stock_code_id: node.stockCodeId,
          parent_stage_id: null,
          stage_order: stageOrderByKey.get(node.stockCodeId) ?? 0,
          is_root: node.parentKey === null,
          required_qty: node.totalQty,
          unit_of_measure: node.unit,
          process_instructions: node.instructions,
          status: 'NOT_STARTED',
        })
        .select()
        .single();
      if (stageErr || !stageRow) throw new Error(stageErr?.message || 'Failed to create stage');
      stageIdByKey.set(node.stockCodeId, stageRow.id as string);
    }

    // Pass 2 — link each stage to its dependency parent (all rows now exist,
    // so the parent_stage_id foreign key always resolves)
    for (const node of byDepth) {
      const stageId = stageIdByKey.get(node.stockCodeId);
      if (!stageId) continue;
      const parentStageId = node.parentKey ? stageIdByKey.get(node.parentKey) || null : null;
      if (!parentStageId) continue; // root stage keeps parent_stage_id: null
      const { error: parentErr } = await (supabase.from('fms_pickle_stages' as any) as any)
        .update({ parent_stage_id: parentStageId })
        .eq('id', stageId);
      if (parentErr) throw new Error(parentErr.message || 'Failed to link pickle stage parent');
    }

    // Pass 3 — insert stage ingredients (source_stage_id references are safe now)
    for (const node of byDepth) {
      const stageId = stageIdByKey.get(node.stockCodeId);
      if (!stageId) continue;
      for (const comp of node.ingredients) {
        await (supabase.from('fms_pickle_stage_ingredients' as any) as any)
          .insert({
            stage_id: stageId,
            material_stock_code_id: comp.materialId,
            source_type: comp.isWip ? 'wip_stage' : 'receiving',
            source_stage_id: comp.isWip ? stageIdByKey.get(comp.materialId) || null : null,
            required_qty: comp.qty,
            unit_of_measure: comp.uom,
            status: 'PENDING',
          })
          .select()
          .single();
      }
    }

    toast.success(`Pickle workflow started for ${batch.batch_number}`);
    return runRow.id as string;
  } catch (err: any) {
    console.error('[Pickle] ensurePickleRunForBatch error', err);
    toast.error(err?.message || 'Failed to generate pickle stages');
    return null;
  }
}
/* --------------------------------------------------------------------------
 * PickleBatchWorkflow
 *
 * Rendered underneath the existing Batch Sheet header once a pickle batch has
 * been started. It shows the stages generated from the BOM dependency tree and
 * the detailed stage workflow (ingredients, weighing, lot selection, soaking /
 * container tracking, verification, completion).
 * ------------------------------------------------------------------------ */
export interface PickleBatchWorkflowProps {
  batch: any;
  stockCodes: any[];
  boms: any[];
  receivingRecords: any[];
  /** Refresh the parent Batch Sheet data after stock/lot changes. */
  onChanged?: () => void | Promise<void>;
}

export const PickleBatchWorkflow: React.FC<PickleBatchWorkflowProps> = ({
  batch,
  stockCodes,
  boms,
  receivingRecords,
  onChanged,
}) => {
  const { user, fmsUser } = useFMSAuth();
  const fmsUserName = fmsUser?.name || '';

  const [runId, setRunId] = useState<string | null>(null);
  const [stages, setStages] = useState<PickleStage[]>([]);
  const [ingredients, setIngredients] = useState<PickleIngredient[]>([]);
  const [materialsUsed, setMaterialsUsed] = useState<{ receiving_record_id: string; quantity_used: number }[]>([]);
  const [operators, setOperators] = useState<FMSOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openStageId, setOpenStageId] = useState<string | null>(null);
  const [selectedStageIds, setSelectedStageIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [measuredInputs, setMeasuredInputs] = useState<Record<string, string>>({});
  const [completedQtyInputs, setCompletedQtyInputs] = useState<Record<string, string>>({});
  const [verifyMap, setVerifyMap] = useState<Record<string, boolean>>({});

  const [soakStage, setSoakStage] = useState<PickleStage | null>(null);
  const [soakContainer, setSoakContainer] = useState('');

  const getStockCode = (id: string) => stockCodes.find((sc) => sc.id === id);
  const getOperator = (id?: string | null) => id ? operators.find((o) => o.user_id === id) : undefined;
  const receivingForLot = (lotId: string) => receivingRecords.find((r) => r.id === lotId);

  const availableLotsFor = (materialStockCodeId: string) =>
    receivingRecords
      .filter((r) => r.stock_code_id === materialStockCodeId && r.status === 'accepted')
      .sort((a, b) => (a.received_at || '').localeCompare(b.received_at || ''));

  const lotAvailable = (lotId: string) => {
    const rec = receivingForLot(lotId);
    const used = materialsUsed
      .filter((m) => m.receiving_record_id === lotId)
      .reduce((sum, m) => sum + Number(m.quantity_used || 0), 0);
    return Math.max(0, Number(rec?.quantity_received || 0) - used);
  };


  const loadInFlightRef = useRef<{ batchId: string; promise: Promise<void> } | null>(null);

  const loadWorkflow = useCallback(async () => {
    if (!batch?.id) return;
    // Another load for this batch is in flight — wait for it instead of
    // starting a second (racing) load.
    if (loadInFlightRef.current?.batchId === batch.id) {
      await loadInFlightRef.current.promise;
      return;
    }

    const promise = (async () => {
      try {
        // Reuse the run created by "Start Production" instead of regenerating
        // it on every open (a regeneration is a full delete + recreate of all
        // stages/ingredients — doing that twice back-to-back is what made the
        // dialog spinner hang). Only generate when no run exists yet, or when
        // the existing run has no stages (e.g. an earlier partial generation).
        const { data: existingRuns, error: runErr } = await (supabase.from('fms_pickle_runs' as any) as any)
          .select('id')
          .eq('batch_id', batch.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (runErr) throw new Error(runErr.message);
        let id: string | null = (existingRuns as any[] | null)?.[0]?.id ?? null;

        let rows: PickleStage[] = [];
        if (id) {
          const { data: stageRows, error: sErr } = await (supabase.from('fms_pickle_stages' as any) as any)
            .select('*')
            .eq('run_id', id);
          if (sErr) throw new Error(sErr.message);
          rows = ((stageRows || []) as PickleStage[]);
        }

        // No run, a run with no stages (partial/failed generation earlier), or
        // a run whose stage count no longer matches the current production-tree
        // scope (e.g. parent_finished_good_id links were added/removed, or a
        // BOM changed the number of stages): (re)generate via
        // ensurePickleRunForBatch, which replaces the old run wholesale.
        // Compare against FRESH BOMs (not the possibly cached `boms` prop) so
        // a just-saved link is detected even within the 5-minute FMS cache.
        const liveBomsForCheck = (await fetchFreshBomsForPlan()) ?? boms;
        const plannedStageCount = buildPickleBatchPlan(
          stockCodes,
          liveBomsForCheck,
          batch.finished_good_id,
          Number(batch.planned_batch_size) || 0
        ).length;
        if (!id || rows.length === 0 || rows.length !== plannedStageCount) {
          id = await ensurePickleRunForBatch({
          batch,
          stockCodes,
          boms: liveBomsForCheck,
          userId: user?.id,
        });
                  if (!id) {
            setError('Pickle stages could not be generated for this batch.');
            setRunId(null);
            setStages([]);
            setIngredients([]);
            return;
          }
          const { data: stageRows, error: sErr } = await (supabase.from('fms_pickle_stages' as any) as any)
            .select('*')
            .eq('run_id', id);
          if (sErr) throw new Error(sErr.message);
          rows = ((stageRows || []) as PickleStage[]);
        }

        setRunId(id);
        setStages(rows);

    
      const stageIds = rows.map((s) => s.id);
      if (stageIds.length > 0) {
        const { data: ingRows, error: iErr} = await (supabase
          .from('fms_pickle_stage_ingredients'as any ) as any)
        .select('*')
        .in('stage_id', stageIds);
        if (iErr) throw new Error(iErr.message);
        setIngredients((ingRows || []) as PickleIngredient[]);
      } else {
        setIngredients([]);
      }

        const [{ data: usedData }, { data: opData }] = await Promise.all([
          (supabase.from('fms_materials_used' as any) as any).select('receiving_record_id, quantity_used'),
          (supabase.from('fms_users' as any) as any).select('id, user_id, name, role, is_active').eq('is_active', true),
        ]);
        if (usedData) {
          setMaterialsUsed((usedData as any[]).map((x) => ({
            receiving_record_id: x.receiving_record_id,
            quantity_used: Number(x.quantity_used),
          })));
        }
        if (opData) setOperators(opData as FMSOperator[]);

        setError(null);
      } catch (e: any) {
        console.error('[Pickle] load workflow error', e);
        setError(e?.message || 'Failed to load pickle stages');
      } finally {
        setLoading(false);
      }
    })();

    loadInFlightRef.current = { batchId: batch.id, promise };
    try {
      await promise;
    } finally {
      if (loadInFlightRef.current?.batchId === batch.id) loadInFlightRef.current = null;
    }
  }, [batch?.id, batch, stockCodes, boms, user?.id]);

  const retryLoadWorkflow = () => {
    setLoading(true);
    void loadWorkflow();
  };

  useEffect(() => { void loadWorkflow(); }, [loadWorkflow, batch?.id]);

  /* ---------------------------------------------------------------------
   * Ordering helpers — start -> end (raw-side WIP first, finished good last)
   * ------------------------------------------------------------------- */
  const runStages = stages;
  const ingredientsFor = (stageId: string) => ingredients.filter((i) => i.stage_id === stageId);

  const stageDepth = (stage: PickleStage): number => {
    let depth = 0;
    let current: PickleStage | undefined = stage;
    const guard = new Set<string>();
    while (current && current.parent_stage_id && !guard.has(current.id)) {
      guard.add(current.id);
      current = runStages.find((s) => s.id === current!.parent_stage_id);
      depth += 1;
    }
    return depth;
  };

  

  const orderedStages = useMemo(() => {
    if (runStages.length === 0) return [] as PickleStage[];
    return runStages.slice().sort((a, b) => {
      const da = stageDepth(a);
      const db = stageDepth(b);
      if (da !== db) return db - da;
      return a.stage_order - b.stage_order;
    });
  }, [runStages]);



  const doneCount = runStages.filter((s) => s.status === 'COMPLETED').length;
  const progressPct = runStages.length === 0 ? 0 : Math.round((doneCount / runStages.length) * 100);

  /** The current stage = first stage in start -> end order that is not complete. */
  const currentStage = orderedStages.find((s) => s.status !== 'COMPLETED') || null;

  /** A stage sheet is available only after every earlier stage is complete. */
  const isStageDownloadable = (stage: PickleStage): boolean => {
    const stageIndex = orderedStages.findIndex((s) => s.id === stage.id);
    const previousStagesComplete = stageIndex <= 0 || orderedStages.slice(0, stageIndex).every((s) => s.status === 'COMPLETED');
    const soakingStageReady = !stage.is_soaking || stage.status === 'READY_FOR_NEXT_STAGE' || stage.status === 'COMPLETED';
    return previousStagesComplete && soakingStageReady;
  };

  const toggleStageSelection = (stage: PickleStage, checked: boolean) => {
    if (!isStageDownloadable(stage)) return;
    setSelectedStageIds((current) => checked
      ? current.includes(stage.id) ? current : [...current, stage.id]
      : current.filter((id) => id !== stage.id));
  };

  const selectedStages = orderedStages.filter((stage) => selectedStageIds.includes(stage.id));
  const selectableStages = orderedStages.filter((stage) => isStageDownloadable(stage));

  const processSelectedStages = (action: 'download' | 'print') => {
    if (selectedStages.length === 0) {
      toast.error('Select at least one available stage first.');
      return;
    }
    selectedStages.forEach((stage, index) => {
      window.setTimeout(() => {
        if (action === 'download') downloadStageSheet(stage);
        else printStageSheet(stage);
      }, index * 250);
    });
    toast.success(`${action === 'download' ? 'Downloading' : 'Printing'} ${selectedStages.length} stage sheet${selectedStages.length === 1 ? '' : 's'}...`);
  };

   const stageDownloadBlockedMessage = (stage: PickleStage): string => {
     const stageIndex = orderedStages.findIndex((s) => s.id === stage.id);
     const previousIncomplete = orderedStages.slice(0, stageIndex).find((s) => s.status !== 'COMPLETED');
     return previousIncomplete
       ? `Complete ${stageName(previousIncomplete)} before downloading ${stageName(stage)}.`
       : 'This stage sheet is not available yet.';
   };

  /** Keep the open stage valid (default to the current stage). */
  useEffect(() => {
    if (openStageId && runStages.some((s) => s.id === openStageId)) return;
    setOpenStageId(currentStage ? currentStage.id : null);
  }, [currentStage?.id, openStageId, runStages.length]);

  const openStage = openStageId ? runStages.find((s) => s.id === openStageId) || null : null;

  const stageName = (stage: PickleStage) => getStockCode(stage.stock_code_id)?.stock_code || 'Stage';

 
const [now, setNow] = useState(() => new Date());

useEffect(() => {
  const timer = window.setInterval(() => {
    setNow(new Date());
  }, 60_000);

  return () => window.clearInterval(timer);
}, []);

const getSoakingRule = (stage: PickleStage) => {
  console.log('[SoakingRule] stage:', {
    stockCodeId: stage.stock_code_id,
    stageId: stage.id,
  });

  console.log(
    '[SoakingRule] matching BOMs:',
    boms.filter(
      bom => bom.finished_good_id === stage.stock_code_id
    )
  );

  

  const stockCodeId = stage.stock_code_id;

  if (!stockCodeId) return undefined;

  const matchingBoms = boms.filter(
    bom => bom.finished_good_id === stockCodeId
  );

  const activeBom = matchingBoms
    .filter(bom => bom.status === 'active')
    .sort(
      (a, b) =>
        (b.version_number ?? 0) - (a.version_number ?? 0)
    )[0];

  if (
    activeBom?.min_soaking_days == null ||
    activeBom?.max_soaking_days == null
  ) {
    return undefined;
  }

  return {
    minDays: activeBom.min_soaking_days,
    maxDays: activeBom.max_soaking_days,
  };
};

  /** "Day 4 of 7-10" */
  const soakingLabel = (stage: PickleStage): string | null => {
  if (!stage.soaking_start_at) return null;

  const start = new Date(stage.soaking_start_at);
  const currentMs = now.getTime();

  const rule = getSoakingRule(stage);

  if (!rule) return 'Soaking';
  

  const minReady = stage.min_ready_at
    ? new Date(stage.min_ready_at)
    : new Date(start.getTime() + rule.minDays * 86400000);

  const maxReady = stage.max_ready_at
    ? new Date(stage.max_ready_at)
    : new Date(start.getTime() + rule.maxDays * 86400000);

  const minMs = minReady.getTime();
  const maxMs = maxReady.getTime();

  // Maximum soaking time has passed
  if (currentMs >= maxMs) {
    const overdueHours = Math.floor(
      (currentMs - maxMs) / 3600000
    );

    return overdueHours > 0
      ? `OVERDUE by ${overdueHours}h`
      : 'Maximum soaking time reached';
  }

  // Minimum soaking time has passed, but maximum has not
  if (currentMs >= minMs) {
    const remainingHours = Math.ceil(
      (maxMs - currentMs) / 3600000
    );

    return `READY — max ${Math.floor(remainingHours / 24)}d ${
      remainingHours % 24
    }h`;
  }

  // Still waiting for minimum soaking time
  const remainingHours = Math.ceil(
    (minMs - currentMs) / 3600000
  );

  return `${Math.floor(remainingHours / 24)}d ${
    remainingHours % 24
  }h remaining`;
};

  const patchStage = async (id: string, patch: any) => {
    const { data, error: err } = await (supabase.from('fms_pickle_stages' as any) as any)
      .update(patch).eq('id', id).select().single();
    if (err) { console.error('[Pickle] update stage', err); toast.error(err.message); return null; }
    setStages((prev) => prev.map((s) => (s.id === id ? (data as PickleStage) : s)));
    return data as PickleStage;
  };

  

  const patchIngredient = async (id: string, patch: any) => {
    const { data, error: err } = await (supabase.from('fms_pickle_stage_ingredients' as any) as any)
      .update(patch).eq('id', id).select().single();
    if (err) { console.error('[Pickle] update ingredient', err); toast.error(err.message); return null; }
    setIngredients((prev) => prev.map((i) => (i.id === id ? (data as PickleIngredient) : i)));
    return data as PickleIngredient;
  };

  

  /* ---------------------------------------------------------------------
   * Stage actions
   * ------------------------------------------------------------------- */
  const generateLot = async (): Promise<string> => {
    try {
      const { data, error } = await (supabase.rpc as any)('fms_generate_lot_number');
      if (!error && data) return data as string;
    } catch {
      /* fall through to a local lot number */
    }
    const year = new Date().getFullYear();
    return `LOT-${year}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
  };

  const setStageReady = async (stage: PickleStage) => {
    await patchStage(stage.id, {
      status: 'READY',
      started_at: stage.started_at || new Date().toISOString(),
      operator_id: user?.id,
    });
  };

  const beginStage = async (stage: PickleStage) => {
    await patchStage(stage.id, {
      status: 'IN_PROGRESS',
      started_at: new Date().toISOString(),
      operator_id: user?.id,
    });
  };

  const markReadyForNext = async (stage: PickleStage) => {
    const patch: any = { status: 'READY_FOR_NEXT_STAGE' };
    if (stage.is_soaking) {
      patch.actual_ready_date = new Date().toISOString().split('T')[0];
      patch.elapsed_days = stage.min_ready_date
        ? daysBetween(stage.min_ready_date, new Date().toISOString())
        : 0;
    }
    await patchStage(stage.id, patch);
  };

  const applySoak = async () => {
  const stage = soakStage;
  if (!stage) return;

  const rule = getSoakingRule(stage);

  if (!rule) {
    toast.error('No soaking duration is configured for this stage BOM.');
    return;
  }

  if (!soakContainer) {
    toast.error('Enter the container / drum ID');
    return;
  }

  setBusy(true);
  

  try {
    const start = new Date();

    const minReady = new Date(
      start.getTime() + rule.minDays * 86400000
    );

    const maxReady = new Date(
      start.getTime() + rule.maxDays * 86400000
    );

    const updated = await patchStage(stage.id, {
      is_soaking: true,
      status: 'SOAKING',
      soaking_start_at: start.toISOString(),

      min_ready_at: minReady.toISOString(),
      max_ready_at: maxReady.toISOString(),

      min_ready_date: minReady.toISOString().split('T')[0],
      max_ready_date: maxReady.toISOString().split('T')[0],

      container_id: soakContainer,
      started_at: stage.started_at || start.toISOString(),
      operator_id: user?.id,
    });

    if (updated) {
      toast.success(
        `${stageName(stage)} — soaking started. Minimum ${rule.minDays} days, maximum ${rule.maxDays} days.`
      );
    }

    setSoakStage(null);
    setSoakContainer('');
  } finally {
    setBusy(false);
  }
};

  const weighIngredient = async (ing: PickleIngredient, measured: string) => {
    const m = parseFloat(measured);
    if (isNaN(m) || m < 0) {
      toast.error('Enter a valid measured quantity');
      return;
    }
    const variance = m - Number(ing.required_qty);
    await patchIngredient(ing.id, {
      measured_qty: m,
      variance,
      status: 'WEIGHED',
      operator_id: user?.id,
      measured_at: new Date().toISOString(),
    });
  };

  const assignIngredientLot = async (ing: PickleIngredient, lotId: string) => {
    const rec = receivingForLot(lotId);
    await patchIngredient(ing.id, {
      receiving_record_id: lotId,
      internal_lot_number: rec?.internal_lot_number || null,
    });
  };


  /** Consume inputs, create the output WIP / finished lot, mark COMPLETED. */
  const completeStage = async (stage: PickleStage) => {
    if (busy) return;
    if (!(verifyMap[stage.id] ?? stage.verified)) {
      toast.error('Verification checkbox must be ticked before completing this stage.');
      return;
    }
    if (stage.status === 'COMPLETED') return;
    setBusy(true);
    try {
      const stageStock = getStockCode(stage.stock_code_id);

      const stageIngredients = ingredientsFor(stage.id);
      const unweighed = stageIngredients.some((i) => i.measured_qty == null || i.measured_qty <= 0);
      const missingLot = stageIngredients.some((i) => !i.receiving_record_id);
      if (unweighed) throw new Error('All ingredients must have an actual measured quantity.');
      

      for (const ing of stageIngredients) {
        const { error } = await (supabase.rpc as any)('fms_apply_stock_movement', {
          p_stock_code_id: ing.material_stock_code_id,
          p_movement_type: 'batch_usage',
          p_quantity_change: -Number(ing.measured_qty || 0),
          p_reference_id: ing.internal_lot_number || '',
          p_notes: `${batch.batch_number} ${stageStock?.stock_code || ''} consumed ${fmtNum(ing.measured_qty)} from ${ing.internal_lot_number || 'lot'}`,
          p_created_by: user?.id || null,
        });
        if (error) console.error('[Pickle] consume movement', error);
        await patchIngredient(ing.id, { status: 'COMPLETED' });
      }


      const completedQty = Number(completedQtyInputs[stage.id] ?? stage.completed_quantity ?? stage.required_qty) || 0;
      if (completedQty <= 0) throw new Error('Completed quantity must be greater than 0.');

      if (stageStock && stageStock.item_type !== 'raw_material' && stageStock.item_type !== 'packaging') {
        const lotNumber = await generateLot();
        const { data: lotRow, error: lotErr } = await (supabase.from('fms_receiving' as any) as any)
          .insert({
            internal_lot_number: lotNumber,
            stock_code_id: stage.stock_code_id,
            quantity_received: completedQty,
            supplier_id: null,
            supplier_batch_number: null,
            expiry_date: null,
            quality_checks: {},
            status: 'accepted',
            received_by: user?.id,
          })
          .select()
          .single();
        if (lotErr || !lotRow) throw new Error(lotErr?.message || 'Failed to create output lot');

        const { error: stockErr } = await (supabase.rpc as any)('fms_apply_stock_movement', {
          p_stock_code_id: stage.stock_code_id,
          p_movement_type: 'receipt',
          p_quantity_change: completedQty,
          p_reference_id: lotNumber,
          p_notes: `${batch.batch_number} ${stageStock?.stock_code || ''} output ${fmtNum(completedQty)} -> ${lotNumber}`,
          p_created_by: user?.id || null,
        });
        if (stockErr) console.error('[Pickle] output movement', stockErr);

        // Feed this output lot into every downstream ingredient row.
        for (const d of ingredients.filter((i) => i.source_stage_id === stage.id)) {
          await patchIngredient(d.id, { receiving_record_id: lotRow.id, internal_lot_number: lotNumber });
        }

        await patchStage(stage.id, {
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          completed_quantity: completedQty,
          output_lot_id: lotRow.id,
          actual_ready_date: stage.is_soaking ? new Date().toISOString().split('T')[0] : stage.actual_ready_date,
          elapsed_days: stage.is_soaking ? (stage.min_ready_date ? daysBetween(stage.min_ready_date, new Date().toISOString()) : null) : stage.elapsed_days,
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
        });
        toast.success(`${stageStock?.stock_code || 'Stage'} completed — output lot ${lotNumber} created`);
      } else {
        await patchStage(stage.id, {
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          completed_quantity: completedQty,
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
        });
      }

      if (onChanged) await onChanged();
    } catch (e: any) {
      console.error('[Pickle] complete stage', e);
      toast.error(e?.message || 'Failed to complete stage');
    } finally {
      setBusy(false);
    }
  };


  /* ---------------------------------------------------------------------
   * Rendering helpers
   * ------------------------------------------------------------------- */
  // Percentage helpers — pickle production works in percentages:
  // a stage's % is relative to its parent stage (root = 100% of the batch),
  // an ingredient's % is relative to the stage it belongs to.
  const fmtPct = (n: number | null): string =>
    n == null || isNaN(Number(n)) ? '—' : `${Number(n.toFixed(3))}%`;

  const stagePct = (stage: PickleStage): number | null => {
    if (stage.is_root) return 100;
    const parent = runStages.find((s) => s.id === stage.parent_stage_id);
    if (!parent || !Number(parent.required_qty)) return null;
    return (Number(stage.required_qty) / Number(parent.required_qty)) * 100;
  };

  const ingredientPct = (ing: PickleIngredient): number | null => {
    const st = runStages.find((s) => s.id === ing.stage_id);
    if (!st || !Number(st.required_qty)) return null;
    return (Number(ing.required_qty) / Number(st.required_qty)) * 100;
  };

  const ingredientRow = (ing: PickleIngredient) => {
    const mat = getStockCode(ing.material_stock_code_id);
    const isWip = ing.source_type === 'wip_stage';
    const srcStage = isWip ? runStages.find((s) => s.id === ing.source_stage_id) : null;
    const lots = isWip ? [] : availableLotsFor(ing.material_stock_code_id);
    const measuredVal = measuredInputs[ing.id] ?? (ing.measured_qty != null ? ing.measured_qty.toString() : '');
    const variance = (ing.measured_qty != null) ? (Number(ing.measured_qty) - Number(ing.required_qty)) : null;

    return (
      <tr key={ing.id} className="border-t border-border/60">
        <td className="py-2 pr-3 align-top">
          <p className="text-sm font-medium">{mat?.stock_code || '—'}</p>
          <p className="text-xs text-muted-foreground">{mat?.description || ''}</p>
          {isWip && <Badge variant="outline" className="mt-1 text-[10px] text-primary">From {srcStage ? (getStockCode(srcStage.stock_code_id)?.stock_code || 'WIP') : 'WIP stage'}</Badge>}
        </td>
        <td className="py-2 pr-3 align-top text-sm font-semibold whitespace-nowrap">
          {fmtNum(ing.required_qty)} <span className="text-xs font-normal text-muted-foreground">{ing.unit_of_measure}</span>
          {ingredientPct(ing) != null && <p className="text-xs font-normal text-muted-foreground">{fmtPct(ingredientPct(ing))}</p>}
        </td>
        <td className="py-2 pr-3 align-top">
          <Input className="h-9 w-24" type="number" min="0" step="0.001" value={measuredVal}
            onChange={(e) => setMeasuredInputs((prev) => ({ ...prev, [ing.id]: e.target.value }))}
            onBlur={() => { if (measuredVal !== '') void weighIngredient(ing, measuredVal); }} placeholder="0.000" />
        </td>
        <td className={`py-2 pr-3 align-top text-sm font-semibold whitespace-nowrap ${variance == null ? 'text-muted-foreground' : (Math.abs(variance) < 0.001 ? 'text-emerald-600' : 'text-amber-600')}`}>
          {variance == null ? '—' : (variance >= 0 ? '+' : '') + fmtNum(variance, 2)}
        </td>
      </tr>
    );
  };

  const stageRow = (stage: PickleStage, index: number) => {
    const sc = getStockCode(stage.stock_code_id);
    const done = stage.status === 'COMPLETED';
    const isOpen = openStage?.id === stage.id;
    const isCurrent = currentStage?.id === stage.id;
    const soakLbl = soakingLabel(stage);

    const selectable = isStageDownloadable(stage);
    const selected = selectedStageIds.includes(stage.id);

    return (
      <div key={stage.id} role="button" tabIndex={0} onClick={() => setOpenStageId(stage.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setOpenStageId(stage.id); }}
        className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${isOpen ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}>
        <Checkbox
          checked={selected}
          disabled={!selectable}
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={(checked) => toggleStageSelection(stage, checked === true)}
          aria-label={`Select ${sc?.stock_code || 'stage'} for download`}
        />
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? 'bg-emerald-600 text-white' : isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
          {done ? 'OK' : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold">{sc?.stock_code}</span>
            {stage.is_root && <Badge variant="outline" className="text-[10px]">Finished good</Badge>}
            {isCurrent && <Badge className="text-[10px]">Current step</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">{sc?.description}</p>
          {soakLbl && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary">
              <Timer className="h-3 w-3" />SOAKING — {soakLbl}{stage.container_id ? ` | ${stage.container_id}` : ''}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold whitespace-nowrap">{fmtNum(stage.required_qty)} {stage.unit_of_measure}</p>
          {stagePct(stage) != null && <p className="text-xs text-muted-foreground">{fmtPct(stagePct(stage))} of parent</p>}
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_BADGE[stage.status]}`}>{STAGE_LABEL[stage.status]}</span>
        </div>
      </div>
    );
  };


  const stagePanel = openStage ? (() => {
    const sc = getStockCode(openStage.stock_code_id);
    const op = getOperator(openStage.operator_id);
    const soakLbl = soakingLabel(openStage);
    const ings = ingredientsFor(openStage.id);
    const verified = verifyMap[openStage.id] ?? openStage.verified;
    const completedVal = completedQtyInputs[openStage.id] ?? (openStage.completed_quantity != null ? openStage.completed_quantity.toString() : (openStage.required_qty || 0).toString());
    const done = openStage.status === 'COMPLETED';
    const active = ['READY', 'IN_PROGRESS', 'SOAKING', 'READY_FOR_NEXT_STAGE'].includes(openStage.status);

    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_BADGE[openStage.status]}`}>{STAGE_LABEL[openStage.status]}</span>
              <span className="font-semibold">{sc?.stock_code}</span>
              {openStage.is_root && <Badge>Finished good</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{sc?.description}</p>
            <p className="text-sm"><strong>Required: {fmtNum(openStage.required_qty)} {openStage.unit_of_measure}</strong>
              {stagePct(openStage) != null && <span className="ml-2 text-muted-foreground">({fmtPct(stagePct(openStage))} of parent stage)</span>}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            {op && <p>Operator: {op.name}</p>}
            {openStage.started_at && <p>Started {formatDateTime(openStage.started_at)}</p>}
            {openStage.completed_at && <p>Completed {formatDateTime(openStage.completed_at)}</p>}
          </div>
        </div>

        {soakLbl && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
            <Timer className="h-4 w-4 text-primary" />
            <strong>SOAKING — {soakLbl}</strong>
            {openStage.container_id && <span className="text-muted-foreground">· {openStage.container_id}</span>}
          </div>
        )}
        {openStage.is_soaking && openStage.status === 'SOAKING' && (
          <div className="mt-2 grid gap-2 sm:grid-cols-3 text-sm">
            <div><Label className="text-xs">Min ready</Label><p>{openStage.min_ready_date || '—'}</p></div>
            <div><Label className="text-xs">Max ready</Label><p>{openStage.max_ready_date || '—'}</p></div>
            <div><Label className="text-xs">Container / Drum</Label><p className="font-medium">{openStage.container_id || '—'}</p></div>
          </div>
        )}


        {ings.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <p className="mb-2 text-sm font-semibold text-muted-foreground">Ingredients</p>
            <table className="w-full min-w-[34rem]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-1 pr-3 font-medium">Material</th>
                  <th className="pb-1 pr-3 font-medium">Required (kg / %)</th>
                  <th className="pb-1 pr-3 font-medium">Actual</th>
                  <th className="pb-1 pr-3 font-medium">Variance</th>
                  <th className="pb-1 font-medium">Lot</th>
                </tr>
              </thead>
              <tbody>{ings.map(ingredientRow)}</tbody>
            </table>
          </div>
        )}

        {openStage.process_instructions && (
          <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/20 p-3">
            <p className="text-sm font-semibold text-muted-foreground">Process instructions</p>
            <pre className="whitespace-pre-wrap text-sm">{openStage.process_instructions}</pre>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Label className="text-sm">Completed qty ({openStage.unit_of_measure})</Label>
          <Input className="w-28" type="number" min="0" step="0.001" value={completedVal} disabled={done}
            onChange={(e) => setCompletedQtyInputs((prev) => ({ ...prev, [openStage.id]: e.target.value }))} />
          {active && (
            <>
              <Checkbox id={`verify-${openStage.id}`} checked={verified} onCheckedChange={(c) => setVerifyMap((prev) => ({ ...prev, [openStage.id]: !!c }))} />
              <Label htmlFor={`verify-${openStage.id}`} className="text-sm font-normal">Verified by {fmsUserName || 'operator'}</Label>
            </>
          )}
        </div>


        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!isStageDownloadable(openStage)}
            title={isStageDownloadable(openStage) ? 'Download this stage sheet as a PDF' : stageDownloadBlockedMessage(openStage)}
            onClick={() => downloadStageSheet(openStage)}
          >
            <Download className="mr-1 h-4 w-4" />
            Download Stage Sheet
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!isStageDownloadable(openStage)}
            title={isStageDownloadable(openStage) ? 'Print this stage sheet' : stageDownloadBlockedMessage(openStage)}
            onClick={() => printStageSheet(openStage)}
          >
            <Printer className="mr-1 h-4 w-4" />
            Print Stage
          </Button>
          {openStage.status === 'NOT_STARTED' && <Button size="sm" onClick={() => void setStageReady(openStage)}>Start</Button>}
          {openStage.status === 'READY' && <Button size="sm" onClick={() => void beginStage(openStage)}><Play className="mr-1 h-4 w-4" />Begin</Button>}
          {active && !openStage.is_soaking && getSoakingRule(openStage) && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => {
      setSoakStage(openStage);
      setSoakContainer(openStage.container_id || '');
    }}
  >
    <Timer className="mr-1 h-4 w-4" />
    Begin Soaking
  </Button>
)}
          {openStage.status === 'SOAKING' && <Button variant="outline" size="sm" onClick={() => void markReadyForNext(openStage)}>Ready for next stage</Button>}
          {active && (
            <Button disabled={busy} onClick={() => void completeStage(openStage)}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
              Complete Stage
            </Button>
          )}
          {done && openStage.output_lot_id && (
            <Button variant="outline" size="sm" onClick={() => void viewLotQR(openStage)}><QrCode className="mr-1 h-4 w-4" />Lot QR</Button>
          )}
        </div>

        {done && (
          <p className="mt-2 text-xs font-medium text-emerald-600">
            Output lot: {receivingForLot(openStage.output_lot_id)?.internal_lot_number || '—'} ({fmtNum(openStage.completed_quantity)} {openStage.unit_of_measure})
          </p>
        )}
      </div>
    );
  })() : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading pickle stages...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-center justify-between gap-3">
        <span>{error}</span>
        <Button variant="outline" size="sm" onClick={retryLoadWorkflow}>
          Retry
        </Button>
      </div>
    );
  }

  if (runStages.length === 0) return null;


  const printStageSheet = (stage: PickleStage) => {
    if (!isStageDownloadable(stage)) {
      toast.error(stageDownloadBlockedMessage(stage));
      return;
    }

    const stageStock = getStockCode(stage.stock_code_id);
    const stageIngredients = ingredientsFor(stage.id);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Allow pop-ups to download the stage sheet.');
      return;
    }

    const escapeHtml = (value: unknown): string => {
      const div = document.createElement('div');
      div.textContent = String(value ?? '');
      return div.innerHTML;
    };
    const ingredientRows = stageIngredients.map((ingredient) => {
      const material = getStockCode(ingredient.material_stock_code_id);
      return `<tr>
        <td>${escapeHtml(material?.stock_code || '')}</td>
        <td>${escapeHtml(material?.description || '')}</td>
        <td>${escapeHtml(ingredient.required_qty)} ${escapeHtml(ingredient.unit_of_measure)}</td>
        <td>${escapeHtml(ingredient.measured_qty ?? '')}</td>
        <td>${escapeHtml(ingredient.internal_lot_number || '')}</td>
      </tr>`;
    }).join('');

    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(stageStock?.stock_code || 'Stage')} Stage Sheet</title>
      <style>
        @page { size: A4; margin: 10mm; }
        body { font-family: Arial, sans-serif; padding: 10px; max-width: 100%; margin: 0 auto; font-size: 11px; }
        h1 { font-size: 16px; margin-bottom: 5px; }
        h2 { font-size: 14px; margin-bottom: 5px; margin-top: 12px; border-bottom: 1px solid #333; padding-bottom: 3px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-start; }
        .header-left { flex: 1; }
        .header-logo { width: 60px; height: 60px; object-fit: contain; }
        .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
        .info-item { padding: 5px; background: #f5f5f5; border-radius: 3px; font-size: 10px; }
        .info-label { font-size: 9px; color: #666; }
        .info-value { font-weight: bold; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
        th { background: #333; color: white; padding: 5px; text-align: left; font-size: 10px; }
        td { font-size: 11px; padding: 5px; border: 1px solid #ddd; }
        .instructions { white-space: pre-wrap; padding: 5px; }
        .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px; }
        .signature-line { border-bottom: 1px solid #333; height: 30px; margin-top: 5px; }
        @media print { .no-print { display: none; } body { padding: 0; } }
      </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <h1>PRODUCTION BATCH SHEET</h1>
            <p style="margin: 0; font-size: 10px;">Document No: MS Q004 | ${escapeHtml(batch.batch_number)} | Stage: ${escapeHtml(stageStock?.stock_code || 'N/A')}</p>
          </div>
          <img src="/images/print-logo.png" alt="Logo" class="header-logo" onerror="this.style.display='none'" />
        </div>

        <div class="info-grid">
          <div class="info-item"><div class="info-label">Product</div><div class="info-value">${escapeHtml(stageStock?.description || 'N/A')}</div></div>
          <div class="info-item"><div class="info-label">Stock Code</div><div class="info-value">${escapeHtml(stageStock?.stock_code || 'N/A')}</div></div>
          <div class="info-item"><div class="info-label">Required Qty</div><div class="info-value">${escapeHtml(stage.required_qty)} ${escapeHtml(stage.unit_of_measure)}</div></div>
          <div class="info-item"><div class="info-label">Stage Status</div><div class="info-value">${escapeHtml(STAGE_LABEL[stage.status])}</div></div>
        </div>

        <h2>1. STAGE INFORMATION</h2>
        <div class="info-grid">
          <div class="info-item"><div class="info-label">Container / Drum</div><div class="info-value">${escapeHtml(stage.container_id || '—')}</div></div>
          <div class="info-item"><div class="info-label">Started</div><div class="info-value">${escapeHtml(stage.started_at ? formatDateTime(stage.started_at) : '—')}</div></div>
          <div class="info-item"><div class="info-label">Completed</div><div class="info-value">${escapeHtml(stage.completed_at ? formatDateTime(stage.completed_at) : '—')}</div></div>
          <div class="info-item"><div class="info-label">Completed Qty</div><div class="info-value">${escapeHtml(stage.completed_quantity ?? '—')}${stage.completed_quantity == null ? '' : ` ${escapeHtml(stage.unit_of_measure)}`}</div></div>
        </div>

        <h2>2. PROCESS INSTRUCTIONS</h2>
        <div style="white-space: pre-wrap; padding: 5px;">${escapeHtml(stage.process_instructions || 'No process instructions provided')}</div>

        <h2>3. DISPENSING MATERIALS</h2>
        <table>
          <thead><tr><th>Stock Code</th><th>Material Description</th><th style="text-align: right;">Qty Required</th><th style="text-align: right;">Qty Weighed</th><th>Int. Lot No.</th></tr></thead>
          <tbody>${ingredientRows || '<tr><td colspan="5" style="padding: 10px; text-align: center; color: #666;">No ingredients recorded</td></tr>'}</tbody>
        </table>

        <h2>4. BATCH INFORMATION</h2>
        <div class="info-grid">
          <div class="info-item"><div class="info-label">Stage Required Qty</div><div class="info-value">${escapeHtml(stage.required_qty)} ${escapeHtml(stage.unit_of_measure)}</div></div>
          <div class="info-item"><div class="info-label">Actual Qty Produced</div><div class="info-value">${escapeHtml(stage.completed_quantity ?? '_______')}</div></div>
          <div class="info-item"><div class="info-label">Stage Status</div><div class="info-value">${escapeHtml(STAGE_LABEL[stage.status])}</div></div>
          <div class="info-item"><div class="info-label">Checker Name</div><div class="info-value">_________________</div></div>
        </div>

        <div class="signature-grid">
          <div><div class="info-label">Operator Signature</div><div class="signature-line"></div><div style="font-size: 9px; margin-top: 3px;">Date: ___________</div></div>
          <div><div class="info-label">Supervisor Signature</div><div class="signature-line"></div><div style="font-size: 9px; margin-top: 3px;">Date: ___________</div></div>
        </div>

        <p style="margin-top: 15px; font-size: 9px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">
          By signing this document, I confirm that I have checked and verified all required fields prior to signing.
        </p>
        <button class="no-print" onclick="window.print()">Print</button>
        <script>setTimeout(() => window.print(), 500);</script>
      </body>
      </html>`);
    printWindow.document.close();
  };

  const downloadStageSheet = (stage: PickleStage) => {
    // Match the normal Batch Sheet action: open the same printable document
    // and let the browser print/save it as PDF.
    printStageSheet(stage);
  };

  const viewLotQR = async (stage: PickleStage) => {    const lot = stage.output_lot_id ? receivingForLot(stage.output_lot_id) : undefined;
    const data = JSON.stringify({
      type: 'PICKLE_LOT',
      lot: lot?.internal_lot_number || '',
      stock_code: getStockCode(stage.stock_code_id)?.stock_code || '',
      quantity: stage.completed_quantity,
      batch: batch.batch_number,
    });
    const img = await generateQRCodeImage(data);
    if (!img) { toast.error('Could not generate QR'); return; }
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Lot QR</title></head><body style="text-align:center;font-family:sans-serif;padding:24px;">
      <h3>${lot?.internal_lot_number || ''}</h3><img src="${img}" style="width:300px;height:300px;image-rendering:pixelated;" />
      <p>${getStockCode(stage.stock_code_id)?.stock_code || ''} · ${String(stage.completed_quantity)} ${stage.unit_of_measure}</p>
      <button onclick="window.print()">Print</button></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-xs text-muted-foreground">{doneCount}/{runStages.length} stages ({progressPct}%)</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-2 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Production stages (start to finish)</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={selectedStages.length === 0} onClick={() => processSelectedStages('download')}>
                <Download className="mr-1 h-4 w-4" />Download Selected ({selectedStages.length})
              </Button>
              <Button variant="outline" size="sm" disabled={selectedStages.length === 0} onClick={() => processSelectedStages('print')}>
                <Printer className="mr-1 h-4 w-4" />Print Selected
              </Button>
            </div>
          </div>
          {selectableStages.length > 0 && (
            <p className="text-xs text-muted-foreground">Select available stages to download or print them together.</p>
          )}
          {orderedStages.map((s, i) => stageRow(s, i))}
        </div>
        <div className="lg:col-span-7">{stagePanel}</div>
      </div>


      {/* Begin soaking dialog */}
      <Dialog open={!!soakStage} onOpenChange={(o) => { if (!o) setSoakStage(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Begin Soaking — {soakStage ? stageName(soakStage) : ''}</DialogTitle>
            <DialogDescription>Soaking stages run for several days. Record the ready window and container.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {soakStage && (() => {
              const rule = getSoakingRule(soakStage);

              if (!rule) {
                return (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    <p className="font-semibold text-destructive">
                      No soaking period configured
                    </p>
                    <p className="text-muted-foreground">
                      This stage's active BOM does not have a minimum and maximum
                      soaking duration configured.
                    </p>
                  </div>
                );
              }

              return (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="font-semibold">Soaking period</p>
                  <p className="text-muted-foreground">
                    Minimum: {rule.minDays} days
                    {' · '}
                    Maximum: {rule.maxDays} days
                  </p>
                </div>
              );
            })()}
            <div className="space-y-2">
              <Label htmlFor="soak_container">Container / Drum ID *</Label>
              <Input id="soak_container" value={soakContainer} onChange={(e) => setSoakContainer(e.target.value.toUpperCase())} placeholder="e.g. DRUM-014" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSoakStage(null)}>Cancel</Button>
            <Button disabled={busy} onClick={() => void applySoak()}><Timer className="mr-1 h-4 w-4" />Start Soaking</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

