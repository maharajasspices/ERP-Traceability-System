import { describe, expect, it } from 'vitest';

import {
  computeStockReconReport,
  ENTRY_WINDOW_START,
  ENTRY_WINDOW_END,
  USAGE_WINDOW_START_ISO,
  USAGE_WINDOW_END_ISO,
  type ReconStockCodeLike,
  type ReconReceivingLike,
  type ReconUsageBatchLike,
  type ReconMaterialsUsedLike,
  type ReconStockMovementLike,
} from '@/lib/stockReconReport';


const RM_A = 'sc-rm-a';
const RM_B = 'sc-rm-b';

const stockCodes: ReconStockCodeLike[] = [
  { id: RM_A, stock_code: 'RM001', description: 'Flour', item_type: 'raw_material', unit_of_measure: 'kg' },
  { id: RM_B, stock_code: 'RM002', description: 'Sugar', item_type: 'raw_material', unit_of_measure: 'kg' },
  { id: 'sc-pk', stock_code: 'PK001', description: 'Box', item_type: 'packaging', unit_of_measure: 'units' },
  { id: 'sc-xx', stock_code: 'XX001', description: 'Other', item_type: 'raw_material', unit_of_measure: 'kg' },
];

const lotToStock: Record<string, string> = { 'lot-a1': RM_A, 'lot-b1': RM_B };
const resolve = (id: string | null) => (id ? lotToStock[id] ?? null : null);

const rec = (stock_code_id: string, qty: number, received_at: string, status = 'accepted'): ReconReceivingLike => ({
  stock_code_id, quantity_received: qty, received_at, status,
});

const batch = (id: string, overrides: Partial<ReconUsageBatchLike> = {}): ReconUsageBatchLike => ({
  id, batch_number: `PB-${id}`, status: 'draft', created_at: '2026-10-03T08:00:00.000Z',
  pre_weigh_materials: [], ...overrides,
});

describe('stock recon report windows', () => {
  it('uses the agreed entry and usage windows', () => {
    expect(ENTRY_WINDOW_START).toBe('2026-10-02');
    expect(ENTRY_WINDOW_END).toBe('2026-10-07');
    expect(USAGE_WINDOW_START_ISO).toBe('2026-09-30T00:00:00.000Z');
    expect(USAGE_WINDOW_END_ISO).toBe('2026-10-07T23:59:59.999Z');
  });

  it('sums accepted receipts dated 2 Oct through 7 Oct only', () => {
    const rows = computeStockReconReport(
      stockCodes,
      [
        rec(RM_A, 80, '2026-10-02T09:00:00.000Z'),
        rec(RM_A, 20, '2026-10-05T09:00:00.000Z'),
        rec(RM_A, 5, '2026-10-07T23:00:00.000Z'),
        rec(RM_A, 999, '2026-10-05T09:00:00.000Z', 'declined'),
        rec(RM_A, 999, '2026-09-28T09:00:00.000Z'),
        rec(RM_A, 999, '2026-10-08T09:00:00.000Z'),
      ],
      [], [], resolve,
    );
    expect(rows.map((r) => r.stock_code)).toEqual(['RM001', 'RM002']);
    expect(rows[0].stockEntered).toBe(105);
    expect(rows[1].stockEntered).toBe(0);
  });

  it('restricts to RM-prefixed raw materials', () => {
    const rows = computeStockReconReport(
      stockCodes,
      [
        rec('sc-pk', 10, '2026-10-02T09:00:00.000Z'),
        rec('sc-xx', 10, '2026-10-02T09:00:00.000Z'),
      ],
      [], [], resolve,
    );
    expect(rows.map((r) => r.stock_code)).toEqual(['RM001', 'RM002']);
    expect(rows.every((r) => r.stockEntered === 0 && r.used === 0)).toBe(true);
  });

  it('lists every raw material even with no receipts and no usage', () => {
    const rows = computeStockReconReport(stockCodes, [], [], [], resolve);
    expect(rows.map((r) => r.stock_code)).toEqual(['RM001', 'RM002']);
    expect(rows.every((r) => r.shouldBeLeft === 0)).toBe(true);
  });
});


