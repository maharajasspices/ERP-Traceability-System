import { describe, expect, it } from 'vitest';

import {
  aggregateRequirements,
  dispatchProgress,
  findScannableLine,
  isDispatchComplete,
  isLineComplete,
  remainingOnLine,
  type DispatchRequirementLike,
} from '@/lib/dispatchRequirements';
import { resolveDispatchScan } from '@/lib/scanParser';

const line = (
  id: string,
  stock_code_id: string,
  stock_code: string,
  quantity_required: number,
  quantity_scanned = 0,
  invoice_number: string | null = 'INV-1',
): DispatchRequirementLike => ({
  id,
  stock_code_id,
  stock_code,
  description: stock_code,
  uom: 'units',
  invoice_number,
  quantity_required,
  quantity_scanned,
});

/** A dispatch invoicing 3 CUM-001 and 2 PAP-002, all still to scan. */
const freshDispatch = () => [
  line('r1', 'sc-cum', 'CUM-001', 3),
  line('r2', 'sc-pap', 'PAP-002', 2),
];

const lookup = {
  batchNumbers: ['PB-2026-00012', 'PB-2026-00099'],
  stockCodes: ['CUM-001', 'PAP-002', 'TAR-003'],
};

describe('remainingOnLine / isLineComplete', () => {
  it('computes the outstanding quantity', () => {
    expect(remainingOnLine(line('a', 'x', 'X', 5))).toBe(5);
    expect(remainingOnLine(line('a', 'x', 'X', 5, 2))).toBe(3);
    expect(remainingOnLine(line('a', 'x', 'X', 5, 5))).toBe(0);
  });

  it('never reports a negative remainder on an over-scanned line', () => {
    expect(remainingOnLine(line('a', 'x', 'X', 5, 7))).toBe(0);
  });

  it('treats a fully scanned line as complete', () => {
    expect(isLineComplete(line('a', 'x', 'X', 5, 4))).toBe(false);
    expect(isLineComplete(line('a', 'x', 'X', 5, 5))).toBe(true);
  });
});

describe('findScannableLine - the over-scan gate', () => {
  it('returns the outstanding line for a product that still owes quantity', () => {
    const reqs = freshDispatch();
    expect(findScannableLine(reqs, 'sc-cum')?.id).toBe('r1');
  });

  it('returns null once the invoiced quantity is met (extra scan is a no-op)', () => {
    const reqs = [line('r1', 'sc-cum', 'CUM-001', 3, 3)];
    expect(findScannableLine(reqs, 'sc-cum')).toBeNull();
  });

  it('returns null for a product that is not on the invoice at all', () => {
    expect(findScannableLine(freshDispatch(), 'sc-tar')).toBeNull();
  });

  it('spills onto the next invoice line for the same product', () => {
    // 2 on invoice A (already scanned) and 3 on invoice B, still outstanding.
    const reqs = [
      line('r1', 'sc-cum', 'CUM-001', 2, 2, 'INV-A'),
      line('r2', 'sc-cum', 'CUM-001', 3, 0, 'INV-B'),
    ];
    expect(findScannableLine(reqs, 'sc-cum')?.id).toBe('r2');
  });
});

describe('aggregateRequirements', () => {
  it('sums the same product across several grouped invoices', () => {
    const reqs = [
      line('r1', 'sc-cum', 'CUM-001', 2, 1, 'INV-A'),
      line('r2', 'sc-cum', 'CUM-001', 3, 1, 'INV-B'),
    ];
    const [row] = aggregateRequirements(reqs);
    expect(row.quantity_required).toBe(5);
    expect(row.quantity_scanned).toBe(2);
    expect(row.remaining).toBe(3);
    expect(row.invoice_numbers).toEqual(['INV-A', 'INV-B']);
    expect(row.lines).toHaveLength(2);
  });

  it('keeps distinct products on separate rows', () => {
    expect(aggregateRequirements(freshDispatch())).toHaveLength(2);
  });
});

