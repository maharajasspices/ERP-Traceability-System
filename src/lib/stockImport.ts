// =====================================================================
// Bulk stock import
// =====================================================================
//
// Reads a stock sheet (Excel / Google Sheets / CSV) into Receiving Log line
// items. Unlike `invoiceParser`, which flattens a document to text and
// pattern-matches it, this is HEADER driven: the first row names the columns
// and every subsequent row is read positionally. That is what makes a sheet
// the user controls reliably importable.
//
// Expected columns (only the product and the quantity are really needed, and
// the names are matched loosely, so "Stock Code", "stock_code" and "SKU" all
// work):
//
//   Stock Code | Description | Quantity | UOM | Batch | Expiry | Production | Cost
// =====================================================================

import * as XLSX from 'xlsx';

export interface StockImportLine {
  /** 1-based spreadsheet row, so error messages can point at the right line. */
  rowNumber: number;
  stock_code_id: string;
  stock_code: string;
  material_description: string;
  quantity_received: string;
  uom: string;
  /** Internal lot number typed in the sheet; blank means the log generates one. */
  internal_lot_number: string;
  supplier_batch_number: string;
  production_date: string;
  expiry_date: string;
  cost_price_per_kg: string;
}

export interface UnmatchedStockRow {
  rowNumber: number;
  raw: Record<string, string>;
  reason: 'no-product' | 'unknown-product' | 'no-quantity' | 'bad-quantity';
  detail?: string;
}

export interface StockImportResult {
  lines: StockImportLine[];
  unmatched: UnmatchedStockRow[];
  /** Columns that were recognised, so the UI can confirm the mapping. */
  detectedColumns: string[];
  /** Header row that was used (1-based), normally 1. */
  headerRow: number;
  totalRows: number;
}

export type StockCodeLike = {
  id: string;
  stock_code: string;
  description: string;
  unit_of_measure: string;
};

// =====================================================================
// HEADER ALIASES
// =====================================================================
//
// Keys are our internal field names; values are the header spellings we
// accept. Matching ignores case, spaces, underscores and punctuation, so
// "Stock Code", "stock_code" and "STOCK-CODE" are all the same column.
const HEADER_ALIASES: Record<string, string[]> = {
  stock_code: ['stockcode', 'code', 'itemcode', 'sku', 'productcode', 'itemnumber', 'itemno'],
  description: ['description', 'material', 'materialdescription', 'product', 'productname', 'item', 'itemdescription', 'name'],
  quantity: ['quantity', 'qty', 'received', 'quantityreceived', 'weight', 'amount', 'netweight', 'kg', 'quantitykg', 'mass'],
  uom: ['uom', 'unit', 'units', 'unitofmeasure'],
  supplier_batch_number: ['batch', 'batchno', 'batchnumber', 'supplierbatch', 'supplierbatchno', 'supplierbatchnumber', 'lotno', 'supplierlot'],
  expiry_date: ['expiry', 'expirydate', 'useby', 'usebydate', 'bestbefore', 'expiration'],
  production_date: ['production', 'productiondate', 'mfg', 'mfd', 'mfgdate', 'manufacturedate', 'manufacturingdate', 'packed', 'packedon'],
  cost_price_per_kg: ['cost', 'costperkg', 'price', 'rate', 'unitprice', 'costprice', 'priceperkg', 'costkg', 'amountperkg'],
  internal_lot_number: ['lot', 'lotnumber', 'internallot', 'internallotnumber', 'maharajalot'],
};

/** Loose header key: "Stock Code" -> "stockcode". */
export const headerKey = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/**
 * Build the header-key -> field-name map for a header row.
 * The first alias to match wins, so more specific spellings are listed first.
 */
export const mapHeaders = (headerRow: unknown[]): Record<number, string> => {
  const map: Record<number, string> = {};

  headerRow.forEach((cell, index) => {
    const key = headerKey(cell);
    if (!key) return;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(key)) {
        map[index] = field;
        return;
      }
    }
  });

  return map;
};

