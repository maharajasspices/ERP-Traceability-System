import { describe, expect, it } from 'vitest';

import {
  computeMissingReservations,
  RECON_CUTOFF_ISO,
  type ReconBatchLike,
  type ReconReservationLike,
} from '@/lib/missingReservations';

const batch = (
  id: string,
  overrides: Partial<ReconBatchLike> = {},
): ReconBatchLike => ({
  id,
  batch_number: `PB-${id}`,
  status: 'draft',
  created_at: '2026-10-01T08:00:00.000Z',
  pre_weigh_materials: [],
  ...overrides,
});

const mat = (material_id: string, required_quantity: number) => ({
  material_id,
  required_quantity,
});

describe('computeMissingReservations', () => {
  it('defaults to the 30 September 2026 count cutoff', () => {
    expect(RECON_CUTOFF_ISO).toBe('2026-09-30T00:00:00.000Z');
  });

  it('includes a post-cutoff draft and lists its lines and totals', () => {
    const result = computeMissingReservations(
      [
        batch('b1', {
          pre_weigh_materials: [mat('sc-a', 10), mat('sc-b', 4)],
        }),
      ],
      [],
    );

    expect(result.batchIds).toEqual(['b1']);
    expect(result.skippedReservedBatchIds).toEqual([]);
    expect(result.lines).toEqual([
      { batch_id: 'b1', batch_number: 'PB-b1', stock_code_id: 'sc-a', quantity: 10 },
      { batch_id: 'b1', batch_number: 'PB-b1', stock_code_id: 'sc-b', quantity: 4 },
    ]);
    expect(result.totals).toEqual([
      { stock_code_id: 'sc-a', quantity: 10, batch_ids: ['b1'] },
      { stock_code_id: 'sc-b', quantity: 4, batch_ids: ['b1'] },
    ]);
  });

  it('aggregates the same material across several batches', () => {
    const result = computeMissingReservations(
      [
        batch('b1', { pre_weigh_materials: [mat('sc-a', 10)] }),
        batch('b2', { pre_weigh_materials: [mat('sc-a', 5), mat('sc-b', 2)] }),
      ],
      [],
    );

    expect(result.batchIds).toEqual(['b1', 'b2']);
    expect(result.lines).toHaveLength(3);
    expect(result.totals).toEqual([
      { stock_code_id: 'sc-a', quantity: 15, batch_ids: ['b1', 'b2'] },
      { stock_code_id: 'sc-b', quantity: 2, batch_ids: ['b2'] },
    ]);
  });

  it('treats a batch exactly at the cutoff as post-count but excludes earlier ones', () => {
    const result = computeMissingReservations(
      [
        batch('pre', {
          created_at: '2026-09-29T23:59:59.999Z',
          pre_weigh_materials: [mat('sc-a', 7)],
        }),
        batch('exact', {
          created_at: '2026-09-30T00:00:00.000Z',
          pre_weigh_materials: [mat('sc-a', 100)],
        }),
      ],
      [],
    );

    expect(result.batchIds).toEqual(['exact']);
    expect(result.totals).toEqual([
      { stock_code_id: 'sc-a', quantity: 100, batch_ids: ['exact'] },
    ]);
  });

  it('ignores every non-draft status including cancelled', () => {
    const result = computeMissingReservations(
      [
        batch('cancelled', { status: 'cancelled', pre_weigh_materials: [mat('sc-a', 9)] }),
        batch('weighing', { status: 'pre_weighing', pre_weigh_materials: [mat('sc-a', 9)] }),
        batch('making', { status: 'manufacturing', pre_weigh_materials: [mat('sc-a', 9)] }),
        batch('progress', { status: 'in_progress', pre_weigh_materials: [mat('sc-a', 9)] }),
        batch('closed', { status: 'closed', pre_weigh_materials: [mat('sc-a', 9)] }),
      ],
      [],
    );

    expect(result.batchIds).toEqual([]);
    expect(result.lines).toEqual([]);
    expect(result.totals).toEqual([]);
  });

  it('skips a draft that already holds a reserved or consumed row', () => {
    const batches = [
      batch('held', { pre_weigh_materials: [mat('sc-a', 20)] }),
      batch('eaten', { pre_weigh_materials: [mat('sc-a', 30)] }),
      batch('free', { pre_weigh_materials: [mat('sc-a', 5)] }),
    ];
    const reservations: ReconReservationLike[] = [
      { batch_id: 'held', status: 'reserved' },
      { batch_id: 'eaten', status: 'consumed' },
      { batch_id: 'free', status: 'released' },
    ];

    const result = computeMissingReservations(batches, reservations);

    expect(result.batchIds).toEqual(['free']);
    expect(result.skippedReservedBatchIds).toEqual(['held', 'eaten']);
    expect(result.totals).toEqual([
      { stock_code_id: 'sc-a', quantity: 5, batch_ids: ['free'] },
    ]);
  });

  it('skips rows with missing, zero or negative quantities', () => {
    const result = computeMissingReservations(
      [
        batch('b1', {
          pre_weigh_materials: [
            { material_id: undefined, required_quantity: 10 },
            mat('sc-a', 0),
            mat('sc-a', -3),
            { material_id: 'sc-a', required_quantity: NaN },
            mat('sc-a', 6),
          ],
        }),
      ],
      [],
    );

    expect(result.batchIds).toEqual(['b1']);
    expect(result.lines).toEqual([
      { batch_id: 'b1', batch_number: 'PB-b1', stock_code_id: 'sc-a', quantity: 6 },
    ]);
    expect(result.totals).toEqual([
      { stock_code_id: 'sc-a', quantity: 6, batch_ids: ['b1'] },
    ]);
  });

  it('keeps a batch with no usable materials but reserves nothing', () => {
    const result = computeMissingReservations(
      [batch('empty', { pre_weigh_materials: null })],
      [],
    );

    expect(result.batchIds).toEqual(['empty']);
    expect(result.lines).toEqual([]);
    expect(result.totals).toEqual([]);
  });

  it('returns empty results when nothing is in scope', () => {
    expect(computeMissingReservations([], [])).toEqual({
      batchIds: [],
      skippedReservedBatchIds: [],
      lines: [],
      totals: [],
    });
  });
});