describe('isDispatchComplete / dispatchProgress', () => {
  it('is not complete while anything is outstanding', () => {
    expect(isDispatchComplete(freshDispatch())).toBe(false);
  });

  it('is complete only when every line is fulfilled', () => {
    const reqs = [line('r1', 'sc-cum', 'CUM-001', 3, 3), line('r2', 'sc-pap', 'PAP-002', 2, 2)];
    expect(isDispatchComplete(reqs)).toBe(true);
  });

  it('is not complete for a dispatch with no lines', () => {
    expect(isDispatchComplete([])).toBe(false);
  });

  it('reports required, scanned and remaining totals', () => {
    const reqs = [line('r1', 'sc-cum', 'CUM-001', 3, 2), line('r2', 'sc-pap', 'PAP-002', 2, 0)];
    expect(dispatchProgress(reqs)).toMatchObject({
      quantity_required: 5,
      quantity_scanned: 2,
      remaining: 3,
      linesComplete: 0,
      linesTotal: 2,
    });
  });
});

describe('resolveDispatchScan', () => {
  it('resolves the existing Batch Sheet QR to the exact production batch', () => {
    // This is the payload shape printed by BatchSheet.handlePrintQRCode.
    const payload = JSON.stringify({
      batch: 'PB-2026-00012',
      productId: 'sc-cum',
      productName: 'Cumin Powder',
      plannedSize: 25,
      productionDate: '2026-09-01',
      generated: '2026-09-01T08:00:00.000Z',
    });
    const result = resolveDispatchScan(payload, lookup);
    expect(result.kind).toBe('batch');
    expect(result.batchNumber).toBe('PB-2026-00012');
  });

  it('resolves a bare batch number', () => {
    const result = resolveDispatchScan('PB-2026-00099', lookup);
    expect(result.kind).toBe('batch');
    expect(result.batchNumber).toBe('PB-2026-00099');
  });

  it('resolves a tag-delimited batch payload', () => {
    const result = resolveDispatchScan('@batch@>@PB-2026-00012@', lookup);
    expect(result.batchNumber).toBe('PB-2026-00012');
  });

  it('resolves a 1D product barcode to its stock code', () => {
    const result = resolveDispatchScan('CUM-001', lookup);
    expect(result.kind).toBe('product');
    expect(result.stockCode).toBe('CUM-001');
  });

  it('ignores case and separator differences on a product code', () => {
    expect(resolveDispatchScan('  cum/001 ', lookup).stockCode).toBe('CUM-001');
  });

  it('resolves a product label JSON that carries a stock code', () => {
    const result = resolveDispatchScan(JSON.stringify({ stockCode: 'PAP-002' }), lookup);
    expect(result.kind).toBe('product');
    expect(result.stockCode).toBe('PAP-002');
  });

  it('reports an unknown code as unknown rather than passing it through', () => {
    const result = resolveDispatchScan('6001234567892', lookup);
    expect(result.kind).toBe('unknown');
    expect(result.batchNumber).toBeNull();
    expect(result.stockCode).toBeNull();
  });

  it('does NOT fuzzy match a partial product code onto a real product', () => {
    // The old Dispatch fuzzy matcher would have bound these onto real records.
    expect(resolveDispatchScan('CUM', lookup).kind).toBe('unknown');
    expect(resolveDispatchScan('PB-2026', lookup).kind).toBe('unknown');
  });

  it('still reports a well-formed but unknown batch as a batch', () => {
    // Lets the UI say "that batch is not available" instead of "unrecognised".
    const result = resolveDispatchScan('PB-2027-99999', lookup);
    expect(result.kind).toBe('batch');
    expect(result.batchNumber).toBe('PB-2027-99999');
  });

  it('returns unknown for an empty scan', () => {
    expect(resolveDispatchScan('   ', lookup).kind).toBe('unknown');
  });
});
