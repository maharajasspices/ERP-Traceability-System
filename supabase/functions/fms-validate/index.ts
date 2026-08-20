import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// CORS allowlist: set ALLOWED_ORIGINS (comma-separated) env var to your production origins.
// Localhost is always allowed for local development.
// If ALLOWED_ORIGINS is not set, all origins are allowed (auth is still enforced via JWT).
const getAllowedOrigin = (requestOrigin: string | null): string => {
  const envOrigins = (Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('ALLOWED_ORIGIN') || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // If no origins are configured, allow all origins (security is enforced by JWT auth)
  if (envOrigins.length === 0) {
    return requestOrigin || '*';
  }

  if (requestOrigin) {
    if (envOrigins.includes(requestOrigin)) return requestOrigin;
    if (
      requestOrigin.startsWith('http://localhost:') ||
      requestOrigin.startsWith('https://localhost:')
    ) {
      return requestOrigin;
    }
  }

  // If a single origin is configured and no request origin matched, return it as default.
  if (envOrigins.length === 1) return envOrigins[0];

  return '';
};


const createCorsHeaders = (requestOrigin: string | null) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(requestOrigin),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Credentials': 'true',
});

// Validation schemas (mirrored from client-side for server enforcement)
const codePattern = /^[A-Z0-9\s\-_]+$/i;
const phonePattern = /^[+]?[0-9\s\-()]+$/;

const supplierSchema = z.object({
  code: z.string().min(2).max(20).regex(codePattern),
  name: z.string().min(2).max(200).trim(),
  contact_name: z.string().max(100).trim().optional().nullable(),
  email: z.string().email().max(255).optional().nullable().or(z.literal('')),
  phone: z.string().max(30).regex(phonePattern).optional().nullable().or(z.literal('')),
  address: z.string().max(500).trim().optional().nullable(),
  is_approved: z.boolean().default(false),
});

const stockCodeSchema = z.object({
  stock_code: z.string().min(2).max(50).regex(codePattern),
  description: z.string().min(3).max(500).trim(),
  item_type: z.enum(['raw_material', 'packaging', 'work_in_progress', 'finished_good']),
  unit_of_measure: z.enum(['kg', 'g', 'litres', 'ml', 'units', 'each']),
  storage_condition: z.enum(['ambient', 'chilled', 'frozen']),
  has_allergens: z.boolean().default(false),
  allergen_types: z.array(z.string().max(50)).max(20).default([]),
  custom_allergens: z.array(z.string().max(100)).max(10).optional().nullable(),
  approved_supplier_ids: z.array(z.string().uuid()).default([]),
  status: z.enum(['active', 'inactive']).default('active'),
});

const receivingSchema = z.object({
  internal_lot_number: z.string().min(5).max(50),
  stock_code_id: z.string().uuid(),
  quantity_received: z.number().positive().max(1000000),
  supplier_id: z.string().uuid(),
  supplier_batch_number: z.string().min(1).max(100),
  manufacturing_date: z.string().optional().nullable(),
  expiry_date: z.string().optional().nullable(),
  delivery_note_number: z.string().max(50).optional().nullable(),
  quality_checks: z.record(z.any()).default({}),
  status: z.enum(['accepted', 'rejected', 'partial', 'pending']).default('pending'),
  rejection_reason: z.string().max(500).optional().nullable(),
  received_by: z.string().uuid(),
  received_at: z.string().optional(),
  cost_price_per_kg: z.number().nonnegative().max(1000000).optional().nullable(),
});

// Processing step schema for BOM
const processingStepSchema = z.object({
  step_order: z.number().int().positive(),
  step_name: z.string().max(100),
  description: z.string().max(500).optional(),
});

// Organoleptic parameter schema for BOM
const organolepticParameterSchema = z.object({
  name: z.string().max(50),
  expected_value: z.string().max(200),
});

const bomSchema = z.object({
  finished_good_id: z.string().uuid(),
  version_number: z.number().int().positive().default(1),
  effective_date: z.string().min(1),
  status: z.enum(['active', 'obsolete']).default('active'),
  obsolete_reason: z.string().max(500).optional().nullable(),
  created_by: z.string().uuid(),
  processing_steps: z.array(processingStepSchema).default([]),
  organoleptic_parameters: z.array(organolepticParameterSchema).default([]),
});

const bomComponentSchema = z.object({
  bom_id: z.string().uuid().optional(),
  material_stock_code_id: z.string().uuid(),
  quantity_per_batch: z.number().positive().max(100000),
});

