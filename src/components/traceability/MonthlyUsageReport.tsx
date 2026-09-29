import React, { useMemo, useState } from 'react';
import {
  Download,
  TrendingDown,
  Factory,
  Package,
  Truck,
  Search,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { exportToCSV } from '@/lib/exportUtils';
import {
  FMSProductionBatch,
  FMSStockCode,
  FMSStockMovement,
} from '@/hooks/useFMSData';

/** Which lens the report is showing. */
type ReportView = 'raw_material' | 'finished_good' | 'all';

interface UsageRow {
  stockCodeId: string;
  stockCode: string;
  description: string;
  itemType: string;
  uom: string;
  /** Quantity consumed by production (batch_usage movements). */
  used: number;
  /** Quantity produced (sum of planned_batch_size on the month's batches). */
  produced: number;
  /** Quantity received into stock. */
  received: number;
  batches: number;
  lastActivity: string | null;
}

interface MonthlyUsageReportProps {
  stockCodes: FMSStockCode[];
  productionBatches: FMSProductionBatch[];
  stockMovements: FMSStockMovement[];
}

const VIEW_LABELS: Record<ReportView, string> = {
  raw_material: 'Raw Materials',
  finished_good: 'Finished Goods',
  all: 'All Items',
};

const num = (value: number) => Math.round(value * 100) / 100;

export const MonthlyUsageReport: React.FC<MonthlyUsageReportProps> = ({
  stockCodes,
  productionBatches,
  stockMovements,
}) => {
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [view, setView] = useState<ReportView>('all');
  const [search, setSearch] = useState('');

  const range = useMemo(() => {
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 0, 23, 59, 59, 999);
    return { start, end };
  }, [month]);

  const monthLabel = useMemo(() => format(range.start, 'MMMM yyyy'), [range]);

  const rows = useMemo<UsageRow[]>(() => {
    // Seed a row per active stock code so items with no activity are still listed.
    const acc = new Map<string, UsageRow>();
    for (const sc of stockCodes) {
      if (sc.status !== 'active') continue;
      acc.set(sc.id, {
        stockCodeId: sc.id,
        stockCode: sc.stock_code,
        description: sc.description,
        itemType: sc.item_type,
        uom: sc.unit_of_measure,
        used: 0,
        produced: 0,
        received: 0,
        batches: 0,
        lastActivity: null,
      });
    }

    const inRange = (value?: string) => {
      if (!value) return false;
      return isWithinInterval(new Date(value), range);
    };

    const touch = (row: UsageRow, when?: string) => {
      if (when && (!row.lastActivity || when > row.lastActivity)) row.lastActivity = when;
    };

    // Consumption + receipts from the stock movement audit trail.
    for (const mv of stockMovements || []) {
      if (!inRange(mv.created_at)) continue;
      const row = acc.get(mv.stock_code_id);
      if (!row) continue;

      if (mv.movement_type === 'batch_usage') {
        row.used += Math.abs(Number(mv.quantity_change) || 0);
      } else if (mv.movement_type === 'receipt' && Number(mv.quantity_change) > 0) {
        row.received += Number(mv.quantity_change);
      }
      touch(row, mv.created_at);
    }

    // Production output, batched by planned production date.
    const batchesInMonth = (productionBatches || []).filter(
      (b) => b.status !== 'cancelled' && inRange(b.planned_production_date)
    );
    for (const batch of batchesInMonth) {
      const row = acc.get(batch.finished_good_id);
      if (!row) continue;
      row.produced += Number(batch.planned_batch_size) || 0;
      row.batches += 1;
      touch(row, batch.planned_production_date);
    }

    return [...acc.values()];
  }, [stockCodes, stockMovements, productionBatches, range]);

  /** Rows for the current view + search, ranked by the metric that view is about. */
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = rows.filter((r) => {
      if (view === 'raw_material' && r.itemType !== 'raw_material') return false;
      if (view === 'finished_good' && r.itemType !== 'finished_good') return false;
      if (!q) return true;
      return (
        r.stockCode.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
      );
    });

    const metric = (r: UsageRow) =>
      view === 'finished_good' ? r.produced : view === 'raw_material' ? r.used : r.used + r.produced + r.received;

    return filtered
      .filter((r) => metric(r) > 0 || r.batches > 0)
      .sort((a, b) => metric(b) - metric(a));
  }, [rows, view, search]);

  const totals = useMemo(
    () => ({
      used: visibleRows.reduce((s, r) => s + r.used, 0),
      produced: visibleRows.reduce((s, r) => s + r.produced, 0),
      received: visibleRows.reduce((s, r) => s + r.received, 0),
      batches: visibleRows.reduce((s, r) => s + r.batches, 0),
    }),
    [visibleRows]
  );

  const topUsed = useMemo(
    () =>
      visibleRows
        .filter((r) => r.used > 0)
        .sort((a, b) => b.used - a.used)
        .slice(0, 3),
    [visibleRows]
  );

  const topProduced = useMemo(
    () =>
      visibleRows
        .filter((r) => r.produced > 0)
        .sort((a, b) => b.produced - a.produced)
        .slice(0, 3),
    [visibleRows]
  );

  const topReceived = useMemo(
    () =>
      visibleRows
        .filter((r) => r.received > 0)
        .sort((a, b) => b.received - a.received)
        .slice(0, 3),
    [visibleRows]
  );
  
  const handleExportCSV = () => {
    if (visibleRows.length === 0) {
      toast.warning('No usage data to export for the selected month');
      return;
    }

    const data = visibleRows.map((r, index) => ({
      Rank: index + 1,
      'Stock Code': r.stockCode,
      Description: r.description,
      'Item Type': r.itemType.replace(/_/g, ' '),
      UOM: r.uom,
      'Used in Production': num(r.used),
      Produced: num(r.produced),
      Received: num(r.received),
      Batches: r.batches,
      'Last Activity': r.lastActivity
        ? format(parseISO(r.lastActivity.slice(0, 10)), 'yyyy-MM-dd')
        : '',
    }));

    // A totals row so the exported file stands on its own.
    data.push({
      Rank: '',
      'Stock Code': 'TOTAL',
      Description: `${visibleRows.length} item(s) - ${monthLabel}`,
      'Item Type': '',
      UOM: '',
      'Used in Production': num(totals.used),
      Produced: num(totals.produced),
      Received: num(totals.received),
      Batches: totals.batches,
      'Last Activity': '',
    } as (typeof data)[number]);

    exportToCSV(data, `Monthly_Usage_Report_${VIEW_LABELS[view].replace(/\s+/g, '_')}_${month}`);

    toast.success(`Usage report exported for ${monthLabel}`);
  };

  const summaryCards = [
    { title: 'Total Used', value: num(totals.used), icon: TrendingDown, tone: 'text-primary' },
    { title: 'Total Produced', value: num(totals.produced), icon: Factory, tone: 'text-success' },
    { title: 'Total Received', value: num(totals.received), icon: Truck, tone: 'text-warning' },
    { title: 'Batches', value: totals.batches, icon: BarChart3, tone: 'text-muted-foreground' },
  ];

  const topLists = [
    { title: 'Most Used Raw Materials', icon: TrendingDown, items: topUsed, metric: 'used' as const },
    { title: 'Most Produced Finished Goods', icon: Factory, items: topProduced, metric: 'produced' as const },
    { title: 'Most Received Items', icon: Truck, items: topReceived, metric: 'received' as const },
  ];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="usage-month" className="text-xs text-muted-foreground">
                  Month
                </Label>
                <Input
                  id="usage-month"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-[170px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">View</Label>
                <Select value={view} onValueChange={(v) => setView(v as ReportView)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    <SelectItem value="raw_material">Raw Materials</SelectItem>
                    <SelectItem value="finished_good">Finished Goods</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="usage-search" className="text-xs text-muted-foreground">
                  Search
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="usage-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Stock code or description"
                    className="w-[220px] pl-9"
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleExportCSV} className="gap-2" disabled={visibleRows.length === 0}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Usage for {monthLabel} &middot; {VIEW_LABELS[view]} &middot; {visibleRows.length} item(s)
          </p>
        </CardContent>
      </Card>

      {/* Summary totals */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-border bg-card p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{card.title}</p>
                <p className={`mt-1 text-2xl font-bold ${card.tone}`}>{card.value}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <card.icon className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Top items */}
      <div className="grid gap-3 lg:grid-cols-3">
        {topLists.map((list) => (
          <Card key={list.title}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <list.icon className="h-4 w-4 text-primary" />
                {list.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {list.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity for {monthLabel}.</p>
              ) : (
                <ol className="space-y-2">
                  {list.items.map((item, i) => (
                    <li
                      key={item.stockCodeId}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge variant="outline" className="shrink-0">
                          {i + 1}
                        </Badge>
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-medium">
                            {item.stockCode}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold">
                        {num(item[list.metric])} {item.uom}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Full detail table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-primary" />
            Full Breakdown
          </CardTitle>
          <CardDescription>
            Every item with activity in {monthLabel}, highest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {visibleRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No usage recorded for {monthLabel}. Try another month or clear the search.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">Stock Code</th>
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 text-right font-medium">Used</th>
                    <th className="py-2 pr-3 text-right font-medium">Produced</th>
                    <th className="py-2 pr-3 text-right font-medium">Received</th>
                    <th className="py-2 pr-3 text-right font-medium">Batches</th>
                    <th className="py-2 text-right font-medium">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r, i) => (
                    <tr key={r.stockCodeId} className="border-b border-border/50">
                      <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-3 font-mono">{r.stockCode}</td>
                      <td className="py-2 pr-3">{r.description}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {r.itemType.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {r.used > 0 ? `${num(r.used)} ${r.uom}` : '-'}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {r.produced > 0 ? `${num(r.produced)} ${r.uom}` : '-'}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {r.received > 0 ? `${num(r.received)} ${r.uom}` : '-'}
                      </td>
                      <td className="py-2 pr-3 text-right">{r.batches || '-'}</td>
                      <td className="py-2 text-right text-muted-foreground">
                        {r.lastActivity
                          ? format(parseISO(r.lastActivity.slice(0, 10)), 'dd MMM yyyy')
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="py-2 pr-3" colSpan={4}>
                      TOTAL
                    </td>
                    <td className="py-2 pr-3 text-right">{num(totals.used)}</td>
                    <td className="py-2 pr-3 text-right">{num(totals.produced)}</td>
                    <td className="py-2 pr-3 text-right">{num(totals.received)}</td>
                    <td className="py-2 pr-3 text-right">{totals.batches}</td>
                    <td className="py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MonthlyUsageReport;


