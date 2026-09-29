import React, { useEffect, useMemo, useState } from "react";
import { useHRData } from "@/hooks/useHRData";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCcw,
  Search,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  pending:
    "bg-amber-50 text-amber-700 border-amber-200",
  approved:
    "bg-emerald-50 text-emerald-700 border-emerald-200",
  declined:
    "bg-red-50 text-red-700 border-red-200",
  cancelled:
    "bg-gray-100 text-gray-600 border-gray-200",
};

const leaveTypeLabels: Record<string, string> = {
  annual: "Annual Leave",
  sick: "Sick Leave",
  family_responsibility: "Family Responsibility",
  study: "Study Leave",
  unpaid: "Unpaid Leave",
  maternity: "Maternity Leave",
  paternity: "Paternity Leave",
};

const Leave: React.FC = () => {
  const { leaveRequests, employees, loading, updateLeaveStatus, refreshData } = useHRData();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /*
   * Review note entered for a specific request. Keyed by leave id so
   * HR can add an optional comment alongside an approve/decline.
   */
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  /*
   * Keep the dashboard in sync with new/decided employee leave
   * requests by polling the database while this page is mounted.
   */
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 20000);

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

  /*
   * Approve or decline a pending request. The employee's portal will
   * reflect the new status the next time it polls.
   */
  const handleDecision = async (leave: any, decision: 'approved' | 'declined') => {
    setActingOnId(leave.id);
    try {
      const note = (reviewNotes[leave.id] || "").trim();
      const result = await updateLeaveStatus(leave.id, decision, note || undefined);
      if (result) {
        // Clear the comment once applied.
        setReviewNotes((prev) => {
          const next = { ...prev };
          delete next[leave.id];
          return next;
        });
      }
    } finally {
      setActingOnId(null);
    }
  };

  /*
   * Create a lookup map for employees.
   */
  const employeeMap = useMemo(() => {
    const map = new Map<
      string,
      {
        first_name: string;
        last_name: string;
        employee_number?: string | null;
        department?: string | null;
      }
    >();

    employees.forEach((employee) => {
      map.set(employee.id, {
        first_name: employee.first_name,
        last_name: employee.last_name,
        employee_number: employee.employee_number,
        department: employee.department,
      });
    });

    return map;
  }, [employees]);

  /*
   * Today's date in YYYY-MM-DD format.
   *
   * Using local date instead of UTC prevents the dashboard
   * from incorrectly showing someone as on leave around midnight.
   */
  const today = useMemo(() => {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }, []);

  /*
   * Employees currently on approved leave.
   */
  const employeesOnLeaveToday = useMemo(() => {
    return leaveRequests.filter((leave) => {
      return (
        leave.status === "approved" &&
        leave.start_date <= today &&
        leave.end_date >= today
      );
    });
  }, [leaveRequests, today]);

  /*
   * Upcoming approved leave.
   */
  const upcomingLeave = useMemo(() => {
    return leaveRequests
      .filter((leave) => {
        return (
          leave.status === "approved" &&
          leave.start_date > today
        );
      })
      .sort((a, b) =>
        a.start_date.localeCompare(b.start_date)
      )
      .slice(0, 10);
  }, [leaveRequests, today]);

  /*
   * Pending requests.
   */
  const pendingRequests = useMemo(() => {
    return leaveRequests.filter(
      (leave) => leave.status === "pending"
    );
  }, [leaveRequests]);

  /*
   * Filter all requests for the HR table.
   */
  const filteredRequests = useMemo(() => {
    return leaveRequests.filter((leave) => {
      const employee = employeeMap.get(leave.employee_id);

      const employeeName = employee
        ? `${employee.first_name} ${employee.last_name}`
        : (leave as any).employee_name || "Unknown";

      const employeeNumber =
        employee?.employee_number ||
        (leave as any).employee_number ||
        "";

      const searchText = search.toLowerCase();

      const matchesSearch =
        !search ||
        employeeName.toLowerCase().includes(searchText) ||
        employeeNumber.toLowerCase().includes(searchText) ||
        leave.leave_type.toLowerCase().includes(searchText);

      const matchesStatus =
        statusFilter === "all" ||
        leave.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [
    leaveRequests,
    employeeMap,
    search,
    statusFilter,
  ]);

  const approvedCount = leaveRequests.filter(
    (leave) => leave.status === "approved"
  ).length;

  const declinedCount = leaveRequests.filter(
    (leave) => leave.status === "declined"
  ).length;

  const getEmployeeName = (leave: any) => {
    const employee = employeeMap.get(leave.employee_id);

    if (employee) {
      return `${employee.first_name} ${employee.last_name}`;
    }

    return leave.employee_name || "Unknown Employee";
  };

  const getEmployeeNumber = (leave: any) => {
    const employee = employeeMap.get(leave.employee_id);

    return (
      employee?.employee_number ||
      leave.employee_number ||
      "—"
    );
  };

  const getDepartment = (leave: any) => {
    const employee = employeeMap.get(leave.employee_id);

    return employee?.department || "—";
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";

    return new Date(
      `${dateString}T00:00:00`
    ).toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatLeaveType = (type: string) => {
    return (
      leaveTypeLabels[type] ||
      type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) =>
          letter.toUpperCase()
        )
    );
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

      {/* =========================================================
          PAGE HEADER
      ========================================================= */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Leave Management
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Manage employee leave requests and see who is currently
          away from work.
        </p>
      </div>

      {/* =========================================================
          CURRENTLY ON LEAVE
      ========================================================= */}
      <div className="rounded-xl border border-border bg-card shadow-card">

        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Users className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-semibold text-foreground">
                Employees On Leave Today
              </h2>

              <p className="text-xs text-muted-foreground">
                {formatDate(today)}
              </p>
            </div>

          </div>

          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
            {employeesOnLeaveToday.length}
          </span>
        </div>

        {employeesOnLeaveToday.length === 0 ? (
          <div className="px-5 py-8 text-center">

            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />

            <p className="mt-2 text-sm font-medium text-foreground">
              Everyone is at work today
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              No employees are currently recorded as being on
              approved leave.
            </p>

          </div>
        ) : (
          <div className="divide-y divide-border">

            {employeesOnLeaveToday.map((leave) => (
              <div
                key={leave.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                    {getEmployeeName(leave)
                      .split(" ")
                      .map((name: string) => name[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>

                  <div>
                    <p className="font-medium text-foreground">
                      {getEmployeeName(leave)}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {getEmployeeNumber(leave)}
                      {getDepartment(leave) !== "—"
                        ? ` • ${getDepartment(leave)}`
                        : ""}
                    </p>
                  </div>

                </div>

                <div className="flex items-center gap-4">

                  <div className="text-left sm:text-right">
                    <p className="text-sm font-medium text-foreground">
                      {formatLeaveType(leave.leave_type)}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {formatDate(leave.start_date)} –{" "}
                      {formatDate(leave.end_date)}
                    </p>
                  </div>

                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    On Leave
                  </span>

                </div>

              </div>
            ))}

          </div>
        )}
      </div>

      {/* =========================================================
          STATISTICS
      ========================================================= */}
      <div className="grid gap-3 sm:grid-cols-3">

        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>

            <div>
              <p className="text-2xl font-bold text-foreground">
                {pendingRequests.length}
              </p>

              <p className="text-xs text-muted-foreground">
                Pending requests
              </p>
            </div>

          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>

            <div>
              <p className="text-2xl font-bold text-foreground">
                {approvedCount}
              </p>

              <p className="text-xs text-muted-foreground">
                Approved requests
              </p>
            </div>

          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <XCircle className="h-5 w-5" />
            </div>

            <div>
              <p className="text-2xl font-bold text-foreground">
                {declinedCount}
              </p>

              <p className="text-xs text-muted-foreground">
                Declined requests
              </p>
            </div>

          </div>
        </div>

      </div>

      {/* =========================================================
          UPCOMING LEAVE
      ========================================================= */}
      {upcomingLeave.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-card">

          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <CalendarDays className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-semibold text-foreground">
                  Upcoming Leave
                </h2>

                <p className="text-xs text-muted-foreground">
                  Approved leave coming up
                </p>
              </div>

            </div>
          </div>

          <div className="divide-y divide-border">

            {upcomingLeave.map((leave) => (
              <div
                key={leave.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >

                <div>
                  <p className="font-medium text-foreground">
                    {getEmployeeName(leave)}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {getEmployeeNumber(leave)}
                  </p>
                </div>

                <div className="flex items-center gap-3">

                  <div className="text-left sm:text-right">
                    <p className="text-sm font-medium text-foreground">
                      {formatLeaveType(leave.leave_type)}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {formatDate(leave.start_date)} –{" "}
                      {formatDate(leave.end_date)}
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

      {/* =========================================================
          ALL LEAVE REQUESTS
      ========================================================= */}
      <div className="space-y-3">

        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Leave Requests
          </h2>

          <p className="text-sm text-muted-foreground">
            Review and manage employee leave applications.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

          <div className="relative flex-1">

            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />

            <input
              type="search"
              placeholder="Search employee, employee number or leave type..."
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
            <option value="declined">Declined</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Refresh
          </button>

        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">

          <div className="overflow-x-auto">

            <table className="w-full text-sm">

              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">

                  <th className="px-4 py-3 font-semibold">
                    Employee
                  </th>

                  <th className="px-4 py-3 font-semibold">
                    Leave Type
                  </th>

                  <th className="px-4 py-3 font-semibold">
                    Dates
                  </th>

                  <th className="px-4 py-3 font-semibold">
                    Days
                  </th>

                  <th className="px-4 py-3 font-semibold">
                    Status
                  </th>

                  <th className="px-4 py-3 font-semibold">
                    Details
                  </th>

                </tr>
              </thead>

              <tbody>

                {filteredRequests.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      No leave requests found.
                    </td>
                  </tr>
                )}

                {filteredRequests.map((leave: any) => {

                  const isExpanded =
                    expandedId === leave.id;

                  return (
                    <React.Fragment key={leave.id}>

                      <tr className="border-b border-border/50 hover:bg-muted/30">

                        <td className="px-4 py-4">

                          <p className="font-medium text-foreground">
                            {getEmployeeName(leave)}
                          </p>

                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {getEmployeeNumber(leave)}
                          </p>

                        </td>

                        <td className="px-4 py-4 text-muted-foreground">
                          {formatLeaveType(
                            leave.leave_type
                          )}
                        </td>

                        <td className="px-4 py-4 text-muted-foreground">

                          <div>
                            {formatDate(
                              leave.start_date
                            )}
                          </div>

                          <div className="text-xs">
                            to{" "}
                            {formatDate(
                              leave.end_date
                            )}
                          </div>

                        </td>

                        <td className="px-4 py-4 text-muted-foreground">
                          {leave.total_days ?? leave.days_requested ?? "—"}
                        </td>

                        <td className="px-4 py-4">

                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
                              statusStyles[
                                leave.status
                              ] ||
                                "bg-muted text-muted-foreground border-border"
                            )}
                          >
                            {leave.status}
                          </span>

                        </td>

                        <td className="px-4 py-4">

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId(
                                isExpanded
                                  ? null
                                  : leave.id
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                          >
                            {isExpanded
                              ? "Hide"
                              : "Review"}

                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>

                        </td>

                      </tr>

                      {/* Expanded details */}
                      {isExpanded && (
                        <tr className="border-b border-border bg-muted/20">

                          <td
                            colSpan={6}
                            className="px-5 py-5"
                          >

                            <div className="grid gap-5 md:grid-cols-2">

                              <div>

                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Employee
                                </p>

                                <p className="mt-1 font-medium">
                                  {getEmployeeName(
                                    leave
                                  )}
                                </p>

                                <p className="text-sm text-muted-foreground">
                                  Employee Number:{" "}
                                  {getEmployeeNumber(
                                    leave
                                  )}
                                </p>

                                <p className="text-sm text-muted-foreground">
                                  Department:{" "}
                                  {getDepartment(
                                    leave
                                  )}
                                </p>

                                {leave.employee_email && (
                                  <p className="text-sm text-muted-foreground">
                                    Email:{" "}
                                    {leave.employee_email}
                                  </p>
                                )}

                              </div>

                              <div>

                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Leave Details
                                </p>

                                <p className="mt-1 font-medium">
                                  {formatLeaveType(
                                    leave.leave_type
                                  )}
                                </p>

                                <p className="text-sm text-muted-foreground">
                                  {formatDate(
                                    leave.start_date
                                  )}{" "}
                                  –{" "}
                                  {formatDate(
                                    leave.end_date
                                  )}
                                </p>

                                <p className="text-sm text-muted-foreground">
                                  Total days:{" "}
                                  {leave.total_days ?? leave.days_requested ?? "—"}
                                </p>

                              </div>

                              <div className="md:col-span-2">

                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Employee Reason
                                </p>

                                <div className="mt-2 rounded-lg border border-border bg-background p-3 text-sm text-foreground">
                                  {leave.reason ||
                                    "No reason provided."}
                                </div>

                              </div>

                              {leave.hr_comment && (
                                <div className="md:col-span-2">

                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    HR Comment
                                  </p>

                                  <div className="mt-2 rounded-lg border border-border bg-background p-3 text-sm text-foreground">
                                    {leave.hr_comment || leave.review_notes}
                                  </div>

                                </div>
                              )}

                              {/* Review actions */}
                              {leave.status ===
                                "pending" && (
                                <div className="md:col-span-2 space-y-3 border-t border-border pt-4">

                                  <textarea
                                    value={reviewNotes[leave.id] || ""}
                                    onChange={(e) =>
                                      setReviewNotes((prev) => ({
                                        ...prev,
                                        [leave.id]: e.target.value,
                                      }))
                                    }
                                    rows={2}
                                    placeholder="Optional comment for the employee (shown on their portal)..."
                                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-emerald-500"
                                  />

                                  <div className="flex flex-wrap gap-3">
                                    <button
                                      type="button"
                                      disabled={actingOnId === leave.id}
                                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                      onClick={() => handleDecision(leave, "approved")}
                                    >
                                      {actingOnId === leave.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="h-4 w-4" />
                                      )}
                                      Approve Leave
                                    </button>

                                    <button
                                      type="button"
                                      disabled={actingOnId === leave.id}
                                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                      onClick={() => handleDecision(leave, "declined")}
                                    >
                                      {actingOnId === leave.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <XCircle className="h-4 w-4" />
                                      )}
                                      Reject Leave
                                    </button>
                                  </div>

                                </div>
                              )}

                            </div>

                          </td>

                        </tr>
                      )}

                    </React.Fragment>
                  );
                })}

              </tbody>

            </table>

          </div>
        </div>

      </div>

    </div>
  );
};

export default Leave;