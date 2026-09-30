import React, { useMemo, useState } from 'react';
import { CalendarDays, Check, X, Sparkles, Info, History } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FMSProductionBatch, FMSStockCode } from '@/hooks/useFMSData';

/** How far back we look for any production history. */
const RECENT_WINDOW_DAYS = 120;

/**
 * A product must have been produced on more than this many of tomorrow's
 * weekday within the recent window to be treated as a regular weekday run.
 * Two or fewer is treated as incidental, not a pattern.
 */
const MIN_WEEKDAY_OCCURRENCES = 2;

/** How many past occurrences of tomorrow's weekday we use to average. */
const MAX_WEEKDAY_OCCURRENCES = 5;

/** When there is no same-weekday history, average the last N production days. */
const FALLBACK_PRODUCTION_DAYS = 3;

interface Suggestion {
  key: string;
  stockCode: string;
  description: string;
  unitOfMeasure: string;
  suggestedQuantity: number;
  /** Whether the number came from same-weekday history or general recent history. */
  basis: 'weekday' | 'recent';
  daysSinceLastProduction: number;
  productionDays: number;
  evidence: string[];
}

interface SuggestedBatchSheetsProps {
  stockCodes: FMSStockCode[];
  productionBatches: FMSProductionBatch[];
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Normalise a date-ish value (DATE string or ISO timestamp) to 'YYYY-MM-DD'. */
const toDateKey = (value?: string | null): string | null => {
  if (!value) return null;
  const key = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
};

/** Local 'YYYY-MM-DD' key for a Date (avoids UTC shifting the day). */
const localDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);
const roundTo = (value: number) => Math.max(1, Math.round(value));
const prettyDate = (dateKey: string) => format(parseISO(dateKey), 'd MMM yyyy');

/**
 * Build tomorrow's suggestions from existing production history.
 *
 * Deliberately lenient so the list stays useful:
 *  - any active finished good, WIP or raw material with production history in the
 *    recent window qualifies
 *  - cancelled batches are never treated as production history
 *  - a product produced on MORE THAN MIN_WEEKDAY_OCCURRENCES of the recent
 *    occurrences of tomorrow's weekday is treated as a regular run and averaged
 *    from that weekday; general recent history is the fallback
 *  - planned_batch_size is the historical quantity
 *  - a product already planned for tomorrow is skipped
 */
