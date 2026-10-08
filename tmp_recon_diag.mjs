// READ-ONLY diagnostic: why does the Stock Recon report show 0 Stock Entered
// for records the Receiving Log displays as 02 October 2026?
// Only issues SELECTs. Writes nothing, creates nothing in the database.
import fs from 'node:fs';

const envText = fs.readFileSync(new URL('./.env', import.meta.url), 'utf8');
const getEnv = (k) => {
  const m = envText.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : '';
};
const SUPA_URL = getEnv('VITE_SUPABASE_URL');
const SUPA_KEY = getEnv('VITE_SUPABASE_PUBLISHABLE_KEY');
const headers = { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY };

// Windows of the report (must mirror src/lib/stockReconReport.ts:17-18)
const ENTRY_WINDOW_START = '2026-10-02';
const ENTRY_WINDOW_END = '2026-10-07';
const TARGET_JHB_DATE = '2026-10-02'; // Receiving Log date filter from=to=02 Oct

// --- helpers mirroring the app exactly -------------------------------------
// ReceivingLog.tsx:1547-1551 - filter date = JHB calendar date
const jhbDate = (rawDate) => {
  if (!rawDate) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date(rawDate));
  } catch {
    return 'INVALID';
  }
};
// stockReconReport.ts:75
const dateOnly = (iso) => (iso || '').slice(0, 10);
// stockReconReport.ts:70-73
const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

