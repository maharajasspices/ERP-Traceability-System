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
