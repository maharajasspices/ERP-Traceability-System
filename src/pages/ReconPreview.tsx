// =====================================================================
// ONE-TIME reconciliation preview: missing backfill reservations
// (30 September 2026 physical count). READ-ONLY: SELECTs + the read-only
// fms_fifo_allocate_lots RPC only. No inserts/updates/deletes, no apply
// button. Temporary: delete this file and its route after the backfill.
// NOT linked in sidebar navigation. Batch Sheet workflow untouched.
// =====================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useFMSData } from '@/hooks/useFMSData';
import { supabase } from '@/integrations/supabase/client';
import { computeMissingReservations, RECON_CUTOFF_ISO } from '@/lib/missingReservations';
import { computeStockReconReport } from '@/lib/stockReconReport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface FifoAllocation {
  receiving_record_id: string;
  internal_lot_number: string;
  quantity_available: number;
  quantity_to_use: number;
}

interface PreviewRow {
  batch_id: string;
  batch_number: string;
  created_at: string;
  stock_code_id: string;
  stock_code: string;
  description: string;
  uom: string;
  required: number;
  onHand: number;
  reserved: number;
  net: number;
  fifoCovered: number | null;
  reservable: number;
  shortage: number;
}

const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '—');

interface SummaryRow {
  stock_code_id: string;
  stock_code: string;
  description: string;
  uom: string;
  batches: number;
  required: number;
  onHand: number;
  reserved: number;
  net: number;
  reservable: number;
  shortage: number;
}

