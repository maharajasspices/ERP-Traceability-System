// =====================================================================
// Invoice / Order document parser
//
// Extracts line items from an uploaded invoice (PDF, CSV, XLSX, TXT)
// and matches them against the system's stock codes.
// =====================================================================

import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import * as XLSX from 'xlsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// =====================================================================
// TYPES
// =====================================================================

export interface ParsedInvoiceItem {
  raw_code: string;
  description: string;
  quantity: number;
  uom: string;
  matched: boolean;
  stock_code_id?: string;
}

export interface ParseResult {
  items: ParsedInvoiceItem[];
  matchedCount: number;
  rawTextLength: number;
}

type StockCodeLike = {
  id: string;
  stock_code: string;
  description: string;
  unit_of_measure: string;
};

// =====================================================================
// HELPERS
// =====================================================================

const normalize = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const tokenize = (s: string): string[] =>
  normalize(s).split(' ').filter(Boolean);

// =====================================================================
// STOCK CODE MATCHING
// =====================================================================

function scoreMatch(haystack: string, sc: StockCodeLike): number {
  const code = normalize(sc.stock_code);
  const desc = normalize(sc.description);
  const haystackWords = tokenize(haystack);

  let score = 0;

  // Stock code exact match
  if (code && haystack.includes(code)) {
    score += 10;
  }

  // Stock code whole-word match
  if (code) {
    const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const codeRegex = new RegExp(`\\b${escapedCode}\\b`, 'i');
    if (codeRegex.test(haystack)) {
      score += 4;
    }
  }

  // Description matching
  if (desc && desc.length >= 3) {
    // Exact ordered description match
    if (haystack.includes(desc)) {
      score += 6;
    } else {
      // Order-independent word-set comparison
      const descWords = tokenize(desc).filter(w => w.length >= 2);
      const haystackWordSet = new Set(haystackWords);

      if (descWords.length > 0 && descWords.every(w => haystackWordSet.has(w))) {
        score += 5;
      } else {
        // Partial description overlap
        const hit = descWords.filter(w => haystackWordSet.has(w)).length;
        if (descWords.length > 0) {
          const ratio = hit / descWords.length;
          if (ratio >= 0.5) {
            score += 3 + Math.floor(hit / 2);
          } else if (ratio >= 0.3) {
            score += 2;
          } else if (hit >= 1) {
            score += 1;
          }
        }
      }

      // Partial word matching
      const significantDescWords = tokenize(desc).filter(w => w.length >= 3);
      for (const descWord of significantDescWords) {
        for (const haystackWord of haystackWords) {
          if (haystackWord.includes(descWord) || descWord.includes(haystackWord)) {
            score += 1;
            break;
          }
        }
      }
    }
  }

  return score;
}

export function matchStockCodes(
  items: ParsedInvoiceItem[],
  stockCodes: StockCodeLike[]
): ParsedInvoiceItem[] {
  for (const item of items) {
    const haystack = normalize(`${item.raw_code} ${item.description}`);

    if (!haystack.trim()) {
      item.matched = false;
      continue;
    }

    let best: StockCodeLike | null = null;
    let bestScore = 0;

    for (const sc of stockCodes) {
      const s = scoreMatch(haystack, sc);
      if (s > bestScore) {
        bestScore = s;
        best = sc;
      }
    }

    // Threshold of 2 for sensitive matching
    if (best && bestScore >= 2) {
      item.matched = true;
      item.stock_code_id = best.id;
      if (!item.uom) {
        item.uom = best.unit_of_measure || '';
      }
    } else {
      item.matched = false;
    }
  }

  return items;
}

