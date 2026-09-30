export const normalizeScannedValue = (value: string): string => value.trim().replace(/\//g, '-');

const BATCH_PATTERN = /PB[-\/]\d{4}[-\/]\d{3,}/i;
const LOT_PATTERN = /LOT[-\/]\d{4}[-\/]\d{3,}/i;

export const extractBatchNumberFromScan = (rawInput: string): string | null => {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const directBatch = trimmed.match(/@batch@>@([^@]+)@/i);
  if (directBatch?.[1]) return normalizeScannedValue(directBatch[1]);

  const anyBatchField = trimmed.match(/@(?:batch|batchNumber|batch_number|lotNumber|lot_number|internal_lot_number)@>@([^@]+)@/i);
  if (anyBatchField?.[1]) {
    const value = normalizeScannedValue(anyBatchField[1]);
    const fromValue = value.match(BATCH_PATTERN);
    return fromValue ? normalizeScannedValue(fromValue[0]) : value;
  }

  const batchMatch = trimmed.match(BATCH_PATTERN);
  if (batchMatch) return normalizeScannedValue(batchMatch[0]);

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      const inner = parsed.match(BATCH_PATTERN);
      return inner ? normalizeScannedValue(inner[0]) : normalizeScannedValue(parsed);
    }

    if (parsed && typeof parsed === 'object') {
      const fields = ['batch', 'batchNumber', 'batch_number', 'lotNumber', 'lot_number', 'internal_lot_number'];
      for (const field of fields) {
        const value = (parsed as Record<string, unknown>)[field];
        if (typeof value === 'string' && value.trim()) {
          const normalized = normalizeScannedValue(value);
          const inner = normalized.match(BATCH_PATTERN);
          return inner ? normalizeScannedValue(inner[0]) : normalized;
        }
      }

      const serialized = JSON.stringify(parsed);
      const serializedMatch = serialized.match(BATCH_PATTERN);
      if (serializedMatch) return normalizeScannedValue(serializedMatch[0]);
    }
  } catch {
    // Not JSON
  }

  return null;
};

/**
 * Field priority for a Receiving QR payload.
 *
 * A receiving label carries BOTH the Maharaja internal lot and the supplier's
 * own batch, so the internal lot must be resolved first. `supplier_batch_number`
 * is intentionally last: it is only used when a payload has no internal lot at
 * all, so a Receiving QR always resolves to the Maharaja internal lot number.
 */
const RECEIVING_LOT_FIELDS = [
  'internal_lot_number',
  'internalLotNumber',
  'lot',
  'lotNumber',
  'lot_number',
];

/**
 * If the scan is a JSON payload carrying a Maharaja internal lot, return it.
 * Returns null for non-JSON input or payloads without a lot field, leaving the
 * normal batch/lot resolution to proceed unchanged.
 */
const extractInternalLotFromJson = (rawInput: string): string | null => {
  const trimmed = rawInput.trim();
  if (!trimmed.startsWith('{')) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const record = parsed as Record<string, unknown>;
  for (const field of RECEIVING_LOT_FIELDS) {
    const value = record[field];
    if (typeof value === 'string' && value.trim()) {
      return normalizeScannedValue(value);
    }
  }

  return null;
};

export const extractBestScanIdentifier = (rawInput: string): string => {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  /**
   * Receiving-QR override: run BEFORE `extractBatchNumberFromScan`, which scans
   * the raw text for a `PB-...` pattern and would otherwise match the
   * `supplierBatch` value embedded in a receiving payload and return the
   * supplier's batch number instead of the Maharaja internal lot.
   */
  const internalLot = extractInternalLotFromJson(trimmed);
  if (internalLot) return internalLot;

  const batch = extractBatchNumberFromScan(trimmed);
  if (batch) return batch;

  const lotMatch = trimmed.match(LOT_PATTERN);
  if (lotMatch) return normalizeScannedValue(lotMatch[0]);

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      return normalizeScannedValue(parsed);
    }

    if (parsed && typeof parsed === 'object') {
      const fields = [
        'internal_lot_number',
        'lot',
        'lotNumber',
        'lot_number',
        'supplier_batch_number',
        'supplierBatchNumber',
        'batch',
        'batchNumber',
        'batch_number',
      ];

      for (const field of fields) {
        const value = (parsed as Record<string, unknown>)[field];
        if (typeof value === 'string' && value.trim()) {
          return normalizeScannedValue(value);
        }
      }
    }
  } catch {
    // Not JSON
  }

  return normalizeScannedValue(trimmed);
};

