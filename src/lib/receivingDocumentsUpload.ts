// =====================================================================
// Receiving document upload (browser only)
// =====================================================================
//
// The storage/PDF side of receiving documents. Kept apart from the pure
// helpers in `receivingDocuments` so those can be imported by the Windows
// print agent and unit tested without a DOM or a Supabase client.
// =====================================================================

import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { supabase } from '@/integrations/supabase/client';
import {
  RECEIVING_DOCUMENT_BUCKET,
  buildDocumentMeta,
  type ReceivingDocument,
  type ReceivingDocumentKind,
} from '@/lib/receivingDocuments';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const bucket = () => supabase.storage.from(RECEIVING_DOCUMENT_BUCKET);

/**
 * Store a document and return the path plus the metadata to record.
 * The lot number is only used to build a readable folder path.
 *
 * Browser-only: this lives apart from the pure document helpers so those can be
 * imported by the Windows print agent and unit tested without a DOM.
 */
export const uploadReceivingDocument = async (params: {
  file: File;
  kind: ReceivingDocumentKind;
  lotNumber?: string | null;
}): Promise<
  { ok: true; path: string; meta: Record<string, string | number> } | { ok: false; error: string }
> => {
  const { file, kind, lotNumber } = params;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const folder = kind === 'COA' ? 'coa' : 'receiving';
  const lot = (lotNumber || 'unassigned').replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${folder}/${lot}/${Date.now()}-${safeName}`;

  const { error } = await bucket().upload(filePath, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });

  if (error) {
    return { ok: false, error: error.message || 'Upload failed' };
  }

  return {
    ok: true,
    path: filePath,
    meta: buildDocumentMeta(kind, { path: filePath, fileName: file.name, sizeBytes: file.size }),
  };
};

/**
 * Read the text out of a PDF so the COA's contents land in the searchable
 * `coa_content` field instead of the operator re-typing them.
 *
 * Returns null when the PDF has no extractable text (a scan/photo), which is
 * normal and must not be treated as a failure: the file is still attached.
 */
export const extractPdfText = async (file: File): Promise<string | null> => {
  try {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ('str' in item ? (item as { str: string }).str : ''))
          .filter(Boolean)
          .join(' '),
      );
    }

    const text = pages.join('\n').replace(/\s+\n/g, '\n').trim();
    return text.length > 0 ? text : null;
  } catch {
    // Scanned image PDFs have no text layer. The attachment still succeeded.
    return null;
  }
};

/**
 * Open a stored document in a new tab via a short-lived signed URL.
 * The bucket is private, so this is the only way to read a file back.
 */
export const openReceivingDocument = async (doc: ReceivingDocument): Promise<void> => {
  const { data, error } = await bucket().createSignedUrl(doc.path, 120);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Could not open the document');
  }
  window.open(data.signedUrl, '_blank', 'noopener');
};
