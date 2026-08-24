import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Send email via Resend
async function sendEmail(to: string, subject: string, html: string) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'orders@maharajasspices.co.za';

  if (!resendApiKey) {
    console.error('[fms-stock-order] RESEND_API_KEY not configured. Email would be sent to:', to);
    console.error('[fms-stock-order] Subject:', subject);
    console.error('[fms-stock-order] Body:', html);
    return {
      sent: false,
      reason: 'RESEND_API_KEY not configured. Add the RESEND_API_KEY secret in Supabase Dashboard → Settings → Edge Functions → Secrets.',
    };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[fms-stock-order] Resend error:', errText);
    return { sent: false, reason: `Resend API error: ${errText}` };
  }

  return { sent: true };
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

    // Verify the caller is an FMS user
    const { data: fmsUser, error: fmsError } = await adminClient
      .from('fms_users')
      .select('role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (fmsError || !fmsUser) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - FMS access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { operation } = body;

    // Send a stock order email to a supplier
    if (operation === 'send_stock_order') {
      const { supplier_id, stock_code_id, quantity, notes } = body;

      if (!supplier_id || !stock_code_id || !quantity) {
        return new Response(
          JSON.stringify({ error: 'supplier_id, stock_code_id, and quantity are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get supplier details
      const { data: supplier, error: supError } = await adminClient
        .from('fms_suppliers')
        .select('*')
        .eq('id', supplier_id)
        .maybeSingle();

      if (supError || !supplier) {
        return new Response(
          JSON.stringify({ error: 'Supplier not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!supplier.email) {
        return new Response(
          JSON.stringify({ error: 'Supplier has no email address on file' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get stock code details
      const { data: stockCode, error: scError } = await adminClient
        .from('fms_stock_codes')
        .select('*')
        .eq('id', stock_code_id)
        .maybeSingle();

      if (scError || !stockCode) {
        return new Response(
          JSON.stringify({ error: 'Stock code not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get current stock level
      const { data: stockLevel } = await adminClient
        .from('fms_stock_levels')
        .select('*')
        .eq('stock_code_id', stock_code_id)
        .maybeSingle();

      const currentStock = (stockLevel as any)?.quantity_on_hand ?? 0;
      const threshold = (stockLevel as any)?.low_stock_threshold ?? 0;

      // Build the order email
      const orderDate = new Date().toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const sc = stockCode as any;
      const emailSubject = `Purchase Order - ${sc.stock_code} (${sc.description})`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="background: #ef302b; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">Purchase Order</h2>
          </div>
          <div style="padding: 24px;">
            <p style="margin: 0 0 16px; color: #374151; font-size: 14px; line-height: 1.6;">
              Dear <strong>${supplier.name}</strong>,
            </p>
            <p style="margin: 0 0 16px; color: #374151; font-size: 14px; line-height: 1.6;">
              We would like to place an order for the following material:
            </p>
            <div style="background: #f9fafb; border-left: 4px solid #ef302b; padding: 16px; margin: 0 0 16px; border-radius: 4px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; width: 40%;">Stock Code:</td>
                  <td style="padding: 4px 0; font-weight: 600; color: #111827;">${sc.stock_code}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280;">Description:</td>
                  <td style="padding: 4px 0; font-weight: 600; color: #111827;">${sc.description}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280;">Quantity Required:</td>
                  <td style="padding: 4px 0; font-weight: 600; color: #111827;">${quantity} ${sc.unit_of_measure}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280;">Current Stock:</td>
                  <td style="padding: 4px 0; color: #ef302b; font-weight: 600;">${currentStock} ${sc.unit_of_measure}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280;">Low Stock Threshold:</td>
                  <td style="padding: 4px 0; color: #111827;">${threshold} ${sc.unit_of_measure}</td>
                </tr>
              </table>
            </div>
            ${notes ? `<p style="margin: 0 0 16px; color: #374151; font-size: 14px; line-height: 1.6;"><strong>Notes:</strong> ${notes}</p>` : ''}
            <p style="margin: 0 0 24px; color: #374151; font-size: 14px; line-height: 1.6;">
              Please confirm availability and delivery timeline. Thank you.
            </p>
            <div style="border-top: 1px solid #e5e7eb; padding-top: 16px;">
              <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px;">Order Date: ${orderDate}</p>
              <p style="margin: 0; color: #111827; font-size: 14px; font-weight: 600;">Maharaja's Spices</p>
            </div>
          </div>
        </div>
      `;

      const result = await sendEmail(supplier.email, emailSubject, emailHtml);

      return new Response(
        JSON.stringify({ success: true, ...result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send a multi-item stock order email to a supplier
    if (operation === 'send_supplier_order') {
      const { supplier_id, items, notes } = body;

      if (!supplier_id || !Array.isArray(items) || items.length === 0) {
        return new Response(
          JSON.stringify({ error: 'supplier_id and items array are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get supplier details
      const { data: supplier, error: supError } = await adminClient
        .from('fms_suppliers')
        .select('*')
        .eq('id', supplier_id)
        .maybeSingle();

      if (supError || !supplier) {
        return new Response(
          JSON.stringify({ error: 'Supplier not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!supplier.email) {
        return new Response(
          JSON.stringify({ error: 'Supplier has no email address on file' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch all stock codes and stock levels in one go
      const stockCodeIds = items.map((i: any) => i.stock_code_id);
      const { data: stockCodes, error: scError } = await adminClient
        .from('fms_stock_codes')
        .select('*')
        .in('id', stockCodeIds);

      if (scError || !stockCodes) {
        return new Response(
          JSON.stringify({ error: 'Stock codes not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: stockLevels } = await adminClient
        .from('fms_stock_levels')
        .select('*')
        .in('stock_code_id', stockCodeIds);

      const stockCodeMap = new Map<string, any>(stockCodes.map((sc: any) => [sc.id, sc]));
      const stockLevelMap = new Map<string, any>((stockLevels || []).map((sl: any) => [sl.stock_code_id, sl]));

      // Build the order items table rows
      const orderDate = new Date().toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const itemRows = items.map((item: any) => {
        const sc = stockCodeMap.get(item.stock_code_id);
        if (!sc) return '';
        const level = stockLevelMap.get(item.stock_code_id);
        const currentStock = level?.quantity_on_hand ?? 0;
        const threshold = level?.low_stock_threshold ?? 0;
        const qty = Number(item.quantity || 0);
        return `
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb; color: #111827; font-weight: 600;">${sc.stock_code}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; color: #374151;">${sc.description}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; color: #111827; font-weight: 600; text-align: right;">${qty} ${sc.unit_of_measure}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; color: #ef302b; text-align: right;">${currentStock} ${sc.unit_of_measure}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; color: #111827; text-align: right;">${threshold} ${sc.unit_of_measure}</td>
          </tr>
        `;
      }).join('');

      const emailSubject = `Purchase Order - ${supplier.name}`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="background: #ef302b; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">Purchase Order</h2>
          </div>
          <div style="padding: 24px;">
            <p style="margin: 0 0 16px; color: #374151; font-size: 14px; line-height: 1.6;">
              Dear <strong>${supplier.name}</strong>,
            </p>
            <p style="margin: 0 0 16px; color: #374151; font-size: 14px; line-height: 1.6;">
              We would like to place an order for the following materials:
            </p>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background: #f9fafb;">
                  <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left; color: #6b7280;">Stock Code</th>
                  <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left; color: #6b7280;">Description</th>
                  <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; color: #6b7280;">Qty Required</th>
                  <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; color: #6b7280;">Current Stock</th>
                  <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; color: #6b7280;">Min. Reorder</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
              </tbody>
            </table>
            ${notes ? `<p style="margin: 16px 0 0; color: #374151; font-size: 14px; line-height: 1.6;"><strong>Notes:</strong> ${notes}</p>` : ''}
            <p style="margin: 16px 0 24px; color: #374151; font-size: 14px; line-height: 1.6;">
              Please confirm availability and delivery timeline. Thank you.
            </p>
            <div style="border-top: 1px solid #e5e7eb; padding-top: 16px;">
              <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px;">Order Date: ${orderDate}</p>
              <p style="margin: 0; color: #111827; font-size: 14px; font-weight: 600;">Maharaja's Spices</p>
            </div>
          </div>
        </div>
      `;

      const result = await sendEmail(supplier.email, emailSubject, emailHtml);

      return new Response(
        JSON.stringify({ success: true, ...result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid operation. Use: send_stock_order, send_supplier_order' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fms-stock-order] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});