import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

// CORS allowlist
const getAllowedOrigin = (requestOrigin: string | null): string => {
  const envOrigins = (Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('ALLOWED_ORIGIN') || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (requestOrigin) {
    if (envOrigins.includes(requestOrigin)) return requestOrigin;
    if (
      requestOrigin.startsWith('http://localhost:') ||
      requestOrigin.startsWith('https://localhost:')
    ) {
      return requestOrigin;
    }
  }

  if (envOrigins.length === 1) return envOrigins[0];

  return '';
};

const createCorsHeaders = (requestOrigin: string | null) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(requestOrigin),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Credentials': 'true',
});

// Send email via the company SMTP server — the SAME transport used by
// send-hr-email / sign-contract / fms-stock-order (SMTP_HOST / SMTP_PORT /
// SMTP_USER / SMTP_PASS secrets), so no extra provider setup is required.
async function sendEmail(to: string, subject: string, html: string) {
  const fromEmail =
    Deno.env.get('SMTP_USER') || 'zulaigah.benjamin@maharajasspices.co.za';

  const smtpPass = Deno.env.get('SMTP_PASS');
  if (!smtpPass) {
    console.error('[fms-hr-warning] SMTP_PASS not configured. Email would be sent to:', to);
    return {
      sent: false,
      reason: 'SMTP_PASS secret not configured. Add it in Supabase Dashboard → Settings → Edge Functions → Secrets.',
    };
  }

  const port = Number(Deno.env.get('SMTP_PORT') || '465');

  try {
    const transporter = nodemailer.createTransport({
      // Port 465 uses implicit SSL/TLS ("secure"), not STARTTLS.
      host: Deno.env.get('SMTP_HOST') || 'mail.maharajasspices.co.za',
      port,
      secure: port === 465,
      auth: {
        user: fromEmail,
        pass: smtpPass,
      },
    });

    const info = await transporter.sendMail({
      from: `"Maharaja Spices HR" <${fromEmail}>`,
      to,
      replyTo: fromEmail,
      subject,
      html,
    });

    console.log(`[fms-hr-warning] Email sent to ${to}: messageId=${info?.messageId}`);
    return { sent: true };
  } catch (smtpErr) {
    console.error('[fms-hr-warning] SMTP error:', smtpErr);
    return {
      sent: false,
      reason: smtpErr instanceof Error ? `SMTP error: ${smtpErr.message}` : 'SMTP error while sending email',
    };
  }
}

//Generate a secure token for the employee's HR meeting booking link 
function generateBookingToken(): string {
  const bytes =  new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('');
}