const productionBatchSchema = z.object({
  finished_good_id: z.string().uuid(),
  bom_id: z.string().uuid(),
 planned_batch_size: z.number().positive().max(1000000),
 actual_quantity_produced: z.number().min(0).max(1000000).optional().nullable(),
  product_size: z.number().positive().max(100000).optional().nullable(),
  status: z.enum(['draft', 'pre_weighing', 'manufacturing', 'in_progress', 'closed', 'cancelled']).default('draft'),
  planned_production_date: z.string().min(1),
  production_start: z.string().optional().nullable(),
  production_end: z.string().optional().nullable(),
  production_instructions: z.string().max(5000).optional().nullable(),
  processing_steps: z.array(z.any()).default([]),
  quality_checks: z.array(z.any()).default([]),
  final_quality_checks: z.any().optional().nullable(),
  pre_weigh_approved: z.boolean().default(false),
  pre_weigh_approved_by: z.string().uuid().optional().nullable(),
  pre_weigh_approved_at: z.string().optional().nullable(),
  pre_weigh_materials: z.array(z.any()).default([]),
  scrap_waste: z.number().min(0).max(1000000).optional().nullable(),
  waste_notes: z.string().max(1000).optional().nullable(),
  retention_sample_taken: z.boolean().default(false),
  operator_id: z.string().uuid(),
  supervisor_id: z.string().uuid().optional().nullable(),
  info_checker_name: z.string().max(100).optional().nullable(),
  steps_checker_name: z.string().max(100).optional().nullable(),
  quality_checker_name: z.string().max(100).optional().nullable(),
});

const dispatchSchema = z.object({
  invoice_number: z.string().min(1).max(50),
  dispatch_date: z.string().min(1),
  customer_name: z.string().max(200).trim().optional().default(''),
  customer_id: z.string().uuid().optional().nullable(),
  dispatched_by: z.string().uuid(),
});

const dispatchItemSchema = z.object({
  dispatch_id: z.string().uuid().optional(),
  batch_id: z.string().uuid(),
  quantity: z.number().int().positive().max(1000000),
});

// Table names type
type TableName = 'fms_suppliers' | 'fms_stock_codes' | 'fms_receiving' | 'fms_bom' | 'fms_bom_components' | 'fms_production_batches' | 'fms_dispatch' | 'fms_dispatch_items';

// Schema registry for operations
const schemas: Record<TableName, z.ZodObject<z.ZodRawShape>> = {
  'fms_suppliers': supplierSchema,
  'fms_stock_codes': stockCodeSchema,
  'fms_receiving': receivingSchema,
  'fms_bom': bomSchema,
  'fms_bom_components': bomComponentSchema,
  'fms_production_batches': productionBatchSchema,
  'fms_dispatch': dispatchSchema,
  'fms_dispatch_items': dispatchItemSchema,
};

// Valid table names for type checking
const validTables = new Set<string>(Object.keys(schemas));

serve(async (req) => {
  // Get the request origin for CORS
  const requestOrigin = req.headers.get('Origin');
  const corsHeaders = createCorsHeaders(requestOrigin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[fms-validate] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[fms-validate] Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has FMS access
    const { data: fmsUser, error: fmsError } = await supabase
      .from('fms_users')
      .select('id, role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (fmsError || !fmsUser) {
      console.error('[fms-validate] FMS access denied for user:', user.id);
      return new Response(
        JSON.stringify({ error: 'Access denied - not an FMS user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { operation, data, id } = body;
    const table = body.table as string;

    console.log(`[fms-validate] Operation: ${operation}, Table: ${table}, User: ${user.email}`);

    // Validate table is allowed
    if (!validTables.has(table)) {
      console.error('[fms-validate] Invalid table:', table);
      return new Response(
        JSON.stringify({ error: 'Invalid table' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get schema for table
    const schema = schemas[table as TableName];

    // For insert_many, validate array of items
    if (operation === 'insert_many') {
      if (!Array.isArray(data)) {
        return new Response(
          JSON.stringify({ error: 'Data must be an array for insert_many' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const validatedItems = [];
      for (let i = 0; i < data.length; i++) {
        const itemValidation = schema.safeParse(data[i]);
        if (!itemValidation.success) {
          const firstError = itemValidation.error.issues[0];
          console.error(`[fms-validate] Validation failed for item ${i}:`, firstError);
          return new Response(
            JSON.stringify({ error: `Item ${i + 1}: ${firstError.message}`, field: firstError.path.join('.') }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        validatedItems.push(itemValidation.data);
      }

      const { data: insertData, error: insertError } = await supabase
        .from(table)
        .insert(validatedItems)
        .select();

      if (insertError) {
        console.error('[fms-validate] Insert many error:', insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[fms-validate] Success: ${operation} on ${table}`);
      return new Response(
        JSON.stringify({ success: true, data: insertData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For single-item operations (insert/update)
    const isUpdate = operation === 'update';
    const validationSchema = isUpdate ? schema.partial() : schema;
    
    const validation = validationSchema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      console.error('[fms-validate] Validation failed:', firstError);
      return new Response(
        JSON.stringify({ error: firstError.message, field: firstError.path.join('.') }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use validated data for database operation
    const validatedData = validation.data;
    let result;

    // Perform the operation with validated data
    if (operation === 'insert') {
      const { data: insertData, error: insertError } = await supabase
        .from(table)
        .insert(validatedData)
        .select()
        .single();

      if (insertError) {
        console.error('[fms-validate] Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      result = insertData;
    } else if (operation === 'update') {
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'ID required for update' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: updateData, error: updateError } = await supabase
        .from(table)
        .update(validatedData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('[fms-validate] Update error:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      result = updateData;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid operation. Use: insert, update, or insert_many' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fms-validate] Success: ${operation} on ${table}`);
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fms-validate] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
