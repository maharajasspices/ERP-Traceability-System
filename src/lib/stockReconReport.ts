// =====================================================================
// Stock reconciliation report: 2 Oct -> 7 Oct (one-off, READ-ONLY).
// Per raw material, exactly three figures:
//   StockEntered (receiving log, accepted receipts 2026-10-02..2026-10-07)
//   Used        (Batch Sheets 30 Sep .. 7 Oct by batch created_at)
//   ShouldBeLeft = StockEntered - Used
// Usage source (per batch+material key, first source that reports wins,
// never summed across sources): batch_usage stock movements first
// (physical consumption, carries stock_code_id directly), then
// fms_materials_used (lot-level), then quantity_weighed; BOM-only
// required_quantity is never counted as used.
// RAW MATERIALS ONLY (stock_code LIKE 'RM%' AND item_type='raw_material').
// Every raw material gets a row, even with no activity in range.
// Cancelled batches excluded. Pure: no Supabase, no Date.now(), no writes.
// =====================================================================

export const ENTRY_WINDOW_START = '2026-10-02';
export const ENTRY_WINDOW_END = '2026-10-07';
export const USAGE_WINDOW_START_ISO = '2026-09-30T00:00:00.000Z';
export const USAGE_WINDOW_END_ISO = '2026-10-07T23:59:59.999Z';

export interface ReconStockCodeLike {
  id: string;
  stock_code: string;
  description: string;
  item_type: string;
  unit_of_measure: string;
}

export interface ReconReceivingLike {
  stock_code_id: string;
  quantity_received: number;
  /** Receipt timestamp; `created_at` is used only when this is empty. */
  received_at: string;
  status: string;
  /** Fallback timestamp for rows where `received_at` is empty. */
  created_at?: string | null;
}

export interface ReconUsageBatchLike {
  id: string;
  batch_number: string;
  status: string;
  created_at: string;
  pre_weigh_materials?: { material_id?: string; required_quantity?: number; quantity_weighed?: number | null }[] | null;
}

export interface ReconMaterialsUsedLike {
  batch_id: string;
  receiving_record_id: string | null;
  quantity_used: number;
}

/** One fms_stock_movements row (only movement_type='batch_usage' is read). */
export interface ReconStockMovementLike {
  batch_id: string | null;
  stock_code_id: string;
  movement_type: string;
  quantity_change: number;
}

export interface ReconReportRow {
  stock_code_id: string;
  stock_code: string;
  description: string;
  uom: string;
  stockEntered: number;
  used: number;
  shouldBeLeft: number;
  batches: string[];
}

const toNum = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// Window boundaries as UTC instants (both ends inclusive):
//   receipts 2026-10-02T00:00:00.000Z .. 2026-10-07T23:59:59.999Z
//   usage    2026-09-30T00:00:00.000Z .. 2026-10-07T23:59:59.999Z
const ENTRY_START_MS = Date.parse(`${ENTRY_WINDOW_START}T00:00:00.000Z`);
const ENTRY_END_MS = Date.parse(`${ENTRY_WINDOW_END}T23:59:59.999Z`);
const USAGE_START_MS = Date.parse(USAGE_WINDOW_START_ISO);
const USAGE_END_MS = Date.parse(USAGE_WINDOW_END_ISO);

const isRawMaterial = (sc: ReconStockCodeLike): boolean =>
  sc.item_type === 'raw_material' && sc.stock_code.startsWith('RM');

/**
 * Build the per-raw-material reconciliation rows.
 * `receivingIdToStockCodeId` resolves fms_materials_used rows (which point
 * at lots, not stock codes) to their material. Unknown lots are ignored,
 * never guessed.
 *
 * Usage sources, in precedence order per batch+material key (the first
 * source that reports for a key wins; sources are never summed together,
 * because fms_consume_batch_reservations writes BOTH a batch_usage
 * movement and a fms_materials_used row for the same consumption):
 *   1. fms_stock_movements with movement_type='batch_usage'
 *      (physical stock deduction; carries stock_code_id directly, so it
 *      counts even when a lot cannot be resolved)
 *   2. fms_materials_used (lot-level traceability)
 *   3. pre_weigh_materials[].quantity_weighed (Batch Sheet evidence).
 *      BOM-only required_quantity is never counted as used.
 *
 * Every raw material (RM... AND item_type='raw_material') gets a row, even
 * when neither column has activity, so the report covers the full scope.
 */
