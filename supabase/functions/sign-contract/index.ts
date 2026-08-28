// ============================================================
// sign-contract — employee-facing part of the e-signature
// workflow. Validates a signing request's secure token + expiry,
// returns the linked contract for viewing, and completes the
// request by recording the drawn signature.
//
// Security:
// - Public function (verify_jwt = false): the request is
//   authenticated by the secure token itself, which is generated in
//   send-contract-signature and delivered privately to the employee.
//   The token is NEVER the employee ID.
// - All lookups/updates run with the service role key; the client
//   only ever supplies the token + the drawn signature. We never
//   return the token or any sensitive employee data beyond the
//   name needed to address the signer.
// - Expiry is enforced server-side; an expired request is marked
//   'expired' and cannot be signed.
//
// Operations:
//   { operation: 'get',               token }  -> request + contract
//   { operation: 'complete', token, signature_data, signer_name } -> sign
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

const MAX_SIGNATURE_DATA_LENGTH = 2_000_000; // ~2MB base64 PNG
const MAX_SIGNER_NAME_LENGTH = 120;
// ---- Helpers -------------------------------------------------------------
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

// Best-effort client IP from common reverse-proxy headers.
function getClientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  const real = req.headers.get("x-real-ip");
  return real ? real.trim() : null;
}

// ---- Server --------------------------------------------------------------
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
      return jsonError(corsHeaders, "Invalid JSON body", 400);
    }

    const operation: string | undefined = body?.operation;
    const token: string | undefined = typeof body?.token === "string" ? body.token.trim() : undefined;

    if (!operation) {
      return jsonError(corsHeaders, "operation is required (get | complete)", 400);
    }
    if (!token) {
      return jsonError(corsHeaders, "token is required", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ---- Resolve the signing request by its secure token ---------------
    const { data: signingRequest, error: reqError } = await adminClient
      .from("fms_contract_signatures")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (reqError) {
      console.error("[sign-contract] Lookup error:", reqError);
      return jsonError(corsHeaders, "Failed to look up signing request", 500);
    }
    if (!signingRequest) {
      return jsonError(corsHeaders, "Invalid signing link.", 404);
    }

    // ---- Determine effective status ------------------------------------
    const nowIso = new Date().toISOString();
    let status = signingRequest.status;
    if (status === "pending" && new Date(signingRequest.expires_at).getTime() < Date.now()) {
      status = "expired";
      await adminClient
        .from("fms_contract_signatures")
        .update({ status: "expired", updated_at: nowIso })
        .eq("id", signingRequest.id);
    }

    if (operation === "get") {
      if (status === "signed") {
        return jsonOk(corsHeaders, { status: "signed", signed_at: signingRequest.signed_at });
      }
      if (status === "expired") {
        return jsonOk(corsHeaders, { status: "expired", expires_at: signingRequest.expires_at });
      }
      if (status === "revoked") {
        return jsonOk(corsHeaders, { status: "revoked" });
      }
      if (status !== "pending") {
        return jsonError(corsHeaders, "This signing link is no longer valid.", 400);
      }

      // Fetch the employee + contract document so the (anonymous) signer can
      // be addressed and shown their contract.
      const [{ data: employee }, { data: document }] = await Promise.all([
        adminClient.from("fms_hr_employees").select("first_name, last_name").eq("id", signingRequest.employee_id).maybeSingle(),
        adminClient.from("fms_hr_documents").select("document_name, mime_type, file_path").eq("id", signingRequest.document_id).maybeSingle(),
      ]);

      // Sign a temporary URL for the contract file so it can be viewed
      // without granting the anon role access to the private bucket.
      let contractUrl: string | null = null;
      if (document?.file_path) {
        const signed = await adminClient.storage.from("hr-documents").createSignedUrl(
          document.file_path,
          60 * 60 * 24 * 7 // 7 days
        );
        contractUrl = signed.error ? null : signed.data?.signedUrl ?? null;
      }

      return jsonOk(corsHeaders, {
        status: "pending",
        expires_at: signingRequest.expires_at,
        employee: employee
          ? { first_name: employee.first_name, last_name: employee.last_name }
          : null,
        document: document
          ? { document_name: document.document_name, mime_type: document.mime_type }
          : null,
        contract_url: contractUrl,
      });
    }

    if (operation === "complete") {
      // Only a pending, unexpired request can be signed.
      if (status === "signed") {
        return jsonOk(corsHeaders, { success: true, status: "signed", signed_at: signingRequest.signed_at });
      }
      if (status === "expired") {
        return jsonError(corsHeaders, "This signing link has expired.", 410);
      }
      if (status === "revoked") {
        return jsonError(corsHeaders, "This signing request has been revoked.", 410);
      }
      if (status !== "pending") {
        return jsonError(corsHeaders, "This signing link is no longer valid.", 400);
      }

      const signatureData: string | undefined =
        typeof body?.signature_data === "string" ? body.signature_data.trim() : undefined;
      const signerName: string | undefined =
        typeof body?.signer_name === "string" ? body.signer_name.trim() : undefined;

      if (!signatureData) {
        return jsonError(corsHeaders, "A signature is required.", 400);
      }
      if (signatureData.length > MAX_SIGNATURE_DATA_LENGTH) {
        return jsonError(corsHeaders, "Signature image is too large.", 400);
      }
      if (!signatureData.startsWith("data:image/")) {
        return jsonError(corsHeaders, "Invalid signature format.", 400);
      }
      if (signerName && signerName.length > MAX_SIGNER_NAME_LENGTH) {
        return jsonError(corsHeaders, "Name is too long.", 400);
      }

      const nowIso = new Date().toISOString();
      const clientIp = getClientIp(req);

      // Mark the request as signed and capture the drawn signature.
      const { error: updateError } = await adminClient
        .from("fms_contract_signatures")
        .update({
          status: "signed",
          signed_at: nowIso,
          signer_name: signerName || null,
          signer_ip: clientIp,
          signature_data: signatureData,
          updated_at: nowIso,
        })
        .eq("id", signingRequest.id)
        .eq("status", "pending");

      if (updateError) {
        console.error("[sign-contract] Complete update error:", updateError);
        return jsonError(corsHeaders, "Failed to sign the contract.", 500);
      }

      // Keep the employee record in sync so HR reports show the contract
      // as signed on the date it was actually signed.
      await adminClient
        .from("fms_hr_employees")
        .update({
          contract_signed: true,
          contract_signed_date: nowIso.slice(0, 10),
          updated_at: nowIso,
        })
        .eq("id", signingRequest.employee_id);

      console.log(
        `[sign-contract] Signed request ${signingRequest.id} for employee ${signingRequest.employee_id}`
      );

      return jsonOk(corsHeaders, { success: true, status: "signed", signed_at: nowIso });
    }

    return jsonError(corsHeaders, "Invalid operation. Use: get, complete", 400);
  } catch (error) {
    console.error("[sign-contract] Unexpected error:", error);
    return jsonError(corsHeaders, "Internal server error", 500);
  }
});