async function fetchAll(table, select) {
  const all = [];
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const u = `${SUPA_URL}/rest/v1/${table}?select=${select}&offset=${from}&limit=${PAGE}`;
    const r = await fetch(u, { headers });
    const text = await r.text();
    if (r.status !== 200) throw new Error(`${table} HTTP ${r.status}: ${text.slice(0, 400)}`);
    const page = JSON.parse(text);
    all.push(...page);
    if (page.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// --- 0. connectivity probe --------------------------------------------------
async function probe(table) {
  const u = `${SUPA_URL}/rest/v1/${table}?select=id&limit=1`;
  const r = await fetch(u, { headers });
  const text = await r.text();
  return { status: r.status, body: text.slice(0, 300) };
}

async function main() {
  for (const t of ['fms_receiving', 'fms_stock_codes']) {
    const p = await probe(t);
    if (p.status !== 200) {
      console.log(`ACCESS DENIED on ${t}: HTTP ${p.status} ${p.body}`);
      console.log('-> anon/publishable key is blocked by RLS; no diagnostic data available.');
      process.exit(2);
    }
  }
  console.log('Access OK (anon SELECT on fms_receiving + fms_stock_codes).');

  const receivings = await fetchAll(
    'fms_receiving',
    'id,internal_lot_number,received_at,created_at,status,quantity_received,stock_code_id'
  );
  const stockCodes = await fetchAll('fms_stock_codes', 'id,stock_code,item_type,description');
  console.log(`Loaded ${receivings.length} receiving rows, ${stockCodes.length} stock codes.`);

  const codeById = new Map(stockCodes.map((sc) => [sc.id, sc]));
  // stockReconReport.ts:77-78,108-115 - the RM scope of the report
  const rawIds = new Set(
    stockCodes
      .filter((sc) => sc.item_type === 'raw_material' && sc.stock_code.startsWith('RM'))
      .map((sc) => sc.id)
  );

  // Q1: records the Receiving Log shows for 02 Oct (ReceivingLog.tsx:1545-1557)
  const displayed = receivings.filter((rec) => {
    const rawDate = rec.received_at || rec.created_at || '';
    return jhbDate(rawDate) === TARGET_JHB_DATE;
  });

  // Gates, exactly as stockReconReport.ts:136-150 applies them
  const evaluate = (rec) => {
    const d = dateOnly(rec.received_at);
    const gates = {
      rm_scope: rawIds.has(rec.stock_code_id),
      status_accepted: rec.status === 'accepted',
      qty_positive: toNum(rec.quantity_received) > 0,
      date_in_window: d >= ENTRY_WINDOW_START && d <= ENTRY_WINDOW_END,
    };
    const failed = Object.entries(gates).filter(([, ok]) => !ok).map(([k]) => k);
    return { d, gates, failed, passesAll: failed.length === 0 };
  };

  const rows = displayed.map((rec) => ({ rec, ...evaluate(rec) }));

  const count = (fn) => rows.filter(fn).length;
  const q2 = count((r) => r.rec.received_at === null);
  const q2empty = count((r) => r.rec.received_at === '' );
  const q3 = count((r) => r.rec.status === 'accepted');
  const q4 = count((r) => r.rec.status !== 'accepted');
  const q5 = count((r) => r.gates.rm_scope);
  const q6 = count((r) => r.gates.qty_positive);
  const q7 = rows.filter((r) => r.passesAll);
  const dateGatePass = count((r) => r.gates.date_in_window);

  console.log('\n=== COUNTS for records displayed as 02 October 2026 (JHB) ===');
  console.log(`1. Total displayed as 02 Oct:                 ${rows.length}`);
  console.log(`2. received_at === null:                      ${q2}`);
  console.log(`   received_at === '' (empty string):         ${q2empty}`);
  console.log(`3. status === 'accepted':                     ${q3}`);
  console.log(`4. status !== 'accepted':                     ${q4}`);
  console.log(`5. RM scope (item_type=raw_material AND RM*):  ${q5}`);
  console.log(`6. quantity_received > 0:                     ${q6}`);
  console.log(`   ...of which date gate passed (02-07 Oct):  ${dateGatePass}`);
  console.log(`7. Pass ALL recon gates:                      ${q7.length}`);
  const entered = q7.reduce((s, r) => s + toNum(r.rec.quantity_received), 0);
  console.log(`   Sum of quantity passing all gates:         ${entered}`);

  // Failure breakdown per gate (a record can fail several)
  const failCounts = { rm_scope: 0, status_accepted: 0, qty_positive: 0, date_in_window: 0 };
  const combos = new Map();
  for (const r of rows) {
    if (r.passesAll) continue;
    for (const g of r.failed) failCounts[g] += 1;
    const key = r.failed.join(' + ');
    combos.set(key, (combos.get(key) || 0) + 1);
  }
  console.log('\n--- Failure counts per gate (records can fail more than one) ---');
  for (const [g, n] of Object.entries(failCounts)) console.log(`  ${g}: ${n}`);
  console.log('--- Failure combinations ---');
  for (const [k, n] of [...combos.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`);

  // Q8: sample of failing records
  const failedRows = rows.filter((r) => !r.passesAll);
  console.log(`\n=== Q8: Sample of failing records (${Math.min(12, failedRows.length)} of ${failedRows.length}) ===`);
  for (const r of failedRows.slice(0, 12)) {
    const sc = codeById.get(r.rec.stock_code_id);
    console.log(JSON.stringify({
      lot: r.rec.internal_lot_number,
      stock_code: sc ? sc.stock_code : '(stock_code_id not found)',
      item_type: sc ? sc.item_type : null,
      status: r.rec.status,
      qty: r.rec.quantity_received,
      received_at: r.rec.received_at,
      created_at: r.rec.created_at,
      recon_date_slice: r.d,
      failed_gates: r.failed,
    }));
  }

  // Special check: received_at null but created_at on 02 Oct
  const nullCreated02 = rows.filter(
    (r) => (r.rec.received_at === null || r.rec.received_at === '') &&
      jhbDate(r.rec.created_at || '') === TARGET_JHB_DATE
  );
  const nullCreated02utc = rows.filter(
    (r) => (r.rec.received_at === null || r.rec.received_at === '') &&
      dateOnly(r.rec.created_at || '') === TARGET_JHB_DATE
  );
  console.log('\n=== Special check: received_at null/empty ===');
  console.log(`records displayed 02 Oct with received_at null/empty (via created_at): ${nullCreated02.length}`);
  console.log(`  ...of those, created_at UTC slice is exactly 2026-10-02:            ${nullCreated02utc.length}`);
  for (const r of nullCreated02.slice(0, 5)) {
    console.log(JSON.stringify({ lot: r.rec.internal_lot_number, received_at: r.rec.received_at, created_at: r.rec.created_at }));
  }

  // Bonus: received_at present but UTC slice differs from JHB date (tz shift)
  const tzShift = rows.filter((r) => r.rec.received_at && dateOnly(r.rec.received_at) !== TARGET_JHB_DATE);
  console.log(`\n=== Timezone shift check ===`);
  console.log(`received_at present but UTC slice != 2026-10-02: ${tzShift.length}`);
  for (const r of tzShift.slice(0, 5)) {
    console.log(JSON.stringify({ lot: r.rec.internal_lot_number, received_at: r.rec.received_at, utc_slice: r.d }));
  }
}

main().catch((e) => { console.error('DIAG ERROR:', e.message); process.exit(1); });
