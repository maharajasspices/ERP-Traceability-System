// =====================================================================
// Missing backfill reservations (30 September 2026 physical count)
// =====================================================================
//
// One-off helper for a single historical event. The physical stock was
// COUNTED on 30 September 2026 but only ENTERED into the ERP on 2 October.
// Draft Batch Sheets created from 30 September onward were therefore planned
// against the counted position but never ran through the reservation system,
// so nothing was set aside for them.
//
// This computes WHICH reservations are missing and in WHAT quantities. It
// writes nothing: the caller applies the result through the existing
// `fms_reserve_batch_stock` RPC (per batch, with FIFO lot detail from
// `fms_fifo_allocate_lots`), exactly as Batch Sheet creation does.
//
// Effect of applying: `reserved_quantity` rises, so Net/Available
// (quantity_on_hand - reserved_quantity) falls. `quantity_on_hand` is
// NEVER touched by a reservation - that only moves when production starts
// (consume) or a batch is cancelled (release).
//
// Selection rules (each batch):
//   * status === 'draft' AND created_at >= cutoff  -> in scope
//   * status === 'cancelled'                       -> always ignored
//   * any other status                             -> out of scope
//   * batch already has a 'reserved'/'consumed' row -> skipped, so nothing
//     already reserved is ever duplicated.
//
// Quantity source:
//   `pre_weigh_materials[].required_quantity` - the BOM requirement stored
//   on the batch at creation. `quantity_weighed` is deliberately NOT used:
//   this is what the batch still needs set aside, not what was taken.
// =====================================================================

export const RECON_CUTOFF_ISO = '2026-09-30T00:00:00.000Z';

/** The parts of a batch this reconciliation needs. */
export interface ReconBatchLike {
  id: string;
  batch_number: string;
  status: string;
  created_at: string;
  pre_weigh_materials?: { material_id?: string; required_quantity?: number }[] | null;
}

/** The parts of a reservation row this reconciliation needs. */
export interface ReconReservationLike {
  batch_id: string;
  status: string;
}

/** One reservation line the apply step should create. */
export interface MissingReservationLine {
  batch_id: string;
  batch_number: string;
  stock_code_id: string;
  quantity: number;
}

export interface MissingReservationTotal {
  stock_code_id: string;
  quantity: number;
  batch_ids: string[];
}

export interface MissingReservationsResult {
  /** Draft batches from the cutoff onward with no active reservation. */
  batchIds: string[];
  /** Batches skipped because they already hold a reserved/consumed row. */
  skippedReservedBatchIds: string[];
  /** Per-batch, per-material lines to reserve. */
  lines: MissingReservationLine[];
  /** Per-material totals across all missing batches. */
  totals: MissingReservationTotal[];
}

const toNum = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Compute the missing backfill reservations for post-count drafts.
 *
 * Pure: no Supabase, no Date.now(), no side effects. `cutoffIso` defaults to
 * the 30 September 2026 count; a batch created exactly at the cutoff counts
 * as post-count (in scope).
 */
export const computeMissingReservations = (
  batches: readonly ReconBatchLike[],
  reservations: readonly ReconReservationLike[],
  cutoffIso: string = RECON_CUTOFF_ISO,
): MissingReservationsResult => {
  const reservedBatchIds = new Set<string>();
  for (const r of reservations) {
    if (r.status === 'reserved' || r.status === 'consumed') {
      reservedBatchIds.add(r.batch_id);
    }
  }

  const batchIds: string[] = [];
  const skippedReservedBatchIds: string[] = [];
  const lines: MissingReservationLine[] = [];
  const totals = new Map<string, { quantity: number; batchIds: string[] }>();

  for (const batch of batches) {
    if (batch.status !== 'draft') continue;
    if (!batch.created_at || batch.created_at < cutoffIso) continue;
    if (reservedBatchIds.has(batch.id)) {
      skippedReservedBatchIds.push(batch.id);
      continue;
    }

    batchIds.push(batch.id);

    const rows = batch.pre_weigh_materials ?? [];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row.material_id) continue;
      const qty = toNum(row.required_quantity);
      if (qty <= 0) continue;
      lines.push({
        batch_id: batch.id,
        batch_number: batch.batch_number,
        stock_code_id: row.material_id,
        quantity: qty,
      });
      const existing = totals.get(row.material_id);
      if (existing) {
        existing.quantity += qty;
        existing.batchIds.push(batch.id);
      } else {
        totals.set(row.material_id, { quantity: qty, batchIds: [batch.id] });
      }
    }
  }

  return {
    batchIds,
    skippedReservedBatchIds,
    lines,
    totals: Array.from(totals.entries()).map(([stock_code_id, t]) => ({
      stock_code_id,
      quantity: t.quantity,
      batch_ids: t.batchIds,
    })),
  };
};
