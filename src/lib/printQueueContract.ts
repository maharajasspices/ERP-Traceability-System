// =====================================================================
// Print queue contract
// =====================================================================
//
// The vocabulary of the print queue: document types, statuses and the rules
// about what identifies a job.
//
// This module is deliberately free of any Supabase / browser / DOM import.
// It is the shared contract that BOTH the web app and the Windows print agent
// (a plain Node script that runs at midnight) import, so the two can never
// disagree about what a job is or what a status means.
//
// The rules encoded here:
//
//   * The IDENTITY of a job is (batch, document_type). NEVER the date.
//   * A batch may have one pending BATCH_SHEET job AND one pending
//     BEST_BEFORE_STICKER job. Both are allowed and they are separate
//     documents that are never merged.
//   * Two pending jobs of the SAME document type for the SAME batch are not
//     allowed. PRINTED / FAILED rows are history and never block anything.
//   * Many batches may carry the exact same best_before_date. That never
//     groups, merges or deduplicates anything.
// =====================================================================

export const PRINT_DOCUMENT_TYPE = {
  /** The A4 sheet carrying the two identical Batch Sheet QR labels. */
  BATCH_SHEET: 'BATCH_SHEET',
  /** The 30 x 30 mm Best Before stickers. */
  BEST_BEFORE_STICKER: 'BEST_BEFORE_STICKER',
} as const;

export type PrintDocumentType = (typeof PRINT_DOCUMENT_TYPE)[keyof typeof PRINT_DOCUMENT_TYPE];

export const PRINT_STATUS = {
  /** Waiting for the midnight run. */
  QUEUED: 'QUEUED',
  /** Claimed by the agent; it is printing this job right now. */
  PRINTING: 'PRINTING',
  /** Finished successfully. */
  PRINTED: 'PRINTED',
  /**
   * Will not be printed, with a recorded reason. A job with no
   * best_before_date lands here rather than printing a blank or guessed date.
   */
  FAILED: 'FAILED',
} as const;

export type PrintStatus = (typeof PRINT_STATUS)[keyof typeof PRINT_STATUS];

/** A job is "active" while it still needs the agent's attention. */
export const ACTIVE_PRINT_STATUSES: readonly PrintStatus[] = [
  PRINT_STATUS.QUEUED,
  PRINT_STATUS.PRINTING,
];

/** Default stickers per batch until someone changes it. */
export const DEFAULT_STICKER_COPIES = 4;

export interface PrintQueueRow {
  id: string;
  batch_id: string | null;
  document_type: PrintDocumentType;
  status: PrintStatus;
  copies: number | null;
  printed_at: string | null;
  failure_reason: string | null;
  created_at: string;
}