const buildSuggestions = (
  stockCodes: FMSStockCode[],
  productionBatches: FMSProductionBatch[],
  tomorrow: Date
): Suggestion[] => {
  const tomorrowKey = localDateKey(tomorrow);
  const weekdayName = WEEKDAYS[tomorrow.getDay()];

  // Mirror the products the "Create Batch" dialog allows: finished goods, WIP
  // and raw materials. Restricting this to finished goods alone hid every WIP
  // and raw-material run from the suggestions, even though batch sheets are
  // created for them all day.
  const activeFinishedGoods = stockCodes.filter(
    (sc) =>
      (sc.item_type === 'finished_good' ||
        sc.item_type === 'work_in_progress' ||
        sc.item_type === 'raw_material') &&
      sc.status === 'active'
  );
  
  const historyStart = new Date(tomorrow);
  historyStart.setDate(historyStart.getDate() - RECENT_WINDOW_DAYS);
  const historyStartKey = localDateKey(historyStart);

  // Every past occurrence of tomorrow's weekday inside the recent window,
  // closest first. Used to detect a regular weekday run, not just the most
  // recent few.
  const occurrenceDates: string[] = [];
  {
    const d = new Date(historyStart);
    d.setDate(d.getDate() + 1);
    while (localDateKey(d) < tomorrowKey) {
      if (d.getDay() === tomorrow.getDay()) {
        occurrenceDates.push(localDateKey(d));
      }
      d.setDate(d.getDate() + 1);
    }
    occurrenceDates.reverse();
  }

  // The most recent N of those, used for the quantity average.
  const recentOccurrenceDates = occurrenceDates.slice(0, MAX_WEEKDAY_OCCURRENCES);

  // Products that already have a batch planned for tomorrow.
  const alreadyPlanned = new Set(
    productionBatches
      .filter(
        (b) => b.status !== 'cancelled' && toDateKey(b.planned_production_date) === tomorrowKey
      )
      .map((b) => b.finished_good_id)
  );

  // Real, non-cancelled production inside the recent window.
  const usable = productionBatches.flatMap((batch) => {
    const dateKey = toDateKey(batch.planned_production_date);
    if (batch.status === 'cancelled' || !dateKey) return [];
    if (dateKey < historyStartKey || dateKey > tomorrowKey) return [];
    return [{ batch, dateKey }];
  });

  const suggestions: Suggestion[] = [];

  for (const fg of activeFinishedGoods) {
    if (alreadyPlanned.has(fg.id)) continue;

    // Total planned quantity produced per calendar day.
    const byDate = new Map<string, number>();
    for (const { batch, dateKey } of usable) {
      if (batch.finished_good_id !== fg.id) continue;
      const qty = Number(batch.planned_batch_size) || 0;
      byDate.set(dateKey, (byDate.get(dateKey) || 0) + qty);
    }
    if (byDate.size === 0) continue;

    const productionDates = [...byDate.keys()].sort();
    const lastDate = productionDates[productionDates.length - 1];

    // A regular weekday run means this product was produced on MORE THAN
    // MIN_WEEKDAY_OCCURRENCES of the recent occurrences of this weekday. That
    // is the signal the supervisor actually uses: a product made on 3+ of the
    // last Wednesdays is a routine run and belongs in tomorrow's list.
    const weekdayDates = occurrenceDates.filter((d) => byDate.has(d));
    const weekdayTotals = weekdayDates.map((d) => byDate.get(d) as number);

    let basis: Suggestion['basis'] = 'recent';
    let sourceDays: string[] = [];

    if (weekdayTotals.length > MIN_WEEKDAY_OCCURRENCES) {
      basis = 'weekday';
      // Average the most recent N weekday runs, not every one in the window.
      const recentDates = recentOccurrenceDates.filter((d) => byDate.has(d));
      sourceDays = recentDates.length > 0 ? recentDates : weekdayDates;
    } else {
      sourceDays = productionDates.slice(-FALLBACK_PRODUCTION_DAYS);
    }

    const sourceTotals = sourceDays.map((d) => byDate.get(d) as number);
    const suggestedQuantity = roundTo(sum(sourceTotals) / sourceTotals.length);

    const daysSinceLastProduction = differenceInCalendarDays(tomorrow, parseISO(lastDate));

    const evidence: string[] = [];
    if (basis === 'weekday') {
      evidence.push(
        `Produced on ${weekdayTotals.length} of the last ${occurrenceDates.length} ${weekdayName}s`
      );
      evidence.push(`Average ${weekdayName} production: ${suggestedQuantity} batches`);
    } else {
      evidence.push(
        weekdayTotals.length > 0
          ? `Only ${weekdayTotals.length} recent ${weekdayName} run${weekdayTotals.length === 1 ? '' : 's'} (needs more than ${MIN_WEEKDAY_OCCURRENCES})`
          : `No recent ${weekdayName} production`
      );
      evidence.push(
        `Based on last ${sourceDays.length} production days: ${suggestedQuantity} batches`
      );
    }
    evidence.push(
      `Last produced ${prettyDate(lastDate)}: ${roundTo(byDate.get(lastDate) as number)} batches`
    );
    evidence.push(
      `${byDate.size} production day${byDate.size === 1 ? '' : 's'} in the last ${RECENT_WINDOW_DAYS} days`
    );

    suggestions.push({
      key: fg.id,
      stockCode: fg.stock_code,
      description: fg.description,
      unitOfMeasure: fg.unit_of_measure,
      suggestedQuantity,
      basis,
      daysSinceLastProduction,
      productionDays: byDate.size,
      evidence,
    });
  }

  // Most recently produced first, then biggest quantity first.
  return suggestions.sort(
    (a, b) =>
      a.daysSinceLastProduction - b.daysSinceLastProduction ||
      b.suggestedQuantity - a.suggestedQuantity
  );
};

/** Exported for tests: the suggestion-building logic without the UI. */
export const buildSuggestionsForTest = buildSuggestions;

