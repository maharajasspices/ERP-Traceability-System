import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Info, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { FMSProductionBatch } from '@/hooks/useFMSData';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

interface PlannedProductionQueueProps {
  productionBatches: FMSProductionBatch[];
  /** Look up the finished good's display fields. */
  getStockCodeById: (id: string) => any;
  onQueued?: () => void | Promise<void>;
}

/** Normalise a DATE string or ISO timestamp to a 'YYYY-MM-DD' key. */
const toDateKey = (value?: string | null): string | null => {
  if (!value) return null;
  const key = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
};

/** Local 'YYYY-MM-DD' key, so UTC timezone shifts cannot move the day. */
const localDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * The next working day, as a 'YYYY-MM-DD' key.
 *
 * A batch planned for a weekend rolls forward to Monday, since the plant is not
 * producing on Saturday or Sunday. A weekday plan is used as-is.
 */
export const getNextWorkingDayKey = (from: Date = new Date()): string => {
  const next = new Date(from);
  next.setDate(next.getDate() + 1);
  if (next.getDay() === 0) next.setDate(next.getDate() + 1); // Sunday -> Monday
  if (next.getDay() === 6) next.setDate(next.getDate() + 2); // Saturday -> Monday
  return localDateKey(next);
};

interface QueuedBatch {
  batch_id: string | null;
  status: string;
}

/**
 * Planned Production Queue for the next working day.
 *
 * A supervisor reviews the batches already drafted for the next working day and
 * selects the ones whose Batch Sheets should be printed for the operators.
 *
 * This is a PLANNING action only:
 *  - it does NOT start production
 *  - it does NOT change the batch's `status`
 *  - it does NOT touch pre-weigh approval, material verification or closing
 *
 * Production still begins the next morning when the operator clicks the existing
 * "Start" action on the Batch Sheets tab.
 */
export const PlannedProductionQueue: React.FC<PlannedProductionQueueProps> = ({
  productionBatches,
  getStockCodeById,
  onQueued,
}) => {
  const [queuedBatches, setQueuedBatches] = useState<QueuedBatch[]>([]);
  const [queuingId, setQueuingId] = useState<string | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(true);

  const workingDayKey = useMemo(() => getNextWorkingDayKey(), []);

  // Batches drafted for the next working day. Cancelled batches are excluded:
  // they will not be produced, so their sheets should not be printed.
  const plannedBatches = useMemo(
    () =>
      productionBatches.filter((batch) => {
        if (batch.status === 'cancelled') return false;
        return toDateKey(batch.planned_production_date) === workingDayKey;
      }),
    [productionBatches, workingDayKey],
  );

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const { data, error } = await supabase
        .from('fms_print_queue')
        .select('batch_id, status')
        .in('status', ['QUEUED', 'PRINTING']);

      if (error) throw error;
      setQueuedBatches((data as QueuedBatch[] | null) ?? []);
    } catch (err) {
      console.error('Failed to load print queue:', err);
      // The list still renders; every row simply shows as not queued.
      setQueuedBatches([]);
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const isQueued = useCallback(
    (batchId: string) =>
      queuedBatches.some(
        (q) => q.batch_id === batchId && q.status !== 'PRINTED',
      ),
    [queuedBatches],
  );

  /**
   * Add the batch's Batch Sheet to the print queue as a single QUEUED job.
   *
   * Duplicate guard: a batch already QUEUED is left alone, and a unique
   * violation (PostgREST 23505, if a unique index is present) is treated as
   * "already queued" rather than a failure, so a double click cannot enqueue the
   * same batch twice.
   */
  const handleQueue = async (batch: FMSProductionBatch) => {
    setQueuingId(batch.id);
    try {
      const { data: existing, error: lookupError } = await supabase
        .from('fms_print_queue')
        .select('id')
        .eq('batch_id', batch.id)
        .eq('status', 'QUEUED')
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (existing) {
        toast.info(`${batch.batch_number} is already queued for printing.`);
        await loadQueue();
        return;
      }

      const { error: insertError } = await supabase
        .from('fms_print_queue')
        .insert({
          batch_id: batch.id,
          document_type: 'BATCH_SHEET',
          status: 'QUEUED',
        });

      if (insertError && insertError.code !== '23505') {
        throw insertError;
      }

      if (insertError) {
        // 23505: another click won the race, so it is already queued.
        toast.info(`${batch.batch_number} is already queued for printing.`);
      } else {
        toast.success('Batch sheet queued for printing', {
          description: `${batch.batch_number} - production has NOT started.`,
        });
      }

      await loadQueue();
      await onQueued?.();
    } catch (err) {
      console.error('Failed to queue batch sheet:', err);
      toast.error(`Could not queue ${batch.batch_number} for printing`);
    } finally {
      setQueuingId(null);
    }
  };

  const workingDayDate = parseISO(workingDayKey);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5 text-primary" />
                Planned Production Queue
              </CardTitle>
              <CardDescription className="mt-1">
                Batch sheets planned for the next working day,{' '}
                <span className="font-medium text-foreground">
                  {format(workingDayDate, 'd MMM yyyy')} (
                  {WEEKDAYS[workingDayDate.getDay()]})
                </span>
              </CardDescription>
            </div>
            <Badge variant="outline" className="w-fit border-primary/40 text-primary">
              {plannedBatches.length} planned
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Selecting a batch queues its Batch Sheet for printing. Production does
            not start here - the operator starts it the next morning using the
            existing Start action on the Batch Sheets tab.
          </p>
        </CardContent>
      </Card>

      {loadingQueue ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading print queue...</p>
          </CardContent>
        </Card>
      ) : plannedBatches.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Info className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No batches are planned for {format(workingDayDate, 'd MMM yyyy')}.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a Batch Sheet with that planned production date to add it here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {plannedBatches.map((batch) => {
                const finishedGood = getStockCodeById(batch.finished_good_id);
                const alreadyQueued = isQueued(batch.id);
                const busy = queuingId === batch.id;

                return (
                  <li
                    key={batch.id}
                    className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 lg:flex-row lg:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {batch.batch_number}
                        </span>
                        <Badge variant="outline" className="capitalize">
                          {batch.status.replace('_', ' ')}
                        </Badge>
                        {alreadyQueued && (
                          <Badge variant="outline" className="border-green-600 text-green-700">
                            <Check className="mr-1 h-3 w-3" />
                            Queued for printing
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {finishedGood?.description || 'Unknown product'}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Planned size: {batch.planned_batch_size} kg
                        {finishedGood?.stock_code ? ` Â· ${finishedGood.stock_code}` : ''}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="gap-2"
                        disabled={alreadyQueued || busy}
                        onClick={() => handleQueue(batch)}
                      >
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="h-4 w-4" />
                        )}
                        {alreadyQueued ? 'Queued' : 'Queue for Printing'}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