// PDF PARSING
async function parsePdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Group text items into visual lines using their Y position so that a
    // line such as "All purpose flour 500" stays on one line instead of the
    // whole page being flattened into a single space-separated string.
    // Losing line structure is what makes quantities get confused with
    // dates, invoice numbers, prices or page numbers.
    type LineItem = { x: number; endX: number; str: string };
    const linesMap = new Map<number, LineItem[]>();
    const yKeys: number[] = [];

    for (const item of content.items as any[]) {
      const str: string = item.str ?? '';
      if (!str.trim()) continue;

      const transform: number[] = item.transform ?? [1, 0, 0, 1, 0, 0];
      const x = transform[4] ?? 0;
      const yRaw = transform[5] ?? 0;
      const width = typeof item.width === 'number' ? item.width : 0;

      // Snap Y to an existing line within a small tolerance so items on the
      // same visual line group together even if their baselines differ slightly.
      let y = yKeys.find(k => Math.abs(k - yRaw) < 3);
      if (y === undefined) {
        y = yRaw;
        yKeys.push(y);
      }
      if (!linesMap.has(y)) linesMap.set(y, []);
      linesMap.get(y)!.push({ x, endX: x + width, str });
    }

    const pageLines = [...linesMap.entries()]
      .sort((a, b) => b[0] - a[0]) // top to bottom
      .map(([, items]) => {
        items.sort((a, b) => a.x - b.x); // left to right
        let line = '';
        let prevEndX: number | null = null;
        for (const it of items) {
          // Use a tab separator between text that has a clear horizontal gap
          // (table columns) so parseLineItem can split fields reliably.
          const gap = prevEndX != null ? it.x - prevEndX : 0;
          if (line.length === 0) {
            line = it.str;
          } else {
            const needsSpace = !/\s$/.test(line) && !/^\s/.test(it.str);
            line += (gap > 5 ? '\t' : (needsSpace ? ' ' : '')) + it.str;
          }
          prevEndX = it.endX;
        }
        return line.trim();
      })
      .filter(Boolean);

    textParts.push(pageLines.join('\n'));
  }

  return textParts.join('\n');
}

// =====================================================================
// SPREADSHEET PARSING
// =====================================================================

async function parseSpreadsheet(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const textParts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    for (const row of jsonData) {
      if (row && row.length > 0) {
        textParts.push(row.map(cell => String(cell ?? '')).join('\t'));
      }
    }
  }

  return textParts.join('\n');
}

// =====================================================================
// LINE ITEM PARSING
// =====================================================================

// Pattern to match currency amounts like $100.00, $50,000.00, R100.00, etc.
const CURRENCY_PATTERN = /(?:R|\$|€|£)\s*\d[\d,]*\.?\d*/gi;

// Pattern to match units of measure
const UOM_PATTERN = /(kg|g|ton|t|l|lt|litre|liter|ml|ea|each|unit|units|box|boxes|case|cases|pack|packs|pallet|pallets|bag|bags)/i;