export const SuggestedBatchSheets: React.FC<SuggestedBatchSheetsProps> = ({
  stockCodes,
  productionBatches,
}) => {
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }, []);

  const suggestions = useMemo(
    () => buildSuggestions(stockCodes, productionBatches, tomorrow),
    [stockCodes, productionBatches, tomorrow]
  );

  const [declined, setDeclined] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');

  const visibleSuggestions = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return suggestions
      .filter((s) => !declined.includes(s.key))
      .filter(
        (s) =>
          !query ||
          s.stockCode.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query)
      );
  }, [suggestions, declined, filter]);

  const weekdayCount = suggestions.filter((s) => s.basis === 'weekday').length;

  const handleApprove = (suggestion: Suggestion) => {
    // Phase 1: UI-only. No batch is created and nothing is persisted.
    toast.success(`${suggestion.stockCode} approved for ${prettyDate(localDateKey(tomorrow))}`, {
      description: 'Suggestion approved only. No production batch was created.',
    });
  };

  const handleDecline = (suggestion: Suggestion) => {
    setDeclined((prev) => [...prev, suggestion.key]);
    toast.info(`${suggestion.stockCode} declined`, {
      description: 'The suggestion was removed from this list. Nothing was saved.',
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5 text-primary" />
                Suggested Batch Sheets
              </CardTitle>
              <CardDescription className="mt-1">
                Based on batch sheet history for{' '}
                <span className="font-medium text-foreground">
                  {prettyDate(localDateKey(tomorrow))} ({WEEKDAYS[tomorrow.getDay()]})
                </span>
              </CardDescription>
            </div>
            <Badge variant="outline" className="w-fit border-primary/40 text-primary">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              {visibleSuggestions.length} suggestion
              {visibleSuggestions.length === 1 ? '' : 's'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {weekdayCount} of {suggestions.length} follow a regular{' '}
            {WEEKDAYS[tomorrow.getDay()]} run (produced on more than{' '}
            {MIN_WEEKDAY_OCCURRENCES} of the recent {WEEKDAYS[tomorrow.getDay()]}{' '}
            dates); the rest fall back to their most recent production days.
            Approving does not create a batch.
          </p>
          {suggestions.length > 0 && (
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by stock code or description..."
              className="max-w-sm"
            />
          )}
        </CardContent>
      </Card>
    {visibleSuggestions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Info className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {suggestions.length === 0
                ? 'No suggestions. This is normal when there is no recent production history.'
                : 'No suggestions match your filter.'}
            </p>
          </CardContent>
        </Card>
      ) : 
        <Card>
          <CardContent className="p-0">
          
            <ul className="divide-y divide-border">
              {visibleSuggestions.map((suggestion) => (
                <li
                  key={suggestion.key}
                  className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 lg:flex-row lg:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {suggestion.stockCode}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          suggestion.basis === 'weekday'
                            ? 'border-primary/40 text-primary'
                            : 'text-muted-foreground'
                        }
                      >
                        <History className="mr-1 h-3 w-3" />
                        {suggestion.basis === 'weekday'
                          ? `${WEEKDAYS[tomorrow.getDay()]} pattern`
                          : 'Recent pattern'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {suggestion.description}
                    </p>
                    <ul className="mt-1.5 space-y-0.5">
                      {suggestion.evidence.map((line) => (
                        <li key={line} className="text-xs text-muted-foreground/80">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="w-full shrink-0 lg:w-40">
                    <Label
                      htmlFor={`qty-${suggestion.key}`}
                      className="text-xs text-muted-foreground"
                    >
                      Qty ({suggestion.unitOfMeasure})
                    </Label>
                    <Input
                      id={`qty-${suggestion.key}`}
                      type="number"
                      min={0}
                      step="any"
                      value={quantities[suggestion.key] ?? `${suggestion.suggestedQuantity}`}
                      onChange={(e) =>
                        setQuantities((prev) => ({ ...prev, [suggestion.key]: e.target.value }))
                      }
                    />
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleApprove(suggestion)}
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleDecline(suggestion)}
                    >
                      <X className="h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      }
    </div>
  );
};

export default SuggestedBatchSheets;


