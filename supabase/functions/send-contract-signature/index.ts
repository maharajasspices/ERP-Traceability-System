// ============================================================
// send-contract-signature — first part of the e-signature
// workflow. HR sends an employee's stored contract (a document of
// type 'contract') for electronic signature.
//
// Security:
// - Reuses the same auth + CORS pattern as send-hr-email /
//   fms-hr-warning: caller must present a valid Supabase JWT and
//   have an active fms_users row with role 'hr_user' or
//   'system_admin'.
// - The employee and the contract document are resolved
//   server-side; the client only supplies IDs, never free-form
//   recipient addresses or contract text.
// - A cryptographically random signing token is generated here
//   (crypto.getRandomValues). It is UNIQUE and is NOT the employee
//   ID. The email's signing link carries this token; it is the only
//   credential a signer needs.
// - The request + status are stored in fms_contract_signatures.
//
// Email is sent via the company SMTP server (same provider + secrets
// as send-hr-email): SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS.
// Without SMTP_PASS the request is still stored but the function
// reports the email was not sent.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

// ---- CORS (same allowlist pattern as the other HR functions) ----
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

// ---- Constants -----------------------------------------------------------
const FROM_EMAIL = Deno.env.get("SMTP_USER") || "hr@maharajasspices.co.za";
const FROM_NAME = "Maharaja Spices HR";
const SIGNING_PATH = "/sign-contract";
// The base URL of the app where the (future) signing page lives.
// The production app is deployed to erp.maharajasspices.com (see
// .cpanel.yml). Set the APP_URL secret if it is ever hosted elsewhere.
const APP_URL = Deno.env.get("APP_URL") || "https://erp.maharajasspices.com";
const SIGNING_EXPIRY_DAYS = 14;

// ---- Helpers -------------------------------------------------------------
function jsonError(corsHeaders: Record<string, string>, errorMessage: string, status: number) {
  return new Response(
    JSON.stringify({ error: errorMessage }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Generate a secure random token. Never derived from employee data.
function generateSigningToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

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

// Send email via the company SMTP server (same pattern as send-hr-email)
async function sendEmail(to: string, subject: string, html: string) {
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      replyTo: FROM_EMAIL,
      subject,
      html,
    });
    return { sent: true, messageId: info?.messageId ?? null };
  } catch (err) {
    console.error("[send-contract-signature] SMTP error:", err);
    return {
      sent: false,
      reason: err instanceof Error ? `SMTP error: ${err.message}` : "SMTP error while sending email",
    };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---- Server --------------------------------------------------------------
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

    // Verify the caller is HR or system_admin (same rule as send-hr-email)
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
    const documentId: string | undefined = body?.document_id;

    if (!employeeId) {
      return jsonError(corsHeaders, "employee_id is required", 400);
    }
    if (!documentId) {
      return jsonError(corsHeaders, "document_id is required", 400);
    }

    // ---- Resolve the employee server-side -------------------------------
    const { data: employee, error: empError } = await adminClient
      .from("fms_hr_employees")
      .select("first_name, last_name, email")
      .eq("id", employeeId)
      .maybeSingle();

    if (empError) {
      console.error("[send-contract-signature] Employee lookup error:", empError);
      return jsonError(corsHeaders, "Failed to look up employee", 500);
    }
    if (!employee) {
      return jsonError(corsHeaders, "Employee not found", 404);
    }
    if (!employee.email) {
      return jsonError(corsHeaders, "This employee has no email address on file.", 400);
    }

    // ---- Resolve the contract document server-side ----------------------
    const { data: document, error: docError } = await adminClient
      .from("fms_hr_documents")
      .select("id, document_name, document_type, file_path")
      .eq("id", documentId)
      .maybeSingle();

    if (docError) {
      console.error("[send-contract-signature] Document lookup error:", docError);
      return jsonError(corsHeaders, "Failed to look up document", 500);
    }
    if (!document) {
      return jsonError(corsHeaders, "Contract document not found", 404);
    }
    if (document.document_type !== "contract") {
      return jsonError(corsHeaders, "Only contract documents can be sent for signature.", 400);
    }
    if (!document.file_path) {
      return jsonError(corsHeaders, "This contract has no file attached, so it cannot be sent for signature.", 400);
    }

    const employeeName = `${employee.first_name} ${employee.last_name}`;

    // ---- Create the secure, unique signing request ----------------------
    const token = generateSigningToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SIGNING_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const { data: signingRequest, error: insertError } = await adminClient
      .from("fms_contract_signatures")
      .insert({
        employee_id: employeeId,
        document_id: documentId,
        token,
        status: "pending",
        sent_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("[send-contract-signature] Insert signing request error:", insertError);
      return jsonError(corsHeaders, "Failed to create signing request", 500);
    }

    // ---- Email the employee a signing link ------------------------------
    const signingUrl = `${APP_URL}${SIGNING_PATH}?token=${token}`;
    const emailSubject = `Please sign your employment contract - ${employeeName}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <div style="background: #ef302b; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 18px;">Employment Contract for Signature</h2>
        </div>
        <div style="padding: 24px;">
          <p style="margin: 0 0 16px; color: #374151; font-size: 14px; line-height: 1.6;">
            Dear <strong>${employeeName}</strong>,
          </p>
          <p style="margin: 0 0 16px; color: #374151; font-size: 14px; line-height: 1.6;">
            Please review your employment contract (<strong>${escapeHtml(document.document_name)}</strong>)
            and complete your electronic signature using the secure link below.
          </p>
          <p style="margin: 0 0 24px; color: #374151; font-size: 14px; line-height: 1.6;">
            This link is private to you and will expire on
            <strong>${expiresAt.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}</strong>.
          </p>
          <p style="margin: 0 0 24px; text-align: center;">
            <a href="${signingUrl}" style="background: #ef302b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
              Sign My Contract
            </a>
          </p>
          <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px;">
            If the button above does not work, copy and paste this link into your browser:
          </p>
          <p style="margin: 0 0 24px; color: #6b7280; font-size: 12px; word-break: break-all;">
            ${signingUrl}
          </p>
          <div style="border-top: 1px solid #e5e7eb; padding-top: 16px;">
            <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px;">Maharaja Spices HR Department</p>
            <p style="margin: 0; color: #111827; font-size: 14px; font-weight: 600;">Do not share this link - it is tied to your contract.</p>
          </div>
        </div>
      </div>
    `;

    const emailResult = await sendEmail(employee.email, emailSubject, emailHtml);

    console.log(
      `[send-contract-signature] Request ${signingRequest.id} for ${employeeName} (${employee.email}); email sent=${emailResult.sent}`
    );
    if (!emailResult.sent) {
      console.warn("[send-contract-signature] Email not sent:", emailResult.reason);
    }

    return new Response(
      JSON.stringify({
        success: true,
        signing_request: {
          id: signingRequest.id,
          status: signingRequest.status,
          expires_at: signingRequest.expires_at,
        },
        email: emailResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-contract-signature] Unexpected error:", error);
    return jsonError(corsHeaders, "Internal server error", 500);
  }
});

