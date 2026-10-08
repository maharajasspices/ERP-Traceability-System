// =====================================================================
// Raw material usage
// =====================================================================
//
// Answers "how much raw material did I use between two dates, and what did I
// use it for?" by walking the batches that survive the Batch Sheet filters.
//
// Source of truth
// ---------------
// `pre_weigh_materials` is what the operator actually recorded and weighed at
// pre-weigh, so it is the honest answer to "used". The BOM recipe is only a
// fallback for batches that were never pre-weighed, because a recipe says what
// should have been used, not what was.
//
// Note (matching Traceability): `fms_materials_used` is the authoritative
// post-consumption record. It is not read here because the Batch Sheet page
// already has the batches loaded and does not want an extra round trip; for a
// recall, Traceability unions both.
// =====================================================================

/** One pre-weigh row, as stored in `fms_production_batches.pre_weigh_materials`. */
export interface PreWeighMaterialLike {
  material_id?: string;
  material_name?: string;
  stock_code?: string;
  required_quantity?: number;
  quantity_weighed?: number;
  uom?: string;
  raw_material_batch_number?: string;
  internal_lot_number?: string;
  expiry_date?: string;
  approved?: boolean;
}

/** The parts of a batch this report needs. */
export interface UsageBatchLike {
  id: string;
  batch_number: string;
  finished_good_id: string;
  /** `YYYY-MM-DD`, used to order the report. */
  production_date?: string | null;
  pre_weigh_materials?: PreWeighMaterialLike[] | null;
}

export interface RawMaterialUse {
  batch_id: string;
  batch_number: string;
  finished_good_id: string;
  /** How much of this material that batch consumed. */
  quantity: number;
  internal_lot_number: string | null;
  supplier_batch_number: string | null;
  production_date: string | null;
  /**
   * True when the quantity came from what was weighed rather than from the
   * recipe, i.e. it is an actual measurement rather than an estimate.
   */
  measured: boolean;
}

export interface RawMaterialUsage {
  material_id: string | null;
  stock_code: string;
  description: string;
  uom: string;
  /** Summed across every batch in the range. */
  total_used: number;
  /** Number of distinct batches this material went into. */
  batch_count: number;
  /** What it was used for, one entry per batch. */
  uses: RawMaterialUse[];
}

const toNum = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * The quantity this material contributed to one batch.
 *
 * `quantity_weighed` wins when present, because that is what was physically
 * weighed out. Otherwise the pre-weigh requirement is used, and finally the
 * recipe amount. Anything that is not a positive number is skipped so a blank
 * or malformed row never inflates a total.
 */
const resolveQuantity = (
  material: PreWeighMaterialLike,
  recipeQuantity: number | null,
): { quantity: number; measured: boolean } | null => {
  const weighed = material.quantity_weighed;
  if (weighed !== undefined && weighed !== null && toNum(weighed) > 0) {
    return { quantity: toNum(weighed), measured: true };
  }

  const required = material.required_quantity;
  if (required !== undefined && required !== null && toNum(required) > 0) {
    return { quantity: toNum(required), measured: false };
  }

  if (recipeQuantity !== null && recipeQuantity !== undefined && recipeQuantity > 0) {
    return { quantity: recipeQuantity, measured: false };
  }

  return null;
};

/**
 * Aggregate raw material usage across a set of batches.
 *
 * Batches are grouped by material, so the same spice used in five batches is
 * one row with five "used for" entries rather than five separate rows.
 *
 * @param batches   batches already narrowed by the page filters
 * @param lookup    resolves a material / finished-good id to its display fields
 * @param recipeFor optional fallback recipe quantities, keyed by batch + material
 */
export const aggregateRawMaterialUsage = (
  batches: readonly UsageBatchLike[],
  lookup: {
    stockCode: (
      id: string | null | undefined,
    ) => { stock_code: string; description: string } | undefined;
  },
  recipeFor?: (batchId: string, materialId: string | null) => number | null,
): RawMaterialUsage[] => {
  const groups = new Map<string, RawMaterialUsage>();

  for (const batch of batches) {
    const rows = batch.pre_weigh_materials ?? [];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    for (const row of rows) {
      const materialId = row.material_id ?? null;
      const resolved = resolveQuantity(row, recipeFor?.(batch.id, materialId) ?? null);
      if (!resolved) continue;

      const sc = materialId ? lookup.stockCode(materialId) : undefined;
      const key = materialId ?? row.stock_code ?? row.material_name ?? 'unknown';

      let group = groups.get(key);
      if (!group) {
        group = {
          material_id: materialId,
          stock_code: sc?.stock_code ?? row.stock_code ?? 'Unknown',
          description: sc?.description ?? row.material_name ?? 'Unknown material',
          uom: row.uom ?? '',
          total_used: 0,
          batch_count: 0,
          uses: [],
        };
        groups.set(key, group);
      }

      group.total_used += resolved.quantity;
      group.uses.push({
        batch_id: batch.id,
        batch_number: batch.batch_number,
        finished_good_id: batch.finished_good_id,
        quantity: resolved.quantity,
        internal_lot_number: row.internal_lot_number ?? null,
        supplier_batch_number: row.raw_material_batch_number ?? null,
        production_date: batch.production_date ?? null,
        measured: resolved.measured,
      });
    }
  }

  const result = Array.from(groups.values());

  for (const group of result) {
    // Most recent first, because that is the useful order when reviewing a
    // date range. Ties fall back to the batch number for a stable order.
    group.uses.sort((a, b) => {
      const da = a.production_date ?? '';
      const db = b.production_date ?? '';
      if (da !== db) return db.localeCompare(da);
      return a.batch_number.localeCompare(b.batch_number);
    });
    group.batch_count = group.uses.length;
  }

  // Most used first: the useful default when reviewing a range.
  result.sort((a, b) => b.total_used - a.total_used);

  return result;
};

/**
 * Totals grouped by unit of measure.
 *
 * Deliberately NOT a single grand total: adding kilograms to "units" to
 * "litres" produces a number that means nothing. A factory that mixes kg and
 * units needs to see them separately, which is what this returns.
 */
export interface UsageTotalByUom {
  uom: string;
  total: number;
  materials: number;
}

export const summariseUsageByUom = (usage: readonly RawMaterialUsage[]): UsageTotalByUom[] => {
  const groups = new Map<string, UsageTotalByUom>();

  for (const row of usage) {
    const key = row.uom || '(no uom)';
    const existing = groups.get(key);
    if (existing) {
      existing.total += row.total_used;
      existing.materials += 1;
    } else {
      groups.set(key, { uom: key, total: row.total_used, materials: 1 });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.total - a.total);
};

