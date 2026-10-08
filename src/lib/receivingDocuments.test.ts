import { describe, expect, it } from 'vitest';

import {
  DOC_KEYS,
  buildDocumentHistoryRows,
  buildDocumentMeta,
  readDocuments,
} from '@/lib/receivingDocuments';

describe('readDocuments', () => {
  it('reads a COA stored in quality_checks', () => {
    const docs = readDocuments({
      coa_file_path: 'coa/LOT-1/123-cert.pdf',
      coa_file_name: 'cert.pdf',
      coa_file_size: 2048,
      coa_uploaded_at: '2026-03-01T08:00:00.000Z',
    });
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ kind: 'COA', path: 'coa/LOT-1/123-cert.pdf', size_bytes: 2048 });
  });

  it('reads a legacy invoice that only stored the path', () => {
    // This is what the existing invoice upload wrote before metadata existed.
    const docs = readDocuments({ invoice_file_path: 'receiving/2026-03-01/9-inv.pdf' });
    expect(docs).toHaveLength(1);
    expect(docs[0].kind).toBe('INVOICE');
    // Falls back to the last path segment as the name.
    expect(docs[0].file_name).toBe('9-inv.pdf');
    expect(docs[0].size_bytes).toBeNull();
  });

  it('returns both when a receipt has a COA and an invoice', () => {
    const docs = readDocuments({
      coa_file_path: 'coa/a.pdf',
      invoice_file_path: 'receiving/b.pdf',
    });
    expect(docs.map((d) => d.kind).sort()).toEqual(['COA', 'INVOICE']);
  });

  it('returns nothing for old records with no documents', () => {
    expect(readDocuments({})).toEqual([]);
    expect(readDocuments(null)).toEqual([]);
    expect(readDocuments(undefined)).toEqual([]);
    expect(readDocuments({ coa_received: 'pass' })).toEqual([]);
  });

  it('ignores a non-string path rather than crashing', () => {
    expect(readDocuments({ coa_file_path: 12345 })).toEqual([]);
  });
});

describe('buildDocumentMeta', () => {
  it('writes the COA keys and keeps the old invoice path key unchanged', () => {
    const meta = buildDocumentMeta('INVOICE', {
      path: 'receiving/x.pdf',
      fileName: 'x.pdf',
      sizeBytes: 10,
    });
    // Byte-identical key to the pre-existing invoice upload.
    expect(meta[DOC_KEYS.INVOICE.path]).toBe('receiving/x.pdf');
    expect(meta).toHaveProperty('invoice_file_name', 'x.pdf');
    expect(meta).toHaveProperty('invoice_file_size', 10);
    expect(typeof meta.invoice_uploaded_at).toBe('string');
  });

  it('writes COA keys for a COA upload', () => {
    const meta = buildDocumentMeta('COA', {
      path: 'coa/y.pdf',
      fileName: 'y.pdf',
      sizeBytes: 20,
    });
    expect(meta).toMatchObject({ coa_file_path: 'coa/y.pdf', coa_file_name: 'y.pdf', coa_file_size: 20 });
  });
});

describe('buildDocumentHistoryRows', () => {
  const lookup = {
    stockCode: (id: string | null | undefined) =>
      id === 'sc-cum' ? { stock_code: 'CUM-001', description: 'Cumin Powder' } : undefined,
    supplier: (id: string | null | undefined) =>
      id === 'sup-1' ? { name: 'Spice World' } : undefined,
  };

  it('produces one row per receipt with its documents', () => {
    const rows = buildDocumentHistoryRows(
      [
        {
          internal_lot_number: 'LOT-2026-0142',
          received_at: '2026-03-05T00:00:00.000Z',
          quantity_received: 25,
          stock_code_id: 'sc-cum',
          supplier_id: 'sup-1',
          uom: 'kg',
          status: 'accepted',
          quality_checks: {
            coa_file_path: 'coa/a.pdf',
            coa_file_name: 'coa-a.pdf',
            coa_uploaded_at: '2026-03-05T01:00:00.000Z',
            invoice_file_path: 'receiving/i.pdf',
            invoice_file_name: 'inv-i.pdf',
            invoice_uploaded_at: '2026-03-05T02:00:00.000Z',
          },
        },
      ],
      lookup,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      lot_number: 'LOT-2026-0142',
      received_date: '2026-03-05',
      supplier: 'Spice World',
      stock_code: 'CUM-001',
      material: 'Cumin Powder',
      quantity: 25,
      uom: 'kg',
      status: 'accepted',
      coa_file: 'coa-a.pdf',
      coa_uploaded: '2026-03-05',
      invoice_file: 'inv-i.pdf',
      invoice_uploaded: '2026-03-05',
    });
  });

  it('leaves blank columns for a receipt with no documents', () => {
    const rows = buildDocumentHistoryRows(
      [{ internal_lot_number: 'LOT-1', received_at: '2026-01-01', quality_checks: {} }],
      lookup,
    );
    expect(rows[0].coa_file).toBe('');
    expect(rows[0].invoice_file).toBe('');
  });

  it('orders newest receipt first', () => {
    const rows = buildDocumentHistoryRows(
      [
        { internal_lot_number: 'OLD', received_at: '2026-01-01' },
        { internal_lot_number: 'NEW', received_at: '2026-06-01' },
      ],
      lookup,
    );
    
    expect(rows.map((r) => r.lot_number)).toEqual(['NEW', 'OLD']);
  });

  it('tolerates a missing stock code or supplier', () => {
    const rows = buildDocumentHistoryRows(
      [{ internal_lot_number: 'LOT-1', received_at: '2026-01-01', quantity_received: null }],
      lookup,
    );
    expect(rows[0].supplier).toBe('');
    expect(rows[0].stock_code).toBe('');
    expect(rows[0].quantity).toBe(0);
  });
});