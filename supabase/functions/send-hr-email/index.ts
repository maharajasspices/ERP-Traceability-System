// ============================================================
// send-hr-email — sends an email to an HR employee's stored
// address via the company SMTP server (hr@maharajasspices.co.za).
//
// Security:
// - SMTP credentials live ONLY in Supabase edge function secrets
//   (SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS) — never in
//   frontend code.
// - Caller must present a valid Supabase JWT and have an active
//   fms_users row with role 'hr_user' or 'system_admin'.
// - The recipient is resolved server-side from the employee
//   record; the client cannot email arbitrary addresses.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

// ---- Constants -----------------------------------------------------------
const FROM_EMAIL = Deno.env.get("SMTP_USER") || "zulaigah.benjamin@maharajasspices.co.za";
const FROM_NAME = "Maharaja Spices HR";
const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 20_000;

// ---- CORS (same allowlist pattern as fms-hr-warning) ---------------------
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

// ---- SMTP ----------------------------------------------------------------
function createTransporter() {
  const smtpUser = FROM_EMAIL;
  const smtpPass = Deno.env.get("SMTP_PASS");

  if (!smtpPass) {
    throw new Error(
      "SMTP_PASS secret not configured. Add it in Supabase Dashboard → Settings → Edge Functions → Secrets."
    );
  }

  const port = Number(Deno.env.get("SMTP_PORT") || "465");

  return nodemailer.createTransport({
    // Port 465 uses implicit SSL/TLS ("secure"), not STARTTLS.
    host: Deno.env.get("SMTP_HOST") || "mail.maharajasspices.co.za",
    port,
    secure: port === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

serve(async (req) => {
  const requestOrigin = req.headers.get("Origin");
  const corsHeaders = createCorsHeaders(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError(corsHeaders, "Unauthorized", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller with their JWT
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonError(corsHeaders, "Unauthorized", 401);
    }

    // Admin client with service role for privileged lookups (bypasses RLS)
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller is HR or system_admin (same rule as fms-hr-warning)
    const { data: fmsUser, error: fmsError } = await adminClient
      .from("fms_users")
      .select("role, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (fmsError || !fmsUser || (fmsUser.role !== "hr_user" && fmsUser.role !== "system_admin")) {
      return jsonError(corsHeaders, "Forbidden - HR access required", 403);
    }

    // ---- Parse & validate payload ---------------------------------------
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonError(corsHeaders, "Invalid JSON body", 400);
    }

    const employeeId: string | undefined = body?.employee_id;
    const subject: string | undefined =
      typeof body?.subject === "string" ? body.subject.trim() : undefined;
    const message: string | undefined =
      typeof body?.message === "string" ? body.message.trim() : undefined;

    if (!employeeId) {
      return jsonError(corsHeaders, "employee_id is required", 400);
    }
    if (!subject || !message) {
      return jsonError(corsHeaders, "subject and message are required", 400);
    }
    if (subject.length > MAX_SUBJECT_LENGTH) {
      return jsonError(corsHeaders, `Subject too long (max ${MAX_SUBJECT_LENGTH} characters)`, 400);
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonError(corsHeaders, `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`, 400);
    }

    // ---- Resolve the employee's stored email address server-side --------
    // The client never supplies the destination address; it comes from
    // fms_hr_employees so only legitimate employee contacts can be emailed.
    const { data: employee, error: empError } = await adminClient
      .from("fms_hr_employees")
      .select("first_name, last_name, email")
      .eq("id", employeeId)
      .maybeSingle();

    if (empError) {
      console.error("[send-hr-email] Employee lookup error:", empError);
      return jsonError(corsHeaders, "Failed to look up employee", 500);
    }
    if (!employee) {
      return jsonError(corsHeaders, "Employee not found", 404);
    }
    if (!employee.email) {
      return jsonError(corsHeaders, "This employee has no email address on file.", 400);
    }

    const recipient = String(employee.email).trim();

    // ---- Send via company SMTP ------------------------------------------
    try {
      const transporter = createTransporter();
      const info = await transporter.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to: recipient,
        replyTo: FROM_EMAIL,
        subject,
        text: message,
        html: buildHtmlBody(message),
      });

      console.log(
        `[send-hr-email] Sent to ${recipient} by user ${user.id}: messageId=${info?.messageId}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          recipient,
          message_id: info?.messageId ?? null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (smtpErr) {
      console.error("[send-hr-email] SMTP error:", smtpErr);
      return jsonError(
        corsHeaders,
        smtpErr instanceof Error
          ? `SMTP error: ${smtpErr.message}`
          : "SMTP error while sending email",
        500
      );
    }
  } catch (error) {
    console.error("[send-hr-email] Unexpected error:", error);
    return jsonError(corsHeaders, "Internal server error", 500);
  }
});

function jsonError(corsHeaders: Record<string, string>, errorMessage: string, status: number) {
  return new Response(
    JSON.stringify({ error: errorMessage }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function buildHtmlBody(message: string): string {
  const paragraphs = escapeHtml(message)
    .split(/\r?\n\r?\n/)
    .map(
      (para) =>
        `<p style="margin: 0 0 12px;">${escapeHtml(para).replace(/\r?\n/g, "<br />")}</p>`
    )
    .join("");

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1f2937;">
      ${paragraphs}
      <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">
        — Maharaja Spices HR<br />
        This message was sent via the ERP HR Management System.
      </p>
    </div>
  `;
}

