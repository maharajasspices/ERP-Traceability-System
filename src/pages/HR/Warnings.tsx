import React, { useMemo, useState } from 'react';
import { useHRData } from '@/hooks/useHRData';
import { AlertTriangle, ShieldAlert, CheckCircle2, Loader2, Search, MessageSquareWarning, Mail, MessageCircle, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const statusStyles: Record<string, string> = {
  issued: 'bg-warning/10 text-warning border-warning/30',
  acknowledged: 'bg-info/10 text-info border-info/30',
  disputed: 'bg-destructive/10 text-destructive border-destructive/30',
  resolved: 'bg-success/10 text-success border-success/30',
};

const typeStyles: Record<string, string> = {
  verbal: 'bg-muted text-muted-foreground border-border',
  written: 'bg-warning/10 text-warning border-warning/30',
  final: 'bg-destructive/10 text-destructive border-destructive/30',
  other: 'bg-info/10 text-info border-info/30',
};

const Warnings: React.FC = () => {
  const { warnings, employees, loading, sendWarningNotification, refreshData } = useHRData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedWarningId, setSelectedWarningId] = useState<string | null>(null);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [sending, setSending] = useState(false);

  const employeeMap = useMemo(() => {
    const map = new Map<string, { first_name: string; last_name: string; email?: string; phone?: string }>();
    employees.forEach((e) => map.set(e.id, { first_name: e.first_name, last_name: e.last_name, email: e.email, phone: e.phone }));
    return map;
  }, [employees]);

  const filtered = useMemo(() => {
    return warnings.filter((w) => {
      const emp = employeeMap.get(w.employee_id);
      const name = emp ? `${emp.first_name} ${emp.last_name}`.toLowerCase() : '';
      const matchesSearch = !search || name.includes(search.toLowerCase()) || w.reason.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [warnings, employeeMap, search, statusFilter]);

  const issuedCount = warnings.filter((w) => w.status === 'issued').length;
  const acknowledgedCount = warnings.filter((w) => w.status === 'acknowledged').length;
  const resolvedCount = warnings.filter((w) => w.status === 'resolved').length;
  const disputedCount = warnings.filter((w) => w.status === 'disputed').length;

  const selectedWarning = selectedWarningId
    ? warnings.find((w) => w.id === selectedWarningId)
    : null;
  const selectedEmployee = selectedWarning
    ? employeeMap.get(selectedWarning.employee_id)
    : null;

  const handleSendNotification = async () => {
    if (!selectedWarning) return;

    setSending(true);
    try {
      const result = await sendWarningNotification(selectedWarning.id, sendEmail, sendWhatsApp);
      if (result) {
        setSelectedWarningId(null);
        // Refresh to update any status changes
        refreshData();
      }
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{issuedCount}</p>
              <p className="text-xs text-muted-foreground">Issued</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10 text-info">
              <MessageSquareWarning className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{acknowledgedCount}</p>
              <p className="text-xs text-muted-foreground">Acknowledged</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{disputedCount}</p>
              <p className="text-xs text-muted-foreground">Disputed</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{resolvedCount}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search by employee or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-emerald-500"
        >
          <option value="all">All Statuses</option>
          <option value="issued">Issued</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="disputed">Disputed</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Issued</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No warnings found.
                  </td>
                </tr>
              )}
              {filtered.map((w) => {
                const emp = employeeMap.get(w.employee_id);
                return (
                  <tr key={w.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize", typeStyles[w.warning_type] || 'bg-muted text-muted-foreground border-border')}>
                        {w.warning_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[300px] truncate" title={w.reason}>
                      {w.reason}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(w.issued_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize", statusStyles[w.status] || 'bg-muted text-muted-foreground border-border')}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedWarningId(w.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-emerald-600 transition hover:bg-emerald-50 hover:border-emerald-300"
                        title="Send email/WhatsApp notification"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Notify
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notification Modal */}
      {selectedWarning && selectedEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedWarningId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Send Warning Notification</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Send notification to {selectedEmployee.first_name} {selectedEmployee.last_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedWarningId(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Warning details */}
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase text-gray-500">
                {selectedWarning.warning_type} Warning
              </p>
              <p className="mt-1 text-sm text-gray-700">{selectedWarning.reason}</p>
              {selectedWarning.details && (
                <p className="mt-1 text-sm text-gray-500">{selectedWarning.details}</p>
              )}
            </div>

            {/* Notification options */}
            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 transition hover:border-emerald-300 hover:bg-emerald-50">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="h-4 w-4 accent-[#ef302b]"
                />
                <Mail className="h-5 w-5 text-emerald-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">Email</p>
                  <p className="text-xs text-gray-500">
                    {selectedEmployee.email || 'No email on file'}
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 transition hover:border-emerald-300 hover:bg-emerald-50">
                <input
                  type="checkbox"
                  checked={sendWhatsApp}
                  onChange={(e) => setSendWhatsApp(e.target.checked)}
                  className="h-4 w-4 accent-[#ef302b]"
                />
                <MessageCircle className="h-5 w-5 text-emerald-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">WhatsApp</p>
                  <p className="text-xs text-gray-500">
                    {selectedEmployee.phone || 'No phone on file'}
                  </p>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setSelectedWarningId(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendNotification}
                disabled={sending || (!sendEmail && !sendWhatsApp)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#ef302b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#d92824] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sending ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Warnings;