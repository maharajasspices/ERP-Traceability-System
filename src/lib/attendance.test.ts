import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ATTENDANCE_POLICY,
  deriveState,
  inferNextEvent,
  previewMessage,
  summariseDay,
  toMinutes,
  type AttendanceEvent,
  type AttendancePunch,
} from '@/lib/attendance';

const policy = DEFAULT_ATTENDANCE_POLICY;

/** A local-time Date on a fixed day, so the tests never drift with the clock. */
const at = (hhmm: string, day = 22) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2026, 8, day, h, m, 0, 0);
};

const punch = (event_type: AttendanceEvent, hhmm: string): AttendancePunch => ({
  event_type,
  punched_at: at(hhmm).toISOString(),
});

describe('toMinutes', () => {
  it('converts HH:MM to minutes past midnight', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('07:30')).toBe(450);
    expect(toMinutes('17:00')).toBe(1020);
  });
});

describe('deriveState', () => {
  it('reads the state from the last punch', () => {
    expect(deriveState([])).toBe('not_in');
    expect(deriveState([punch('CLOCK_IN', '07:00')])).toBe('working');
    expect(deriveState([punch('CLOCK_IN', '07:00'), punch('TEA_START', '10:00')])).toBe('on_tea');
    expect(deriveState([punch('CLOCK_IN', '07:00'), punch('BREAK_START', '12:00')])).toBe('on_break');
    expect(
      deriveState([punch('CLOCK_IN', '07:00'), punch('CLOCK_OUT', '17:00')]),
    ).toBe('done');
  });
});

describe('inferNextEvent - the full normal day', () => {
  it('walks 07:00 -> tea -> break -> 17:00 with no buttons pressed', () => {
    const log: AttendancePunch[] = [];

    // 1. First scan of the day
    expect(inferNextEvent(log, at('07:05'), policy)).toBe('CLOCK_IN');
    log.push(punch('CLOCK_IN', '07:05'));

    // 2. Working at 10:00 -> tea
    expect(inferNextEvent(log, at('10:00'), policy)).toBe('TEA_START');
    log.push(punch('TEA_START', '10:00'));

    // 3. On tea -> back
    expect(inferNextEvent(log, at('10:10'), policy)).toBe('TEA_END');
    log.push(punch('TEA_END', '10:10'));

    // 4. Working at 12:00 -> break
    expect(inferNextEvent(log, at('12:00'), policy)).toBe('BREAK_START');
    log.push(punch('BREAK_START', '12:00'));

    // 5. On break -> back
    expect(inferNextEvent(log, at('12:30'), policy)).toBe('BREAK_END');
    log.push(punch('BREAK_END', '12:30'));

    // 6. No breaks left -> home
    expect(inferNextEvent(log, at('17:00'), policy)).toBe('CLOCK_OUT');
  });

  it('always ends a break on the very next scan, whatever the time', () => {
    const onTea = [punch('CLOCK_IN', '07:00'), punch('TEA_START', '10:00')];
    // Even at 15:00, a scan while on tea means they are back.
    expect(inferNextEvent(onTea, at('15:00'), policy)).toBe('TEA_END');

    const onBreak = [punch('CLOCK_IN', '07:00'), punch('BREAK_START', '12:00')];
    expect(inferNextEvent(onBreak, at('16:00'), policy)).toBe('BREAK_END');
  });
});

