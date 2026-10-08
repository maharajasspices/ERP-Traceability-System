import { describe, expect, it } from 'vitest';

import {
  aggregateRawMaterialUsage,
  summariseUsageByUom,
  type PreWeighMaterialLike,
  type UsageBatchLike,
} from '@/lib/rawMaterialUsage';

const stockCodes: Record<string, { stock_code: string; description: string }> = {
  'sc-cum': { stock_code: 'CUM-001', description: 'Cumin Powder' },
  'sc-pap': { stock_code: 'PAP-002', description: 'Paprika Powder' },
};

const lookup = {
  stockCode: (id: string | null | undefined) => (id ? stockCodes[id] : undefined),
};

const batch = (
  id: string,
  batch_number: string,
  finished_good_id: string,
  production_date: string | null,
  pre_weigh_materials: PreWeighMaterialLike[] | null,
): UsageBatchLike => ({
  id,
  batch_number,
  finished_good_id,
  production_date,
  pre_weigh_materials,
});



describe('aggregateRawMaterialUsage', () => {
  it('groups the same material used across batches into one row', () => {
    const usage = aggregateRawMaterialUsage(
      [
        batch('b1', 'PB-1', 'fg-1', '2026-03-01', [
          { material_id: 'sc-cum', quantity_weighed: 10, uom: 'kg' },
        ]),
        batch('b2', 'PB-2', 'fg-2', '2026-03-05', [
          { material_id: 'sc-cum', quantity_weighed: 5, uom: 'kg' },
        ]),
      ],
      lookup,
    );

    expect(usage).toHaveLength(1);
    expect(usage[0].stock_code).toBe('CUM-001');
    expect(usage[0].total_used).toBe(15);
    expect(usage[0].batch_count).toBe(2);
  });

  it('records what each material was used for, one entry per batch', () => {
    const usage = aggregateRawMaterialUsage(
      [
        batch('b1', 'PB-1', 'fg-1', '2026-03-01', [
          { material_id: 'sc-cum', quantity_weighed: 10 },
          { material_id: 'sc-pap', quantity_weighed: 2 },
        ]),
      ],
      lookup,
    );

    const cumin = usage.find((u) => u.stock_code === 'CUM-001')!;
    expect(cumin.uses).toHaveLength(1);
    expect(cumin.uses[0]).toMatchObject({
      batch_number: 'PB-1',
      finished_good_id: 'fg-1',
      quantity: 10,
      measured: true,
    });
  });

  it('prefers the weighed quantity over the requirement', () => {
    const [row] = aggregateRawMaterialUsage(
      [
        batch('b1', 'PB-1', 'fg-1', '2026-03-01', [
          { material_id: 'sc-cum', required_quantity: 12, quantity_weighed: 9.5 },
        ]),
      ],
      lookup,
    );
    expect(row.total_used).toBe(9.5);
    expect(row.uses[0].measured).toBe(true);
  });

  it('falls back to the requirement when nothing was weighed', () => {
    const [row] = aggregateRawMaterialUsage(
      [
        batch('b1', 'PB-1', 'fg-1', '2026-03-01', [
          { material_id: 'sc-cum', required_quantity: 12 },
        ]),
      ],
      lookup,
    );
    expect(row.total_used).toBe(12);
    expect(row.uses[0].measured).toBe(false);
  });

  it('falls back to the recipe when the pre-weigh row has no quantity', () => {
    const [row] = aggregateRawMaterialUsage(
      [
        batch('b1', 'PB-1', 'fg-1', '2026-03-01', [{ material_id: 'sc-cum' }]),
      ],
      lookup,
      () => 7,
    );
    expect(row.total_used).toBe(7);
    expect(row.uses[0].measured).toBe(false);
  });

  it('skips rows with no usable quantity instead of counting them as zero', () => {
    const usage = aggregateRawMaterialUsage(
      [
        batch('b1', 'PB-1', 'fg-1', '2026-03-01', [
          { material_id: 'sc-cum', quantity_weighed: 0, required_quantity: 0 },
        ]),
      ],
      lookup,
      () => null,
    );
    expect(usage).toHaveLength(0);
  });

  it('ignores batches with no pre-weigh record at all', () => {
    expect(aggregateRawMaterialUsage([batch('b1', 'PB-1', 'fg-1', '2026-03-01', null)], lookup)).toEqual([]);
    expect(aggregateRawMaterialUsage([batch('b2', 'PB-2', 'fg-1', '2026-03-01', [])], lookup)).toEqual([]);
  });

  it('carries the supplier batch and internal lot for traceability', () => {
    const [row] = aggregateRawMaterialUsage(
      [
        batch('b1', 'PB-1', 'fg-1', '2026-03-01', [
          {
            material_id: 'sc-cum',
            quantity_weighed: 5,
            raw_material_batch_number: 'SUP-99123',
            internal_lot_number: 'LOT-2026-0142',
          },
        ]),
      ],
      lookup,
    );
    expect(row.uses[0].supplier_batch_number).toBe('SUP-99123');
    expect(row.uses[0].internal_lot_number).toBe('LOT-2026-0142');
  });

  it('orders materials by most used and uses by most recent', () => {
    const usage = aggregateRawMaterialUsage(
      [
        batch('b1', 'PB-1', 'fg-1', '2026-03-01', [
          { material_id: 'sc-cum', quantity_weighed: 10 },
          { material_id: 'sc-pap', quantity_weighed: 30 },
        ]),
        batch('b2', 'PB-2', 'fg-1', '2026-03-09', [
          { material_id: 'sc-cum', quantity_weighed: 1 },
        ]),
      ],
      lookup,
    );

    expect(usage.map((u) => u.stock_code)).toEqual(['PAP-002', 'CUM-001']);
    // Cumin's most recent batch comes first.
    expect(usage[1].uses.map((u) => u.batch_number)).toEqual(['PB-2', 'PB-1']);
  });

  it('returns nothing when no batches match the filters', () => {
    expect(aggregateRawMaterialUsage([], lookup)).toEqual([]);
    expect(summariseUsageByUom([])).toEqual([]);
  });
});

describe('summariseUsageByUom', () => {
  it('totals each unit of measure SEPARATELY rather than adding them together', () => {
    const usage = aggregateRawMaterialUsage(
      [
        batch('b1', 'PB-1', 'fg-1', '2026-03-01', [
          { material_id: 'sc-cum', quantity_weighed: 10, uom: 'kg' },
          { material_id: 'sc-pap', quantity_weighed: 4, uom: 'units' },
        ]),
        batch('b2', 'PB-2', 'fg-1', '2026-03-02', [
          { material_id: 'sc-cum', quantity_weighed: 5, uom: 'kg' },
        ]),
      ],
      lookup,
    );

    // "15" would be nonsense: 15 kg + 4 units added together.
    expect(summariseUsageByUom(usage)).toEqual([
      { uom: 'kg', total: 15, materials: 1 },
      { uom: 'units', total: 4, materials: 1 },
    ]);
  });

  it('labels rows that have no unit of measure instead of dropping them', () => {
    const usage = aggregateRawMaterialUsage(
      [batch('b1', 'PB-1', 'fg-1', '2026-03-01', [{ material_id: 'sc-cum', quantity_weighed: 7 }])],
      lookup,
    );
    expect(summariseUsageByUom(usage)).toEqual([{ uom: '(no uom)', total: 7, materials: 1 }]);
  });
});
