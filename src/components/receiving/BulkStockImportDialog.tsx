import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import {
  buildStockTemplate,
  importStockFile,
  type StockCodeLike,
  type StockImportLine,
  type StockImportResult,
  type UnmatchedStockRow,
} from '@/lib/stockImport';

/** A queued Receiving Log line. Mirrors the shape held in `receivingLines`. */
export type ImportedReceivingLine = {
  internal_lot_number: string;
  stock_code_id: string;
  stock_code: string;
  material_description: string;
  quantity_received: string;
  uom: string;
  supplier_batch_number: string;
  production_date: string;
  expiry_date: string;
  cost_price_per_kg: string;
};

interface BulkStockImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockCodes: StockCodeLike[];
  /** Hand the accepted lines back so they join the delivery being recorded. */
  onImported: (lines: ImportedReceivingLine[]) => void;
  /** Lines already queued, so we can warn before they are replaced. */
  existingLineCount: number;
}

const REASON_TEXT: Record<UnmatchedStockRow['reason'], string> = {
  'no-product': 'No product given',
  'unknown-product': 'Product not in your stock codes',
  'no-quantity': 'No quantity',
  'bad-quantity': 'Quantity is zero or negative',
};

/**
 * Bulk stock import for the Receiving Log.
 *
 * The operator makes a sheet in Excel or Google Sheets, uploads it, and the
 * product lines are queued onto the delivery they are recording. Nothing is
 * written to stock here - the operator still reviews the list and presses
 * "Record Receiving" as normal, so the usual quality checks, lot numbers and
 * supplier details all still apply.
 */
export const BulkStockImportDialog = ({
  open,
  onOpenChange,
  stockCodes,
  onImported,
  existingLineCount,
}: BulkStockImportDialogProps) => {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<StockImportResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const reset = () => {
    setResult(null);
    setFileName(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setParsing(true);
    setResult(null);
    setFileName(file.name);
    try {
      const parsed = await importStockFile(file, stockCodes);
      setResult(parsed);
      if (parsed.headerRow < 0) {
        toast.error(
          'Could not find a header row. Make sure the sheet has a row naming the columns, including a product and a quantity column.',
        );
      } else if (parsed.lines.length === 0) {
        toast.warning('No rows could be matched to your stock codes.');
      } else {
        toast.success(
          `Read ${parsed.lines.length} line(s) from ${file.name}${
            parsed.unmatched.length ? `, ${parsed.unmatched.length} need attention` : ''
          }`,
        );
      }
    } catch (err: unknown) {
      console.error('Stock import error:', err);
      toast.error(err instanceof Error ? err.message : 'Could not read that file.');
      setResult(null);
    } finally {
      setParsing(false);
    }
  };

  const downloadTemplate = () => {
    const blob = buildStockTemplate(stockCodes);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Stock_Import_Template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAccept = () => {
    if (!result || result.lines.length === 0) return;

    if (existingLineCount > 0) {
      toast.info(`${existingLineCount} existing line(s) will be replaced by this import.`);
    }

    onImported(
      result.lines.map((l: StockImportLine) => ({
        internal_lot_number: '',
        stock_code_id: l.stock_code_id,
        stock_code: l.stock_code,
        material_description: l.material_description,
        quantity_received: l.quantity_received,
        uom: l.uom,
        supplier_batch_number: l.supplier_batch_number,
        production_date: l.production_date,
        expiry_date: l.expiry_date,
        cost_price_per_kg: l.cost_price_per_kg,
      })),
    );

    toast.success(
      `${result.lines.length} line(s) added to this delivery. Review them, then press "Record Receiving".`,
    );
    handleClose(false);
  };

  const totalQty = (result?.lines ?? []).reduce(
    (sum, l) => sum + (Number(l.quantity_received) || 0),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import stock from a spreadsheet
          </DialogTitle>
          <DialogDescription>
            Upload an Excel, Google Sheets or CSV file listing everything on this delivery. The
            lines are added to the delivery you are recording — nothing is saved until you press
            &quot;Record Receiving&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={parsing}
              onClick={() => fileInput.current?.click()}
            >
              {parsing ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1 h-4 w-4" />
              )}
              {parsing ? 'Reading…' : fileName || 'Choose file'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
              <Download className="mr-1 h-4 w-4" />
              Download template
            </Button>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
            <p className="font-medium">How to lay out the sheet</p>
            <p className="mt-1 text-muted-foreground">
              One row of column headings, then one row per material. You only need a{' '}
              <b>Stock Code</b> (or <b>Description</b>) and a <b>Quantity</b>. Optional: UOM, Batch,
              Expiry, Production, Cost, Lot. Names are flexible — &quot;Qty&quot;, &quot;Batch
              No&quot; and &quot;Use By&quot; all work.
            </p>
          </div>

          {result && result.headerRow >= 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">Header on row {result.headerRow}</Badge>
                <Badge className="bg-green-500/15 text-green-700 border-green-500/30">
                  {result.lines.length} matched
                </Badge>
                {result.unmatched.length > 0 && (
                  <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">
                    {result.unmatched.length} need attention
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  {totalQty.toLocaleString()} units total
                </span>
              </div>

              {result.lines.length > 0 && (
                <div className="max-h-56 overflow-y-auto rounded border border-border">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Stock Code</th>
                        <th>Description</th>
                        <th className="text-right">Qty</th>
                        <th>UOM</th>
                        <th>Batch</th>
                        <th>Expiry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.lines.map((line) => (
                        <tr key={line.rowNumber}>
                          <td className="text-xs text-muted-foreground">{line.rowNumber}</td>
                          <td className="font-mono text-xs">{line.stock_code}</td>
                          <td className="text-xs">{line.material_description}</td>
                          <td className="text-right font-medium">{line.quantity_received}</td>
                          <td className="text-xs text-muted-foreground">{line.uom}</td>
                          <td className="text-xs text-muted-foreground">
                            {line.supplier_batch_number || '—'}
                          </td>
                          <td className="text-xs text-muted-foreground">
                            {line.expiry_date || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.unmatched.length > 0 && (
                <div className="space-y-1 rounded border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="flex items-center gap-1 text-sm font-medium text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    These rows were not imported
                  </p>
                  {result.unmatched.map((row) => (
                    <div key={row.rowNumber} className="flex items-start gap-2 text-xs">
                      <span className="w-16 shrink-0 text-muted-foreground">Row {row.rowNumber}</span>
                      <span className="flex-1">
                        {row.raw.stock_code || row.raw.description || '(blank)'}
                        <span className="text-muted-foreground">
                          {' '}
                          — {row.detail ?? REASON_TEXT[row.reason]}
                        </span>
                      </span>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Fix these in your sheet and upload again, or add them by hand.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Close
          </Button>
          <Button onClick={handleAccept} disabled={!result || result.lines.length === 0}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Add {result?.lines.length ?? 0} line(s) to this delivery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkStockImportDialog;
