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

export const extractBestScanIdentifier = (rawInput: string): string => {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

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