// =====================================================================
// DISPATCH SCAN RESOLUTION
// =====================================================================
//
// Used by the Dispatch packing flow. Unlike `extractBestScanIdentifier`,
// this NEVER returns a raw, unrecognised string: an unknown code resolves to
// `kind: 'unknown'`, which the caller must reject. That is what stops a
// mis-read label from silently increasing a dispatch quantity.
//
// Two recognised shapes, in priority order:
//   1. A production batch  - the existing Batch Sheet QR payload
//                           ({"batch":"PB-2026-00012", ...}), or a bare
//                           / tag-delimited PB-... value.
//   2. A product/stock code - a 1D barcode or a typed stock code, matched
//                           EXACTLY (case/separator insensitive). No fuzzy
//                           matching: a partial code must never bind to a
//                           product, or a mis-scan becomes a wrong pick.
// =====================================================================

export type DispatchScanKind = 'batch' | 'product' | 'unknown';

export interface DispatchScanResult {
  kind: DispatchScanKind;
  /** `fms_production_batches.batch_number` when kind === 'batch'. */
  batchNumber: string | null;
  /** `fms_stock_codes.stock_code` when kind === 'product'. */
  stockCode: string | null;
  /** The raw decoded scan, kept only for error messages. */
  raw: string;
}

export interface DispatchScanLookup {
  /** Batch numbers available to this dispatch (fms_production_batches). */
  batchNumbers: readonly string[];
  /** Stock codes that exist in the ERP (fms_stock_codes). */
  stockCodes: readonly string[];
}

/** Case/separator-insensitive comparison key: `pb 2026 00012` -> `PB202600012`. */
const scanKey = (value: string): string =>
  normalizeScannedValue(String(value ?? ''))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

/**
 * Resolve a raw TOVI / camera scan for a Dispatch.
 *
 * @example
 * resolveDispatchScan(scan, lookup)
 * // Batch Sheet QR  -> { kind: 'batch',   batchNumber: 'PB-2026-00012' }
 * // 1D product code -> { kind: 'product', stockCode: 'CUM-001' }
 * // anything else   -> { kind: 'unknown' }
 */
export const resolveDispatchScan = (
  rawInput: string,
  lookup: DispatchScanLookup,
): DispatchScanResult => {
  const raw = typeof rawInput === 'string' ? rawInput : '';
  const trimmed = raw.trim();
  const empty: DispatchScanResult = { kind: 'unknown', batchNumber: null, stockCode: null, raw };
  if (!trimmed) return empty;

  const batchByKey = new Map(lookup.batchNumbers.map((b) => [scanKey(b), b] as const));
  const productByKey = new Map(lookup.stockCodes.map((s) => [scanKey(s), s] as const));

  /** Exact lookup of a candidate string against both namespaces. */
  const classify = (candidate: string): DispatchScanResult | null => {
    const key = scanKey(candidate);
    if (!key) return null;

    const batch = batchByKey.get(key);
    if (batch) {
      return { kind: 'batch', batchNumber: batch, stockCode: null, raw };
    }

    const product = productByKey.get(key);
    if (product) {
      return { kind: 'product', batchNumber: null, stockCode: product, raw };
    }

    return null;
  };

  // 1. The existing Batch Sheet QR / tag-delimited / bare PB-... handling.
  const batchCandidate = extractBatchNumberFromScan(trimmed);
  if (batchCandidate) {
    const hit = classify(batchCandidate);
    if (hit) return hit;
    // A syntactically valid PB batch that is not on this dispatch: report it
    // as a batch so the caller can say "that batch is not on this dispatch"
    // rather than the useless "unrecognised code".
    return { kind: 'batch', batchNumber: batchCandidate, stockCode: null, raw };
  }

  // 2. JSON payload that carries a stock code but no batch (e.g. a
  //    product label). Only consulted when the payload is clearly JSON.
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const field of ['stockCode', 'stock_code', 'productCode', 'product_code', 'sku']) {
          const value = parsed[field];
          if (typeof value === 'string' && value.trim()) {
            const hit = classify(value);
            if (hit) return hit;
          }
        }
      }
    } catch {
      // Not JSON - fall through to the plain-value check below.
    }
  }

  // 3. A 1D barcode or a hand-typed product code, matched EXACTLY.
  const direct = classify(trimmed);
  if (direct) return direct;

  return empty;
};

