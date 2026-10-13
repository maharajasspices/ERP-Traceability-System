import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Camera,
  CheckCircle2,
  CircleDashed,
  Loader2,
  ScanLine,
  Send,
  Undo2,
} from 'lucide-react';
import { QRScanner } from '@/components/QRScanner';
import { resolveDispatchScan } from '@/lib/scanParser';
import {
  aggregateRequirements,
  dispatchProgress,
  findScannableLine,
  type DispatchRequirementLike,
} from '@/lib/dispatchRequirements';
import type { FMSDispatchRequirement, FMSProductionBatch, FMSStockCode } from '@/hooks/useFMSData';

interface DispatchScanPanelProps {
  requirements: FMSDispatchRequirement[];
  /** Closed production batches, so a Batch Sheet QR can be tied to a batch. */
  productionBatches: FMSProductionBatch[];
  stockCodes: FMSStockCode[];
  /** Scanning never dispatches: the lady confirms explicitly. */
  canConfirm: boolean;
  isConfirming: boolean;

  onScan: (
  requirement: FMSDispatchRequirement,
  batchId?: string,
) => Promise<boolean>;

  onUndo: (requirement: FMSDispatchRequirement) => Promise<boolean>;
  onConfirm: () => void;
}

/** One entry in the live scan feed, so the packer sees what just happened. */
interface ScanEvent {
  id: number;
  ok: boolean;
  message: string;
}

let eventCounter = 0;

/**
 * The packer's verification surface.
 *
 * A scan is only ever accepted when it resolves to a product that is on this
 * dispatch's invoice AND that product still has outstanding quantity. Anything
 * else is reported and changes nothing.
 */