describe('used on Batch Sheets 30 Sep - 7 Oct', () => {
  it('prefers fms_materials_used over quantity weighed', () => {
    const batches = [
      batch('b1', { pre_weigh_materials: [{ material_id: RM_A, quantity_weighed: 9 }] }),
    ];
    const used: ReconMaterialsUsedLike[] = [{ batch_id: 'b1', receiving_record_id: 'lot-a1', quantity_used: 7 }];
    const rows = computeStockReconReport(stockCodes, [], batches, used, resolve);
    expect(rows[0].used).toBe(7);
  });

  it('uses quantity_weighed when no consumed row covers the batch+material', () => {
    const batches = [
      batch('b1', { pre_weigh_materials: [{ material_id: RM_A, quantity_weighed: 9.5 }] }),
    ];
    const rows = computeStockReconReport(stockCodes, [], batches, [], resolve);
    expect(rows[0].used).toBe(9.5);
  });

  it('does not count BOM-only required_quantity as used', () => {
    const batches = [
      batch('b1', { pre_weigh_materials: [{ material_id: RM_A, required_quantity: 12 }] }),
    ];
    const rows = computeStockReconReport(
      stockCodes, [rec(RM_A, 100, '2026-10-02T09:00:00.000Z')], batches, [], resolve,
    );
    expect(rows[0]).toMatchObject({ stockEntered: 100, used: 0, shouldBeLeft: 100 });
  });

  it('excludes cancelled batches and batches outside the window', () => {
    const batches = [
      batch('cx', { status: 'cancelled', pre_weigh_materials: [{ material_id: RM_A, quantity_weighed: 50 }] }),
      batch('early', { created_at: '2026-09-29T23:00:00.000Z', pre_weigh_materials: [{ material_id: RM_A, quantity_weighed: 50 }] }),
      batch('late', { created_at: '2026-10-08T00:00:01.000Z', pre_weigh_materials: [{ material_id: RM_A, quantity_weighed: 50 }] }),
    ];
    const rows = computeStockReconReport(stockCodes, [], batches, [], resolve);
    expect(rows.map((r) => r.stock_code)).toEqual(['RM001', 'RM002']);
    expect(rows.every((r) => r.used === 0)).toBe(true);
  });

  it('keeps both window boundaries inclusive', () => {
    const batches = [
      batch('start', { created_at: '2026-09-30T00:00:00.000Z', pre_weigh_materials: [{ material_id: RM_A, quantity_weighed: 3 }] }),
      batch('end', { created_at: '2026-10-07T23:59:59.999Z', pre_weigh_materials: [{ material_id: RM_A, quantity_weighed: 4 }] }),
    ];
    const rows = computeStockReconReport(stockCodes, [], batches, [], resolve);
    expect(rows[0].used).toBe(7);
  });

  it('ignores consumed rows whose lot cannot be resolved', () => {
    const batches = [batch('b1', { pre_weigh_materials: [{ material_id: RM_A, quantity_weighed: 5 }] })];
    const used: ReconMaterialsUsedLike[] = [{ batch_id: 'b1', receiving_record_id: 'lot-unknown', quantity_used: 40 }];
    const rows = computeStockReconReport(stockCodes, [], batches, used, resolve);
    expect(rows[0].used).toBe(5);
  });

  it('counts batch_usage stock movements even when the lot is unresolvable', () => {
    const moves: ReconStockMovementLike[] = [
      { batch_id: 'b1', stock_code_id: RM_A, movement_type: 'batch_usage', quantity_change: -12 },
    ];
    const rows = computeStockReconReport(stockCodes, [], [batch('b1')], [], resolve, moves);
    expect(rows[0].used).toBe(12);
  });

  it('sums multiple batch_usage movements for the same batch and material', () => {
    const moves: ReconStockMovementLike[] = [
      { batch_id: 'b1', stock_code_id: RM_A, movement_type: 'batch_usage', quantity_change: -7 },
      { batch_id: 'b1', stock_code_id: RM_A, movement_type: 'batch_usage', quantity_change: -3 },
    ];
    const rows = computeStockReconReport(stockCodes, [], [batch('b1')], [], resolve, moves);
    expect(rows[0].used).toBe(10);
  });

  it('does not double count a movement also covered by fms_materials_used', () => {
    const batches = [batch('b1', { pre_weigh_materials: [{ material_id: RM_A, quantity_weighed: 9 }] })];
    const used: ReconMaterialsUsedLike[] = [{ batch_id: 'b1', receiving_record_id: 'lot-a1', quantity_used: 7 }];
    const moves: ReconStockMovementLike[] = [
      { batch_id: 'b1', stock_code_id: RM_A, movement_type: 'batch_usage', quantity_change: -7 },
    ];
    const rows = computeStockReconReport(stockCodes, [], batches, used, resolve, moves);
    expect(rows[0].used).toBe(7);
  });

  it('ignores non-batch_usage movements, movements without a batch, and out-of-window movements', () => {
    const moves: ReconStockMovementLike[] = [
      { batch_id: 'b1', stock_code_id: RM_A, movement_type: 'adjustment', quantity_change: -50 },
      { batch_id: null, stock_code_id: RM_A, movement_type: 'batch_usage', quantity_change: -50 },
      { batch_id: 'cx', stock_code_id: RM_A, movement_type: 'batch_usage', quantity_change: -50 },
      { batch_id: 'b1', stock_code_id: 'sc-pk', movement_type: 'batch_usage', quantity_change: -50 },
      { batch_id: 'b1', stock_code_id: RM_A, movement_type: 'batch_usage', quantity_change: 0 },
    ];
    const batches = [
      batch('b1'),
      batch('cx', { status: 'cancelled' }),
    ];
    const rows = computeStockReconReport(stockCodes, [], batches, [], resolve, moves);
    expect(rows.every((r) => r.used === 0)).toBe(true);
  });
});

describe('stock entered minus used equals should be left', () => {
  it('computes the three reported figures and batch list', () => {
    const batches = [
      batch('b1', { batch_number: 'PB-1', pre_weigh_materials: [{ material_id: RM_A, quantity_weighed: 30 }] }),
    ];
    const rows = computeStockReconReport(
      stockCodes,
      [rec(RM_A, 80, '2026-10-02T09:00:00.000Z'), rec(RM_A, 20, '2026-10-05T09:00:00.000Z')],
      batches, [], resolve,
    );
    expect(rows[0]).toMatchObject({
      stock_code: 'RM001', uom: 'kg',
      stockEntered: 100, used: 30, shouldBeLeft: 70,
      batches: ['PB-1'],
    });
  });

  it('allows negative should-be-left when usage exceeds receipts in window', () => {
    const batches = [
      batch('b1', { pre_weigh_materials: [{ material_id: RM_A, quantity_weighed: 150 }] }),
    ];
    const rows = computeStockReconReport(
      stockCodes, [rec(RM_A, 100, '2026-10-02T09:00:00.000Z')], batches, [], resolve,
    );
    expect(rows[0].shouldBeLeft).toBe(-50);
  });
});

