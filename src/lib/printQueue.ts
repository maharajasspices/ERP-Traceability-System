// =====================================================================
// Print queue
// =====================================================================
//
// A thin, deliberate layer over the EXISTING `fms_print_queue` table. This
// does not introduce a new print system: the queue table, the Batch Sheet
// print layout and the QR generation all already exist and are unchanged.
//
// The vocabulary (document types, statuses, row shape) lives in
// `printQueueContract` so the Windows print agent can import it without
// pulling in the browser Supabase client. This module adds the async
// operations the web app needs on top of that contract.
// =====================================================================

import { supabase } from '@/integrations/supabase/client';
import {
  ACTIVE_PRINT_STATUSES,
  DEFAULT_STICKER_COPIES,
  PRINT_DOCUMENT_TYPE,
  PRINT_STATUS,
  type PrintDocumentType,
  type PrintQueueRow,
  type PrintStatus,
} from '@/lib/printQueueContract';

export {
  ACTIVE_PRINT_STATUSES,
  DEFAULT_STICKER_COPIES,
  PRINT_DOCUMENT_TYPE,
  PRINT_STATUS,
};
export type { PrintDocumentType, PrintQueueRow, PrintStatus };

export type QueueResult =
  | { ok: true; row: PrintQueueRow; /** true when an existing pending job was updated */ updated: boolean }
  | { ok: false; reason: string; /** the migration has not been applied yet */ schemaMissing?: boolean };

// `copies` and `failure_reason` are newer than the generated types, so the
// client is cast once here rather than on every call.
const queue = () => supabase.from('fms_print_queue') as any;

/** True when an error means the print-queue migration has not been applied. */
const isSchemaMissing = (message: unknown): boolean =>
  /PGRST204|42P01|column .* does not exist|schema cache/i.test(String(message ?? ''));

/** Find the pending (QUEUED) job of one document type for a batch. */
const findPending = async (batchId: string, documentType: PrintDocumentType) => {
  const { data, error } = await queue()
    .select('*')
    .eq('batch_id', batchId)
    .eq('document_type', documentType)
    .eq('status', PRINT_STATUS.QUEUED)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return (data?.[0] as PrintQueueRow | undefined) ?? null;
};

const toFailure = (err: unknown, fallback: string): QueueResult => {
  let message = fallback;

  if (err instanceof Error) {
    message = err.message || fallback;
  } else if (typeof err === 'object' && err !== null) {
    const supabaseError = err as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    message =
      supabaseError.message ||
      supabaseError.details ||
      supabaseError.hint ||
      fallback;

    if (supabaseError.code) {
      message = `${message} (${supabaseError.code})`;
    }
  } else if (typeof err === 'string' && err.trim()) {
    message = err;
  }

  return {
    ok: false,
    reason: message,
    schemaMissing: isSchemaMissing(message),
  };
};
/**
 * Queue a Batch Sheet QR label job.
 *
 * The QR payload is generated from the individual batch at print time - it is
 * never shared, cached or deduplicated against another batch.
 */
export const queueBatchSheet = async (batchId: string): Promise<QueueResult> => {
  try {
    const existing = await findPending(batchId, PRINT_DOCUMENT_TYPE.BATCH_SHEET);
    if (existing) return { ok: true, row: existing, updated: false };

    const { data, error } = await queue()
      .insert({
        batch_id: batchId,
        document_type: PRINT_DOCUMENT_TYPE.BATCH_SHEET,
        status: PRINT_STATUS.QUEUED,
      })
      .select()
      .single();

    if (error) {
      // 23505: the partial unique index rejected a second pending job, which
      // means someone else queued it first. Not a failure.
      if (error.code === '23505') {
        const raced = await findPending(batchId, PRINT_DOCUMENT_TYPE.BATCH_SHEET);
        if (raced) return { ok: true, row: raced, updated: false };
      }
      return toFailure(error, 'Could not queue the batch sheet');
    }

    return { ok: true, row: data as PrintQueueRow, updated: false };
  } catch (err: unknown) {
    return toFailure(err, 'Could not queue the batch sheet');
  }
};

/**
 * Queue a Best Before sticker job, snapshotting the copy count.
 *
 * If a pending sticker job already exists for this batch it is UPDATED with
 * the new copy count rather than adding a second one - otherwise the queue
 * could hold two contradictory jobs and midnight would print both. The date
 * itself lives on the batch and is saved by the caller before queueing.
 */
export const queueBestBeforeSticker = async (params: {
  batchId: string;
  copies: number;
}): Promise<QueueResult> => {
  const { batchId, copies } = params;

  try {
    const existing = await findPending(batchId, PRINT_DOCUMENT_TYPE.BEST_BEFORE_STICKER);

    if (existing) {
      const { data, error } = await queue()
        .update({ copies })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) return toFailure(error, 'Could not update the queued stickers');
      return { ok: true, row: data as PrintQueueRow, updated: true };
    }

    const { data, error } = await queue()
      .insert({
        batch_id: batchId,
        document_type: PRINT_DOCUMENT_TYPE.BEST_BEFORE_STICKER,
        status: PRINT_STATUS.QUEUED,
        copies,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const raced = await findPending(batchId, PRINT_DOCUMENT_TYPE.BEST_BEFORE_STICKER);
        if (raced) return { ok: true, row: raced, updated: true };
      }
      return toFailure(error, 'Could not queue the stickers');
    }

    return { ok: true, row: data as PrintQueueRow, updated: false };
  } catch (err: unknown) {
    return toFailure(err, 'Could not queue the stickers');
  }
};

/**
 * Remove a pending job of one document type. Used to undo a mistaken queue.
 * Only ACTIVE rows are touched, so print history is never destroyed.
 */
export const cancelPrintJob = async (
  batchId: string,
  documentType: PrintDocumentType,
): Promise<boolean> => {
  try {
    const { error } = await queue()
      .delete()
      .eq('batch_id', batchId)
      .eq('document_type', documentType)
      .in('status', ACTIVE_PRINT_STATUSES as unknown as string[]);
    return !error;
  } catch {
    return false;
  }
};

/**
 * The pending jobs, for the "queued for printing" badges.
 * A missing table returns an empty list so the page still renders.
 */
export const getPendingPrintJobs = async (): Promise<PrintQueueRow[]> => {
  try {
    const { data, error } = await queue()
      .select('*')
      .in('status', ACTIVE_PRINT_STATUSES as unknown as string[]);
    if (error) throw error;
    return (data as PrintQueueRow[]) ?? [];
  } catch {
    return [];
  }
};