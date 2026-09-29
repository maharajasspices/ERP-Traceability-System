import React, { useEffect, useRef, useState } from 'react';
import { BellRing, CalendarCheck, CalendarClock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { useHRData } from '@/hooks/useHRData';

// Persistent bell reminder for HR: scheduled disciplinary meetings from
// issued warnings that still need to be confirmed or postponed.
// Rendered in both the main header and the HR layout header so it is
// visible on every page even if the dashboard is forgotten.
export const WarningMeetingsBell: React.FC = () => {
  const { fmsUser } = useFMSAuth();
  const { warnings } = useHRData();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const pendingCount = warnings.filter(w => w.meeting_status === 'pending').length;

  // Close the dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Only HR users and system admins see the reminder
  if (!fmsUser || (fmsUser.role !== 'hr_user' && fmsUser.role !== 'system_admin')) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="relative rounded-lg border border-border bg-background p-2 hover:bg-accent"
        title="Warning meetings awaiting confirmation"
      >
        <BellRing className={`h-4 w-4 ${pendingCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
        {pendingCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
            {pendingCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[380px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-3 shadow-lg">
          <p className="mb-2 text-sm font-semibold text-foreground">
            Warning Meetings
            {pendingCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {pendingCount} pending
              </span>
            )}
          </p>
          <WarningMeetingsList compact />
        </div>
      )}
    </div>
  );
};

// Shared list of pending disciplinary-meeting reminders from issued warnings.
// Used on the Dashboard (panel) and in the Header (bell dropdown) so HR
// always sees meetings that still need to be confirmed or postponed.
export const WarningMeetingsList: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { warnings, employees, confirmWarningMeeting, postponeWarningMeeting } = useHRData();
  const [postponingId, setPostponingId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingMeetings = warnings
    .filter(w => w.meeting_status === 'pending' && w.meeting_date)
    .sort(
      (a, b) => new Date(a.meeting_date!).getTime() - new Date(b.meeting_date!).getTime()
    );

  const getEmployeeName = (employeeId: string) => {
    const e = employees.find(emp => emp.id === employeeId);
    return e ? `${e.first_name} ${e.last_name}` : 'Unknown employee';
  };

  const handleConfirm = async (id: string) => {
    setBusyId(id);
    await confirmWarningMeeting(id);
    setBusyId(null);
  };

  const handlePostpone = async (id: string) => {
    if (!newDate) return;
    setBusyId(id);
    const ok = await postponeWarningMeeting(id, newDate);
    setBusyId(null);
    if (ok) {
      setPostponingId(null);
      setNewDate('');
    }
  };

  if (pendingMeetings.length === 0) {
    return (
      <p className={`text-muted-foreground ${compact ? 'px-3 py-2 text-xs' : 'text-sm'}`}>
        No scheduled warning meetings waiting for confirmation.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {pendingMeetings.map(w => {
        const meetingDate = new Date(w.meeting_date!);
        const isBusy = busyId === w.id;
        return (
          <div
            key={w.id}
            className="rounded-lg border border-amber-300 bg-amber-50 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <CalendarClock className="h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {getEmployeeName(w.employee_id)} — {w.warning_type.charAt(0).toUpperCase() + w.warning_type.slice(1)} warning meeting
                </p>
                <p className="text-xs text-muted-foreground">
                  {meetingDate.toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {w.meeting_postponed_to ? ' · postponed' : ''}
                  {' · '}
                  {w.reason}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="gap-1.5 bg-green-600 text-white hover:bg-green-700"
                  disabled={isBusy}
                  onClick={() => handleConfirm(w.id)}
                >
                  {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />}
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPostponingId(postponingId === w.id ? null : w.id);
                    setNewDate('');
                  }}
                  disabled={isBusy}
                >
                  Postpone
                </Button>
              </div>
            </div>

            {postponingId === w.id && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2">
                <Input
                  type="datetime-local"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="h-9 w-auto flex-1 text-sm"
                />
                <Button
                  size="sm"
                  disabled={!newDate || isBusy}
                  onClick={() => handlePostpone(w.id)}
                >
                  {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Save new date
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
