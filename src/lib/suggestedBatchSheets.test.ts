import { describe, expect, it } from 'vitest';

import { buildSuggestionsForTest } from '@/components/dashboard/SuggestedBatchSheets';

const localKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** The `count` most recent past occurrences of `weekday` (0=Sun) before `from`. */
const weekdayDatesBefore = (from: Date, weekday: number, count: number): string[] => {
  const out: string[] = [];
  for (let i = 1; i <= count; i += 1) {
    const d = new Date(from);
    d.setDate(d.getDate() - i * 7);
    while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
    out.push(localKey(d));
  }
  return out;
};

const product = (id: string, itemType = 'finished_good') => ({
  id,
  stock_code: id.toUpperCase(),
  description: `Product ${id}`,
  unit_of_measure: 'kg',
  item_type: itemType,
  status: 'active',
}) as any;

const batch = (
  id: string,
  finishedGoodId: string,
  dateKey: string,
  status = 'closed'
) =>
  ({
    id,
    finished_good_id: finishedGoodId,
    planned_production_date: dateKey,
    planned_batch_size: 10,
    status,
  }) as any;

// Tomorrow is Thursday 2026-01-08. The suggestions look for history on
// TOMORROW's weekday, so the test history is seeded on Thursdays (weekday 4).
const TOMORROW = new Date(2026, 0, 8);
const TOMORROW_WEEKDAY = TOMORROW.getDay(); // 4 = Thursday

describe('suggested batch sheets - weekday threshold', () => {
  it('treats a product run on 4 of the same weekday as a regular weekday run', () => {
    const dates = weekdayDatesBefore(TOMORROW, TOMORROW_WEEKDAY, 4);
    const result = buildSuggestionsForTest(
      [product('p1')],
      dates.map((d, i) => batch(`b${i}`, 'p1', d)),
      TOMORROW
    );

    expect(result).toHaveLength(1);
    expect(result[0].basis).toBe('weekday');
  });

  it('does NOT treat exactly 2 same-weekday runs as regular (boundary)', () => {
    const dates = weekdayDatesBefore(TOMORROW, TOMORROW_WEEKDAY, 2);
    const result = buildSuggestionsForTest(
      [product('p1')],
      dates.map((d, i) => batch(`b${i}`, 'p1', d)),
      TOMORROW
    );

    expect(result).toHaveLength(1);
    expect(result[0].basis).toBe('recent');
  });

  it('treats exactly 3 same-weekday runs as regular (boundary)', () => {
    const dates = weekdayDatesBefore(TOMORROW, TOMORROW_WEEKDAY, 3);
    const result = buildSuggestionsForTest(
      [product('p1')],
      dates.map((d, i) => batch(`b${i}`, 'p1', d)),
      TOMORROW
    );

    expect(result[0].basis).toBe('weekday');
  });

  it('includes WIP and raw material products, not just finished goods', () => {
    const dates = weekdayDatesBefore(TOMORROW, TOMORROW_WEEKDAY, 4);
    const result = buildSuggestionsForTest(
      [
        product('fg1', 'finished_good'),
        product('wip1', 'work_in_progress'),
        product('rm1', 'raw_material'),
      ],
      [
        ...dates.map((d, i) => batch(`b${i}`, 'wip1', d)),
        ...dates.map((d, i) => batch(`c${i}`, 'rm1', d)),
      ],
      TOMORROW
    );

    const keys = result.map((s) => s.key);
    expect(keys).toContain('wip1');
    expect(keys).toContain('rm1');
  });

  it('skips inactive products', () => {
    const dates = weekdayDatesBefore(TOMORROW, TOMORROW_WEEKDAY, 4);
    const result = buildSuggestionsForTest(
      [{ ...product('p1'), status: 'inactive' } as any],
      dates.map((d, i) => batch(`b${i}`, 'p1', d)),
      TOMORROW
    );
    expect(result).toHaveLength(0);
  });

  it('never treats cancelled batches as production history', () => {
    const dates = weekdayDatesBefore(TOMORROW, TOMORROW_WEEKDAY, 4);
    const result = buildSuggestionsForTest(
      [product('p1')],
      dates.map((d, i) => batch(`b${i}`, 'p1', d, 'cancelled')),
      TOMORROW
    );
    expect(result).toHaveLength(0);
  });

  it('skips a product already planned for tomorrow', () => {
    const dates = weekdayDatesBefore(TOMORROW, TOMORROW_WEEKDAY, 4);
    const tomorrowKey = localKey(TOMORROW);
    const result = buildSuggestionsForTest(
      [product('p1')],
      [...dates.map((d, i) => batch(`b${i}`, 'p1', d)), batch('t1', 'p1', tomorrowKey, 'draft')],
      TOMORROW
    );
    expect(result).toHaveLength(0);
  });
});

