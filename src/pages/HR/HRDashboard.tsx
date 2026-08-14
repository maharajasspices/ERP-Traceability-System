import React from 'react';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { useHRData } from '@/hooks/useHRData';
import { StatCard } from '@/components/dashboard/StatCard';
import { Users, CalendarCheck, CalendarDays, FileText, UserPlus, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '@/assets/logo.png';


const HRDashboard: React.FC = () => {
  const { fmsUser } = useFMSAuth();
  const { employees, attendance, leaveRequests, documents, loading } = useHRData();

  const activeEmployees = employees.filter(e => e.status === 'active').length;
  const onLeaveCount = employees.filter(e => e.status === 'on_leave').length;
  const pendingLeave = leaveRequests.filter(l => l.status === 'pending').length;
  const approvedLeave = leaveRequests.filter(l => l.status === 'approved').length;

  const todayAttendance = attendance.filter(a => {
    const today = new Date().toISOString().split('T')[0];
    return a.attendance_date === today;
  }).length;

  return (
    <div className="space-y-6 animate-fade-in">
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

      {/* Stats Grid */}
      <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Employees" value={activeEmployees} icon={Users} variant="primary" />
        <StatCard title="On Leave" value={onLeaveCount} icon={CalendarDays} variant="warning" />
        <StatCard title="Pending Leave" value={pendingLeave} icon={Clock} variant="warning" />
        <StatCard title="Documents" value={documents.length} icon={FileText} variant="default" />
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-foreground">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/hr/employees"
            className="group rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:border-emerald-400/50 hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <UserPlus className="h-5 w-5" />
            </div>
            <p className="font-semibold text-foreground">Employees</p>
            <p className="text-xs text-muted-foreground mt-1">Staff records & details</p>
          </Link>

          <Link
            to="/hr/attendance"
            className="group rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:border-emerald-400/50 hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <p className="font-semibold text-foreground">Attendance</p>
            <p className="text-xs text-muted-foreground mt-1">{todayAttendance} marked today</p>
          </Link>

          <Link
            to="/hr/leave"
            className="group rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:border-emerald-400/50 hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CalendarDays className="h-5 w-5" />
            </div>
            <p className="font-semibold text-foreground">Leave</p>
            <p className="text-xs text-muted-foreground mt-1">{pendingLeave} pending requests</p>
          </Link>

          <Link
            to="/hr/documents"
            className="group rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:border-emerald-400/50 hover:shadow-md"
          >
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
    </div>
  );
};

export default HRDashboard;