export const computeStockReconReport = (
  stockCodes: readonly ReconStockCodeLike[],
  receivings: readonly ReconReceivingLike[],
  batches: readonly ReconUsageBatchLike[],
  materialsUsed: readonly ReconMaterialsUsedLike[],
  receivingIdToStockCodeId: (receivingRecordId: string | null) => string | null,
  movements: readonly ReconStockMovementLike[] = [],
): ReconReportRow[] => {
  const rawIds = new Set<string>();
  const meta = new Map<string, ReconStockCodeLike>();
  for (const sc of stockCodes) {
    if (isRawMaterial(sc)) {
      rawIds.add(sc.id);
      meta.set(sc.id, sc);
    }
  }

  interface Acc {
    stockEntered: number;
    used: number;
    batches: Set<string>;
  }
  const acc = new Map<string, Acc>();
  const get = (id: string): Acc => {
    let a = acc.get(id);
    if (!a) {
      a = { stockEntered: 0, used: 0, batches: new Set() };
      acc.set(id, a);
    }
    return a;
  };

  // Seed every raw material so the report always shows the full RM scope,
  // even for materials with no receipts and no usage in range.
  for (const id of rawIds) get(id);

  // 1) Stock entered: accepted receipts dated 2 Oct .. 7 Oct inclusive.
  for (const r of receivings) {
    if (!rawIds.has(r.stock_code_id)) continue;
    if (r.status !== 'accepted') continue;

    const qty = toNum(r.quantity_received);
    if (qty <= 0) continue;

    const receivedMs = Date.parse(r.received_at || r.created_at || '');
    if (!Number.isFinite(receivedMs)) continue;
    if (receivedMs < ENTRY_START_MS || receivedMs > ENTRY_END_MS) continue;

    const a = get(r.stock_code_id);
    a.stockEntered += qty;
  }
  // 2) Used: batches created 30 Sep .. 7 Oct (inclusive UTC instants),
  //    cancelled excluded.
  const inWindow = new Map<string, ReconUsageBatchLike>();
  for (const b of batches) {
    if (b.status === 'cancelled') continue;
    if (!b.created_at) continue;
    const createdMs = Date.parse(b.created_at);
    if (!Number.isFinite(createdMs)) continue;
    if (createdMs < USAGE_START_MS || createdMs > USAGE_END_MS) continue;
    inWindow.set(b.id, b);
  }

  // Tier 1 (physical): batch_usage stock movements for in-window batches.
  // fms_consume_batch_reservations writes one movement per consumed lot,
  // so several movements can share a batch+material key - sum them, and
  // mark the key covered so tiers 2/3 never double count it.
  const covered = new Set<string>();
  for (const mv of movements) {
    if (mv.movement_type !== 'batch_usage') continue;
    if (!mv.batch_id) continue;
    const batch = inWindow.get(mv.batch_id);
    if (!batch) continue;
    if (!rawIds.has(mv.stock_code_id)) continue;
    const qty = Math.abs(toNum(mv.quantity_change));
    if (qty <= 0) continue;
    const key = `${mv.batch_id}::${mv.stock_code_id}`;
    covered.add(key);
    const a = get(mv.stock_code_id);
    a.used += qty;
    a.batches.add(batch.batch_number);
  }

  // Tier 2: fms_materials_used rows (lot-level) for keys the movements did
  // not cover. Unknown lots are ignored, never guessed. Several lots of the
  // same material in one batch all count (they sum); the keys are only
  // sealed afterwards so tier 3 cannot double count them.
  const lotCovered = new Set<string>();
  for (const mu of materialsUsed) {
    const batch = inWindow.get(mu.batch_id);
    if (!batch) continue;
    const stockCodeId = receivingIdToStockCodeId(mu.receiving_record_id);
    if (!stockCodeId || !rawIds.has(stockCodeId)) continue;
    const qty = toNum(mu.quantity_used);
    if (qty <= 0) continue;
    const key = `${mu.batch_id}::${stockCodeId}`;
    if (covered.has(key)) continue;
    lotCovered.add(key);
    const a = get(stockCodeId);
    a.used += qty;
    a.batches.add(batch.batch_number);
  }
  for (const key of lotCovered) covered.add(key);

  // Tier 3: Batch Sheet evidence where no actual consumption record
  // covers the batch + material key. Only the operator-entered
  // quantity_weighed counts: a BOM-only required_quantity is a plan, not
  // actual usage, and is never counted.
  for (const batch of inWindow.values()) {
    const rows = batch.pre_weigh_materials ?? [];
    if (!Array.isArray(rows)) continue;

    for (const row of rows) {
      if (!row.material_id || !rawIds.has(row.material_id)) continue;

      const key = `${batch.id}::${row.material_id}`;

      // Actual consumption already exists for this batch + material.
      // Do not add the Batch Sheet amount again.
      if (covered.has(key)) continue;

      const used = toNum(row.quantity_weighed);

      if (used <= 0) continue;

      const a = get(row.material_id);
      a.used += used;
      a.batches.add(batch.batch_number);

      // Prevent another row for the same batch + material from
      // being counted twice.
      covered.add(key);
    }
  }

  const out: ReconReportRow[] = [];

  // One row per raw material, including ones with no activity in range
  // (every RM id is pre-seeded into `acc` above).
  for (const [id, a] of acc) {
    if (!rawIds.has(id)) continue;

    const m = meta.get(id)!;

    out.push({
      stock_code_id: id,
      stock_code: m.stock_code,
      description: m.description,
      uom: m.unit_of_measure || '',
      stockEntered: a.stockEntered,
      used: a.used,
      shouldBeLeft: a.stockEntered - a.used,
      batches: Array.from(a.batches).sort(),
    });
  }

  out.sort((x, y) => x.stock_code.localeCompare(y.stock_code));
  return out;
};