describe('inferNextEvent - choosing WHICH break', () => {
  it('picks tea near 10:00 and break near 12:00', () => {
    const working = [punch('CLOCK_IN', '07:00')];
    expect(inferNextEvent(working, at('09:45'), policy)).toBe('TEA_START');
    expect(inferNextEvent(working, at('12:00'), policy)).toBe('BREAK_START');
  });

  it('does not start the same break twice', () => {
    const afterTea = [
      punch('CLOCK_IN', '07:00'),
      punch('TEA_START', '10:00'),
      punch('TEA_END', '10:10'),
    ];
    // 10:15 is still inside the tea window, but tea was already taken, so a
    // second tea is not a thing - it falls through to going home.
    expect(inferNextEvent(afterTea, at('10:15'), policy)).toBe('CLOCK_OUT');
  });

  it('honours the grace window at both edges', () => {
    const working = [punch('CLOCK_IN', '07:00')];
    // tea window is 10:00 + 10 min, +/- 30 min grace => 09:30 .. 10:40
    expect(inferNextEvent(working, at('09:29'), policy)).toBe('CLOCK_OUT');
    expect(inferNextEvent(working, at('09:30'), policy)).toBe('TEA_START');
    expect(inferNextEvent(working, at('10:40'), policy)).toBe('TEA_START');
    expect(inferNextEvent(working, at('10:41'), policy)).toBe('CLOCK_OUT');
  });

  it('respects a custom policy', () => {
    const custom = {
      ...policy,
      teaStart: '14:00',
      teaMinutes: 15,
      breakStart: '15:30',
      graceMinutes: 5,
    };
    const working = [punch('CLOCK_IN', '07:00')];
    expect(inferNextEvent(working, at('14:00'), custom)).toBe('TEA_START');
    expect(inferNextEvent(working, at('10:00'), custom)).toBe('CLOCK_OUT');
  });
});

describe('inferNextEvent - edges', () => {
  it('treats a scan before any punch as clock in, at any hour', () => {
    expect(inferNextEvent([], at('06:30'), policy)).toBe('CLOCK_IN');
    expect(inferNextEvent([], at('16:00'), policy)).toBe('CLOCK_IN');
  });

  it('treats a scan after clock out as a new clock in (second shift)', () => {
    const done = [punch('CLOCK_IN', '07:00'), punch('CLOCK_OUT', '17:00')];
    expect(inferNextEvent(done, at('19:00'), policy)).toBe('CLOCK_IN');
  });
});

describe('previewMessage', () => {
  it('tells the worker what the scan will do before they scan', () => {
    expect(previewMessage([], at('07:05'), policy)).toMatch(/clock in/i);
    expect(previewMessage([punch('CLOCK_IN', '07:00')], at('10:00'), policy)).toMatch(/tea/i);
    expect(
      previewMessage(
        [punch('CLOCK_IN', '07:00'), punch('TEA_START', '10:00')],
        at('10:05'),
        policy,
      ),
    ).toMatch(/back/i);
    expect(previewMessage([punch('CLOCK_IN', '07:00')], at('17:00'), policy)).toMatch(
      /clock out/i,
    );
  });
});

describe('summariseDay', () => {
  const day = new Date(2026, 8, 22);

  it('deducts the unpaid break but never the paid tea', () => {
    const log = [
      punch('CLOCK_IN', '07:00'),
      punch('TEA_START', '10:00'),
      punch('TEA_END', '10:10'),
      punch('BREAK_START', '12:00'),
      punch('BREAK_END', '12:30'),
      punch('CLOCK_OUT', '17:00'),
    ];
    const s = summariseDay(log, day, policy);
    // 07:00 -> 17:00 is 10h; the 30 min unpaid break is removed, tea is not.
    expect(s.hoursWorked).toBe(9.5);
    expect(s.timeIn).toBe('07:00');
    expect(s.timeOut).toBe('17:00');
    expect(s.punches).toBe(6);
  });

  it('marks a day with no punches as absent', () => {
    expect(summariseDay([], day, policy).status).toBe('absent');
  });

  it('marks a late arrival', () => {
    const s = summariseDay(
      [punch('CLOCK_IN', '07:45'), punch('CLOCK_OUT', '17:00')],
      day,
      policy,
    );
    expect(s.status).toBe('late');
  });

  it('marks a full day present', () => {
    const s = summariseDay(
      [punch('CLOCK_IN', '07:00'), punch('CLOCK_OUT', '17:00')],
      day,
      policy,
    );
    expect(s.status).toBe('present');
  });
});
