/**
 * Dedicated parser for the "Scan lot with TOVI..." input on the Receiving Log page.
 *
 * Intentionally SEPARATE from `scanParser.ts`, which serves the camera QR
 * scanner, BatchSheet, Dispatch and Traceability. Those flows are batch/dispatch
 * oriented and must keep resolving `PB-...` batch numbers, so they are untouched.
 *
 * A TOVI handheld scanner is a keyboard wedge: it types the payload into the
 * focused input then presses Enter. Payloads seen in the field are:
 *   1. a bare Maharaja internal lot number        e.g. `LOT-2026-0142`
 *   2. a lot number using slashes                  e.g. `LOT/2026/0142`
 *   3. a tag-delimited string                       e.g. `@internal_lot_number@>@LOT-2026-0142@`
 *   4. the JSON payload printed on a Receiving QR   e.g. `{"batch":"LOT-2026-0142","type":"receiving",...}`
 *   5. a JSON payload that is itself JSON-encoded   e.g. "{\"lot\":\"LOT-2026-0142\"}"
 *
 * Hard rule: the supplier's own batch number is NEVER returned as the lot
 * number. A Receiving QR must always resolve to the Maharaja internal lot.
 */

export type ToviScanSource =
  | 'empty'
  | 'lot-tag'
  | 'receiving-json'
  | 'lot-pattern'
  | 'plain'
  | 'unsupported';

export interface ToviScanResult {
  /** True when a usable Maharaja internal lot number was extracted. */
  ok: boolean;
  /** Normalized Maharaja internal lot number, e.g. `LOT-2026-0142`. */
  lotNumber: string | null;
  /** Comparison key for DB lookups: upper-cased, non-alphanumerics removed. */
  lotKey: string | null;
  /**
   * Supplier batch number, captured for display/matching only.
   * Informational - it is never returned as `lotNumber`.
   */
  supplierBatchNumber: string | null;
  source: ToviScanSource;
  /** The raw scanned string, echoed back for error messages. */
  raw: string;
}

const LOT_PATTERN = /LOT[-\/]\d{4}[-\/]\d{3,}/i;
const BATCH_PATTERN = /PB[-\/]\d{4}[-\/]\d{3,}/i;

/** Fields that carry the Maharaja internal lot number on a Receiving QR. */
const LOT_FIELDS = [
  'internal_lot_number',
  'lotNumber',
  'lot_number',
  'internalLotNumber',
  'lot',
] as const;

/** Fields that carry the supplier's own batch number. Never used as the lot. */
const SUPPLIER_BATCH_FIELDS = [
  'supplier_batch_number',
  'supplierBatchNumber',
  'supplier_batch',
  'supplierBatch',
] as const;

/**
 * Strip characters a wedge scanner adds around the payload and normalise
 * slashes to dashes so `LOT/2026/0142` and `LOT-2026-0142` compare equal.
 */
export const normalizeToviValue = (value: string): string =>
  value
    // zero-width / BOM characters some wedge firmware prepends
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()
    .replace(/\//g, '-')
    .replace(/\s+/g, ' ');

/**
 * Comparison key used to match a scanned value against
 * `fms_receiving.internal_lot_number`, tolerant of case, spacing and separators.
 */
export const toToviLotKey = (value: string | null | undefined): string =>
  normalizeToviValue(String(value ?? ''))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const readString = (
  source: Record<string, unknown>,
  keys: readonly string[],
): string | null => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
};

const buildResult = (
  raw: string,
  lotNumber: string | null,
  supplierBatchNumber: string | null,
  source: ToviScanSource,
): ToviScanResult => ({
  ok: Boolean(lotNumber),
  lotNumber,
  lotKey: lotNumber ? toToviLotKey(lotNumber) : null,
  supplierBatchNumber,
  source,
  raw,
});


/**
 * Pull a lot number out of a decoded JSON value. Handles the case where the
 * whole payload is a JSON string that itself contains JSON.
 */
const lotFromDecodedJson = (decoded: unknown): {
  lotNumber: string | null;
  supplierBatchNumber: string | null;
} => {
  if (typeof decoded === 'string') {
    // Double-encoded payload: unwrap once, then re-evaluate.
    const inner = decoded.trim();
    if (inner.startsWith('{') || inner.startsWith('[')) {
      try {
        return lotFromDecodedJson(JSON.parse(inner));
      } catch {
        /* not nested JSON - fall through to pattern matching */
      }
    }

    // A bare lot string carried inside a JSON string, e.g. "\"LOT-2026-0142\"".
    const match = inner.match(LOT_PATTERN);
    if (match) {
      return {
        lotNumber: normalizeToviValue(match[0]),
        supplierBatchNumber: null,
      };
    }
    return { lotNumber: null, supplierBatchNumber: null };
  }

  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    return { lotNumber: null, supplierBatchNumber: null };
  }

  const record = decoded as Record<string, unknown>;

  // Only lot-bearing fields are consulted for the lot number. `supplier_batch_number`
  // is read afterwards purely for display, so a Receiving QR can never resolve
  // to the supplier's batch instead of the Maharaja internal lot.
  const lot = readString(record, LOT_FIELDS);
  if (lot) {
    return {
      lotNumber: normalizeToviValue(lot),
      supplierBatchNumber: readString(record, SUPPLIER_BATCH_FIELDS),
    };
  }

  return {
    lotNumber: null,
    supplierBatchNumber: readString(record, SUPPLIER_BATCH_FIELDS),
  };
};

