import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { useHRData } from '@/hooks/useHRData';
import { StatCard } from '@/components/dashboard/StatCard';
import {
  Users,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  FileCheck,
  FileText,
  UserPlus,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  RefreshCcw,
  BellRing,
} from 'lucide-react';


import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import logo from '@/assets/logo.png';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useNotifications, FMSNotification } from '@/hooks/useNotifications'

const leaveTypeLabels: Record<string, string> = {
  annual: 'Annual Leave',
  sick: 'Sick Leave',
  family_responsibility: 'Family Responsibility',
  study: 'Study Leave',
  unpaid: 'Unpaid Leave',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
};
const HRDashboard: React.FC = () => {
  const { fmsUser } = useFMSAuth();
  const { 
    employees,
    attendance, 
    leaveRequests, 
    documents, 
    warnings, 
    contractSignatures, 
    updateLeaveStatus, 
    confirmWarningMeeting, 
    postponeWarningMeeting, 
    refreshData 
  } = useHRData();

  const { notifications, markAsRead } = useNotifications();
    // ======================================================
// CONTRACT SIGNED POPUP ALERT
// ======================================================

const [contractPopupNotification, setContractPopupNotification] =
  useState<FMSNotification | null>(null);

const seenContractNotificationIds = useRef<Set<string>>(new Set());
const notificationsInitialised = useRef(false);

useEffect(() => {
  const unreadContractNotification = notifications.find(
    notification =>
      notification.entity_type === 'contract_signature' &&
      notification.notification_type === 'success' &&
      !notification.is_read
  );

  if (unreadContractNotification) {
    setContractPopupNotification(unreadContractNotification);
  }
}, [notifications]);


  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [leavePopupOpen, setLeavePopupOpen] = useState(false);
  const [seenPendingIds, setSeenPendingIds] = useState<Set<string>>(new Set());
  const [meetingPopupOpen, setMeetingPopupOpen] = useState(false);
  const [seenMeetingIds, setSeenMeetingIds] = useState<Set<string>>(new Set());


  // Tracks whether HR has dismissed the current round of meeting popups.
  // Reset to false whenever a genuinely NEW pending meeting appears so the
  // popup fires again (e.g. a second employee schedules a meeting).
  const [meetingsDismissed, setMeetingsDismissed] = useState(false);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [meetingBusyId, setMeetingBusyId] = useState<string | null>(null);

  const activeEmployees = employees.filter(e => e.status === 'active').length;

  //Leave
  const onLeaveCount = employees.filter(e => e.status === 'on_leave').length;
  const pendingLeave = leaveRequests.filter(l => l.status === 'pending').length;
  const approvedLeave = leaveRequests.filter(l => l.status === 'approved').length;

  const todayAttendance = attendance.filter(a => {
    const today = new Date().toISOString().split('T')[0];
    return a.attendance_date === today;
  }).length;

  /*
   * Pop a modal over the dashboard as soon as a NEW pending warning meeting
   * (scheduled when the warning was sent) arrives while HR is viewing it.
   * Polling below covers meetings set while the page was already open.
   */
  const pendingMeetings = useMemo(
    () =>
      (warnings ?? [])
        .filter(w => w.meeting_status === 'pending' && w.meeting_date)
        .sort((a, b) => new Date(a.meeting_date!).getTime() - new Date(b.meeting_date!).getTime()),
    [warnings]
  );

  useEffect(() => {
    const unseen = pendingMeetings.filter(w => !seenMeetingIds.has(w.id));
    if (unseen.length > 0) {
      setSeenMeetingIds(prev => {
        const next = new Set(prev);
        unseen.forEach(w => next.add(w.id));
        return next;
      });
      // Any unseen meeting is genuinely new (dismissed ones are already in
      // the seen set), so always pop the notification. The header bell +
      // dashboard panel keep it visible afterwards.
      setMeetingPopupOpen(true);
      setReschedulingId(null);
      setRescheduleDate('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMeetings]);

  

   const handleConfirmMeeting = async (warningId: string) => {
     setMeetingBusyId(warningId);
     const ok = await confirmWarningMeeting(warningId);
     setMeetingBusyId(null);
     if (ok && pendingMeetings.length <= 1) {
       setMeetingPopupOpen(false);
     }
   };

  

   const handleRescheduleMeeting = async (warningId: string) => {
     if (!rescheduleDate) return;
     setMeetingBusyId(warningId);
     const ok = await postponeWarningMeeting(warningId, rescheduleDate);
     setMeetingBusyId(null);
     if (ok) {
       setSeenMeetingIds(prev => {
         const next = new Set(prev);
         next.add(warningId);
         return next;
       });
       setReschedulingId(null);
       setRescheduleDate('');
       setMeetingPopupOpen(false);
     }
   };

   const getMeetingEmployeeName = (employeeId: string) => {
     const emp = employees.find(e => e.id === employeeId);
     return emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown employee';
   };

  const formatMeetingDate = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  /*
   * Sync with newly-submitted / decided employee leave requests and newly
   * scheduled warning meetings by polling the database while the dashboard
   * is mounted.
   */
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 15000);

    return () => clearInterval(interval);
  }, [refreshData]);

   const handleRefresh = async () => {
     setRefreshing(true);
     try {
       await refreshData();
     } finally {
       setRefreshing(false);
     }
   };

  

   const employeeMap = useMemo(() => {
     const map = new Map<string, HREmployeeLite>();
     employees.forEach(e => {
       map.set(e.id, {
         first_name: e.first_name,
         last_name: e.last_name,
         employee_number: e.employee_number,
         department: e.department,
         email: e.email,
       });
     });
     return map;
   }, [employees]);

  

  const today = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const getEmployeeName = (leave: any) => {
    const emp = employeeMap.get(leave.employee_id);
    if (emp) return `${emp.first_name} ${emp.last_name}`;
    return leave.employee_name || 'Unknown Employee';
  };

 const getEmployeeNumber = (leave: any) => {
     const emp = employeeMap.get(leave.employee_id);
     return emp?.employee_number || leave.employee_number || '—';
   };

   const getDepartment = (leave: any) => {
     const emp = employeeMap.get(leave.employee_id);
     return emp?.department || '—';
   };
  

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatLeaveType = (type: string) =>
    leaveTypeLabels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  // Pending requests awaiting an immediate decision.
  const pendingRequests = useMemo(
    () => leaveRequests.filter(l => l.status === 'pending'),
    [leaveRequests]
  );

  // Approved leave that is coming up in the future (for the upcoming view).
  const upcomingLeave = useMemo(
    () =>
      leaveRequests
        .filter(l => l.status === 'approved' && l.start_date > today)
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .slice(0, 10),
    [leaveRequests, today]
  );

  // Today's date in Y-M-D for comparing date-only contract_signed_date.
  const todayDateOnly = today;

  // Employees whose contracts were signed today or within the last 7 days.
  // Surfaced as a notification on the HR dashboard the moment the signing
  // completes (HR dashboard polls refreshData every 15s).
   const recentlySignedContracts = useMemo(
    () =>
       employees
         .filter(e => e.contract_signed && e.contract_signed_date)
         .map(e => ({
           id: e.id,
           name: `${e.first_name} ${e.last_name}`,
           employee_number: e.employee_number || '—',
           signed_date: String(e.contract_signed_date).slice(0, 10),
           signed_contract_url: e.signed_contract_url,
         }))
         .filter((e) => {
           const d = new Date(`${e.signed_date}T00:00:00`);
          const diff = (new Date(`${todayDateOnly}T00:00:00`).getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
           return diff >= 0 && diff <= 7;
         })
         .sort((a, b) => b.signed_date.localeCompare(a.signed_date))
         .slice(0, 10),
     [employees, todayDateOnly]
   );

      const signedTodayCount = useMemo(
        () =>
          recentlySignedContracts.filter(
            contract => contract.signed_date === todayDateOnly
          ).length,
        [recentlySignedContracts, todayDateOnly]
      );


  const handleDecision = async (leave: any, decision: 'approved' | 'declined') => {
    setActingOnId(leave.id);
    try {
      const note = (reviewNotes[leave.id] || '').trim();
      const result = await updateLeaveStatus(leave.id, decision, note || undefined);
      if (result) {
        setReviewNotes(prev => {
          const next = { ...prev };
          delete next[leave.id];
          return next;
        });
      }
    } finally {
      setActingOnId(null);
    }
  };

  useEffect(() => {
    const freshPending = pendingRequests.filter(
      l => !seenPendingIds.has(l.id)
    );

    if (freshPending.length > 0) {
      // Mark them as seen so they don't keep re-popping when polling.
      setSeenPendingIds(prev => {
        const next = new Set(prev);
        freshPending.forEach(l => next.add(l.id));
        return next;
      });
      setLeavePopupOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRequests]);

  // When a decision is made, keep the pop-up open only if more pending remain.
  useEffect(() => {
    if (!leavePopupOpen) return;
    if (pendingRequests.length === 0) {
      setLeavePopupOpen(false);
    }
  }, [pendingRequests, leavePopupOpen]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Pop-up: employee has signed their contract */}
<Dialog
  open={!!contractPopupNotification}
  onOpenChange={(open) => {
    if (!open) {
      setContractPopupNotification(null);
    }
  }}
>
  <DialogContent className="sm:max-w-md">
    <DialogHeader className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <FileCheck className="h-8 w-8 text-emerald-600" />
      </div>

      <DialogTitle className="text-xl">
        Contract Signed
      </DialogTitle>

      <DialogDescription className="text-base">
        {contractPopupNotification?.message ||
          'An employee has signed their employment contract.'}
      </DialogDescription>
    </DialogHeader>

    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        </div>

        <div>
          <p className="font-semibold text-foreground">
            Contract completed
          </p>

          <p className="text-xs text-muted-foreground">
            The signed contract has been saved to the employee's records.
          </p>
        </div>
      </div>

      {contractPopupNotification?.created_at && (
        <p className="mt-3 text-xs text-muted-foreground">
          Signed{' '}
          {new Date(
            contractPopupNotification.created_at
          ).toLocaleString('en-ZA', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>

    <DialogFooter className="flex-col gap-2 sm:flex-row">
      <Button
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => {
          setContractPopupNotification(null);
        }}
      >
        Dismiss
      </Button>

      <Button
  className="w-full sm:w-auto"
  onClick={async () => {
    const notification = contractPopupNotification;

    if (!notification) return;

    // Mark notification as read so it will not pop up again
    await markAsRead(notification.id);

    // Open the signed contract PDF
    if (notification.entity_id) {
      const signedContract = contractSignatures.find(
        signature => signature.id === notification.entity_id
      );

      if (signedContract?.signed_contract_url) {
        window.open(
          signedContract.signed_contract_url,
          '_blank'
        );
      }
    }

    // Close the popup
    setContractPopupNotification(null);
  }}
>
  <FileText className="mr-2 h-4 w-4" />
  View Contract
</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
      {/* Pop-up: newly scheduled warning meeting awaiting HR decision */}
      <Dialog open={meetingPopupOpen} onOpenChange={setMeetingPopupOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <span className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <BellRing className="h-4 w-4" />
                </span>
                New Warning Meeting Scheduled
              </span>
            </DialogTitle>
            <DialogDescription>
              An employee set a meeting when a warning was sent. Confirm it or reschedule it below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {pendingMeetings.map(w => {
              const busy = meetingBusyId === w.id;
              const rescheduling = reschedulingId === w.id;
              return (
                <div key={w.id} className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CalendarClock className="h-4 w-4 shrink-0 text-amber-600"/>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {getMeetingEmployeeName(w.employee_id)} — {w.warning_type.charAt(0).toUpperCase() + w.warning_type.slice(1)} warning meeting
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatMeetingDate(w.meeting_date!)}
                        {w.meeting_postponed_to ? ' · postponed' : ''}
                        {' · '}{w.reason}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="gap-1.5 bg-green-600 text-white hover:bg-green-700"
                        disabled={busy}
                        onClick={() => handleConfirmMeeting(w.id)}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setReschedulingId(rescheduling ? null : w.id);
                          setRescheduleDate('');
                        }}
                      >
                        Reschedule
                      </Button>
                    </div>
                  </div>
                  {rescheduling && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2">
                      <Input
                        type="datetime-local"
                        value={rescheduleDate}
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        className="h-9 w-auto flex-1 text-sm"
                      />
                      <Button
                        size="sm"
                        disabled={!rescheduleDate || busy}
                        onClick={() => handleRescheduleMeeting(w.id)}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Save new date
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Pop-up: leave request awaiting HR decision */}
      <Dialog open={leavePopupOpen} onOpenChange={setLeavePopupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <BellRing className="h-6 w-6" />
            </div>
            <DialogTitle>New Leave Request</DialogTitle>
            <DialogDescription>
              An employee has requested leave and is waiting for your decision.
            </DialogDescription>
          </DialogHeader>

          <div className="divide-y divide-border rounded-lg border border-border">
            {pendingRequests.slice(0, 3).map(leave => (
              <div key={leave.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{getEmployeeName(leave)}</p>
                    <p className="text-xs text-muted-foreground">
                      {getEmployeeNumber(leave)}
                      {getDepartment(leave) !== '—' ? ` · ${getDepartment(leave)}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                    Pending
                  </span>
                </div>

                <p className="mt-3 text-sm font-medium text-foreground">
                  {formatLeaveType(leave.leave_type)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(leave.start_date)} – {formatDate(leave.end_date)} ·{' '}
                  {leave.total_days ?? leave.days_requested ?? '—'} day(s)
                </p>
                {leave.reason && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">"{leave.reason}"</p>
                )}

                <div className="mt-4 flex flex-col gap-2">
                  <textarea
                    value={reviewNotes[leave.id] || ''}
                    onChange={e =>
                      setReviewNotes(prev => ({ ...prev, [leave.id]: e.target.value }))
                    }
                    rows={1}
                    placeholder="Optional comment..."
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={actingOnId === leave.id}
                      onClick={() => handleDecision(leave, 'approved')}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actingOnId === leave.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={actingOnId === leave.id}
                      onClick={() => handleDecision(leave, 'declined')}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actingOnId === leave.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pendingRequests.length > 3 && (
            <p className="text-center text-xs text-muted-foreground">
              + {pendingRequests.length - 3} more request(s). View all in the Leave section.
            </p>
          )}
        </DialogContent>
      </Dialog>


      {/* Welcome Section */}
      <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-background to-background p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <img src={logo} alt="Maharaja's Spices" className="h-16 sm:h-12 w-auto max-w-[140px] sm:max-w-[120px] object-contain shrink-0 mx-auto sm:mx-0" />
          <div className="text-center sm:text-left">
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              Welcome{fmsUser ? `, ${fmsUser.name}` : ''}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              HR Department - Manage employees, attendance, leave and staff records.
            </p>
          </div>
        </div>
      </div>

      {/* Recently Signed Contracts - notification when an employee signs */}
      {recentlySignedContracts.length > 0 && (
        <div className="rounded-xl border border-emerald-300/50 bg-emerald-50/40 shadow-card animate-fade-in">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-emerald-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <FileCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  Contracts Signed
                </h3>
                <p className="text-xs text-muted-foreground">
                  {signedTodayCount > 0
                    ? `${signedTodayCount} signed today — employee(s) have completed their contract.`
                    : 'Contracts signed in the last 7 days.'}
                </p>
              </div>
            </div>
            {signedTodayCount > 0 && (
              <span className="shrink-0 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white">
                {signedTodayCount} new
              </span>
            )}
          </div>

          <div className="divide-y divide-border">
            {recentlySignedContracts.map((sig) => (
              <div key={sig.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{sig.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {sig.employee_number} · Signed {formatDate(sig.signed_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    Contract Signed
                  </span>
                  {sig.signed_contract_url ? (
                    <a
                      href={sig.signed_contract_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      View
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Employees" value={activeEmployees} icon={Users} variant="primary" />
        <StatCard title="On Leave" value={onLeaveCount} icon={CalendarDays} variant="warning" />
        <StatCard title="Pending Leave" value={pendingLeave} icon={Clock} variant="warning" />
        <StatCard title="Documents" value={documents.length} icon={FileText} variant="default" />
      </div>

      {/* Pending Leave Requests - pop up here for immediate decision */}
      {pendingRequests.length > 0 && (
        <div className="rounded-xl border border-amber-300/50 bg-card shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-amber-50/50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  Leave Requests Awaiting Approval
                </h3>
                <p className="text-xs text-muted-foreground">
                  {pendingRequests.length} request(s) - review and decide below.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </button>
          </div>

          <div className="divide-y divide-border">
            {pendingRequests.map(leave => (
              <div key={leave.id} className="px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{getEmployeeName(leave)}</p>
                    <p className="text-xs text-muted-foreground">
                      {getEmployeeNumber(leave)}{getDepartment(leave) !== '—' ? ` · ${getDepartment(leave)}` : ''}
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {formatLeaveType(leave.leave_type)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(leave.start_date)} – {formatDate(leave.end_date)} ·{' '}
                      {leave.total_days ?? leave.days_requested ?? '—'} day(s)
                    </p>
                    {leave.reason && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">"{leave.reason}"</p>
                    )}
                  </div>
<div className="flex w-full max-w-sm flex-col gap-2 lg:w-72">
                    <textarea
                      value={reviewNotes[leave.id] || ''}
                      onChange={e =>
                        setReviewNotes(prev => ({ ...prev, [leave.id]: e.target.value }))
                      }
                      rows={2}
                      placeholder="Optional comment..."
                      className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={actingOnId === leave.id}
                        onClick={() => handleDecision(leave, 'approved')}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actingOnId === leave.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actingOnId === leave.id}
                        onClick={() => handleDecision(leave, 'declined')}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actingOnId === leave.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
{/* Quick Actions */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-foreground">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/hr/employees" className="group rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:border-emerald-400/50 hover:shadow-md">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <UserPlus className="h-5 w-5" />
            </div>
            <p className="font-semibold text-foreground">Employees</p>
            <p className="text-xs text-muted-foreground mt-1">Staff records & details</p>
          </Link>

          <Link to="/hr/attendance" className="group rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:border-emerald-400/50 hover:shadow-md">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <p className="font-semibold text-foreground">Attendance</p>
            <p className="text-xs text-muted-foreground mt-1">{todayAttendance} marked today</p>
          </Link>

          <Link to="/hr/leave" className="group rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:border-emerald-400/50 hover:shadow-md">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CalendarDays className="h-5 w-5" />
            </div>
            <p className="font-semibold text-foreground">Leave</p>
            <p className="text-xs text-muted-foreground mt-1">{pendingLeave} pending requests</p>
          </Link>

          <Link to="/hr/documents" className="group rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:border-emerald-400/50 hover:shadow-md">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <FileText className="h-5 w-5" />
            </div>
            <p className="font-semibold text-foreground">Documents</p>
            <p className="text-xs text-muted-foreground mt-1">Contracts & records</p>
          </Link>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h3 className="font-semibold text-foreground mb-4">Leave Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-3">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium text-foreground">{approvedLeave} approved leave requests</p>
                <p className="text-xs text-muted-foreground">All time</p>
              </div>
            </div>
            {pendingLeave > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
                <AlertCircle className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-sm font-medium text-foreground">{pendingLeave} pending leave request(s)</p>
                  <p className="text-xs text-muted-foreground">Awaiting review</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h3 className="font-semibold text-foreground mb-4">Your Role</h3>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <Users className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-foreground capitalize">
                {fmsUser?.role === 'hr_user' ? 'HR User' : fmsUser?.role?.replace('_', ' ')}
              </p>
              <p className="text-xs text-muted-foreground">Human Resources Department</p>
            </div>
          </div>
        </div>
      </div>
{/* Upcoming Approved Leave */}
      {upcomingLeave.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Upcoming Leave</h3>
              <p className="text-xs text-muted-foreground">Approved leave coming up</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {upcomingLeave.map(leave => (
              <div key={leave.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-foreground">{getEmployeeName(leave)}</p>
                  <p className="text-xs text-muted-foreground">{getEmployeeNumber(leave)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-medium text-foreground">{formatLeaveType(leave.leave_type)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(leave.start_date)} – {formatDate(leave.end_date)}
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    Approved
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface HREmployeeLite {
  first_name: string;
  last_name: string;
  employee_number?: string;
  department?: string;
  email?: string;
}

export default HRDashboard;