/** Normalise a date cell (Date, Excel serial, or a string) to YYYY-MM-DD. */
export const toDateString = (value: unknown): string => {
  if (value == null || value === '') return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel serial date. Day 1 is 1900-01-01 in the spreadsheet's own epoch.
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return '';
  }

  const text = String(value).trim();
  if (!text) return '';

  // Already ISO-ish.
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // South African / European style: DD/MM/YYYY or DD-MM-YYYY.
  const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Month name, e.g. "15 Mar 2026".
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return '';
};

export const cellText = (value: unknown): string => {
  if (value == null) return '';
  if (value instanceof Date) return toDateString(value);
  return String(value).trim();
};

/** Words of length >= 3, used for description matching. */
const significantWords = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);

/**
 * Match a spreadsheet row to a stock code.
 *
 * Strict on purpose. An exact code always wins. A description is only
 * accepted when it points at exactly ONE stock code: if two products could
 * match ("Paprika Powder" and "Paprika Flakes") the row is left for the
 * operator, because guessing here would receive the wrong material into stock.
 */
export const matchStockRow = (
  rawCode: string,
  rawDescription: string,
  stockCodes: StockCodeLike[],
): StockCodeLike | null => {
  const code = rawCode.trim();
  if (code) {
    const codeKey = headerKey(code);
    const byCode = stockCodes.find((sc) => headerKey(sc.stock_code) === codeKey);
    if (byCode) return byCode;
  }

  const desc = rawDescription.trim();
  if (!desc) return null;

  const descWords = significantWords(desc);
  if (descWords.length === 0) return null;

  const candidates = stockCodes.filter((sc) => {
    const scWords = significantWords(sc.description);
    if (scWords.length === 0) return false;
    const scSet = new Set(scWords);
    // Every word the operator typed must be part of the stock description.
    return descWords.every((w) => scSet.has(w));
  });

  // Only an unambiguous match is safe to import.
  return candidates.length === 1 ? candidates[0] : null;
};

/**
 * Find the header row: the first row that names at least one column we
 * recognise AND includes a product or quantity column. This tolerates a
 * title or a couple of blank rows above the real header, which is very
 * common in a sheet someone typed in Google Sheets.
 */
const findHeaderRow = (rows: unknown[][]): number => {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const map = mapHeaders(rows[i] ?? []);
    const fields = Object.values(map);
    if (
      fields.length >= 2 &&
      (fields.includes('stock_code') || fields.includes('description')) &&
      fields.includes('quantity')
    ) {
      return i;
    }
  }
  return -1;
};

/**
 * Read a stock spreadsheet into Receiving Log line items.
 *
 * Rows that cannot be trusted come back in `unmatched` with a reason rather
 * than being guessed at, so the operator reviews them before anything is
 * written to stock.
 */
