import React, { useMemo, useState } from 'react';
import { useHRData } from '@/hooks/useHRData';
import { AlertTriangle, ShieldAlert, CheckCircle2, Loader2, Search, MessageSquareWarning } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const { warnings, employees, loading } = useHRData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const employeeMap = useMemo(() => {
    const map = new Map<string, { first_name: string; last_name: string }>();
    employees.forEach((e) => map.set(e.id, { first_name: e.first_name, last_name: e.last_name }));
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
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
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

export default Warnings;