const decodeJson = (value: string): { decoded: unknown } | null => {
  const candidate = value.trim();
  if (
    !candidate.startsWith('{') &&
    !candidate.startsWith('[') &&
    !candidate.startsWith('"')
  ) {
    return null;
  }
  try {
    return { decoded: JSON.parse(candidate) };
  } catch {
    return null;
  }
};

/** Parse a raw TOVI scan into a normalized Maharaja internal lot number. */
export const parseToviScan = (rawInput: string): ToviScanResult => {
  const raw = typeof rawInput === 'string' ? rawInput : '';
  const trimmed = normalizeToviValue(raw);

  if (!trimmed) {
    return buildResult(raw, null, null, 'empty');
  }

  // 1. Tag-delimited payloads, e.g. `@internal_lot_number@>@LOT-2026-0142@`.
  const tagged = trimmed.match(
    /@(?:internal_lot_number|lotNumber|lot_number|lot)@>@([^@]+)@/i,
  );
  if (tagged?.[1]) {
    const value = normalizeToviValue(tagged[1]);
    const lot = value.match(LOT_PATTERN);
    return buildResult(
      raw,
      normalizeToviValue(lot ? lot[0] : value),
      null,
      'lot-tag',
    );
  }

  // 2. JSON payloads printed on a Receiving QR.
  const decoded = decodeJson(trimmed);
  if (decoded) {
    const { lotNumber, supplierBatchNumber } = lotFromDecodedJson(decoded.decoded);
    if (lotNumber) {
      return buildResult(raw, lotNumber, supplierBatchNumber, 'receiving-json');
    }
    return buildResult(raw, null, supplierBatchNumber, 'unsupported');
  }

  // 3. A lot number embedded in free text.
  const lotMatch = trimmed.match(LOT_PATTERN);
  if (lotMatch) {
    return buildResult(
      raw,
      normalizeToviValue(lotMatch[0]),
      null,
      'lot-pattern',
    );
  }

  // 4. A bare production batch number. Recognised so the caller can report a
  //    precise error, but deliberately NOT returned as a lot number.
  if (BATCH_PATTERN.test(trimmed)) {
    return buildResult(raw, null, null, 'unsupported');
  }

  // 5. Anything else is treated as a plain lot number as typed.
  return buildResult(raw, trimmed, null, 'plain');
};

export interface ToviLotMatch<T> {
  record: T;
  /** Whether the scan matched the internal lot number or the supplier batch. */
  matchedOn: 'internal_lot_number' | 'supplier_batch_number';
}

/**
 * Resolve a parsed scan against the receiving records.
 *
 * Matching is on the normalized key so `LOT/2026/0142`, `lot 2026 0142` and
 * `LOT-2026-0142` all hit the same row. The supplier batch is only consulted as
 * a fallback; when it matches, the record returned is still the Maharaja
 * receiving record keyed by its internal lot number.
 */
export const findReceivingRecordForToviScan = <T extends {
  internal_lot_number?: string | null;
  supplier_batch_number?: string | null;
}>(
  records: readonly T[],
  scan: ToviScanResult,
): ToviLotMatch<T> | null => {
  if (!scan.ok || !scan.lotKey) return null;

  const byInternalLot = records.find(
    (record) => toToviLotKey(record.internal_lot_number) === scan.lotKey,
  );
  if (byInternalLot) {
    return { record: byInternalLot, matchedOn: 'internal_lot_number' };
  }

  if (scan.supplierBatchNumber) {
    const supplierKey = toToviLotKey(scan.supplierBatchNumber);
    if (supplierKey) {
      const bySupplierBatch = records.find(
        (record) => toToviLotKey(record.supplier_batch_number) === supplierKey,
      );
      if (bySupplierBatch) {
        return { record: bySupplierBatch, matchedOn: 'supplier_batch_number' };
      }
    }
  }

  return null;
};

/** Convenience wrapper: parse and resolve in one call. */
export const resolveToviLot = <T extends {
  internal_lot_number?: string | null;
  supplier_batch_number?: string | null;
}>(
  records: readonly T[],
  rawInput: string,
): { scan: ToviScanResult; match: ToviLotMatch<T> | null } => {
  const scan = parseToviScan(rawInput);
  return { scan, match: findReceivingRecordForToviScan(records, scan) };
};
