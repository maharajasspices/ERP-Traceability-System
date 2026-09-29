import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  LogOut,
  Send,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Employee = {
  id: string;
  employee_number: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  department: string | null;
};

type LeaveRequest = {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: string;
  hr_comment: string | null;
  created_at: string;
};

const leaveTypes = [
  {
    value: "annual",
    label: "Annual Leave",
  },
  {
    value: "sick",
    label: "Sick Leave",
  },
  {
    value: "family_responsibility",
    label: "Family Responsibility Leave",
  },
  {
    value: "study",
    label: "Study Leave",
  },
  {
    value: "unpaid",
    label: "Unpaid Leave",
  },
  {
    value: "maternity",
    label: "Maternity Leave",
  },
  {
    value: "paternity",
    label: "Paternity Leave",
  },
];

const statusStyles: Record<string, string> = {
  pending:
    "border-amber-200 bg-amber-50 text-amber-700",
  approved:
    "border-emerald-200 bg-emerald-50 text-emerald-700",
  declined:
    "border-red-200 bg-red-50 text-red-700",
  cancelled:
    "border-gray-200 bg-gray-100 text-gray-600",
};

const EmployeeLeave: React.FC = () => {
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [pin, setPin] = useState("");

  const [employee, setEmployee] =
    useState<Employee | null>(null);

  const [requests, setRequests] =
    useState<LeaveRequest[]>([]);

  const [loggingIn, setLoggingIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [leaveType, setLeaveType] =
    useState("annual");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const [loginError, setLoginError] =
    useState("");

  const calculateDays = (
    start: string,
    end: string
  ) => {
    if (!start || !end) return 0;

    const startTime = new Date(
      `${start}T00:00:00`
    ).getTime();

    const endTime = new Date(
      `${end}T00:00:00`
    ).getTime();

    if (endTime < startTime) return 0;

    return (
      Math.floor(
        (endTime - startTime) /
          (1000 * 60 * 60 * 24)
      ) + 1
    );
  };

  const totalDays = useMemo(
    () => calculateDays(startDate, endDate),
    [startDate, endDate]
  );

  /*
   * Login employee using the set-leave-pin
   * Edge Function.
   */
  const handleLogin = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setLoginError("");

    const cleanEmployeeNumber =
      employeeNumber.trim().toUpperCase();

    const cleanPin = pin.trim();

    if (!cleanEmployeeNumber) {
      setLoginError(
        "Please enter your Employee Number."
      );
      return;
    }

    if (!cleanPin) {
      setLoginError(
        "Please enter your Leave PIN."
      );
      return;
    }

    setLoggingIn(true);

    try {
      const { data, error } =
        await supabase.functions.invoke(
          "employee-leave-auth",
          {
            body: {
              operation: "verify",
              employee_number:
                cleanEmployeeNumber,
              pin: cleanPin,
            },
          }
        );

      if (error) {
        console.error(
          "Leave PIN verification error:",
          error
        );

        throw new Error(
          error.message ||
            "Unable to verify your details."
        );
      }

      if (!data?.success || !data?.employee) {
        throw new Error(
          data?.error ||
            "Invalid Employee Number or PIN."
        );
      }

      setEmployee(data.employee);

      /*
       * Load this employee's previous leave requests
       * through the leave-request Edge Function.
       */
      const {
        data: leaveData,
        error: leaveError,
      } = await supabase.functions.invoke(
        "employee-leave",
        {
          body: {
            operation: "list",
            employee_id:
              data.employee.id,
          },
        }
      );

      if (!leaveError && leaveData?.requests) {
        setRequests(leaveData.requests);
      }

      toast.success(
        `Welcome ${data.employee.first_name}!`
      );
    } catch (error) {
      console.error(error);

      setLoginError(
        error instanceof Error
          ? error.message
          : "Invalid Employee Number or PIN."
      );
    } finally {
      setLoggingIn(false);
    }
  };

  /*
   * Submit a new leave request.
   */
  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!employee) return;

    if (!leaveType) {
      toast.error(
        "Please select a leave type."
      );
      return;
    }

    if (!startDate || !endDate) {
      toast.error(
        "Please select your leave dates."
      );
      return;
    }

    if (endDate < startDate) {
      toast.error(
        "The end date cannot be before the start date."
      );
      return;
    }

    if (totalDays <= 0) {
      toast.error(
        "Please select valid leave dates."
      );
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } =
        await supabase.functions.invoke(
          "employee-leave",
          {
            body: {
              operation: "create",
              employee_id: employee.id,
              employee_number:
                employee.employee_number,
              leave_type: leaveType,
              start_date: startDate,
              end_date: endDate,
              total_days: totalDays,
              reason:
                reason.trim() || null,
            },
          }
        );

      if (error) {
        throw new Error(
          error.message ||
            "Unable to submit leave request."
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.error ||
            "Unable to submit leave request."
        );
      }

      toast.success(
        "Leave request submitted successfully."
      );

      /*
       * Add the newly-created request to the page
       * immediately.
       */
      if (data.request) {
        setRequests((previous) => [
          data.request,
          ...previous,
        ]);
      }

      setLeaveType("annual");
      setStartDate("");
      setEndDate("");
      setReason("");
    } catch (error) {
      console.error(
        "Leave request error:",
        error
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to submit leave request."
      );
    } finally {
      setSubmitting(false);
    }
  };

  /*
   * Log out of the employee leave page.
   */
  const handleLogout = () => {
    setEmployee(null);
    setRequests([]);
    setEmployeeNumber("");
    setPin("");
    setLoginError("");
    setLeaveType("annual");
    setStartDate("");
    setEndDate("");
    setReason("");
  };

  /*
   * Keep the request list in sync with HR decisions (approved /
   * declined) by re-fetching the employee's requests periodically
   * while they are logged in. This is what shows the upcoming leave
   * as "approved" after HR reviews it.
   */
  const loadRequests = async (employeeId: string) => {
    if (!employeeId) return;

    try {
      const { data, error } = await supabase.functions.invoke(
        "employee-leave",
        { body: { operation: "list", employee_id: employeeId } }
      );

      if (!error && data?.success && Array.isArray(data.requests)) {
        setRequests(data.requests);
      }
    } catch (err) {
      console.error("Leave request poll error:", err);
    }
  };


  useEffect(() => {
    if (!employee?.id) return;

    // Initial load is already handled at login; poll for changes.
    const interval = setInterval(() => {
      loadRequests(employee.id!);
    }, 20000);

    return () => clearInterval(interval);
  }, [employee?.id]);

  /*
   * LOGIN SCREEN
   */
  if (!employee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">

        <header className="border-b bg-card px-6 py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between">

            <div className="flex items-center gap-2">

              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ef302b] font-bold text-white">
                MS
              </div>

              <span className="text-lg font-semibold">
                Maharaja's Spices
              </span>

            </div>

            <span className="text-sm text-muted-foreground">
              Employee Leave
            </span>

          </div>
        </header>

        <main className="flex min-h-[calc(100vh-73px)] items-center justify-center p-6">

          <div className="w-full max-w-md">

            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">

              <div className="mb-6 text-center">

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CalendarDays className="h-7 w-7" />
                </div>

                <h1 className="mt-4 text-2xl font-bold">
                  Employee Leave
                </h1>

                <p className="mt-2 text-sm text-muted-foreground">
                  Enter your Employee Number and
                  Leave PIN to request leave.
                </p>

              </div>

              <form
                onSubmit={handleLogin}
                className="space-y-4"
              >

                <div className="space-y-2">

                  <label
                    htmlFor="employee-number"
                    className="text-sm font-medium"
                  >
                    Employee Number
                  </label>

                  <input
                    id="employee-number"
                    value={employeeNumber}
                    onChange={(e) =>
                      setEmployeeNumber(
                        e.target.value.toUpperCase()
                      )
                    }
                    placeholder="EMP-0001"
                    autoComplete="username"
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 font-mono uppercase outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />

                </div>

                <div className="space-y-2">

                  <label
                    htmlFor="leave-pin"
                    className="text-sm font-medium"
                  >
                    Leave PIN
                  </label>

                  <input
                    id="leave-pin"
                    type="password"
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) =>
                      setPin(e.target.value)
                    }
                    placeholder="Enter your PIN"
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />

                </div>

                {loginError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loggingIn}
                  className="flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >

                  {loggingIn ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <User className="mr-2 h-4 w-4" />
                      Continue
                    </>
                  )}

                </button>

              </form>

            </div>

          </div>

        </main>

      </div>
    );
  }

  /*
   * EMPLOYEE LEAVE PAGE
   */
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">

      {/* Header */}
      <header className="border-b bg-card px-6 py-4">

        <div className="mx-auto flex max-w-6xl items-center justify-between">

          <div className="flex items-center gap-2">

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ef302b] font-bold text-white">
              MS
            </div>

            <span className="text-lg font-semibold">
              Maharaja's Spices
            </span>

          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>

        </div>

      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-6">

        {/* Employee welcome */}
        <div>

          <h1 className="text-2xl font-bold">
            Hi, {employee.first_name}!
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Submit a leave request or check the status
            of your previous requests.
          </p>

        </div>

        {/* Employee information */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">

          <div className="grid gap-4 sm:grid-cols-3">

            <div>
              <p className="text-xs text-muted-foreground">
                Employee Number
              </p>

              <p className="mt-1 font-medium">
                {employee.employee_number || "—"}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Employee
              </p>

              <p className="mt-1 font-medium">
                {employee.first_name}{" "}
                {employee.last_name}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Department
              </p>

              <p className="mt-1 font-medium">
                {employee.department || "—"}
              </p>
            </div>

          </div>

        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">

          {/* =====================================================
              REQUEST LEAVE
          ===================================================== */}
          <div className="rounded-xl border border-border bg-card shadow-card">

            <div className="border-b border-border px-5 py-4">

              <h2 className="font-semibold">
                Request Leave
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Complete the form below to submit your
                leave application.
              </p>

            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-5"
            >

              {/* Leave type */}
              <div className="space-y-2">

                <label
                  htmlFor="leave-type"
                  className="text-sm font-medium"
                >
                  Leave Type
                </label>

                <select
                  id="leave-type"
                  value={leaveType}
                  onChange={(e) =>
                    setLeaveType(e.target.value)
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none focus:border-emerald-500"
                >

                  {leaveTypes.map((type) => (
                    <option
                      key={type.value}
                      value={type.value}
                    >
                      {type.label}
                    </option>
                  ))}

                </select>

              </div>

              {/* Dates */}
              <div className="grid gap-4 sm:grid-cols-2">

                <div className="space-y-2">

                  <label
                    htmlFor="start-date"
                    className="text-sm font-medium"
                  >
                    Start Date
                  </label>

                  <input
                    id="start-date"
                    type="date"
                    value={startDate}
                    min={new Date()
                      .toISOString()
                      .split("T")[0]}
                    onChange={(e) =>
                      setStartDate(
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none focus:border-emerald-500"
                  />

                </div>

                <div className="space-y-2">

                  <label
                    htmlFor="end-date"
                    className="text-sm font-medium"
                  >
                    End Date
                  </label>

                  <input
                    id="end-date"
                    type="date"
                    value={endDate}
                    min={
                      startDate ||
                      new Date()
                        .toISOString()
                        .split("T")[0]
                    }
                    onChange={(e) =>
                      setEndDate(
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none focus:border-emerald-500"
                  />

                </div>

              </div>

              {/* Days */}
              {totalDays > 0 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">

                  <div className="flex items-center justify-between">

                    <span className="text-sm text-emerald-800">
                      Total leave days
                    </span>

                    <span className="text-lg font-bold text-emerald-700">
                      {totalDays}
                    </span>

                  </div>

                </div>
              )}

              {/* Reason */}
              <div className="space-y-2">

                <label
                  htmlFor="reason"
                  className="text-sm font-medium"
                >
                  Reason
                  <span className="ml-1 font-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>

                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) =>
                    setReason(e.target.value)
                  }
                  rows={4}
                  placeholder="Please provide a reason for your leave request..."
                  className="w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />

              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >

                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Leave Request
                  </>
                )}

              </button>

            </form>

          </div>

          {/* =====================================================
              MY LEAVE REQUESTS
          ===================================================== */}
          <div className="rounded-xl border border-border bg-card shadow-card">

            <div className="border-b border-border px-5 py-4">

              <h2 className="font-semibold">
                My Leave Requests
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Track the status of your applications.
              </p>

            </div>

            <div className="divide-y divide-border">

              {requests.length === 0 ? (
                <div className="px-5 py-10 text-center">

                  <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />

                  <p className="mt-3 text-sm font-medium">
                    No leave requests yet
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Your submitted requests will appear
                    here.
                  </p>

                </div>
              ) : (
                requests.map((request) => (

                  <div
                    key={request.id}
                    className="space-y-3 px-5 py-5"
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div>

                        <p className="font-medium">
                          {leaveTypes.find(
                            (type) =>
                              type.value ===
                              request.leave_type
                          )?.label ||
                            request.leave_type}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {request.start_date}{" "}
                          –{" "}
                          {request.end_date}
                        </p>

                      </div>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${
                          statusStyles[
                            request.status
                          ] ||
                          "border-gray-200 bg-gray-100 text-gray-600"
                        }`}
                      >
                        {request.status}
                      </span>

                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">

                      <Clock className="h-4 w-4" />

                      {request.total_days}{" "}
                      {request.total_days === 1
                        ? "day"
                        : "days"}

                    </div>

                    {request.reason && (
                      <div className="rounded-lg bg-muted/40 p-3 text-sm">
                        <p className="text-xs font-medium text-muted-foreground">
                          Reason
                        </p>

                        <p className="mt-1">
                          {request.reason}
                        </p>
                      </div>
                    )}

                    {request.hr_comment && (
                      <div className="rounded-lg border border-border bg-background p-3 text-sm">

                        <p className="text-xs font-medium text-muted-foreground">
                          HR Comment
                        </p>

                        <p className="mt-1">
                          {request.hr_comment}
                        </p>

                      </div>
                    )}

                  </div>

                ))
              )}

            </div>

          </div>

        </div>

      </main>

    </div>
  );
};

export default EmployeeLeave;