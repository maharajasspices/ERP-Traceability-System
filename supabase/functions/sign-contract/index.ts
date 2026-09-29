import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import nodemailer from "npm:nodemailer@6.9.16";

// ============================================================
// CONFIGURATION
// ============================================================

const SIGNATURE_CONFIG = {
  pageNumber: -1,
  x: 50,
  y: 100,
  width: 250,
  height: 80,
  fontSize: 10,
  imageMaxWidth: 180,
  imageMaxHeight: 60,
};

const FROM_EMAIL =
  Deno.env.get("SMTP_USER") ||
  "zulaigah.benjamin@maharajasspices.co.za";

const FROM_NAME = "Maharaja Spices HR";

const HR_CONTRACT_EMAIL =
  Deno.env.get("HR_CONTRACT_EMAIL") || FROM_EMAIL;

// ============================================================
// HELPERS
// ============================================================

function imageDataUrlToBytes(dataUrl: string): {
  bytes: Uint8Array;
  mimeType: string;
} {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    throw new Error("Invalid signature image data.");
  }

  const commaIndex = dataUrl.indexOf(",");

  if (commaIndex === -1) {
    throw new Error("Invalid signature image format.");
  }

  const header = dataUrl.slice(0, commaIndex);
  const base64 = dataUrl.slice(commaIndex + 1);

  const mimeMatch = header.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/);

  if (!mimeMatch) {
    throw new Error("Invalid signature image MIME type.");
  }

  const mimeType = mimeMatch[1].toLowerCase();

  const binaryString = atob(base64);

  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return {
    bytes,
    mimeType,
  };
}

