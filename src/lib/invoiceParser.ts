// =====================================================================
// Invoice / Order document parser
// Extracts line items from an uploaded invoice (PDF, CSV, XLSX, TXT)
// and matches them against the system's stock codes.
// =====================================================================
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import * as XLSX from 'xlsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface ParsedInvoiceItem {
  raw_code: string;       // stock code / product code text found on the invoice (may be '')
  description: string;    // item description text
  quantity: number;       // quantity parsed from the document (0 if unknown)
  uom: string;            // unit of measure if detectable, else ''
  matched: boolean;       // whether we matched it to a system stock code
  stock_code_id?: string; // matched stock code id
}

export interface ParseResult {
  items: ParsedInvoiceItem[];
  matchedCount: number;
  rawTextLength: number;
}

type StockCodeLike = { id: string; stock_code: string; description: string; unit_of_measure: string };

// ---------------------------------------------------------------- helpers
const normalize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Score how well an invoice line matches a stock code (higher = better). */
function scoreMatch(haystack: string, sc: StockCodeLike): number {
  const code = normalize(sc.stock_code);
  const desc = normalize(sc.description);
  let score = 0;
  if (code && haystack.includes(code)) score += 10;
  // whole-word code match is stronger
  if (code && new RegExp(`\\b${code.replace(/ /g, '\\s+')}\\b`, 'i').test(haystack)) score += 4;
  if (desc && desc.length >= 4) {
    if (haystack.includes(desc)) score += 6;
    else {
      // partial description overlap: count matched significant words
      const words = desc.split(' ').filter(w => w.length >= 4);
      const hit = words.filter(w => haystack.includes(w)).length;
      if (words.length > 0 && hit / words.length >= 0.6) score += hit;
    }
  }
  return score;
}

/** Match parsed items against known stock codes. Mutates and returns the array. */
export function matchStockCodes(items: ParsedInvoiceItem[], stockCodes: StockCodeLike[]): ParsedInvoiceItem[] {
  for (const item of items) {
    const haystack = normalize(`${item.raw_code} ${item.description}`);
    if (!haystack.trim()) { item.matched = false; continue; }
    let best: StockCodeLike | null = null;
    let bestScore = 0;
    for (const sc of stockCodes) {
      const s = scoreMatch(haystack, sc);
      if (s > bestScore) { bestScore = s; best = sc; }
    }
    if (best && bestScore >= 4) {
      item.matched = true;
      item.stock_code_id = best.id;
      if (!item.uom) item.uom = best.unit_of_measure || '';
    } else {
      item.matched = false;
    }
  }
  return items;
}

// ---------------------------------------------------------------- CSV / XLSX
async function parseSpreadsheet(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return '';
  return XLSX.utils.sheet_to_csv(sheet);
}

// ---------------------------------------------------------------- PDF
async function parsePdf(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let text = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Group items into lines by their Y coordinate, preserving X order
    type Item = { str: string; x: number; y: number };
    const items = (content.items as any[])
      .filter(it => typeof it.str === 'string' && it.str.trim())
      .map(it => ({ str: it.str as string, x: it.transform[4] as number, y: it.transform[5] as number })) as Item[];
    const rows = new Map<number, Item[]>();
    for (const it of items) {
      const key = Math.round(it.y / 3) * 3; // 3pt tolerance
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key)!.push(it);
    }
    const sortedKeys = [...rows.keys()].sort((a, b) => b - a); // top to bottom
    for (const key of sortedKeys) {
      const line = rows.get(key)!.sort((a, b) => a.x - b.x).map(i => i.str).join(' ');
      text += line + '\n';
    }
  }
  return text;
}

export { parseSpreadsheet, parsePdf };

// ---------------------------------------------------------------- line parsing
const UOM_PATTERN = String.raw`\b(kg|g|gr|ton|t|l|lt|litre|liter|ml|ea|each|unit|units|box|boxes|case|pack|pallet|bag|bags)\b`;

/**
 * Parse invoice text into candidate line items.
 * Heuristics: a line item typically looks like
 *   "SC-001 Coriander Ground 25 kg" or "SC-001;Coriander Ground;25;kg"
 * We accept lines containing both text and a number, skipping obvious
 * header/total/footer lines.
 */
