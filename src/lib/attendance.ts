// =====================================================================
// Attendance event inference
// =====================================================================
//
// A worker only ever SCANS. Which event that scan means is worked out from
// where they already are and what time it is:
//
//   first scan of the day ........ CLOCK_IN
//   working, in the tea window ... TEA_START
//   on tea ....................... TEA_END
//   working, in the break window . BREAK_START
//   on break .................... BREAK_END
//   working, no break left ...... CLOCK_OUT
//
// IMPORTANT: `fms_hr_record_attendance_punch` in the database is the
// authoritative implementation of these rules. This module is the mirror used
// by the kiosk to PREVIEW what a scan will do ("scan now = start your tea
// break") and to render timelines, so a worker is never surprised. Both are
// covered by the same scenarios in attendance.test.ts - if a rule changes in
// one it must change in the other.
// =====================================================================

export type AttendanceEvent =
  | 'CLOCK_IN'
  | 'CLOCK_OUT'
  | 'TEA_START'
  | 'TEA_END'
  | 'BREAK_START'
  | 'BREAK_END';

/** What a worker can be doing right now, derived from their last punch. */
export type AttendanceState = 'not_in' | 'working' | 'on_tea' | 'on_break' | 'done';

export interface AttendancePolicy {
  workdayStart: string; // '07:00'
  workdayEnd: string; // '17:00'
  teaStart: string; // '10:00'
  teaMinutes: number; // 10
  breakStart: string; // '12:00'
  breakMinutes: number; // 30
  breakIsPaid: boolean;
  /** How early/late a scan still counts as taking a given break. */
  graceMinutes: number;
  lateAfterMinutes: number;
}

/** Factory default: 07:00-17:00, 10 min tea at 10:00, 30 min unpaid break. */
export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicy = {
  workdayStart: '07:00',
  workdayEnd: '17:00',
  teaStart: '10:00',
  teaMinutes: 10,
  breakStart: '12:00',
  breakMinutes: 30,
  breakIsPaid: false,
  graceMinutes: 30,
  lateAfterMinutes: 15,
};

export interface AttendancePunch {
  event_type: AttendanceEvent;
  punched_at: string;
}

/** 'HH:MM' -> minutes past midnight. */
export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
};

/** Minutes past midnight for a Date. */
export const minutesOfDay = (at: Date): number => at.getHours() * 60 + at.getMinutes();

/** Where the worker currently is, from their punches so far today. */
export const deriveState = (punches: readonly AttendancePunch[]): AttendanceState => {
  if (punches.length === 0) return 'not_in';
  const last = punches[punches.length - 1].event_type;
  if (last === 'CLOCK_OUT') return 'done';
  if (last === 'CLOCK_IN') return 'working';
  if (last === 'TEA_START') return 'on_tea';
  if (last === 'BREAK_START') return 'on_break';
  return 'working';
};

/** True when `nowMinutes` is close enough to a break to be taking it. */
const isInBreakWindow = (
  nowMinutes: number,
  startHhmm: string,
  durationMinutes: number,
  graceMinutes: number,
): boolean => {
  const start = toMinutes(startHhmm);
  return nowMinutes >= start - graceMinutes && nowMinutes <= start + durationMinutes + graceMinutes;
};

/**
 * The event a scan at `at` would record, given the punches already made today.
 *
 * `punches` must be that employee's punches for the same local day, in order.
 */
export const inferNextEvent = (
  punches: readonly AttendancePunch[],
  at: Date,
  policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY,
): AttendanceEvent => {
  const state = deriveState(punches);

  // Not in yet, or finished for the day: a scan means start.
  if (state === 'not_in' || state === 'done') return 'CLOCK_IN';

  // Returning from a break just ends it.
  if (state === 'on_tea') return 'TEA_END';
  if (state === 'on_break') return 'BREAK_END';

  // Working: the scan means going for a break, or going home.
  const now = minutesOfDay(at);
  const teaTaken = punches.some((p) => p.event_type === 'TEA_START');
  const breakTaken = punches.some((p) => p.event_type === 'BREAK_START');

  if (
    !teaTaken &&
    isInBreakWindow(now, policy.teaStart, policy.teaMinutes, policy.graceMinutes)
  ) {
    return 'TEA_START';
  }

  if (
    !breakTaken &&
    isInBreakWindow(now, policy.breakStart, policy.breakMinutes, policy.graceMinutes)
  ) {
    return 'BREAK_START';
  }

  // No break left to take (or far from all of them): they are going home.
  return 'CLOCK_OUT';
};