function createTransporter() {
  const smtpUser = FROM_EMAIL;
  const smtpPass = Deno.env.get("SMTP_PASS");

  if (!smtpPass) {
    throw new Error("SMTP_PASS secret not configured.");
  }

  const port = Number(
    Deno.env.get("SMTP_PORT") || "465"
  );

  return nodemailer.createTransport({
    host:
      Deno.env.get("SMTP_HOST") ||
      "mail.maharajasspices.co.za",
    port,
    secure: port === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

function getClientIp(req: Request): string {
  return (
    req.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// Insert an in-app notification for every active HR user so a bell (the bell
// atop the HR dashboard) surfaces the contract signing the moment it happens.
async function notifyHRContractSigned(
  adminClient: any,
  employeeName: string,
  employeeNumber: string,
  signingRequestId: string
): Promise<void> {
  try {
    const { data: hrUsers, error: hrErr } = await adminClient
    .from("fms_users")
    .select("user_id")
    .in("role", ["hr_user", "system_admin"])
    .eq("is_active", true);

    if (hrErr || !hrUsers?.length) {
      console.warn(
        "[sign-contract] No HR users found to notify:",
      );
      return;
    }

    const nowIso = new Date().toISOString();

    const rows = hrUsers.map((u: any) => ({
      user_id: u.user_id,
      title: "Contract signed",
      message: `${employeeName} (${employeeNumber}) has signed their employment contract.`,
      notification_type: "success",
      entity_type: "contract_signature",
      entity_id: signingRequestId,
      is_read: false,
      created_at: nowIso,
    }));

    const { error: insertErr } = await adminClient
    .from("fms_notifications")
    .insert(rows);

    if (insertErr) {
      console.warn(
        "[sign-contract] Failed to insert contract notifications:",
      );
    }
  } catch (err) {
    console.error(
      "[sign-contract] Error notifying HR of contract signing:",
    );
  }
}

// ============================================================
// DRAW SIGNATURE ON PDF
// ============================================================

async function embedDrawnSignature(
  pdfBytes: ArrayBuffer,
  signatureDataUrl: string,
  signerName: string,
  signingDate: string
): Promise<Uint8Array> {
  console.log(
    "[sign-contract] Starting drawn signature embedding..."
  );

  console.log(
    "[sign-contract] Signature data prefix:",
    signatureDataUrl?.slice(0, 50)
  );

  const pdfDoc = await PDFDocument.load(pdfBytes);

  const pages = pdfDoc.getPages();

  if (!pages.length) {
    throw new Error("Contract PDF has no pages.");
  }

  const pageIndex =
    SIGNATURE_CONFIG.pageNumber === -1
      ? pages.length - 1
      : Math.min(
          SIGNATURE_CONFIG.pageNumber - 1,
          pages.length - 1
        );

  const targetPage = pages[pageIndex];

  const { bytes, mimeType } =
    imageDataUrlToBytes(signatureDataUrl);

  console.log(
    `[sign-contract] Signature image type: ${mimeType}`
  );

  console.log(
    `[sign-contract] Signature image size: ${bytes.length} bytes`
  );

  let signatureImage;

  if (mimeType === "image/png") {
    signatureImage =
      await pdfDoc.embedPng(bytes);
  } else if (
    mimeType === "image/jpeg" ||
    mimeType === "image/jpg"
  ) {
    signatureImage =
      await pdfDoc.embedJpg(bytes);
  } else {
    throw new Error(
      `Unsupported signature image format: ${mimeType}. Please use PNG or JPEG.`
    );
  }

  const dims =
    signatureImage.scaleToFit(
      SIGNATURE_CONFIG.imageMaxWidth,
      SIGNATURE_CONFIG.imageMaxHeight
    );

  const boxX =
    SIGNATURE_CONFIG.x;

  const boxY =
    SIGNATURE_CONFIG.y;

  const imageX =
    boxX +
    (SIGNATURE_CONFIG.width - dims.width) / 2;

  const imageY =
    boxY +
    (SIGNATURE_CONFIG.height - dims.height) / 2;

  // Draw a visible signature box.
  targetPage.drawRectangle({
    x: boxX,
    y: boxY,
    width: SIGNATURE_CONFIG.width,
    height: SIGNATURE_CONFIG.height,
    borderColor: rgb(0.75, 0.75, 0.75),
    borderWidth: 0.5,
  });

  // Draw the actual handwritten signature.
  targetPage.drawImage(signatureImage, {
    x: imageX,
    y: imageY,
    width: dims.width,
    height: dims.height,
  });

  // Stamp the signer name and date below the signature box so the
  // document clearly records who signed and when.
  if (signerName) {
    targetPage.drawText(`Signed by: ${signerName}`, {
      x: boxX,
      y: boxY - 12,
      size: SIGNATURE_CONFIG.fontSize,
      color: rgb(0.2, 0.2, 0.2),
    });
  }
  targetPage.drawText(`Date: ${signingDate}`, {
    x: boxX,
    y: boxY - 24,
    size: SIGNATURE_CONFIG.fontSize,
    color: rgb(0.2, 0.2, 0.2),
  });

  console.log(
    `[sign-contract] Drawn signature embedded successfully on page ${pageIndex + 1}.`
  );

  console.log(
    `[sign-contract] Signature position: x=${imageX}, y=${imageY}, width=${dims.width}, height=${dims.height}`
  );

  return await pdfDoc.save();
}

// ============================================================
// ELECTRONIC EMPLOYEE-ID SIGNATURE
// ============================================================

async function embedElectronicSignature(
  pdfBytes: ArrayBuffer,
  employeeNumber: string,
  signerName: string,
  signingDate: string
): Promise<Uint8Array> {
  const pdfDoc =
    await PDFDocument.load(pdfBytes);

  const pages =
    pdfDoc.getPages();

  if (!pages.length) {
    throw new Error("Contract PDF has no pages.");
  }

  const pageIndex =
    SIGNATURE_CONFIG.pageNumber === -1
      ? pages.length - 1
      : Math.min(
          SIGNATURE_CONFIG.pageNumber - 1,
          pages.length - 1
        );

  const targetPage =
    pages[pageIndex];

  targetPage.drawRectangle({
    x: SIGNATURE_CONFIG.x,
    y: SIGNATURE_CONFIG.y,
    width: SIGNATURE_CONFIG.width,
    height: SIGNATURE_CONFIG.height,
    borderColor: rgb(0.5, 0.5, 0.5),
    borderWidth: 0.5,
    color: rgb(1, 1, 1),
  });

  const lines: string[] = [
    signingDate,
    `Employee: ${employeeNumber}`,
    "Signed by:",
  ];

  const words =
    signerName.split(/\s+/);

  let currentLine = "";

  for (const word of words) {
    if (
      (currentLine + word).length >
      30
    ) {
      if (currentLine.trim()) {
        lines.push(
          currentLine.trim()
        );
      }

      currentLine =
        word + " ";
    } else {
      currentLine +=
        word + " ";
    }
  }

  if (currentLine.trim()) {
    lines.push(
      currentLine.trim()
    );
  }

  const fontSize =
    SIGNATURE_CONFIG.fontSize;

  const lineHeight =
    fontSize * 1.3;

  const startX =
    SIGNATURE_CONFIG.x + 8;

  let currentY =
    SIGNATURE_CONFIG.y +
    SIGNATURE_CONFIG.height -
    12;

  for (const line of lines) {
    targetPage.drawText(line, {
      x: startX,
      y: currentY,
      size: fontSize,
      color: rgb(
        0.2,
        0.2,
        0.2
      ),
    });

    currentY -=
      lineHeight;
  }

  return await pdfDoc.save();
}

// ============================================================
// EMAIL SIGNED CONTRACT
// ============================================================

async function sendSignedContractEmail(
  signedPdfBytes: Uint8Array,
  employeeName: string,
  employeeNumber: string
): Promise<{
  sent: boolean;
  error?: string;
}> {
  try {
    const transporter =
      createTransporter();

    const info =
      await transporter.sendMail({
        from:
          `"${FROM_NAME}" <${FROM_EMAIL}>`,

        to:
          HR_CONTRACT_EMAIL,

        subject:
          `Signed Contract - ${employeeName} (${employeeNumber})`,

        text:
          `A signed contract has been submitted.\n\n` +
          `Employee: ${employeeName}\n` +
          `Employee Number: ${employeeNumber}\n` +
          `Date Signed: ${new Date().toLocaleDateString("en-ZA")}\n\n` +
          `The signed contract PDF is attached.`,

        html: `
          <div style="font-family: Arial, sans-serif; font-size: 14px;">
            <h3 style="color: #1a5276;">
              Signed Contract Received
            </h3>

            <p>
              A signed contract has been submitted.
            </p>

            <p>
              <strong>Employee:</strong> ${employeeName}<br>
              <strong>Employee Number:</strong> ${employeeNumber}<br>
              <strong>Date Signed:</strong>
              ${new Date().toLocaleDateString("en-ZA")}
            </p>

            <p>
              The signed contract PDF is attached.
            </p>

            <p style="color: #7f8c8d; font-size: 12px;">
              &mdash; Maharaja Spices HR<br>
              This message was sent via the ERP HR Management System.
            </p>
          </div>
        `,

        attachments: [
          {
            filename:
              `signed-contract-${employeeNumber}.pdf`,
            content:
              Buffer.from(
                signedPdfBytes
              ),
            contentType:
              "application/pdf",
          },
        ],
      });

    console.log(
      `[sign-contract] Signed contract email sent. messageId=${info?.messageId}`
    );

    return {
      sent: true,
    };
  } catch (err) {
    const errorMsg =
      err instanceof Error
        ? err.message
        : String(err);

    console.error(
      "[sign-contract] Signed email failed:",
      err
    );

    return {
      sent: false,
      error: errorMsg,
    };
  }
}

// ============================================================
// WHATSAPP — NOTIFY HR WHEN AN EMPLOYEE SIGNS
// ============================================================

function normalizeWhatsAppNumber(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, "");

  // Convert South African local numbers like 0743428180
  // to international format +27743428180.
  if (cleaned.startsWith("0")) {
    cleaned = `+27${cleaned.substring(1)}`;
  }

  // Ensure the number starts with +
  if (!cleaned.startsWith("+")) {
    cleaned = `+${cleaned}`;
  }

  return cleaned;
}

async function sendWhatsApp(to: string, message: string) {
  try {
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!accessToken || !phoneNumberId) {
      return {
        sent: false,
        reason: "WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID are not configured.",
      };
    }

    const recipient = normalizeWhatsAppNumber(to);

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "text",
          text: {
            preview_url: false,
            body: message,
          },
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("[sign-contract] WhatsApp HR error:", result);
      return {
        sent: false,
        reason: result?.error?.message || "WhatsApp message failed.",
      };
    }

    return {
      sent: true,
      messageId: result?.messages?.[0]?.id ?? null,
    };
  } catch (err) {
    console.error("[sign-contract] WhatsApp HR error:", err);
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "WhatsApp error while sending message",
    };
  }
}

// Notify HR via WhatsApp that an employee has signed their contract.
// Best-effort — never blocks or undoes the signing.
async function sendSignedWhatsAppToHR(
  employeeName: string,
  employeeNumber: string
): Promise<{ sent: boolean; reason?: string }> {
  const hrNumber =
    Deno.env.get("HR_WHATSAPP_NUMBER") ||
    Deno.env.get("WHATSAPP_HR_NUMBER");

  if (!hrNumber) {
    console.error(
      "[sign-contract] HR_WHATSAPP_NUMBER not configured — skipping WhatsApp HR notification."
    );
    return { sent: false, reason: "HR_WHATSAPP_NUMBER not configured." };
  }

  const dateStr = new Date().toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return await sendWhatsApp(
    hrNumber,
    `Contract Signed\n\n${employeeName} (${employeeNumber}) has signed their employment contract on ${dateStr}.\n\nThe signed contract PDF has been emailed to you.`
  );
}

// ============================================================
// RESPONSE HELPERS
// ============================================================

function jsonOk(
  headers: Record<string, string>,
  body: Record<string, unknown>
) {
  return new Response(
    JSON.stringify(body),
    {
      status: 200,
      headers: {
        ...headers,
        "Content-Type":
          "application/json",
      },
    }
  );
}

function jsonError(
  headers: Record<string, string>,
  errorMessage: string,
  status: number
) {
  return new Response(
    JSON.stringify({
      success: false,
      error: errorMessage,
    }),
    {
      status,
      headers: {
        ...headers,
        "Content-Type":
          "application/json",
      },
    }
  );
}

// ============================================================
// MAIN FUNCTION
// ============================================================

serve(async (req) => {
  const requestOrigin =
    req.headers.get("Origin");

  const corsHeaders = {
    "Access-Control-Allow-Origin":
      requestOrigin || "*",

    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",

    "Access-Control-Allow-Credentials":
      "true",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    if (!supabaseUrl) {
      throw new Error(
        "SUPABASE_URL is not configured."
      );
    }

    if (!serviceRoleKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is not configured."
      );
    }

    const adminClient =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

    const body =
      await req.json();

    const operation =
      body?.operation || "get";

    const signingToken =
      typeof body?.token === "string"
        ? body.token.trim()
        : "";

    if (!signingToken) {
      return jsonError(
        corsHeaders,
        "Signing token is required.",
        400
      );
    }

    const nowIso =
      new Date().toISOString();

    // ========================================================
    // GET SIGNING REQUEST
    // ========================================================

    if (operation === "get") {
      const {
        data: signingRequest,
        error: fetchError,
      } = await adminClient
        .from(
          "fms_contract_signatures"
        )
        .select(`
          id,
          employee_id,
          document_id,
          signature_method,
          status,
          created_at,
          expires_at,
          signed_at
        `)
        .eq(
          "token",
          signingToken
        )
        .maybeSingle();

      if (fetchError) {
        console.error(
          "[sign-contract] Get request error:",
          fetchError
        );

        return jsonError(
          corsHeaders,
          fetchError.message,
          500
        );
      }

      if (!signingRequest) {
        return jsonOk(
          corsHeaders,
          {
            success: false,
            status: "invalid",
          }
        );
      }

      if (
        signingRequest.status ===
        "signed"
      ) {
        return jsonOk(
          corsHeaders,
          {
            success: true,
            status: "signed",
            signed_at:
              signingRequest.signed_at,
          }
        );
      }

      if (
        signingRequest.status ===
        "revoked"
      ) {
        return jsonOk(
          corsHeaders,
          {
            success: true,
            status: "revoked",
          }
        );
      }

      if (
        signingRequest.expires_at &&
        new Date(
          signingRequest.expires_at
        ) < new Date()
      ) {
        return jsonOk(
          corsHeaders,
          {
            success: true,
            status: "expired",
            expires_at:
              signingRequest.expires_at,
          }
        );
      }

      // ------------------------------------------------------
      // Get employee separately
      // ------------------------------------------------------

      const {
        data: employee,
        error: employeeError,
      } = await adminClient
        .from(
          "fms_hr_employees"
        )
        .select(`
          id,
          first_name,
          last_name,
          employee_number
        `)
        .eq(
          "id",
          signingRequest.employee_id
        )
        .maybeSingle();

      if (employeeError) {
        console.error(
          "[sign-contract] Employee lookup error:",
          employeeError
        );

        return jsonError(
          corsHeaders,
          employeeError.message,
          500
        );
      }

      if (!employee) {
        return jsonError(
          corsHeaders,
          "Employee record not found.",
          404
        );
      }

      // ------------------------------------------------------
      // Get document separately
      // ------------------------------------------------------

      const {
        data: document,
        error: documentError,
      } = await adminClient
        .from(
          "fms_hr_documents"
        )
        .select(`
          id,
          document_name,
          mime_type,
          file_path
        `)
        .eq(
          "id",
          signingRequest.document_id
        )
        .maybeSingle();

      if (documentError) {
        console.error(
          "[sign-contract] Document lookup error:",
          documentError
        );
      }

      let contractUrl:
        string | null = null;

      if (document?.file_path) {
        const {
          data: urlData,
          error: urlError,
        } =
          await adminClient.storage
            .from(
              "hr-documents"
            )
            .createSignedUrl(
              document.file_path,
              3600
            );

        if (urlError) {
          console.error(
            "[sign-contract] Contract URL error:",
            urlError
          );
        } else {
          contractUrl =
            urlData?.signedUrl ||
            null;
        }
      }

      return jsonOk(
        corsHeaders,
        {
          success: true,
          status: "pending",

          expires_at:
            signingRequest.expires_at,

          employee: {
            first_name:
              employee.first_name,
            last_name:
              employee.last_name,
          },

          document: document
            ? {
                document_name:
                  document.document_name,
              }
            : null,

          contract_url:
            contractUrl,
        }
      );
    }

    // ========================================================
    // COMPLETE SIGNING
    // ========================================================

    if (operation === "complete") {
      const signatureMethod =
        body?.signature_method;

      const signatureData =
        body?.signature_data;

      const signerName =
        typeof body?.signer_name === "string"
          ? body.signer_name.trim()
          : "";

      const employeeNumberFromBody =
        typeof body?.employee_number === "string"
          ? body.employee_number.trim().toUpperCase()
          : "";

      // ------------------------------------------------------
      // Get signing request
      // ------------------------------------------------------

      const {
        data: signingRequest,
        error: fetchError,
      } = await adminClient
        .from(
          "fms_contract_signatures"
        )
        .select(`
          id,
          employee_id,
          document_id,
          status,
          expires_at,
          signed_at
        `)
        .eq(
          "token",
          signingToken
        )
        .eq(
          "status",
          "pending"
        )
        .maybeSingle();

      if (fetchError) {
        console.error(
          "[sign-contract] Complete request error:",
          fetchError
        );

        return jsonError(
          corsHeaders,
          fetchError.message,
          500
        );
      }

      if (!signingRequest) {
        return jsonError(
          corsHeaders,
          "Signing request not found or already signed.",
          404
        );
      }

      if (
        signingRequest.expires_at &&
        new Date(
          signingRequest.expires_at
        ) < new Date()
      ) {
        return jsonError(
          corsHeaders,
          "This signing request has expired.",
          400
        );
      }

      // ------------------------------------------------------
      // Get employee
      // ------------------------------------------------------

      const {
        data: employee,
        error: employeeFetchError,
      } = await adminClient
        .from(
          "fms_hr_employees"
        )
        .select(`
          id,
          employee_number,
          first_name,
          last_name
        `)
        .eq(
          "id",
          signingRequest.employee_id
        )
        .maybeSingle();

      if (employeeFetchError) {
        console.error(
          "[sign-contract] Employee fetch error:",
          employeeFetchError
        );

        return jsonError(
          corsHeaders,
          employeeFetchError.message,
          500
        );
      }

      if (!employee) {
        return jsonError(
          corsHeaders,
          "Employee record not found.",
          404
        );
      }

      const expectedEmployeeNumber =
        employee.employee_number
          ?.trim()
          .toUpperCase();

      const employeeNumber =
        employeeNumberFromBody ||
        expectedEmployeeNumber;

      // ------------------------------------------------------
      // Validate employee ID
      // ------------------------------------------------------

      if (
        signatureMethod ===
          "employee_number" &&
        employeeNumber !==
          expectedEmployeeNumber
      ) {
        return jsonError(
          corsHeaders,
          "The Employee Unique ID does not match this employee.",
          400
        );
      }

      // ------------------------------------------------------
      // Validate signature
      // ------------------------------------------------------

      let storedSignatureData:
        Record<string, unknown>;

      if (
        signatureMethod ===
        "draw"
      ) {
        if (
          typeof signatureData !==
            "string" ||
          !signatureData.startsWith(
            "data:image/"
          )
        ) {
          return jsonError(
            corsHeaders,
            "A valid drawn signature is required.",
            400
          );
        }

        storedSignatureData = {
          type: "drawn",
          data_url:
            signatureData,
        };
      } else if (
        signatureMethod ===
        "employee_number"
      ) {
        if (!signerName) {
          return jsonError(
            corsHeaders,
            "Signer name is required.",
            400
          );
        }

        const signatureHash =
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(
              `${employee.id}-${signerName}-${nowIso}`
            )
          );

        storedSignatureData = {
          type:
            "employee_number",

          signer_name:
            signerName,

          employee_number:
            employeeNumber,

          signature_hash:
            Array.from(
              new Uint8Array(
                signatureHash
              )
            )
              .map((b) =>
                b
                  .toString(16)
                  .padStart(2, "0")
              )
              .join(""),
        };
      } else {
        return jsonError(
          corsHeaders,
          "Invalid signature method.",
          400
        );
      }

      // ======================================================
      // GET ORIGINAL CONTRACT PDF
      // ======================================================

      const {
        data: document,
        error: documentError,
      } = await adminClient
        .from(
          "fms_hr_documents"
        )
        .select(`
          id,
          document_name,
          file_path,
          mime_type
        `)
        .eq(
          "id",
          signingRequest.document_id
        )
        .maybeSingle();

      if (documentError) {
        console.error(
          "[sign-contract] Document fetch error:",
          documentError
        );

        return jsonError(
          corsHeaders,
          documentError.message,
          500
        );
      }

      if (
        !document?.file_path
      ) {
        return jsonError(
          corsHeaders,
          "The original contract PDF could not be found.",
          500
        );
      }

      console.log(
        `[sign-contract] Downloading original PDF: ${document.file_path}`
      );

      const {
        data: pdfBlob,
        error: downloadError,
      } =
        await adminClient.storage
          .from(
            "hr-documents"
          )
          .download(
            document.file_path
          );

      if (
        downloadError ||
        !pdfBlob
      ) {
        console.error(
          "[sign-contract] PDF download error:",
          downloadError
        );

        return jsonError(
          corsHeaders,
          "Could not download the original contract PDF.",
          500
        );
      }

      const originalPdfBytes =
        await pdfBlob.arrayBuffer();

      // ======================================================
      // EMBED SIGNATURE
      // ======================================================

      const signingDateFormatted =
        new Date().toLocaleDateString(
          "en-ZA",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        );

      let signedPdfBytes:
        Uint8Array;

      try {
        if (
          signatureMethod ===
          "draw"
        ) {
          signedPdfBytes =
            await embedDrawnSignature(
              originalPdfBytes,
              signatureData,
              signerName ||
                `${employee.first_name} ${employee.last_name}`.trim(),
              signingDateFormatted
            );
        } else {
          signedPdfBytes =
            await embedElectronicSignature(
              originalPdfBytes,
              employeeNumber,
              `${employee.first_name} ${employee.last_name}`.trim(),
              signingDateFormatted
            );
        }
      } catch (pdfError) {
        console.error(
          "[sign-contract] PDF embedding error:",
          pdfError
        );

        return jsonError(
          corsHeaders,
          pdfError instanceof Error
            ? pdfError.message
            : "Failed to create signed PDF.",
          500
        );
      }

      console.log(
        "[sign-contract] Signed PDF created successfully."
      );

      // ======================================================
      // SAVE SIGNED PDF
      // ======================================================

      const signedFileName =
        `signed-contract-${employee.id}-${Date.now()}.pdf`;

      const signedPath =
        `signatures/${employee.id}/${signedFileName}`;

      const {
        error: uploadError,
      } =
        await adminClient.storage
          .from(
            "hr-documents"
          )
          .upload(
            signedPath,
            signedPdfBytes,
            {
              contentType:
                "application/pdf",
              upsert: false,
            }
          );

      if (uploadError) {
        console.error(
          "[sign-contract] Signed PDF upload error:",
          uploadError
        );

        return jsonError(
          corsHeaders,
          "Failed to save the signed contract PDF.",
          500
        );
      }

      console.log(
        `[sign-contract] Signed PDF saved: ${signedPath}`
      );

      // ======================================================
      // CREATE SIGNED PDF URL
      // ======================================================

      const {
        data: signedUrlData,
        error: signedUrlError,
      } =
        await adminClient.storage
          .from(
            "hr-documents"
          )
          .createSignedUrl(
            signedPath,
            60 * 60 * 24 * 365
          );

      if (signedUrlError) {
        console.error(
          "[sign-contract] Signed URL error:",
          signedUrlError
        );

        return jsonError(
          corsHeaders,
          "Signed PDF was saved but its secure URL could not be created.",
          500
        );
      }

      const signedContractUrl =
        signedUrlData?.signedUrl;

      if (!signedContractUrl) {
        return jsonError(
          corsHeaders,
          "Signed PDF URL could not be created.",
          500
        );
      }

      // ======================================================
      // SAVE SIGNATURE RECORD
      // ======================================================

      const clientIp =
        getClientIp(req);

      const {
        error: signatureUpdateError,
      } =
        await adminClient
          .from(
            "fms_contract_signatures"
          )
          .update({
            status: "signed",
            signed_at: nowIso,
            signer_name:
              signerName ||
              `${employee.first_name} ${employee.last_name}`.trim(),
            signer_ip: clientIp,
            signature_data:
              JSON.stringify(
                storedSignatureData
              ),
            updated_at: nowIso,
          })
          .eq(
            "id",
            signingRequest.id
          )
          .eq(
            "status",
            "pending"
          );

      if (signatureUpdateError) {
        console.error(
          "[sign-contract] Signature record update error:",
          signatureUpdateError
        );

        return jsonError(
          corsHeaders,
          `Failed to update signing record: ${signatureUpdateError.message}`,
          500
        );
      }

      // ======================================================
      // UPDATE EMPLOYEE RECORD
      // ======================================================

      const {
        data: updatedEmployee,
        error: employeeUpdateError,
      } =
        await adminClient
          .from(
            "fms_hr_employees"
          )
          .update({
            contract_signed: true,

            contract_signed_date:
              nowIso.slice(0, 10),

            signed_contract_url:
              signedContractUrl,

            updated_at: nowIso,
          })
          .eq(
            "id",
            employee.id
          )
          .select(`
            id,
            employee_number,
            contract_signed,
            contract_signed_date,
            signed_contract_url
          `)
          .maybeSingle();

      if (employeeUpdateError) {
        console.error(
          "[sign-contract] EMPLOYEE UPDATE FAILED:",
          employeeUpdateError
        );

        return jsonError(
          corsHeaders,
          `Employee record could not be updated: ${employeeUpdateError.message}`,
          500
        );
      }

      if (!updatedEmployee) {
        console.error(
          "[sign-contract] Employee update returned no employee."
        );

        return jsonError(
          corsHeaders,
          "Employee record could not be updated.",
          500
        );
      }

      if (
        updatedEmployee.contract_signed !==
        true
      ) {
        console.error(
          "[sign-contract] Employee record did not become signed:",
          updatedEmployee
        );

        return jsonError(
          corsHeaders,
          "Employee record was not marked as signed.",
          500
        );
      }

      console.log(
        "[sign-contract] EMPLOYEE UPDATED SUCCESSFULLY:",
        updatedEmployee
      );

      // ======================================================
      // EMAIL SIGNED PDF TO HR
      // ======================================================

      const employeeName =
        `${employee.first_name} ${employee.last_name}`.trim();

      const emailResult =
        await sendSignedContractEmail(
          signedPdfBytes,
          employeeName,
          employeeNumber
        );

      if (!emailResult.sent) {
        console.error(
          "[sign-contract] Signed PDF email failed:",
          emailResult.error
        );

        // Do not undo the signed contract.
        // The contract is already safely stored.
      }

      // ======================================================
      // WHATSAPP NOTIFY HR — "so-and-so has signed"
      // ======================================================

      const signingWhatsAppResult =
        await sendSignedWhatsAppToHR(
          employeeName,
          employeeNumber
        );

      if (!signingWhatsAppResult.sent) {
        console.error(
          "[sign-contract] WhatsApp HR notification not sent:",
          signingWhatsAppResult.reason
        );
      }

      // ======================================================
      // NOTIFY HR IN-APP (bell) — "so-and-so has signed"
      // ======================================================

      await notifyHRContractSigned(
        adminClient,
        employeeName,
        employeeNumber,
        signingRequest.id
      );

      // ======================================================
      // FINAL SUCCESS
      // ======================================================

      console.log(
        `[sign-contract] SUCCESS: ${employeeNumber} signed contract ${signingRequest.id}`
      );

      return jsonOk(
        corsHeaders,
        {
          success: true,
          status: "signed",
          signed_at: nowIso,

          signature_method:
            signatureMethod,

          pdf_uploaded: true,

          signed_contract_url:
            signedContractUrl,

          employee_updated: true,

          email_sent:
            emailResult.sent,

          whatsapp_sent:
            signingWhatsAppResult.sent,
        }
      );
    }

    return jsonError(
      corsHeaders,
      "Invalid operation.",
      400
    );

  } catch (err) {
    console.error(
      "[sign-contract] UNEXPECTED ERROR:",
      err
    );

    return jsonError(
      corsHeaders,
      err instanceof Error
        ? err.message
        : "Internal server error.",
      500
    );
  }
});