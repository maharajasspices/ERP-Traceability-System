import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Clock,
  Coffee,
  LogIn,
  LogOut,
  RotateCcw,
  Search,
  ScanLine,
  TriangleAlert,
  UtensilsCrossed,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_ATTENDANCE_POLICY,
  EVENT_LABELS,
  deriveState,
  inferNextEvent,
  previewMessage,
  type AttendanceEvent,
  type AttendancePolicy,
  type AttendancePunch,
} from '@/lib/attendance';

interface KioskEmployee {
  id: string;
  employee_number: string | null;
  first_name: string;
  last_name: string;
  department: string | null;
}

const EVENT_ICON: Record<AttendanceEvent, React.ReactNode> = {
  CLOCK_IN: <LogIn className="h-4 w-4" />,
  CLOCK_OUT: <LogOut className="h-4 w-4" />,
  TEA_START: <Coffee className="h-4 w-4" />,
  TEA_END: <Coffee className="h-4 w-4" />,
  BREAK_START: <UtensilsCrossed className="h-4 w-4" />,
  BREAK_END: <UtensilsCrossed className="h-4 w-4" />,
};

const EVENT_TONE: Record<AttendanceEvent, string> = {
  CLOCK_IN: 'bg-green-500/15 text-green-700 border-green-500/30',
  CLOCK_OUT: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
  TEA_START: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  TEA_END: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  BREAK_START: 'bg-violet-500/15 text-violet-700 border-violet-500/30',
  BREAK_END: 'bg-violet-500/15 text-violet-700 border-violet-500/30',
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// The punches/policy tables and the recorder RPC are newer than the generated
// Supabase types (which are currently corrupt and cannot be regenerated), so
// queries go through this one alias rather than casting at every call site.
const db = supabase as any;

/**
 * Attendance kiosk.
 *
 * Simulates the fingerprint machine until the hardware arrives: pick a worker,
 * press the big button, and the DATABASE decides what the scan meant. The
 * client never chooses an event - that is the whole point of the design.
 *
 * The contract a real device must satisfy is the same one this screen uses:
 * send `employee_id` + timestamp, and nothing else.
 */
const Kiosk: React.FC = () => {
  const [employees, setEmployees] = useState<KioskEmployee[]>([]);
  const [selected, setSelected] = useState<KioskEmployee | null>(null);
  const [punches, setPunches] = useState<AttendancePunch[]>([]);
  const [policy, setPolicy] = useState<AttendancePolicy>(DEFAULT_ATTENDANCE_POLICY);
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<{ event: AttendanceEvent; time: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Keep the clock ticking so the "what will this scan do" preview stays live.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await db
        .from('fms_hr_employees')
        .select('id, employee_number, first_name, last_name, department')
        .eq('status', 'active')
        .order('last_name');
      setEmployees((data as KioskEmployee[]) ?? []);

      const { data: pol } = await db
        .from('fms_hr_attendance_policy')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (pol) {
        setPolicy({
          workdayStart: pol.workday_start,
          workdayEnd: pol.workday_end,
          teaStart: pol.tea_start,
          teaMinutes: pol.tea_minutes,
          breakStart: pol.break_start,
          breakMinutes: pol.break_minutes,
          breakIsPaid: pol.break_is_paid,
          graceMinutes: pol.grace_minutes,
          lateAfterMinutes: pol.late_after_minutes,
        });
      }
    })();
  }, []);

  const loadPunches = useCallback(async (employeeId: string) => {
    const { data } = await db
      .from('fms_hr_attendance_punches')
      .select('event_type, punched_at')
      .eq('employee_id', employeeId)
      .order('punched_at', { ascending: true });
    setPunches((data as AttendancePunch[]) ?? []);
  }, []);

  const selectEmployee = async (emp: KioskEmployee) => {
    setSelected(emp);
    setLastResult(null);
    setNotice(null);
    await loadPunches(emp.id);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.first_name.toLowerCase().includes(q) ||
        e.last_name.toLowerCase().includes(q) ||
        (e.employee_number || '').toLowerCase().includes(q),
    );
  }, [employees, query]);

  const state = deriveState(punches);
  const nextEvent = selected ? inferNextEvent(punches, now, policy) : null;

  /** The single write path. The database infers the event, not this screen. */
  const handleScan = async () => {
    if (!selected || scanning) return;
    setScanning(true);
    setNotice(null);
    try {
      const { data, error } = await db.rpc('fms_hr_record_attendance_punch', {
        p_employee_id: selected.id,
        p_at: new Date().toISOString(),
        p_source: 'kiosk',
        p_device_id: 'KIOSK-01',
      });

      if (error) {
        setNotice(error.message);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (row?.duplicate) {
        setNotice(
          `That scan was already recorded today (${
            EVENT_LABELS[row.event_type as AttendanceEvent]
          }). Nothing was added.`,
        );
      } else if (row?.event_type) {
        setLastResult({
          event: row.event_type as AttendanceEvent,
          time: fmtTime(row.punched_at ?? new Date().toISOString()),
        });
      }
      await loadPunches(selected.id);
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Could not record the scan');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <ScanLine className="h-6 w-6" />
            Attendance Kiosk
          </CardTitle>
          <CardDescription>
            Simulation mode — no hardware connected. When the fingerprint machine arrives it
            will send only the worker ID and the time; this page already works exactly like that.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Shift {policy.workdayStart}–{policy.workdayEnd} · tea {policy.teaStart} (
            {policy.teaMinutes} min) · break {policy.breakStart} ({policy.breakMinutes} min,
            {policy.breakIsPaid ? ' paid' : ' unpaid'})
          </p>

          {/* Step 1 — who is scanning */}
          {!selected ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your name or employee number..."
                  className="h-12 pl-9 text-lg"
                  autoFocus
                />
              </div>
              <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
                {filtered.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => void selectEmployee(e)}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                      {e.first_name[0]}
                      {e.last_name[0]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {e.first_name} {e.last_name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {e.employee_number || 'no number'} · {e.department || '—'}
                      </span>
                    </span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
                    No active employee matches that.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Step 2 — the scan */}
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 p-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                  {selected.first_name[0]}
                  {selected.last_name[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {selected.first_name} {selected.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selected.employee_number || 'no employee number'} ·{' '}
                    {selected.department || '—'}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  <RotateCcw className="mr-1 h-4 w-4" />
                  Change
                </Button>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {previewMessage(punches, now, policy)}
                </p>
                <Button
                  size="lg"
                  className="mt-3 h-24 w-full text-xl"
                  disabled={scanning}
                  onClick={handleScan}
                >
                  {scanning ? (
                    <RotateCcw className="mr-2 h-6 w-6 animate-spin" />
                  ) : (
                    <ScanLine className="mr-2 h-6 w-6" />
                  )}
                  {scanning ? 'Recording…' : 'Scan fingerprint'}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                  {state === 'not_in' ? 'not clocked in' : state.replace('_', ' ')}
                  {nextEvent ? ` · next scan = ${EVENT_LABELS[nextEvent]}` : ''}
                </p>
              </div>

              {lastResult && (
                <div className="flex items-center gap-3 rounded-lg border border-green-500/40 bg-green-500/5 p-4">
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-700">
                      {EVENT_LABELS[lastResult.event]}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Recorded at {lastResult.time}
                    </p>
                  </div>
                </div>
              )}

              {notice && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
                  <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600" />
                  <p className="text-sm text-amber-800">{notice}</p>
                </div>
              )}

              {/* Today so far */}
              {punches.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Today</p>
                  <ol className="space-y-1">
                    {punches.map((p, i) => (
                      <li
                        key={`${p.punched_at}-${i}`}
                        className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1.5 text-sm"
                      >
                        <span className="w-14 font-mono text-xs text-muted-foreground">
                          {fmtTime(p.punched_at)}
                        </span>
                        <Badge variant="outline" className={EVENT_TONE[p.event_type]}>
                          {EVENT_ICON[p.event_type]}
                          {EVENT_LABELS[p.event_type]}
                        </Badge>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Events are decided by the database, never by this screen.
      </p>
    </div>
  );
};

export default Kiosk;