export const parseStockSheet = (
  rows: unknown[][],
  stockCodes: StockCodeLike[],
): StockImportResult => {
  const headerRow = findHeaderRow(rows);

  if (headerRow < 0) {
    return { lines: [], unmatched: [], detectedColumns: [], headerRow: -1, totalRows: 0 };
  }

  const headerMap = mapHeaders(rows[headerRow] ?? []);
  const detectedColumns = [...new Set(Object.values(headerMap))];

  const lines: StockImportLine[] = [];
  const unmatched: UnmatchedStockRow[] = [];
  // Repeated rows for the same product and batch are summed: a supplier sheet
  // often splits one material across several lines.
  const merged = new Map<string, StockImportLine>();

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.every((c) => cellText(c) === '')) continue; // blank row

    const values: Record<string, unknown> = {};
    const raw: Record<string, string> = {};
    for (const [colIndex, field] of Object.entries(headerMap)) {
      const value = row[Number(colIndex)];
      values[field] = value;
      raw[field] = cellText(value);
    }

    const rowNumber = i + 1; // 1-based for the operator

    const product = matchStockRow(
      raw.stock_code ?? '',
      raw.description ?? '',
      stockCodes,
    );

    if (!product) {
      const hasProductInfo = (raw.stock_code ?? '') !== '' || (raw.description ?? '') !== '';
      unmatched.push({
        rowNumber,
        raw,
        reason: hasProductInfo ? 'unknown-product' : 'no-product',
        detail: hasProductInfo
          ? `${raw.stock_code || raw.description} does not match any stock code`
          : 'no stock code or description',
      });
      continue;
    }

    const qtyText = String(values.quantity ?? '').replace(/[,\s]/g, '');
    const qty = Number(qtyText);
    if (qtyText === '' || !Number.isFinite(qty)) {
      unmatched.push({ rowNumber, raw, reason: 'no-quantity' });
      continue;
    }
    if (qty <= 0) {
      unmatched.push({ rowNumber, raw, reason: 'bad-quantity', detail: `quantity ${qty}` });
      continue;
    }

    const expiry = raw.expiry_date ? toDateString(values.expiry_date) : '';
    const production = raw.production_date ? toDateString(values.production_date) : '';

    // A lot number typed in the sheet is honoured; blank means the Receiving
    // Log generates one when the delivery is recorded.
    const lot = (raw.internal_lot_number ?? '').trim();
    const batch = (raw.supplier_batch_number ?? '').trim();

    // Merge key: same product + same lot + same batch + same dates.
    const mergeKey = [product.id, lot.toUpperCase(), batch.toUpperCase(), expiry, production].join('|');

    const existing = merged.get(mergeKey);
    if (existing) {
      existing.quantity_received = String(
        (Number(existing.quantity_received) || 0) + qty,
      );
      continue;
    }

    const line: StockImportLine = {
      rowNumber,
      stock_code_id: product.id,
      stock_code: product.stock_code,
      material_description: product.description,
      quantity_received: String(qty),
      uom: raw.uom || product.unit_of_measure,
      internal_lot_number: lot,
      supplier_batch_number: batch,
      production_date: production,
      expiry_date: expiry,
      cost_price_per_kg: raw.cost_price_per_kg ?? '',
    };

    merged.set(mergeKey, line);
    lines.push(line);
  }

  return {
    lines,
    unmatched,
    detectedColumns,
    headerRow: headerRow + 1,
    totalRows: rows.length - headerRow - 1,
  };
};

/** Read the chosen file into a raw row/cell matrix. */
export const readStockFile = async (file: File): Promise<unknown[][]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  // The first non-empty sheet is the one the operator means.
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: '',
      raw: false,
    });
    if (rows.length > 0) return rows;
  }

  return [];
};

/** File -> parsed result in one call. */
export const importStockFile = async (
  file: File,
  stockCodes: StockCodeLike[],
): Promise<StockImportResult> => parseStockSheet(await readStockFile(file), stockCodes);

/** The columns a template sheet uses, in order. */
export const TEMPLATE_HEADERS = [
  'Lot',
  'Stock Code',
  'Description',
  'Quantity',
  'UOM',
  'Batch',
  'Expiry',
  'Production',
  'Cost',
];

/** Build a ready-to-fill template workbook, pre-seeded with the real products. */
export const buildStockTemplate = (stockCodes: StockCodeLike[]): Blob => {
  const example = stockCodes.slice(0, 5);
  const body = example.length
    ? example.map((sc) => ['', sc.stock_code, sc.description, '', sc.unit_of_measure, '', '', '', ''])
    : [['', '', '', '', 'kg', '', '', '', '']];

  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...body]);
  sheet['!cols'] = [
    { wch: 16 },
    { wch: 16 },
    { wch: 34 },
    { wch: 12 },
    { wch: 8 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Stock');

  const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};



