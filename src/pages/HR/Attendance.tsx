import React, { useMemo, useState } from 'react';
import { useHRData } from '@/hooks/useHRData';
import { CalendarCheck, Clock, UserX, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  present: 'bg-success/10 text-success border-success/30',
  absent: 'bg-destructive/10 text-destructive border-destructive/30',
  late: 'bg-warning/10 text-warning border-warning/30',
  half_day: 'bg-info/10 text-info border-info/30',
  leave: 'bg-muted text-muted-foreground border-border',
};

const Attendance: React.FC = () => {
  const { attendance, employees, loading } = useHRData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const employeeMap = useMemo(() => {
    const map = new Map<string, { first_name: string; last_name: string }>();
    employees.forEach((e) => map.set(e.id, { first_name: e.first_name, last_name: e.last_name }));
    return map;
  }, [employees]);

  const filtered = useMemo(() => {
    return attendance.filter((a) => {
      const emp = employeeMap.get(a.employee_id);
      const name = emp ? `${emp.first_name} ${emp.last_name}`.toLowerCase() : '';
      const matchesSearch = !search || name.includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [attendance, employeeMap, search, statusFilter]);

  const today = new Date().toISOString().split('T')[0];
  const todayCount = attendance.filter((a) => a.attendance_date === today).length;
  const presentCount = attendance.filter((a) => a.status === 'present').length;

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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{todayCount}</p>
              <p className="text-xs text-muted-foreground">Marked today</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{presentCount}</p>
              <p className="text-xs text-muted-foreground">Total present</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{attendance.length}</p>
              <p className="text-xs text-muted-foreground">Total records</p>
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
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="late">Late</option>
          <option value="half_day">Half Day</option>
          <option value="leave">Leave</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Time In</th>
                <th className="px-4 py-3 font-semibold">Time Out</th>
                <th className="px-4 py-3 font-semibold">Hours</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No attendance records found.
                  </td>
                </tr>
              )}
              {filtered.map((a) => {
                const emp = employeeMap.get(a.employee_id);
                return (
                  <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.attendance_date}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.time_in || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.time_out || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.hours_worked != null ? `${a.hours_worked}h` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize", statusStyles[a.status] || 'bg-muted text-muted-foreground border-border')}>
                        {a.status.replace('_', ' ')}
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

export default Attendance;