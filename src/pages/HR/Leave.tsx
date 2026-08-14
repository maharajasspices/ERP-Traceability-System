import React, { useMemo, useState } from 'react';
import { useHRData } from '@/hooks/useHRData';
import { CalendarDays, Clock, CheckCircle2, XCircle, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/30',
  approved: 'bg-success/10 text-success border-success/30',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

const leaveTypeLabels: Record<string, string> = {
  annual: 'Annual',
  sick: 'Sick',
  family_responsibility: 'Family Responsibility',
  study: 'Study',
  unpaid: 'Unpaid',
  maternity: 'Maternity',
  paternity: 'Paternity',
};

const Leave: React.FC = () => {
  const { leaveRequests, employees, loading } = useHRData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const employeeMap = useMemo(() => {
    const map = new Map<string, { first_name: string; last_name: string }>();
    employees.forEach((e) => map.set(e.id, { first_name: e.first_name, last_name: e.last_name }));
    return map;
  }, [employees]);

  const filtered = useMemo(() => {
    return leaveRequests.filter((l) => {
      const emp = employeeMap.get(l.employee_id);
      const name = emp ? `${emp.first_name} ${emp.last_name}`.toLowerCase() : '';
      const matchesSearch = !search || name.includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leaveRequests, employeeMap, search, statusFilter]);

  const pendingCount = leaveRequests.filter((l) => l.status === 'pending').length;
  const approvedCount = leaveRequests.filter((l) => l.status === 'approved').length;
  const rejectedCount = leaveRequests.filter((l) => l.status === 'rejected').length;

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
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending requests</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{approvedCount}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{rejectedCount}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
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
            placeholder="Search by employee name..."
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
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
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
                <th className="px-4 py-3 font-semibold">Start</th>
                <th className="px-4 py-3 font-semibold">End</th>
                <th className="px-4 py-3 font-semibold">Days</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No leave requests found.
                  </td>
                </tr>
              )}
              {filtered.map((l) => {
                const emp = employeeMap.get(l.employee_id);
                return (
                  <tr key={l.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {leaveTypeLabels[l.leave_type] || l.leave_type}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{l.start_date}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.end_date}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.days_requested}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize", statusStyles[l.status] || 'bg-muted text-muted-foreground border-border')}>
                        {l.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Leave;