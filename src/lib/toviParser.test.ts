import { describe, expect, it } from 'vitest';

import {
  normalizeToviValue,
  toToviLotKey,
  parseToviScan,
  findReceivingRecordForToviScan,
  resolveToviLot,
} from '@/lib/toviParser';
import { extractBestScanIdentifier } from '@/lib/scanParser';

interface ReceivingRow {
  id: string;
  internal_lot_number: string;
  supplier_batch_number?: string | null;
}

const records: ReceivingRow[] = [
  {
    id: 'r1',
    internal_lot_number: 'LOT-2026-0142',
    supplier_batch_number: 'SUP-99123',
  },
  {
    id: 'r2',
    internal_lot_number: 'LOT-2026-0200',
    supplier_batch_number: 'SUP-55555',
  },
  {
    id: 'r3',
    internal_lot_number: 'LOT-2025-0007',
    supplier_batch_number: null,
  },
];

/** Payload exactly as produced by handlePrintQRCode in ReceivingLog.tsx. */
const receivingQrPayload = JSON.stringify({
  batch: 'LOT-2026-0142',
  type: 'receiving',
  receivingId: 'r1',
  lotNumber: 'LOT-2026-0142',
  stockCode: 'CUM-001',
  stockCodeId: 'sc-1',
  materialDescription: 'Cumin Powder',
  supplierBatch: 'SUP-99123',
  supplierName: 'Spice World',
  expiryDate: '2027-01-01',
  quantity: '25',
  generated: '2026-01-05T08:00:00.000Z',
});

describe('normalizeToviValue', () => {
  it('trims whitespace and converts slashes to dashes', () => {
    expect(normalizeToviValue('  LOT/2026/0142  ')).toBe('LOT-2026-0142');
  });

  it('strips surrounding quotes added by the wedge', () => {
    expect(normalizeToviValue('"LOT-2026-0142"')).toBe('LOT-2026-0142');
  });

  it('strips zero-width characters some firmware prepends', () => {
    expect(normalizeToviValue('\u200BLOT-2026-0142')).toBe('LOT-2026-0142');
  });
});

describe('toToviLotKey', () => {
  it('is case, spacing and separator insensitive', () => {
    expect(toToviLotKey('LOT-2026-0142')).toBe('LOT20260142');
    expect(toToviLotKey('lot 2026 0142')).toBe('LOT20260142');
    expect(toToviLotKey('lot/2026/0142')).toBe('LOT20260142');
  });

  it('returns an empty key for null/undefined', () => {
    expect(toToviLotKey(null)).toBe('');
    expect(toToviLotKey(undefined)).toBe('');
  });
});

describe('parseToviScan', () => {
  it('parses a bare internal lot number', () => {
    const result = parseToviScan('LOT-2026-0142');
    expect(result.ok).toBe(true);
    expect(result.lotNumber).toBe('LOT-2026-0142');
    // A bare lot still matches LOT_PATTERN, so it is reported as lot-pattern.
    expect(result.source).toBe('lot-pattern');
  });

  it('parses a slash-separated lot number', () => {
    const result = parseToviScan('LOT/2026/0142');
    expect(result.ok).toBe(true);
    expect(result.lotNumber).toBe('LOT-2026-0142');
  });

  it('parses a tag-delimited payload', () => {
    const result = parseToviScan('@internal_lot_number@>@LOT-2026-0142@');
    expect(result.ok).toBe(true);
    expect(result.lotNumber).toBe('LOT-2026-0142');
    expect(result.source).toBe('lot-tag');
  });

  it('extracts the lot number from a Receiving QR JSON payload', () => {
    const result = parseToviScan(receivingQrPayload);
    expect(result.ok).toBe(true);
    expect(result.lotNumber).toBe('LOT-2026-0142');
    expect(result.source).toBe('receiving-json');
  });

  it('never returns the supplier batch as the lot number', () => {
    const result = parseToviScan(receivingQrPayload);
    expect(result.lotNumber).not.toBe('SUP-99123');
    // The supplier batch is still surfaced for display/matching only.
    expect(result.supplierBatchNumber).toBe('SUP-99123');
  });

  it('ignores supplier batch when a lot field is absent', () => {
    const result = parseToviScan(
      JSON.stringify({ supplierBatch: 'SUP-99123', type: 'receiving' }),
    );
    expect(result.ok).toBe(false);
    expect(result.lotNumber).toBeNull();
    expect(result.supplierBatchNumber).toBe('SUP-99123');
  });

  it('unwraps a double-encoded JSON payload', () => {
    const inner = JSON.stringify({ lot: 'LOT-2026-0142' });
    const result = parseToviScan(JSON.stringify(inner));
    expect(result.ok).toBe(true);
    expect(result.lotNumber).toBe('LOT-2026-0142');
  });

  it('finds a lot number embedded in surrounding text', () => {
    const result = parseToviScan('Maharaja LOT-2026-0142 received');
    expect(result.ok).toBe(true);
    expect(result.lotNumber).toBe('LOT-2026-0142');
    expect(result.source).toBe('lot-pattern');
  });

  it('rejects a production batch number instead of treating it as a lot', () => {
    const result = parseToviScan('PB-2026-0123');
    expect(result.ok).toBe(false);
    expect(result.lotNumber).toBeNull();
    expect(result.source).toBe('unsupported');
  });

  it('reports an empty scan', () => {
    const result = parseToviScan('   ');
    expect(result.ok).toBe(false);
    expect(result.source).toBe('empty');
  });
});