/** Plain-language label, shown on the kiosk so the scan is never a surprise. */
export const EVENT_LABELS: Record<AttendanceEvent, string> = {
  CLOCK_IN: 'Clocked in',
  CLOCK_OUT: 'Clocked out',
  TEA_START: 'Started tea break',
  TEA_END: 'Back from tea',
  BREAK_START: 'Started break',
  BREAK_END: 'Back from break',
};

/** What the kiosk tells the worker BEFORE they scan. */
export const previewMessage = (
  punches: readonly AttendancePunch[],
  at: Date,
  policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY,
): string => {
  const state = deriveState(punches);
  switch (state) {
    case 'not_in':
      return 'Ready to clock in';
    case 'done':
      return 'Already clocked out today';
    case 'on_tea':
      return 'On tea — scan when you are back';
    case 'on_break':
      return 'On break — scan when you are back';
    default: {
      const next = inferNextEvent(punches, at, policy);
      if (next === 'TEA_START') return 'Working — scan now to start your tea break';
      if (next === 'BREAK_START') return 'Working — scan now to start your break';
      return 'Working — scan now to clock out';
    }
  }
};

/** A day's summary derived from the punch log, mirroring the SQL rollup. */
export interface AttendanceDaySummary {
  timeIn: string | null;
  timeOut: string | null;
  hoursWorked: number;
  status: 'present' | 'late' | 'half_day' | 'absent';
  punches: number;
}

const fmtTime = (d: Date | null): string | null =>
  d ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null;

const atShiftTime = (day: Date, hhmm: string): Date => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
};

export const summariseDay = (
  punches: readonly AttendancePunch[],
  dayStart: Date,
  policy: AttendancePolicy = DEFAULT_ATTENDANCE_POLICY,
): AttendanceDaySummary => {
  if (punches.length === 0) {
    return { timeIn: null, timeOut: null, hoursWorked: 0, status: 'absent', punches: 0 };
  }

  const inPunch = punches.find((p) => p.event_type === 'CLOCK_IN');
  const outPunch = [...punches].reverse().find((p) => p.event_type === 'CLOCK_OUT');
  const inAt = inPunch ? new Date(inPunch.punched_at) : null;
  const outAt = outPunch ? new Date(outPunch.punched_at) : null;

  const brkStart = punches.find((p) => p.event_type === 'BREAK_START');
  const brkEnd = [...punches].reverse().find((p) => p.event_type === 'BREAK_END');

  // The lunch break is unpaid, so only that is deducted. Tea is paid.
  let unpaidMinutes = 0;
  if (!policy.breakIsPaid && brkStart && brkEnd) {
    unpaidMinutes =
      (new Date(brkEnd.punched_at).getTime() - new Date(brkStart.punched_at).getTime()) / 60000;
  }

  let hoursWorked = 0;
  if (inAt) {
    const end = outAt ?? new Date();
    hoursWorked = Math.max((end.getTime() - inAt.getTime()) / 60000 - unpaidMinutes, 0) / 60;
  }

  let status: AttendanceDaySummary['status'] = 'present';
  if (!inAt) {
    status = 'absent';
  } else if (inAt.getTime() > atShiftTime(dayStart, policy.workdayStart).getTime() + policy.lateAfterMinutes * 60000) {
    status = 'late';
  } else if (
    (outAt ?? new Date()).getTime() <
    atShiftTime(dayStart, policy.workdayEnd).getTime() - 4 * 3600000
  ) {
    // Still in, or out, more than 4 hours before the shift ends.
    status = 'half_day';
  }

  return {
    timeIn: fmtTime(inAt),
    timeOut: fmtTime(outAt),
    hoursWorked: Math.round(hoursWorked * 100) / 100,
    status,
    punches: punches.length,
  };
};