// Send WhatsApp via Twilio (or fallback to console log if not configured)
async function sendWhatsApp(to: string, message: string) {
  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioFrom = Deno.env.get('TWILIO_WHATSAPP_FROM') || 'whatsapp:+14155238886';

  if (!twilioSid || !twilioAuthToken) {
    console.error('[fms-hr-warning] Twilio not configured. WhatsApp would be sent to:', to);
    console.error('[fms-hr-warning] Message:', message);
    return {
      sent: false,
      reason: 'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured. Add them in Supabase Dashboard → Settings → Edge Functions → Secrets.',
    };
  }

  // Normalize phone number to E.164 format for WhatsApp
  let normalized = to.replace(/[^0-9]/g, '');
  if (!normalized.startsWith('+')) {
    // Assume South Africa if no country code
    if (normalized.length === 9) normalized = '27' + normalized;
    normalized = '+' + normalized;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
  const auth = btoa(`${twilioSid}:${twilioAuthToken}`);

  const body = new URLSearchParams({
    From: twilioFrom,
    To: `whatsapp:${normalized}`,
    Body: message,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[fms-hr-warning] Twilio error:', errText);
    return { sent: false, reason: `Twilio API error: ${errText}` };
  }

  return { sent: true };
}

// Build email and WhatsApp content for a warning + employee, then send them
async function sendNotificationsForWarning(adminClient: any, warning: any, employee: any, sendEmailFlag: boolean, sendWhatsAppFlag: boolean) {
  const employeeName = `${employee.first_name} ${employee.last_name}`;
  const warningTypeLabel = warning.warning_type.charAt(0).toUpperCase() + warning.warning_type.slice(1);
  const dateStr = new Date(warning.issued_at || Date.now()).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let bookingUrl = '';
  if (sendEmailFlag && employee.email) {
    try{
      //Reuse an existing booking link if this warning was already emailed
     const { data: existingMeeting, error: meetingLookupError } = await adminClient
  .from('fms_hr_warnings')
  .select('booking_token, meeting_status')
  .eq('id', warning.id)
  .maybeSingle();

if (meetingLookupError) {
  console.error(
    '[fms-hr-warning] Meeting lookup error:',
    meetingLookupError
  );

  throw new Error(
    `Meeting lookup failed: ${meetingLookupError.message}`
  );
}

      let bookingToken = existingMeeting?.booking_token;

      if (!bookingToken) {
        bookingToken = generateBookingToken();

        const { error: bookingError } = await adminClient
          .from('fms_hr_warnings')
          .update ({
            meeting_requested: true,
            meeting_status:'pending',
            booking_token: bookingToken,
          })
          .eq('id', warning.id);

          if (bookingError) {
              console.error(
                '[fms-hr-warning] Failed to create meeting booking token:',
                bookingError
              );

              throw new Error(
                `Failed to create meeting booking token: ${bookingError.message}`
              );
            }

      }
   if (bookingToken) {
  const appUrl =
    Deno.env.get('APP_URL') ||
    'http://localhost:8084';

  bookingUrl =
    `${appUrl}/book-hr-meeting?token=${encodeURIComponent(bookingToken)}`;

  console.log('[fms-hr-warning] BOOKING URL:', bookingUrl);
}
    }catch (bookingErr) {
      console.error(
         '[fms-hr-warning] Booking link generation error:',
          bookingErr
      )
    }
  }

  const emailSubject = `Formal ${warningTypeLabel} Warning - ${employeeName}`;
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <div style="background: #ef302b; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">Formal ${warningTypeLabel} Warning</h2>
      </div>
      <div style="padding: 24px;">
        <p style="margin: 0 0 16px; color: #374151; font-size: 14px; line-height: 1.6;">
          Dear <strong>${employeeName}</strong>,
        </p>
        <p style="margin: 0 0 16px; color: #374151; font-size: 14px; line-height: 1.6;">
          This is to formally notify you of a <strong>${warningTypeLabel.toLowerCase()}</strong> warning issued on <strong>${dateStr}</strong>.
        </p>
        <div style="background: #f9fafb; border-left: 4px solid #ef302b; padding: 16px; margin: 0 0 16px; border-radius: 4px;">
          <p style="margin: 0 0 8px; font-weight: 600; color: #111827; font-size: 14px;">Reason:</p>
          <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">${warning.reason}</p>
          ${warning.details ? `<p style="margin: 12px 0 0; color: #374151; font-size: 14px; line-height: 1.6;">${warning.details}</p>` : ''}
        </div>
        <p style="margin: 0 0 24px; color: #374151; font-size: 14px; line-height: 1.6;">
          Please take this warning seriously and address the matter immediately. Further disciplinary action may be taken if the issue persists.
        </p>
                <div style="border-top: 1px solid #e5e7eb; padding-top: 16px;">
          <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px;">
            Issued by HR Department
          </p>

          <p style="margin: 0 0 20px; color: #111827; font-size: 14px; font-weight: 600;">
            Signature: ${warning.signature}
          </p>

          ${
            bookingUrl
              ? `
                <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center;">
                  <p style="margin: 0 0 12px; color: #374151; font-size: 14px; line-height: 1.5;">
                    If you would like to discuss this warning with HR, you can book a meeting with the HR department.
                  </p>

                  <a
                    href="${bookingUrl}"
                    style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-size: 14px; font-weight: 600;"
                  >
                    📅 Book a Meeting with HR
                  </a>

                  <p style="margin: 12px 0 0; color: #6b7280; font-size: 11px;">
                    Click the button above to choose a suitable date and time.
                  </p>
                </div>
              `
              : ''
          }
        </div>
      </div>
    </div>
  `;

  const whatsappMessage = `*FORMAL ${warningTypeLabel.toUpperCase()} WARNING*\n\nDear ${employeeName},\n\nYou have received a ${warningTypeLabel.toLowerCase()} warning issued on ${dateStr}.\n\nReason: ${warning.reason}${warning.details ? `\nDetails: ${warning.details}` : ''}\n\nPlease address this matter immediately. Further disciplinary action may be taken if the issue persists.\n\nIssued by HR Department\nSignature: ${warning.signature}`;

  const results: any = {};

  // Send email if requested and employee has an email
  if (sendEmailFlag && employee.email) {
    results.email = await sendEmail(employee.email, emailSubject, emailHtml);
  } else if (sendEmailFlag && !employee.email) {
    results.email = { sent: false, reason: 'Employee has no email address on file' };
  }

  // Send WhatsApp if requested and employee has a phone
  if (sendWhatsAppFlag && employee.phone) {
    results.whatsapp = await sendWhatsApp(employee.phone, whatsappMessage);
  } else if (sendWhatsAppFlag && !employee.phone) {
    results.whatsapp = { sent: false, reason: 'Employee has no phone number on file' };
  }

  return results;
}

serve(async (req) => {
  const requestOrigin = req.headers.get('Origin');
  const corsHeaders = createCorsHeaders(requestOrigin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify the caller with their JWT
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin client with service role for privileged operations (bypasses RLS)
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller is HR or system_admin
    const { data: fmsUser, error: fmsError } = await adminClient
      .from('fms_users')
      .select('role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (fmsError || !fmsUser || (fmsUser.role !== 'hr_user' && fmsUser.role !== 'system_admin')) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - HR access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { operation } = body;

    // Create a warning AND send notifications (standalone API usage)
    if (operation === 'send_warning') {
      const { employee_id, warning_type, reason, details, signature, send_email, send_whatsapp } = body;

      if (!employee_id || !warning_type || !reason || !signature) {
        return new Response(
          JSON.stringify({ error: 'employee_id, warning_type, reason, and signature are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get employee details
      const { data: employee, error: empError } = await adminClient
        .from('fms_hr_employees')
        .select('*')
        .eq('id', employee_id)
        .maybeSingle();

      if (empError || !employee) {
        return new Response(
          JSON.stringify({ error: 'Employee not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert the warning record
      const { data: warning, error: warnError } = await adminClient
        .from('fms_hr_warnings')
        .insert({
          employee_id,
          warning_type,
          reason,
          details: details || null,
          issued_by: user.id,
          signature,
        })
        .select()
        .single();

      if (warnError) {
        console.error('[fms-hr-warning] Insert warning error:', warnError);
        return new Response(
          JSON.stringify({ error: warnError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send notifications (email / WhatsApp)
      const results = await sendNotificationsForWarning(
        adminClient,
        warning,
        employee,
        !!send_email,
        !!send_whatsapp
      );

      return new Response(
        JSON.stringify({ success: true, warning_id: warning.id, ...results }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send notifications for an EXISTING warning record (used by the app after insert)
    if (operation === 'send_notification') {
      const { warning_id, send_email, send_whatsapp } = body;

      if (!warning_id) {
        return new Response(
          JSON.stringify({ error: 'warning_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get the existing warning record
      const { data: warning, error: warnError } = await adminClient
        .from('fms_hr_warnings')
        .select('*')
        .eq('id', warning_id)
        .maybeSingle();

      if (warnError || !warning) {
        return new Response(
          JSON.stringify({ error: 'Warning not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get employee details
      const { data: employee, error: empError } = await adminClient
        .from('fms_hr_employees')
        .select('*')
        .eq('id', warning.employee_id)
        .maybeSingle();

      if (empError || !employee) {
        return new Response(
          JSON.stringify({ error: 'Employee not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send notifications (email / WhatsApp) - does NOT insert a duplicate
      const results = await sendNotificationsForWarning(
        adminClient,
        warning,
        employee,
        !!send_email,
        !!send_whatsapp
      );

      return new Response(
        JSON.stringify({ success: true, warning_id: warning.id, ...results }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid operation. Use: send_warning or send_notification' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fms-hr-warning] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});