export function parseInvoiceText(text: string, stockCodes: StockCodeLike[]): ParsedInvoiceItem[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const skip = /^(total|subtotal|sub-total|vat|tax|grand total|amount due|balance|invoice|date|page|supplier|customer|delivery|po\b|purchase order|thanks|thank you|banking|payment|terms|item\s+description|description\s+qty|qty\s+description)/i;
  const items: ParsedInvoiceItem[] = [];

  for (const line of lines) {
    if (skip.test(line)) continue;
    // Split candidate fields: by 2+ spaces, tabs, pipes or semicolons first
    let fields = line.split(/\t|\s{2,}|\||;/g).map(f => f.trim()).filter(Boolean);
    if (fields.length < 2) {
      // Fall back to "description ... number at end" pattern
      const m = line.match(/^(.*?)[\s.:]+((?:R\s?)?\d[\d.,]*)\s*(kg|g|ton|t|l|ml|ea|unit|box|pack|bag)?\s*$/i);
      if (m) fields = [m[1], m[2], m[3] || ''].filter(Boolean);
      else continue;
    }

    // Find a numeric field (the quantity) — last numeric-looking field wins
    let qtyIdx = -1;
    for (let i = fields.length - 1; i >= 0; i--) {
      if (/^\d[\d.,]*$/.test(fields[i].replace(/^R\s?/i, '')) || new RegExp(`^${UOM_PATTERN}$`, 'i').test(fields[i])) {
        if (qtyIdx === -1) qtyIdx = i;
      }
    }
    if (qtyIdx === -1) continue;

    const qtyStr = fields[qtyIdx].replace(/^R\s?/i, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.');
    const quantity = parseFloat(qtyStr);
    if (isNaN(quantity) || quantity <= 0) continue;

    // Description = everything before the quantity field
    const descParts = fields.slice(0, qtyIdx);
    if (descParts.length === 0) continue;
    let rawCode = '';
    let description = descParts.join(' ').trim();

    // If the first field looks like a code (short, alphanumeric-ish) treat it separately
    const first = descParts[0];
    if (descParts.length >= 2 && /^[A-Za-z0-9][A-Za-z0-9\-\/_.]{1,15}$/.test(first) && /\d/.test(first)) {
      rawCode = first;
      description = descParts.slice(1).join(' ').trim();
    }

    // UoM may follow the quantity
    let uom = '';
    const afterQty = fields.slice(qtyIdx + 1).join(' ').trim();
    const uomMatch = afterQty.match(new RegExp(`^${UOM_PATTERN}\\b`, 'i')) ||
      (fields[qtyIdx].replace(/^R\s?/i, '').match(new RegExp(`${UOM_PATTERN}\\b`, 'i')));
    if (uomMatch) uom = uomMatch[1].toLowerCase();
    if (uom === 't') uom = 'ton';
    if (uom === 'gr') uom = 'g';
    if (uom === 'lt') uom = 'l';

    if (!description && !rawCode) continue;
    items.push({ raw_code: rawCode, description, quantity, uom, matched: false });
  }

  // Deduplicate identical raw rows
  const seen = new Set<string>();
  const unique = items.filter(it => {
    const key = `${it.raw_code}|${it.description.toLowerCase()}|${it.quantity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return matchStockCodes(unique, stockCodes);
}

/** Main entry: parse an uploaded invoice document into matched line items. */
export async function parseInvoiceFile(file: File, stockCodes: StockCodeLike[]): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  let text = '';

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    text = await parsePdf(file);
  } else if (/\.(xlsx|xls|csv)$/.test(name) || file.type.includes('sheet') || file.type.includes('excel') || file.type.includes('csv')) {
    text = await parseSpreadsheet(file);
  } else if (file.type.startsWith('text/') || name.endsWith('.txt')) {
    text = await file.text();
  } else {
    throw new Error('Unsupported file type. Please upload a PDF, CSV or Excel invoice.');
  }

  const items = parseInvoiceText(text, stockCodes);
  return {
    items,
    matchedCount: items.filter(i => i.matched).length,
    rawTextLength: text.length,
  };
}
