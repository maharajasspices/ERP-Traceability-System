// =====================================================================
// Dispatch requirement maths
// =====================================================================
//
// Pure helpers shared by the Dispatch picking list and the TOVI scan
// handler. Kept free of React and of Supabase so the verification rules can
// be unit tested (see dispatchRequirements.test.ts).
//
// The invariant this module exists to protect:
//   a scan may only ever increase quantity_scanned while
//   quantity_scanned < quantity_required.
// =====================================================================

export interface DispatchRequirementLike {
  id: string;
  stock_code_id: string;
  stock_code: string;
  description?: string | null;
  uom?: string | null;
  invoice_number?: string | null;
  quantity_required: number;
  quantity_scanned: number;
}

/** One product's combined position across every invoice on the dispatch. */
export interface AggregatedRequirement {
  stock_code_id: string;
  stock_code: string;
  description: string;
  uom: string;
  /** Summed across every invoice line for this product. */
  quantity_required: number;
  quantity_scanned: number;
  remaining: number;
  /** Every invoice that contributed a line for this product. */
  invoice_numbers: string[];
  /** The underlying lines, so a scan can pick the one to increment. */
  lines: DispatchRequirementLike[];
  is_complete: boolean;
}

const toInt = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

/** How many more units of this line may still be scanned. Never negative. */
export const remainingOnLine = (line: DispatchRequirementLike): number =>
  Math.max(0, toInt(line.quantity_required) - toInt(line.quantity_scanned));

/** True when the line has already been fully fulfilled. */
export const isLineComplete = (line: DispatchRequirementLike): boolean =>
  remainingOnLine(line) <= 0;

/**
 * Combine the per-invoice lines of a dispatch into one entry per product.
 *
 * A product can legitimately appear on two different invoices grouped into the
 * same delivery, so quantities are summed for the picking list while the
 * underlying lines are retained.
 */
export const aggregateRequirements = (
  requirements: readonly DispatchRequirementLike[],
): AggregatedRequirement[] => {
  const byProduct = new Map<string, DispatchRequirementLike[]>();

  for (const req of requirements) {
    const list = byProduct.get(req.stock_code_id);
    if (list) {
      list.push(req);
    } else {
      byProduct.set(req.stock_code_id, [req]);
    }
  }

  return Array.from(byProduct.values()).map((lines) => {
    const quantity_required = lines.reduce((sum, l) => sum + toInt(l.quantity_required), 0);
    const quantity_scanned = lines.reduce((sum, l) => sum + toInt(l.quantity_scanned), 0);

    const invoice_numbers = Array.from(
      new Set(lines.map((l) => l.invoice_number).filter((n): n is string => !!n)),
    );

    const first = lines[0];

    return {
      stock_code_id: first.stock_code_id,
      stock_code: first.stock_code,
      description: first.description || first.stock_code,
      uom: first.uom || '',
      quantity_required,
      quantity_scanned,
      remaining: Math.max(0, quantity_required - quantity_scanned),
      invoice_numbers,
      lines,
      is_complete: quantity_scanned >= quantity_required,
    };
  });
};

/**
 * The line a scan of `stockCodeId` should increment: the first line for that
 * product that still has capacity, or null when the invoice quantity for the
 * product is already fully scanned.
 *
 * Returning null is what makes an over-scan a no-op rather than a silent
 * quantity increase.
 */
export const findScannableLine = (
  requirements: readonly DispatchRequirementLike[],
  stockCodeId: string,
): DispatchRequirementLike | null =>
  requirements.find(
    (r) => r.stock_code_id === stockCodeId && remainingOnLine(r) > 0,
  ) ?? null;

/** True when every line on the dispatch has been fully fulfilled. */
export const isDispatchComplete = (
  requirements: readonly DispatchRequirementLike[],
): boolean =>
  requirements.length > 0 && requirements.every((r) => isLineComplete(r));

/** Headline counters for the dispatch header card. */
export const dispatchProgress = (requirements: readonly DispatchRequirementLike[]) => {
  const quantity_required = requirements.reduce((s, r) => s + toInt(r.quantity_required), 0);
  const quantity_scanned = requirements.reduce((s, r) => s + toInt(r.quantity_scanned), 0);
  const complete = isDispatchComplete(requirements);
  return {
    quantity_required,
    quantity_scanned,
    remaining: Math.max(0, quantity_required - quantity_scanned),
    complete,
    linesComplete: requirements.filter(isLineComplete).length,
    linesTotal: requirements.length,
  };
};
