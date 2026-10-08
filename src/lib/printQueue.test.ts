import { describe, expect, it } from 'vitest';

import {
  ACTIVE_PRINT_STATUSES,
  DEFAULT_STICKER_COPIES,
  PRINT_DOCUMENT_TYPE,
  PRINT_STATUS,
} from '@/lib/printQueueContract';

describe('print queue identity rules', () => {
  it('treats a batch sheet and a sticker as two separate document types', () => {
    // This is the core rule: they are separate jobs and both are allowed on the
    // same batch, never merged.
    expect(PRINT_DOCUMENT_TYPE.BATCH_SHEET).not.toBe(PRINT_DOCUMENT_TYPE.BEST_BEFORE_STICKER);
  });

  it('never uses the best before date as an identifier', () => {
    // The identity is (batch, document_type). There is deliberately no field,
    // helper or key anywhere in this module derived from a date, so two batches
    // sharing a date cannot collide or be grouped.
    const keys = Object.keys(PRINT_DOCUMENT_TYPE);
    expect(keys).toEqual(['BATCH_SHEET', 'BEST_BEFORE_STICKER']);
    expect(keys.some((k) => /date/i.test(k))).toBe(false);
  });

  it('only treats QUEUED and PRINTING as active', () => {
    expect(ACTIVE_PRINT_STATUSES).toEqual(['QUEUED', 'PRINTING']);
    // PRINTED and FAILED are history and must never block a new job.
    expect(ACTIVE_PRINT_STATUSES).not.toContain(PRINT_STATUS.PRINTED);
    expect(ACTIVE_PRINT_STATUSES).not.toContain(PRINT_STATUS.FAILED);
  });

  it('has a FAILED status so an unprintable job is never retried blindly', () => {
    expect(PRINT_STATUS.FAILED).toBe('FAILED');
  });

  it('defaults new batches to 4 stickers', () => {
    expect(DEFAULT_STICKER_COPIES).toBe(4);
  });
});