export const DispatchScanPanel = ({
  requirements,
  productionBatches,
  stockCodes,
  canConfirm,
  isConfirming,
  onScan,
  onUndo,
  onConfirm,
}: DispatchScanPanelProps) => {
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // A wedge scanner types faster than a human and then sends Enter. Buffering
  // the keystrokes lets the packer scan without first focusing the input, and
  // stops a fast typist from accidentally counting as a scan.
  const wedgeRef = useRef({ buffer: '', fastKeys: 0, lastTs: 0 });

  const progress = useMemo(() => dispatchProgress(requirements), [requirements]);
  const aggregated = useMemo(() => aggregateRequirements(requirements), [requirements]);

  /** Batches the packer may legitimately pick from: closed ones only. */
  const closedBatchNumbers = useMemo(
    () => productionBatches.filter((b) => b.status === 'closed').map((b) => b.batch_number),
    [productionBatches],
  );
  const allStockCodes = useMemo(() => stockCodes.map((s) => s.stock_code), [stockCodes]);
  const productByStockCode = useMemo(
    () => new Map(stockCodes.map((s) => [s.stock_code, s])),
    [stockCodes],
  );
  const batchByNumber = useMemo(
    () => new Map(productionBatches.map((b) => [b.batch_number, b])),
    [productionBatches],
  );

  const pushEvent = (ok: boolean, message: string) => {
    setEvents((prev) => [{ id: ++eventCounter, ok, message }, ...prev].slice(0, 6));
  };

  /** Accept a scan only if it maps to an outstanding invoice line. */
  const handleScan = async (raw: string) => {
    setBusy(true);
    try {
      const resolved = resolveDispatchScan(raw, {
        batchNumbers: closedBatchNumbers,
        stockCodes: allStockCodes,
      });

      const reject = (message: string) => {
        pushEvent(false, message);
        toast.error(message);
      };

      if (resolved.kind === 'unknown') {
        reject('Code not recognised — nothing was added');
        return;
      }

      let stockCodeId: string | null = null;
      let label = '';

      let batchId: string | undefined;

      if (resolved.kind === 'batch' && resolved.batchNumber) {
        const batch = batchByNumber.get(resolved.batchNumber);
          if (!batch) {
            reject(`Batch ${resolved.batchNumber} is not available for dispatch`);
            return;
          }

          batchId = batch.id;

        if (batch.status !== 'closed') {
          reject(`Batch ${resolved.batchNumber} is not closed yet`);
          return;
        }
        stockCodeId = batch.finished_good_id;
        label = `${batch.batch_number}`;
      }

      if (resolved.kind === 'product' && resolved.stockCode) {
        const sc = productByStockCode.get(resolved.stockCode);
        if (!sc) {
          reject('Code not recognised — nothing was added');
          return;
        }
        stockCodeId = sc.id;
        label = sc.stock_code;
      }

      if (!stockCodeId) {
        reject('Code not recognised — nothing was added');
        return;
      }

      // The verification gate: the product must be on the invoice, and it must
      // still owe quantity. findScannableLine returns null once the invoiced
      // quantity is met, which makes the extra scan a no-op.
      const target = findScannableLine(requirements, stockCodeId) as
        | FMSDispatchRequirement
        | null;

      if (!target) {
        const onInvoice = requirements.some((r) => r.stock_code_id === stockCodeId);
        reject(
          onInvoice
            ? `${label} is already fully scanned — not added`
            : `${label} is not on this invoice — not added`,
        );
        return;
      }

      const ok = await onScan(target, batchId);
      if (ok) {
        const message = `${target.stock_code} verified (${target.quantity_scanned + 1}/${target.quantity_required})`;
        pushEvent(true, message);
        toast.success(message);
      } else {
        reject('Scan could not be saved — not added');
      }
    } finally {
      setBusy(false);
    }
  };

  // Keep the latest handler in a ref so the global wedge listener (registered
  // once) always calls the current closure without re-subscribing.
  const handleScanRef = useRef<(raw: string) => Promise<void>>(async () => {});
  handleScanRef.current = handleScan;

  const pct =
    progress.quantity_required > 0
      ? Math.round((progress.quantity_scanned / progress.quantity_required) * 100)
      : 0;

  // Global keyboard-wedge capture. Only a burst of fast keystrokes terminated
  // by Enter/Tab is treated as a scan, so ordinary typing in another control on
  // the page is never counted as a packed item.
  const complete = progress.complete;
  useEffect(() => {
    if (complete) return;

    const flush = () => {
      const state = wedgeRef.current;
      const value = state.buffer.trim();
      const looksLikeScan = state.fastKeys >= 3 && value.length >= 3;
      state.buffer = '';
      state.fastKeys = 0;
      state.lastTs = 0;
      if (looksLikeScan) {
        void handleScanRef.current(value);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      // Ignore keystrokes aimed at a real text field; those are handled locally.
      const target = event.target as HTMLElement | null;
      const typingInField =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typingInField) return;

      if (event.key === 'Enter' || event.key === 'Tab') {
        if (wedgeRef.current.buffer) {
          event.preventDefault();
          flush();
        }
        return;
      }

      if (event.key.length !== 1) return;

      const state = wedgeRef.current;
      const now = Date.now();
      const delta = now - state.lastTs;
      state.fastKeys = delta > 0 && delta < 50 ? state.fastKeys + 1 : 1;
      state.lastTs = now;
      state.buffer += event.key;
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [complete]);

  return (
    <div className="space-y-4">
      {/* Required / Scanned / Remaining */}
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Packing progress</span>
          <span className="text-muted-foreground">
            {progress.linesComplete}/{progress.linesTotal} lines complete
          </span>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
          <div
            className={`h-full transition-all ${progress.complete ? 'bg-green-500' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded border border-border bg-card py-2">
            <div className="text-xs text-muted-foreground">Required</div>
            <div className="text-lg font-semibold">{progress.quantity_required}</div>
          </div>
          <div className="rounded border border-border bg-card py-2">
            <div className="text-xs text-muted-foreground">Scanned</div>
            <div className="text-lg font-semibold text-green-600">{progress.quantity_scanned}</div>
          </div>
          <div className="rounded border border-border bg-card py-2">
            <div className="text-xs text-muted-foreground">Remaining</div>
            <div className="text-lg font-semibold text-amber-600">{progress.remaining}</div>
          </div>
        </div>

        {progress.complete && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Everything on the invoice has been scanned. This dispatch is ready to confirm.
          </p>
        )}
      </div>

      {/* Scan controls */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <QRScanner
            onScanResult={handleScan}
            triggerButton={
              <Button type="button" variant="outline" size="sm" disabled={busy} className="flex-1">
                <Camera className="mr-1 h-4 w-4" />
                Scan with camera
              </Button>
            }
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={busy || progress.complete}
            onClick={() => setManualCode('')}
          >
            <ScanLine className="mr-1 h-4 w-4" />
            {busy ? 'Checking…' : 'Ready for TOVI'}
          </Button>
        </div>

        <div className="flex gap-2">
          <Input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && manualCode.trim()) {
                handleScan(manualCode.trim());
                setManualCode('');
              }
            }}
            placeholder="Type a batch number or product code, then press Enter"
            className="font-mono"
            disabled={progress.complete}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          The TOVI keyboard-wedge scanner types straight into this box. A Batch Sheet QR
          identifies the exact production batch; a product barcode is matched exactly.
        </p>
      </div>

      {/* Picking list: Required / Scanned / Remaining per product */}
      {aggregated.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Picking list</p>
          {aggregated.map((row) => (
            <div
              key={row.stock_code_id}
              className={`flex items-center gap-2 rounded border px-2 py-2 ${
                row.is_complete ? 'border-green-500/40 bg-green-500/5' : 'border-border bg-card'
              }`}
            >
              {row.is_complete ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <Badge variant="outline" className="shrink-0 font-mono">{row.stock_code}</Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{row.description}</p>
                {row.invoice_numbers.length > 1 && (
                  <p className="truncate text-xs text-muted-foreground">
                    {row.invoice_numbers.join(', ')}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                <span className="text-muted-foreground">Req <b className="text-foreground">{row.quantity_required}</b></span>
                <span className="text-muted-foreground">Scan <b className="text-green-600">{row.quantity_scanned}</b></span>
                <span className="text-muted-foreground">Left <b className={row.remaining > 0 ? 'text-amber-600' : 'text-muted-foreground'}>{row.remaining}</b></span>
              </div>
              {row.lines.some((l) => l.quantity_scanned > 0)&& (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Undo one scan"
                  onClick={() => {
                    const scannedLine =[...row.lines]
                        .filter((l) => l.quantity_scanned > 0)
                        .sort(
                          (a, b) =>
                            new Date(b.scanned_at ?? 0).getTime() -
                            new Date(a.scanned_at ?? 0).getTime(),
                        )[0]
                    if (scannedLine) {
                      void onUndo(scannedLine);
                    }
                  }}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Live scan feed - shows rejections, not just successes */}
      {events.length > 0 && (
        <div className="space-y-1 rounded border border-border bg-muted/20 p-2">
          {events.map((e) => (
            <p
              key={e.id}
              className={`flex items-center gap-1.5 text-xs ${e.ok ? 'text-green-600' : 'text-red-600'}`}
            >
              {e.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
              {e.message}
            </p>
          ))}
        </div>
      )}

      {/* Scanning does NOT dispatch. The lady confirms explicitly. */}
      <div className="border-t border-border pt-3">
        <Button
          onClick={onConfirm}
          disabled={!canConfirm || isConfirming}
          className="w-full"
        >
          {isConfirming ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {progress.complete ? 'Confirm dispatch' : `Confirm dispatch (${progress.remaining} still to scan)`}
        </Button>
        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          {progress.complete
            ? 'Confirming marks this delivery as dispatched.'
            : 'Scanning alone never dispatches. Everything on the invoice must be scanned first.'}
        </p>
        <p className='mt-1.5 text-center text-xs text-muted-foreground'>
          {progress.complete
          ? 'Confirming marks this delivery as dispatched.'
        : 'Scanning alone never dispaches. Everyhting on the invoice must be scanned first.'}
        </p>
      </div>
    </div>
  );
};

export default DispatchScanPanel;
