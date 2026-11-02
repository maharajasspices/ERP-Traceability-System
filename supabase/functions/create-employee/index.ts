import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';


const getAllowedOrigin = (origin: string | null): string => {
  const allowedOrigins = [
    'https://erp.maharajasspices.com',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://10.0.0.114:8080',
  ];

  return origin && allowedOrigins.includes(origin) ? origin : '';
};

const getCorsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(origin),
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});


const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const clean = (value: unknown, max = 200): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';


Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed.' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  // Reject browser requests from origins not in the allowlist.
  if (origin && !getAllowedOrigin(origin)) {
    return new Response(
      JSON.stringify({ error: 'Origin not allowed.' }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');


  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing server configuration.');
    return jsonResponse({ error: 'Server configuration error.' }, 500);
  }

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > 100_000) {
    return jsonResponse({ error: 'Submission is too large.' }, 413);
  }

  try {
    const body = await req.json();

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonResponse({ error: 'Invalid request body.' }, 400);
    }

    // Honeypot field: real users should leave this blank.
    if (clean(body.website, 200)) {
      return jsonResponse({ error: 'Submission rejected.' }, 400);
    }

    const firstName = clean(body.first_name, 100);
    const lastName = clean(body.last_name, 100);
    const idNumber = clean(body.id_number, 100);
    const phone = clean(body.phone, 40);

    if (!firstName || !lastName || !idNumber || !phone) {
      return jsonResponse({
        error: 'First name, surname, ID/passport number and phone are required.',
      }, 400);
    }

    const email = clean(body.email, 254);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: 'Enter a valid email address.' }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    
const details = {
  title: clean(body.title, 30),
  passport_country: clean(body.passport_country, 100),
  marital_status: clean(body.marital_status, 50),
  second_phone: clean(body.contact_no_2 || body.second_phone, 40),
  physical_address: clean(body.address || body.physical_address, 1000) || null,

  next_of_kin: [
    {
      name: clean(body.next_of_kin_1_name, 150),
      relation: clean(body.next_of_kin_1_relation, 100),
      phone: clean(body.next_of_kin_1_phone, 40),
    },
    {
      name: clean(body.next_of_kin_2_name, 150),
      relation: clean(body.next_of_kin_2_relation, 100),
      phone: clean(body.next_of_kin_2_phone, 40),
    },
  ].filter((contact) => contact.name || contact.phone),

  dependants: clean(body.dependants, 1000),
  tax_number: clean(body.tax_number, 100),
  bank_account_holder: clean(body.bank_account_holder, 150),
  bank_account_type: clean(body.bank_account_type, 50),
  bank_account_type_other: clean(body.bank_account_type_other, 100),

  document_checklist:
    body.document_checklist &&
    typeof body.document_checklist === 'object' &&
    !Array.isArray(body.document_checklist)
      ? body.document_checklist
      : {},

  criminal_check_acknowledged:
    body.criminal_check_acknowledged === true,
  employee_signature: clean(body.employee_signature, 150),
  acknowledgement_date: clean(body.acknowledgement_date, 20),

  // Office-only proof-of-payment/results fields are intentionally excluded.
};


    const employee = {
      first_name: firstName,
      last_name: lastName,
      id_number: idNumber,
      date_of_birth: clean(body.date_of_birth, 10) || null,
      email: email || null,
      phone,
      address: clean(body.address, 1000) || null,
      department: clean(body.department, 100) || null,
      job_title: clean(body.job_title, 150) || null,
      employment_type: clean(body.employment_type, 50) || null,
      start_date: clean(body.start_date, 10) || null,
      supervisor: clean(body.supervisor, 150) || null,
      emergency_contact_name: clean(body.emergency_contact_name, 150) || null,
      emergency_contact_phone:
        clean(body.emergency_contact_phone, 40) || null,
      bank_name: clean(body.bank_name, 150) || null,
      bank_account_number: clean(body.bank_account_number, 100) || null,
      system_role: 'employee',
      status: 'active',
      contract_signed: false,
      take_on_details: details,
    };

    // Retry if another submission claims the same employee number.
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: latest, error: latestError } = await supabase
        .from('fms_hr_employees')
        .select('employee_number')
        .like('employee_number', 'EMP-%')
        .order('employee_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestError) {
        console.error('Employee number lookup failed:', latestError);
        return jsonResponse({ error: 'Could not prepare employee record.' }, 500);
      }

      const match = /^EMP-(\d+)$/.exec(latest?.employee_number ?? '');
      const nextNumber = match ? Number(match[1]) + 1 : 1;
      const employeeNumber = `EMP-${String(nextNumber).padStart(4, '0')}`;

      const { data, error } = await supabase
        .from('fms_hr_employees')
        .insert({ ...employee, employee_number: employeeNumber })
        .select('id, employee_number')
        .single();

      if (!error && data) {
        return jsonResponse({
          success: true,
          employee_number: data.employee_number,
          message: 'Employee onboarding submitted successfully.',
        }, 201);
      }

      if (error?.code === '23505') {
        if (error.message?.includes('id_number')) {
          return jsonResponse({
            error: 'This ID/passport number is already registered. Please contact HR.',
          }, 409);
        }

        if (error.message?.includes('employee_number')) {
          continue;
        }

        return jsonResponse({
          error: 'A record with these details already exists. Please contact HR.',
        }, 409);
      }

      console.error('Employee insert failed:', error);
      return jsonResponse({ error: 'Could not save onboarding details.' }, 500);
    }

    return jsonResponse({
      error: 'Could not allocate an employee number. Please try again.',
    }, 503);
  } catch (error) {
    console.error('create-employee request failed:', error);
    return jsonResponse({ error: 'Invalid request or server error.' }, 400);
  }
});
