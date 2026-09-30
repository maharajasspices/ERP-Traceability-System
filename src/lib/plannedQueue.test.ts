import { describe, expect, it } from 'vitest';

// The queue component imports the Supabase client, which touches localStorage
// at module load. Stub it before the dynamic import so the pure date helper is
// testable in the node environment.
(globalThis as any).localStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const { getNextWorkingDayKey } = await import(
  '@/components/dashboard/PlannedProductionQueue'
);

/** Local 'YYYY-MM-DD' key, matching the app's date helpers. */
const key = (d: Date): string => {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};

describe('getNextWorkingDayKey', () => {
  it('returns the next day when it is a weekday', () => {
    // 2026-01-05 is a Monday, so the next working day is Tuesday.
    const monday = new Date(2026, 0, 5);
    expect(getNextWorkingDayKey(monday)).toBe('2026-01-06');
  });

  it('rolls a Friday plan forward to Monday', () => {
    // 2026-01-09 is a Friday; Saturday and Sunday are skipped.
    const friday = new Date(2026, 0, 9);
    expect(getNextWorkingDayKey(friday)).toBe('2026-01-12');
  });

  it('rolls a Saturday forward to Monday', () => {
    const saturday = new Date(2026, 0, 10);
    expect(getNextWorkingDayKey(saturday)).toBe('2026-01-12');
  });

  it('rolls a Sunday forward to Monday', () => {
    const sunday = new Date(2026, 0, 11);
    expect(getNextWorkingDayKey(sunday)).toBe('2026-01-12');
  });

  it('crosses a month boundary correctly', () => {
    // 2026-01-30 is a Friday, so the next working day is Monday 2026-02-02.
    const friday = new Date(2026, 0, 30);
    expect(getNextWorkingDayKey(friday)).toBe('2026-02-02');
  });

  it('uses local time rather than UTC', () => {
    // A late-evening local date must not roll to the next day via UTC.
    const lateEvening = new Date(2026, 0, 5, 23, 30);
    expect(getNextWorkingDayKey(lateEvening)).toBe(key(new Date(2026, 0, 6)));
  });
});