describe('findReceivingRecordForToviScan', () => {
  it('matches the record by internal lot number', () => {
    const match = findReceivingRecordForToviScan(records, parseToviScan('LOT-2026-0142'));
    expect(match?.record.id).toBe('r1');
    expect(match?.matchedOn).toBe('internal_lot_number');
  });

  it('matches case-insensitively and across separators', () => {
    const match = findReceivingRecordForToviScan(records, parseToviScan('lot 2026 0200'));
    expect(match?.record.id).toBe('r2');
  });

  it('matches a Receiving QR JSON payload to the internal lot record', () => {
    const match = findReceivingRecordForToviScan(records, parseToviScan(receivingQrPayload));
    expect(match?.record.id).toBe('r1');
    expect(match?.record.internal_lot_number).toBe('LOT-2026-0142');
  });

  it('falls back to the supplier batch and still returns the internal lot', () => {
    const payload = JSON.stringify({ lot: 'LOT-9999-0001', supplierBatch: 'SUP-55555' });
    const match = findReceivingRecordForToviScan(records, parseToviScan(payload));
    expect(match?.matchedOn).toBe('supplier_batch_number');
    expect(match?.record.internal_lot_number).toBe('LOT-2026-0200');
  });

  it('returns null when the lot is unknown', () => {
    const match = findReceivingRecordForToviScan(records, parseToviScan('LOT-2030-9999'));
    expect(match).toBeNull();
  });

  it('returns null for an unparseable scan', () => {
    const match = findReceivingRecordForToviScan(records, parseToviScan('PB-2026-0123'));
    expect(match).toBeNull();
  });
});

describe('resolveToviLot', () => {
  it('parses and resolves in one call', () => {
    const { scan, match } = resolveToviLot(records, receivingQrPayload);
    expect(scan.lotNumber).toBe('LOT-2026-0142');
    expect(match?.record.id).toBe('r1');
  });
});

describe('extractBestScanIdentifier - Receiving QR supplier-batch override', () => {
  it('returns the internal lot, not the supplier batch, for a Receiving QR', () => {
    const result = extractBestScanIdentifier(receivingQrPayload);
    expect(result).toBe('LOT-2026-0142');
    expect(result).not.toBe('SUP-99123');
  });

  it('returns the internal lot for the download-QR payload shape', () => {
    const payload = JSON.stringify({
      lot: 'LOT-2026-0200',
      stockCode: 'CUM-001',
      material: 'Cumin Powder',
    });
    expect(extractBestScanIdentifier(payload)).toBe('LOT-2026-0200');
  });

  it('still returns a production PB batch for BatchSheet QR payloads', () => {
    const payload = JSON.stringify({
      batch: 'PB-2026-0123',
      productId: 'fg-1',
      productName: 'Cumin Powder',
    });
    expect(extractBestScanIdentifier(payload)).toBe('PB-2026-0123');
  });

  it('leaves dispatch QR payloads on their existing code path', () => {
    // `invoiceNumber` is not a recognised field, so this payload has always
    // fallen through to the normalized raw string. Unchanged by the override.
    const payload = JSON.stringify({
      type: 'dispatch',
      invoiceNumber: 'INV-202601-0007',
      customerName: 'Pick n Pay',
    });
    expect(extractBestScanIdentifier(payload)).toBe(
      JSON.stringify({
        type: 'dispatch',
        invoiceNumber: 'INV-202601-0007',
        customerName: 'Pick n Pay',
      }),
    );
  });

  it('returns the internal lot when the supplier batch looks like a PB batch', () => {
    // Regression: `extractBatchNumberFromScan` scans the raw text for a
    // `PB-...` pattern. When a supplier batch matches that shape it used to be
    // returned instead of the Maharaja internal lot.
    const payload = JSON.stringify({
      batch: 'LOT-2026-0142',
      type: 'receiving',
      lotNumber: 'LOT-2026-0142',
      supplierBatch: 'PB-2026-0123',
    });
    expect(extractBestScanIdentifier(payload)).toBe('LOT-2026-0142');
  });

  it('still resolves a bare PB batch typed by the user', () => {
    expect(extractBestScanIdentifier('PB-2026-0123')).toBe('PB-2026-0123');
  });
});
