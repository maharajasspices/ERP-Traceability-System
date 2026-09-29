// ============================================================
// employee-leave-auth — employee self-service login for the
// Employee Leave portal.
//
// Security:
// - Public function (verify_jwt = false): the employee is not a
//   Supabase auth user, so identity is established with their
//   Employee Number + Leave PIN.
// - The bcrypt PIN comparison runs inside Postgres via
//   fms_verify_employee_leave_pin (SECURITY DEFINER). The plaintext
//   PIN is signed with the service role key and never persisted or
//   logged; the PIN hash is never returned to the client.
// - On success, only the non-sensitive employee profile fields are
//   returned (never the PIN).
//
// Operations:
//   { operation: 'verify', employee_number, pin } -> employee
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

const MAX_EMPLOYEE_NUMBER_LENGTH = 30;
const MAX_PIN_LENGTH = 20;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
    if (operation !== "verify") {
      return jsonError(corsHeaders, "Invalid operation. Use: verify", 400);
    }

    const employeeNumber = isNonEmptyString(body.employee_number)
      ? body.employee_number.trim().toUpperCase()
      : "";
    const pin = isNonEmptyString(body.pin) ? body.pin.trim() : "";

    if (!employeeNumber) {
      return jsonError(corsHeaders, "Employee Number is required.", 400);
    }
    if (!pin) {
      return jsonError(corsHeaders, "Leave PIN is required.", 400);
    }
    if (employeeNumber.length > MAX_EMPLOYEE_NUMBER_LENGTH) {
      return jsonError(corsHeaders, "Employee Number is too long.", 400);
    }
    if (pin.length > MAX_PIN_LENGTH) {
      return jsonError(corsHeaders, "Leave PIN is too long.", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseServiceKey) {
      console.error("[employee-leave-auth] Missing SUPABASE_SERVICE_ROLE_KEY secret.");
      return jsonError(corsHeaders, "Server configuration error", 500);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await adminClient.rpc("fms_verify_employee_leave_pin", {
      p_employee_number: employeeNumber,
      p_pin: pin,
    });

    if (error) {
      console.error("[employee-leave-auth] RPC error:", error);
      return jsonError(corsHeaders, "Unable to verify your details.", 500);
    }

    // The RPC returns a jsonb employee object, or null when the
    // Employee Number / PIN combination does not match.
    const employee = data ? (typeof data === "object" ? data : null) : null;

    if (!employee) {
      return jsonOk(corsHeaders, {
        success: false,
        error: "Invalid Employee Number or PIN.",
      });
    }

    console.log(`[employee-leave-auth] Verified employee ${employeeNumber}`);
    return jsonOk(corsHeaders, { success: true, employee });
  } catch (error) {
    console.error("[employee-leave-auth] Unexpected error:", error);
    return jsonError(corsHeaders, "Internal server error", 500);
  }
});