export function parseInvoiceText(
  text: string,
  stockCodes: StockCodeLike[]
): ParsedInvoiceItem[] {

  const items: ParsedInvoiceItem[] = [];

  // PDF extraction can flatten an entire invoice into one long line.
  // First try to identify known stock-code descriptions directly from
  // the complete document text. This prevents invoice dates, invoice
  // numbers and totals from being mistaken for quantities.

  const normalizedText = text
    .replace(/\s+/g, ' ')
    .trim();

  for (const sc of stockCodes) {
    const description = (sc.description || '').trim();
    const stockCode = (sc.stock_code || '').trim();

    if (!description && !stockCode) continue;

    // Try the stock-code first when one exists.
    const searchTerms: string[] = [];

    if (stockCode) {
      searchTerms.push(stockCode);
    }

    if (description) {
      searchTerms.push(description);
    }

    for (const term of searchTerms) {
      if (!term) continue;

      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Look for:
      // "All purpose flour 500"
      // "All purpose flour 500 kg"
      // "All purpose flour R150.00 500"  (price column between description and qty)
      //
      // The quantity must occur immediately after the known product
      // description/code (allowing an optional unit-price in between).
      // This prevents "9" from 9/1/2026 being used.
      const quantityPattern = new RegExp(
        `${escapedTerm}\\s+(?:(?:R|\\$|€|£)\\s*[\\d.,]+\\s*)?(\\d+(?:\\.\\d+)?)\\s*(kg|g|ton|t|l|lt|litre|liter|ml|ea|each|unit|units|box|boxes|case|cases|pack|packs|bag|bags)?(?=\\s|$)`,
        'i'
      );

      const match = normalizedText.match(quantityPattern);

      // Also support invoices where the quantity column comes BEFORE the
      // description: "500 All purpose flour" / "500 kg All purpose flour".
      const quantityBeforePattern = new RegExp(
        `(?<![\\d./])(\\d+(?:\\.\\d+)?)\\s*(kg|g|ton|t|l|lt|litre|liter|ml|ea|each|unit|units|box|boxes|case|cases|pack|packs|bag|bags)?\\s+${escapedTerm}(?=\\s|$)`,
        'i'
      );

      const matchBefore = match ? null : normalizedText.match(quantityBeforePattern);
      const chosen = match ?? matchBefore;

      if (chosen) {
        const quantity = parseFloat(chosen[1]);

        if (quantity > 0 && quantity < 1000000) {
          items.push({
            raw_code: stockCode,
            description,
            quantity,
            uom: chosen[2]
              ? chosen[2].toLowerCase()
              : sc.unit_of_measure || '',
            matched: true,
            stock_code_id: sc.id,
          });

          break;
        }
      }
    }
  }

  // If we successfully found known stock-code items, return those.
  // This is the safest path for invoice uploads because the ERP already
  // knows which stock codes are valid.
  if (items.length > 0) {
    const seen = new Set<string>();

    return items.filter(item => {
      const key = `${item.stock_code_id}|${item.quantity}`;

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
  }

  // Fallback for invoices where the description does not exactly match
  // a stock-code description. Use the existing line-based parser.
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const fallbackItems: ParsedInvoiceItem[] = [];

  const headerPatterns = [
    /^description/i,
    /^qty/i,
    /^quantity/i,
    /^unit\s*price/i,
    /^amount/i,
    /^item/i,
    /^product/i,
    /^code/i,
    /^stock\s*code/i,
    /^#/i,
    /^no\./i,
    /^num/i,
    /^---/i,
    /^===/i,
  ];

  for (const line of lines) {
    if (!line || line.length < 3) continue;
    if (headerPatterns.some(p => p.test(line))) continue;

    if (/^(?:R|\$|€|£)?\s*[\d,]+\.?\d*$/.test(line)) {
      continue;
    }

    const parsed = parseLineItem(line);

    if (
      parsed &&
      parsed.description &&
      parsed.quantity > 0
    ) {
      fallbackItems.push(parsed);
    }
  }

  const seen = new Set<string>();

  const unique = fallbackItems.filter(item => {
    const key =
      `${item.raw_code}|${item.description.toLowerCase()}|${item.quantity}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });

  return matchStockCodes(unique, stockCodes);
}


function parseLineItem(line: string): ParsedInvoiceItem | null {
  // Remove currency amounts from the line (unit price, amount, etc.)
  // This handles patterns like $100.00, $50,000.00, R100.00, etc.
  let cleanedLine = line.replace(CURRENCY_PATTERN, '').trim();

  // Also remove standalone numbers at the end that look like currency (no currency symbol)
  // but be careful not to remove the quantity
  cleanedLine = cleanedLine.replace(/\s+\d[\d,]*\.?\d{2,}\s*$/, '').trim();

  // Now find the quantity - it should be a number that's NOT followed by currency
  // Strategy: find the first reasonable quantity in the line

  // Split by tabs or multiple spaces
  const fields = cleanedLine.split(/\t|\s{2,}/).map(f => f.trim()).filter(Boolean);

  if (fields.length === 0) return null;

  // If we have multiple fields, try to identify which is quantity
  if (fields.length >= 2) {
    return parseMultiFieldLine(fields);
  }

  // Single field line - parse more carefully
  return parseSingleFieldLine(cleanedLine);
}

function parseMultiFieldLine(fields: string[]): ParsedInvoiceItem | null {
  // Try to identify which field is the quantity
  // Quantity is typically a simple number (not a currency amount)

  let quantity = 0;
  let quantityIndex = -1;
  let uom = '';

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];

    // Check if this field is a simple number (quantity)
    const numMatch = field.match(/^(\d+\.?\d*)$/);
    if (numMatch) {
      const num = parseFloat(numMatch[1]);
      if (num > 0 && num < 1000000) { // Reasonable quantity range
        quantity = num;
        quantityIndex = i;

        // Check next field for UOM
        if (i + 1 < fields.length) {
          const nextField = fields[i + 1].toLowerCase();
          const uomMatch = nextField.match(UOM_PATTERN);
          if (uomMatch) {
            uom = uomMatch[1].toLowerCase();
          }
        }
        break;
      }
    }

    // Check if field contains number followed by UOM (like "500kg" or "500 kg")
    const numUomMatch = field.match(/^(\d+\.?\d*)\s*(kg|g|ton|t|l|lt|litre|liter|ml|ea|each|unit|units|box|boxes|case|cases|pack|packs|bag|bags)$/i);
    if (numUomMatch) {
      quantity = parseFloat(numUomMatch[1]);
      uom = numUomMatch[2].toLowerCase();
      quantityIndex = i;
      break;
    }
  }

  if (quantityIndex === -1 || quantity === 0) {
    // Try to find any number that could be quantity
    for (let i = fields.length - 1; i >= 0; i--) {
      const field = fields[i];
      if (field.match(/^(?:R|\$|€|£)/)) continue; // Skip currency fields

      const numMatch = field.match(/(\d+\.?\d*)/);
      if (numMatch) {
        const num = parseFloat(numMatch[1]);
        if (num > 0 && num < 1000000) {
          quantity = num;
          quantityIndex = i;
          break;
        }
      }
    }
  }

  if (quantity === 0) return null;

  // Description is everything except the quantity field and any currency fields
  const descriptionParts: string[] = [];
  let rawCode = '';

  for (let i = 0; i < fields.length; i++) {
    if (i === quantityIndex) continue;

    const field = fields[i];

    // Skip currency fields
    if (field.match(/^(?:R|\$|€|£)/)) continue;

    // Skip UOM-only fields
    if (field.match(/^(kg|g|ton|t|l|lt|litre|liter|ml|ea|each|unit|units|box|boxes|case|cases|pack|packs|bag|bags)$/i)) continue;

    // Check if first field looks like a stock code
    if (descriptionParts.length === 0 && /^[A-Za-z0-9][A-Za-z0-9\-_\/.]{1,15}$/.test(field) && /\d/.test(field)) {
      rawCode = field;
      continue;
    }

    descriptionParts.push(field);
  }

  const description = descriptionParts.join(' ').trim();

  if (!description) return null;

  return {
    raw_code: rawCode,
    description,
    quantity,
    uom,
    matched: false,
  };
}


function parseSingleFieldLine(line: string): ParsedInvoiceItem | null {
  const cleaned = line.replace(/\s+/g, ' ').trim();
  const endMatch = cleaned.match(
    /^(.+?)\s+(\d+(?:\.\d+)?)\s*(kg|g|ton|t|l|lt|litre|liter|ml|ea|each|unit|units|box|boxes|case|cases|pack|packs|bag|bags)?$/i
  );

  if (endMatch) {
    const potentialQty = parseFloat(endMatch[2]);

    if (potentialQty > 0 && potentialQty < 1000000) {
      const uom = endMatch[3] ? endMatch[3].toLowerCase() : '';
      let quantity = potentialQty;
      let descPart = endMatch[1].trim();

      // PDF text extraction can glue extra trailing numbers onto a line
      // (page numbers, footer numbers, the next row's first column, etc.),
      // e.g. "All purpose flour 500 9". In that case the LAST number is
      // not the quantity. If the description part still ends with another
      // standalone number AND still contains text, prefer that inner
      // number as the quantity and drop the glued trailing number(s).
      for (;;) {
        const inner = descPart.match(/^(.*\S)\s+(\d+(?:\.\d+)?)$/);
        if (!inner) break;
        const prefix = inner[1].trim();
        // Only strip if the remaining description still contains a number
        // (i.e. this is a glued number, not the actual quantity).
        if (!/\d/.test(prefix) || prefix.length < 2) break;
        quantity = parseFloat(inner[2]);
        descPart = prefix;
      }

      // Make sure we are not treating a date as the quantity.
      // A date such as 9/1/2026 will never match the numeric-at-end
      // pattern above as a complete quantity.
      if (!/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(descPart)) {
        let rawCode = '';
        let description = descPart;

        const words = descPart.split(/\s+/);

        // Check if first word looks like a stock code.
        if (
          words.length >= 2 &&
          /^[A-Za-z0-9][A-Za-z0-9\-_/.]{1,15}$/.test(words[0]) &&
          /\d/.test(words[0])
        ) {
          rawCode = words[0];
          description = words.slice(1).join(' ');
        }

        if (description) {
          return {
            raw_code: rawCode,
            description,
            quantity,
            uom,
            matched: false,
          };
        }
      }
    }
  }

  // Pattern 2:
  // Look for a number immediately before a UOM.
  // Example: "All purpose flour 500 kg"
  const uomMatch = cleaned.match(
    /(.+?)\s+(\d+(?:\.\d+)?)\s*(kg|g|ton|t|l|lt|litre|liter|ml|ea|each|unit|units|box|boxes|case|cases|pack|packs|bag|bags)\s*$/i
  );

  if (uomMatch) {
    const quantity = parseFloat(uomMatch[2]);

    if (quantity > 0 && quantity < 1000000) {
      let rawCode = '';
      let description = uomMatch[1].trim();

      const words = description.split(/\s+/);

      if (
        words.length >= 2 &&
        /^[A-Za-z0-9][A-Za-z0-9\-_/.]{1,15}$/.test(words[0]) &&
        /\d/.test(words[0])
      ) {
        rawCode = words[0];
        description = words.slice(1).join(' ');
      }

      if (description) {
        return {
          raw_code: rawCode,
          description,
          quantity,
          uom: uomMatch[3].toLowerCase(),
          matched: false,
        };
      }
    }
  }

  // Pattern 3:
  // Only as a final fallback, look for standalone numbers that are NOT:
  // - part of a date
  // - part of an invoice number
  // - decimal/currency values
  //
  // IMPORTANT: use the LAST suitable number rather than the first number.
  const numberMatches = [...cleaned.matchAll(/(?<![\/\d])\d+(?:\.\d+)?(?![\/\d])/g)];

  for (let i = numberMatches.length - 1; i >= 0; i--) {
    const match = numberMatches[i];
    const numStr = match[0];
    const num = parseFloat(numStr);

    if (num <= 0 || num >= 1000000) continue;

    const before = cleaned.slice(0, match.index).trim();
    const after = cleaned.slice((match.index ?? 0) + numStr.length).trim();

    // Don't use a number that is part of a date.
    if (
      /(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4})$/.test(before) ||
      /^[/-]\d/.test(after)
    ) {
      continue;
    }

    // The description must contain actual text.
    if (before.length < 2) continue;

    let rawCode = '';
    let description = before;

    const words = description.split(/\s+/);

    if (
      words.length >= 2 &&
      /^[A-Za-z0-9][A-Za-z0-9\-_/.]{1,15}$/.test(words[0]) &&
      /\d/.test(words[0])
    ) {
      rawCode = words[0];
      description = words.slice(1).join(' ');
    }

    if (description) {
      return {
        raw_code: rawCode,
        description,
        quantity: num,
        uom: '',
        matched: false,
      };
    }
  }

  return null;
}


// =====================================================================
// MAIN ENTRY POINT
// =====================================================================

export async function parseInvoiceFile(
  file: File,
  stockCodes: StockCodeLike[]
): Promise<ParseResult> {
  const name = file.name.toLowerCase();

  let text = '';

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    text = await parsePdf(file);
  } else if (/\.(xlsx|xls|csv)$/.test(name) || file.type.includes('sheet') || file.type.includes('excel') || file.type.includes('csv')) {
    text = await parseSpreadsheet(file);
  } else if (file.type.startsWith('text/') || name.endsWith('.txt')) {
    text = await file.text();
  } else {
    throw new Error('Unsupported file type. Please upload a PDF, CSV, Excel or TXT invoice.');
  }

  const items = parseInvoiceText(text, stockCodes);

  return {
    items,
    matchedCount: items.filter(item => item.matched).length,
    rawTextLength: text.length,
  };
}