const ReconPreview: React.FC = () => {
  const { productionBatches, stockReservations, stockLevels, stockCodes, receivingRecords, loading } = useFMSData();

  const [fifoByStock, setFifoByStock] = useState<Record<string, FifoAllocation[] | null>>({});
  const [checkingFifo, setCheckingFifo] = useState(false);
  const [fifoError, setFifoError] = useState<string | null>(null);
  const [materialsUsed, setMaterialsUsed] = useState<{ batch_id: string; receiving_record_id: string | null; quantity_used: number }[]>([]);
  const [usageMovements, setUsageMovements] = useState<{ batch_id: string | null; stock_code_id: string; movement_type: string; quantity_change: number }[]>([]);

  // READ-ONLY: fms_materials_used is the authoritative post-consumption
  // record (Traceability loads it the same way). The batch_usage stock
  // movements are the physical deduction that often exists when lot
  // records do not - both are plain SELECTs, paginated because one page
  // would silently cap at 1000 rows.
  useEffect(() => {
    let cancelled = false;
    const PAGE = 1000;
    const fetchAll = async (table: string, columns: string, match?: { column: string; value: string }) => {
      const all: any[] = [];
      let from = 0;
      for (;;) {
        let q = (supabase.from(table as any) as any).select(columns);
        if (match) q = q.eq(match.column, match.value);
        const { data, error } = await q.range(from, from + PAGE - 1);
        if (error) throw error;
        const page = (data as any[]) || [];
        all.push(...page);
        if (page.length < PAGE) break;
        from += PAGE;
      }
      return all;
    };
    (async () => {
      try {
        const [used, moves] = await Promise.all([
          fetchAll('fms_materials_used', 'batch_id, receiving_record_id, quantity_used'),
          fetchAll('fms_stock_movements', 'batch_id, stock_code_id, movement_type, quantity_change', {
            column: 'movement_type', value: 'batch_usage',
          }),
        ]);
        if (cancelled) return;
        setMaterialsUsed(used);
        setUsageMovements(moves);
      } catch {
        if (!cancelled) {
          setMaterialsUsed([]);
          setUsageMovements([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const missing = useMemo(
    () => computeMissingReservations(productionBatches as any, stockReservations as any),
    [productionBatches, stockReservations],
  );

  const stockById = useMemo(() => {
    const m = new Map<string, { stock_code: string; description: string; uom: string }>();
    for (const sc of stockCodes as any[]) {
      m.set(sc.id, { stock_code: sc.stock_code, description: sc.description, uom: sc.unit_of_measure || '' });
    }
    return m;
  }, [stockCodes]);

  // Stock reconciliation report (2 Oct -> 7 Oct).
  // RM-only, read-only: stock entered (receiving log) - used (Batch Sheets)
  // = should be left, per raw material.
  const reconReport = useMemo(() => {
    const lotToStock = new Map<string, string>();
    for (const r of receivingRecords as any[]) {
      if (r?.id && r?.stock_code_id) lotToStock.set(r.id, r.stock_code_id);
    }
    return computeStockReconReport(
      stockCodes as any,
      receivingRecords as any,
      productionBatches as any,
      materialsUsed,
      (id) => (id ? lotToStock.get(id) ?? null : null),
      usageMovements,
    );
  }, [stockCodes, receivingRecords, productionBatches, materialsUsed, usageMovements]);

  const levelByStock = useMemo(() => {
    const m = new Map<string, { onHand: number; reserved: number }>();
    for (const sl of stockLevels as any[]) {
      m.set(sl.stock_code_id, { onHand: Number(sl.quantity_on_hand) || 0, reserved: Number(sl.reserved_quantity) || 0 });
    }
    return m;
  }, [stockLevels]);

  // Per-batch rows with current stock position. `reservable` is capped at
  // free net per material ACROSS the preview (running total), mirroring the
  // cap creation applies so the all-or-nothing RPC cannot void the rest.
  const rows: PreviewRow[] = useMemo(() => {
    const usedSoFar = new Map<string, number>();
    return missing.lines.map((line) => {
      const meta = stockById.get(line.stock_code_id);
      const level = levelByStock.get(line.stock_code_id);
      const onHand = level?.onHand ?? 0;
      const reserved = level?.reserved ?? 0;
      const net = onHand - reserved;
      const alreadyPromised = usedSoFar.get(line.stock_code_id) ?? 0;
      const reservable = Math.min(line.quantity, Math.max(0, net - alreadyPromised));
      usedSoFar.set(line.stock_code_id, alreadyPromised + reservable);
      const allocs = fifoByStock[line.stock_code_id];
      const fifoCovered = allocs == null ? null : allocs.reduce((s, a) => s + (Number(a.quantity_to_use) || 0), 0);
      return {
        batch_id: line.batch_id, batch_number: line.batch_number,
        created_at: productionBatches.find((b: any) => b.id === line.batch_id)?.created_at ?? '',
        stock_code_id: line.stock_code_id, stock_code: meta?.stock_code ?? line.stock_code_id,
        description: meta?.description ?? '', uom: meta?.uom ?? '',
        required: line.quantity, onHand, reserved, net, fifoCovered, reservable,
        shortage: Math.max(0, line.quantity - reservable),
      };
    });
  }, [missing.lines, stockById, levelByStock, fifoByStock, productionBatches]);

  const totals = useMemo(() => {
    const required = rows.reduce((s, r) => s + r.required, 0);
    const reservable = rows.reduce((s, r) => s + r.reservable, 0);
    return { required, reservable, shortage: Math.max(0, required - reservable) };
  }, [rows]);

  // Concise per-material summary rolled up from the per-batch rows, so the
  // reviewer sees totals at a glance. `reservable` here is the same capped
  // figure as the detail rows (free net shared across the batches).
  const summary: SummaryRow[] = useMemo(() => {
    const m = new Map<string, SummaryRow>();
    const batchSets = new Map<string, Set<string>>();
    for (const r of rows) {
      let s = m.get(r.stock_code_id);
      if (!s) {
        s = {
          stock_code_id: r.stock_code_id, stock_code: r.stock_code,
          description: r.description, uom: r.uom, batches: 0,
          required: 0, onHand: r.onHand, reserved: r.reserved, net: r.net,
          reservable: 0, shortage: 0,
        };
        m.set(r.stock_code_id, s);
        batchSets.set(r.stock_code_id, new Set());
      }
      s.required += r.required;
      s.reservable += r.reservable;
      batchSets.get(r.stock_code_id)!.add(r.batch_id);
    }
    for (const [id, s] of m) {
      s.batches = batchSets.get(id)!.size;
      s.shortage = Math.max(0, s.required - s.reservable);
    }
    return Array.from(m.values()).sort((a, b) => a.stock_code.localeCompare(b.stock_code));
  }, [rows]);

  // Read-only: fms_fifo_allocate_lots is a SELECT-based allocator, once per
  // material, showing how much of the missing total is lot-traceable.
  const checkFifo = async () => {
    setCheckingFifo(true);
    setFifoError(null);
    try {
      const entries: Record<string, FifoAllocation[] | null> = {};
      for (const t of missing.totals) {
        const { data, error } = await (supabase.rpc as any)('fms_fifo_allocate_lots', {
          p_stock_code_id: t.stock_code_id,
          p_quantity_required: t.quantity,
        });
        entries[t.stock_code_id] = error
          ? null
          : ((data || []) as any[]).map((row: any) => ({
              receiving_record_id: row.receiving_record_id,
              internal_lot_number: row.internal_lot_number,
              quantity_available: Number(row.quantity_available) || 0,
              quantity_to_use: Number(row.quantity_to_use) || 0,
            }));
      }
      setFifoByStock(entries);
    } catch (err: any) {
      setFifoError(err?.message || 'FIFO check failed');
    } finally {
      setCheckingFifo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Reconciliation preview (read-only)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drafts on/after {RECON_CUTOFF_ISO.slice(0, 10)} with no active reservation. Nothing
          here writes to the database — no apply button exists.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock reconciliation 2 Oct – 7 Oct, raw materials only ({reconReport.length})</CardTitle>
          <CardDescription>
            Stock Entered = accepted receiving log entries 2026-10-02 → 2026-10-07.
            Used = quantity on Batch Sheets created 30 Sep → 7 Oct (consumed records first,
            else quantity weighed). Should Be Left = Stock Entered − Used.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Raw Material</th>
                <th className="px-3 py-2 text-right">Stock Entered from 2 Oct to 7 Oct (receiving log)</th>
                <th className="px-3 py-2 text-right">Used on Batch Sheets 30 Sep – 7 Oct</th>
                <th className="px-3 py-2 text-right">Should Be Left</th>
              </tr>
            </thead>
            <tbody>
              {reconReport.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-sm text-muted-foreground">No raw-material receivings or usage in range.</td></tr>
              ) : reconReport.map((r) => (
                <tr key={r.stock_code_id} className="border-b last:border-0">
                  <td className="px-3 py-2"><span className="font-mono text-xs">{r.stock_code}</span><span className="ml-1 text-xs">{r.description}</span></td>
                  <td className="px-3 py-2 text-right">{fmt(r.stockEntered)} {r.uom}</td>
                  <td className="px-3 py-2 text-right">{fmt(r.used)} {r.uom}</td>
                  <td className={`px-3 py-2 text-right font-medium ${r.shouldBeLeft < 0 ? 'text-destructive' : ''}`}>{fmt(r.shouldBeLeft)} {r.uom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Draft sheets to reconcile</p><p className="text-2xl font-bold">{missing.batchIds.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Stock codes affected</p><p className="text-2xl font-bold">{summary.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total to reserve</p><p className="text-2xl font-bold">{fmt(totals.reservable)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total shortage</p><p className={`text-2xl font-bold ${totals.shortage > 0 ? 'text-destructive' : ''}`}>{fmt(totals.shortage)}</p></CardContent></Card>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>Already reserved (skipped): <strong>{missing.skippedReservedBatchIds.length}</strong></span>
        <span>Total required: <strong>{fmt(totals.required)}</strong></span>
        <Button variant="outline" size="sm" onClick={checkFifo} disabled={checkingFifo || missing.totals.length === 0}>
          {checkingFifo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Check FIFO lot coverage (read-only)
        </Button>
      </div>
      {fifoError && <p className="text-sm text-destructive">FIFO check failed: {fifoError}</p>}
      {summary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary by material ({summary.length})</CardTitle>
            <CardDescription>Totals across the affected drafts. UOM is per stock code.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Stock Code</th>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2 text-right">Sheets</th>
                  <th className="px-3 py-2 text-right">Total Required</th>
                  <th className="px-3 py-2 text-right">On Hand</th>
                  <th className="px-3 py-2 text-right">Reserved</th>
                  <th className="px-3 py-2 text-right">Net</th>
                  <th className="px-3 py-2 text-right">Reservable</th>
                  <th className="px-3 py-2 text-right">Shortage</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.stock_code_id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{s.stock_code}</td>
                    <td className="px-3 py-2 text-xs">{s.description}</td>
                    <td className="px-3 py-2 text-right">{s.batches}</td>
                    <td className="px-3 py-2 text-right">{fmt(s.required)} {s.uom}</td>
                    <td className="px-3 py-2 text-right">{fmt(s.onHand)}</td>
                    <td className="px-3 py-2 text-right">{fmt(s.reserved)}</td>
                    <td className="px-3 py-2 text-right">{fmt(s.net)}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(s.reservable)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${s.shortage > 0 ? 'text-destructive' : ''}`}>{s.shortage > 0 ? fmt(s.shortage) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      {rows.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No missing reservations.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proposed reservations ({rows.length} lines)</CardTitle>
            <CardDescription>On Hand never moves on a reservation; only Reserved rises (Net falls).</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Batch</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2 text-right">Required</th>
                  <th className="px-3 py-2 text-right">On Hand</th>
                  <th className="px-3 py-2 text-right">Reserved</th>
                  <th className="px-3 py-2 text-right">Net</th>
                  <th className="px-3 py-2 text-right">FIFO covers</th>
                  <th className="px-3 py-2 text-right">Reservable</th>
                  <th className="px-3 py-2 text-right">Short</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.batch_id}-${r.stock_code_id}-${i}`} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{r.batch_number}</td>
                    <td className="px-3 py-2 text-xs">{r.created_at ? r.created_at.slice(0, 10) : '—'}</td>
                    <td className="px-3 py-2"><span className="font-mono text-xs">{r.stock_code}</span><span className="ml-1 text-xs text-muted-foreground">{r.description}</span></td>
                    <td className="px-3 py-2 text-right">{fmt(r.required)} {r.uom}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.onHand)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.reserved)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.net)}</td>
                    <td className="px-3 py-2 text-right">{r.fifoCovered == null ? '—' : fmt(r.fifoCovered)}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(r.reservable)}</td>
                    <td className="px-3 py-2 text-right font-medium">{r.shortage > 0 ? fmt(r.shortage) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReconPreview;

