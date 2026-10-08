// =====================================================================
// Receiving documents (COA + supplier invoice)
// =====================================================================
//
// Documents attached to a receipt. The receiving form already uploads the
// supplier invoice into the private `order-documents` bucket and records the
// path in `quality_checks.invoice_file_path`; this module generalises that so
// a Certificate of Analysis can be attached the same way.
//
// WHY THERE IS NO DATABASE CHANGE
// -------------------------------
// `fms_receiving.quality_checks` is already a JSONB column, and the invoice
// path is already stored inside it. The COA file's path, name, size and
// upload time are stored alongside it under the keys below. That keeps the
// schema lean instead of adding a document table, and older records simply
// have no COA keys and render nothing.
// =====================================================================

/** Private bucket already used for receiving invoices and supplier documents. */
export const RECEIVING_DOCUMENT_BUCKET = 'order-documents';

export type ReceivingDocumentKind = 'COA' | 'INVOICE';

/** Keys written inside `fms_receiving.quality_checks`. */
export const DOC_KEYS = {
  COA: {
    path: 'coa_file_path',
    name: 'coa_file_name',
    size: 'coa_file_size',
    uploadedAt: 'coa_uploaded_at',
  },
  INVOICE: {
    path: 'invoice_file_path',
    name: 'invoice_file_name',
    size: 'invoice_file_size',
    uploadedAt: 'invoice_uploaded_at',
  },
} as const;

export interface ReceivingDocument {
  kind: ReceivingDocumentKind;
  path: string;
  file_name: string;
  size_bytes: number | null;
  uploaded_at: string | null;
}

/** A COA/invoice pair as listed in the history tab and CSV export. */
export interface DocumentHistoryRow {
  lot_number: string;
  received_date: string;
  supplier: string;
  stock_code: string;
  material: string;
  quantity: number;
  uom: string;
  status: string;
  coa_file: string;
  coa_uploaded: string;
  invoice_file: string;
  invoice_uploaded: string;
}

const bucket = () => supabase.storage.from(RECEIVING_DOCUMENT_BUCKET);

/**
 * Pull whichever documents a receiving record has attached.
 * Safe on old records: a missing key simply yields no document.
 */
export const readDocuments = (
  qualityChecks: Record<string, unknown> | null | undefined,
): ReceivingDocument[] => {
  if (!qualityChecks || typeof qualityChecks !== 'object') return [];
  const qc = qualityChecks as Record<string, unknown>;
  const out: ReceivingDocument[] = [];

  for (const kind of ['COA', 'INVOICE'] as const) {
    const keys = DOC_KEYS[kind];
    const path = qc[keys.path];
    if (typeof path !== 'string' || !path) continue;

    out.push({
      kind,
      path,
      file_name:
        typeof qc[keys.name] === 'string' ? (qc[keys.name] as string) : path.split('/').pop() || '',
      size_bytes: typeof qc[keys.size] === 'number' ? (qc[keys.size] as number) : null,
      uploaded_at:
        typeof qc[keys.uploadedAt] === 'string' ? (qc[keys.uploadedAt] as string) : null,
    });
  }

  return out;
};

/**
 * Build the `quality_checks` fragment for an uploaded document.
 *
 * `invoice_file_path` is kept byte-identical to what the old invoice upload
 * already wrote, so existing records and the invoice attachment keep working.
 */
export const buildDocumentMeta = (
  kind: ReceivingDocumentKind,
  meta: { path: string; fileName: string; sizeBytes: number },
): Record<string, string | number> => {
  const keys = DOC_KEYS[kind];
  return {
    [keys.path]: meta.path,
    [keys.name]: meta.fileName,
    [keys.size]: meta.sizeBytes,
    [keys.uploadedAt]: new Date().toISOString(),
  };
};

/**
 * Build the rows for the CSV history export, newest receipt first.
 * Pure, so the export shape can be unit tested without a browser.
 */
export const buildDocumentHistoryRows = (
  records: readonly {
    internal_lot_number: string;
    received_at?: string | null;
    quantity_received?: number | null;
    stock_code_id?: string | null;
    supplier_id?: string | null;
    uom?: string | null;
    status?: string | null;
    quality_checks?: Record<string, unknown> | null;
  }[],
  lookup: {
    stockCode: (
      id: string | null | undefined,
    ) => { stock_code: string; description: string } | undefined;
    supplier: (id: string | null | undefined) => { name: string } | undefined;
  },
): DocumentHistoryRow[] =>
  records
    .map((rec) => {
      const docs = readDocuments(rec.quality_checks);
      const coa = docs.find((d) => d.kind === 'COA');
      const invoice = docs.find((d) => d.kind === 'INVOICE');
      const sc = lookup.stockCode(rec.stock_code_id);

      return {
        lot_number: rec.internal_lot_number,
        received_date: String(rec.received_at || '').slice(0, 10),
        supplier: lookup.supplier(rec.supplier_id)?.name || '',
        stock_code: sc?.stock_code || '',
        material: sc?.description || '',
        quantity: Number(rec.quantity_received) || 0,
        uom: rec.uom || '',
        status: rec.status || '',
        coa_file: coa?.file_name || '',
        coa_uploaded: coa?.uploaded_at ? coa.uploaded_at.slice(0, 10) : '',
        invoice_file: invoice?.file_name || '',
        invoice_uploaded: invoice?.uploaded_at ? invoice.uploaded_at.slice(0, 10) : '',
      };
    })
    .sort((a, b) => b.received_date.localeCompare(a.received_date));
