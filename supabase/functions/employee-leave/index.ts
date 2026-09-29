// ============================================================
// employee-leave — employee-facing leave request operations for
// the Employee Leave portal.
//
// Security:
// - Public function (verify_jwt = false). The employee is identified
//   server-side by their employee record (which every request must
//   reference) — the same identity established during login in
//   employee-leave-auth. Requests are only allowed for records that
//   exist and have a Leave PIN configured, which prevents arbitrary
//   UUID scanning from creating/hijacking requests for unverified
//   rows.
// - All reads/writes run with the service role key.
//
// Operations:
//   { operation: 'list',  employee_id }                       -> requests
//   { operation: 'create', employee_id, employee_number, leave_type,
//     start_date, end_date, total_days, reason }              -> request
//
// Output is shaped for the portal using the fms_leave_requests columns
// (total_days, hr_comment) directly; the employee's name / number are
// read from the row when present.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- CORS (same allowlist pattern as the other edge functions) ----
const getAllowedOrigin = (requestOrigin: string | null): string => {
  const envOrigins = (Deno.env.get("ALLOWED_ORIGINS") || Deno.env.get("ALLOWED_ORIGIN") || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (requestOrigin) {
    if (envOrigins.includes(requestOrigin)) return requestOrigin;
    if (
      requestOrigin.startsWith("http://localhost:") ||
      requestOrigin.startsWith("https://localhost:")
    ) {
      return requestOrigin;
    }
  }

  if (envOrigins.length === 1) return envOrigins[0];

  return "";
};

const createCorsHeaders = (requestOrigin: string | null) => ({
  "Access-Control-Allow-Origin": getAllowedOrigin(requestOrigin),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Credentials": "true",
});

// ---- Helpers ----------------------------------------------------------
function jsonError(corsHeaders: Record<string, string>, errorMessage: string, status: number) {
  return new Response(
    JSON.stringify({ error: errorMessage }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function jsonOk(corsHeaders: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ALLOWED_LEAVE_TYPES = new Set([
  "annual",
  "sick",
  "family_responsibility",
  "study",
  "unpaid",
  "maternity",
  "paternity",
]);
/**
 * Normalise a raw fms_leave_requests row into the shape the portal
 * renders (total_days / hr_comment come straight from the table).
 */
function serializeLeave(row: any, employee: any = null, employeeNumber: string = "") {
  return {
    id: row.id,
    employee_id: row.employee_id,
    employee_number: employeeNumber || row.employee_number || "",
    employee_name: employee
      ? `${employee.first_name} ${employee.last_name}`
      : row.employee_name || "",
    employee_email: row.employee_email || null,
    leave_type: row.leave_type,
    start_date: row.start_date,
    end_date: row.end_date,
    total_days: row.total_days,
    days_requested: row.total_days, // legacy alias for safety
    reason: row.reason,
    status: row.status,
    hr_comment: row.hr_comment ?? null,
    review_notes: row.hr_comment ?? null, // legacy alias for safety
    created_at: row.created_at,
  };
}

// ---- Server ------------------------------------------------------------
serve(async (req) => {
  const requestOrigin = req.headers.get("Origin");
  const corsHeaders = createCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonError(corsHeaders, "Invalid JSON body.", 400);
    }

    const operation = body?.operation;
    if (operation !== "list" && operation !== "create") {
      return jsonError(corsHeaders, "Invalid operation. Use: list, create", 400);
    }

    const employeeId = typeof body.employee_id === "string" ? body.employee_id.trim() : "";
    if (!employeeId) {
      return jsonError(corsHeaders, "employee_id is required.", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseServiceKey) {
      console.error("[employee-leave] Missing SUPABASE_SERVICE_ROLE_KEY secret.");
      return jsonError(corsHeaders, "Server configuration error", 500);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ---- Resolve the employee record (identity guard) ------------------
    // Only allow operations for employees that exist and have a Leave PIN
    // configured (i.e. they were set up for self-service leave).
    const { data: employee, error: employeeError } = await adminClient
      .from("fms_hr_employees")
      .select("id, employee_number, first_name, last_name, email, department, leave_pin")
      .eq("id", employeeId)
      .maybeSingle();

    if (employeeError) {
      console.error("[employee-leave] Employee lookup error:", employeeError);
      return jsonError(corsHeaders, "Failed to look up employee.", 500);
    }
    if (!employee) {
      return jsonError(corsHeaders, "Employee record not found.", 404);
    }
    if (!employee.leave_pin) {
      return jsonError(corsHeaders, "Leave PIN is not configured for this employee.", 403);
    }

    const employeeNumber = employee.employee_number?.trim().toUpperCase() || "";
// ============================================================
    // LIST
    // ============================================================
    if (operation === "list") {
      const { data: rows, error: listError } = await adminClient
        .from("fms_leave_requests")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (listError) {
        console.error("[employee-leave] List error:", listError);
        return jsonError(corsHeaders, "Failed to load leave requests.", 500);
      }

      const requests = (rows || []).map((row) =>
        serializeLeave(row, employee, employeeNumber)
      );

      return jsonOk(corsHeaders, { success: true, requests });
    }

    // ============================================================
    // CREATE
    // ============================================================
    const leaveType = typeof body.leave_type === "string" ? body.leave_type : "";
    if (!ALLOWED_LEAVE_TYPES.has(leaveType)) {
      return jsonError(corsHeaders, "Please select a valid leave type.", 400);
    }

    const startDate = typeof body.start_date === "string" ? body.start_date.trim() : "";
    const endDate = typeof body.end_date === "string" ? body.end_date.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!startDate || !endDate) {
      return jsonError(corsHeaders, "Start date and end date are required.", 400);
    }

    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return jsonError(corsHeaders, "Invalid leave dates.", 400);
    }
    if (end < start) {
      return jsonError(corsHeaders, "The end date cannot be before the start date.", 400);
    }

    // total_days may arrive (frontend) or we compute it server-side as a
    // reliable fallback.
    let totalDays = Number(body.total_days);
    if (!Number.isFinite(totalDays) || totalDays <= 0) {
      totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    totalDays = Math.floor(totalDays);

    if (reason.length > 2000) {
      return jsonError(corsHeaders, "Reason is too long (max 2000 characters).", 400);
    }

    const { data: inserted, error: insertError } = await adminClient
      .from("fms_leave_requests")
      .insert({
        employee_id: employeeId,
        employee_number: employeeNumber,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        employee_email: employee.email || null,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        reason: reason || null,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[employee-leave] Create error:", insertError);
      return jsonError(corsHeaders, "Unable to submit leave request.", 500);
    }

    console.log(
      `[employee-leave] Created ${leaveType} request ${inserted.id} for employee ${employeeId}`
    );

    return jsonOk(corsHeaders, {
      success: true,
      request: serializeLeave(inserted, employee, employeeNumber),
    });
  } catch (error) {
    console.error("[employee-leave] Unexpected error:", error);
    return jsonError(corsHeaders, "Internal server error", 500);
  }
});