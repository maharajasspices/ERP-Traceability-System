import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, Loader2, Upload, X, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { parseInvoiceFile } from '@/lib/invoiceParser';

/** A product line read off an uploaded invoice, before it becomes a requirement. */
export interface InvoiceLine {
  key: string;
  stock_code_id: string;
  stock_code: string;
  description: string;
  uom: string;
  quantity_required: number;
  invoice_number: string;
}

export interface InvoiceDraft {
  id: string;
  invoice_number: string;
  customer_name: string;
  file_name: string | null;
  file: File | null;
  lines: InvoiceLine[];
  /** Lines the parser could not tie to a stock code, surfaced for review. */
  unmatched: number;
  parsing: boolean;
  parsed: boolean;
}

interface InvoiceUploadPanelProps {
  stockCodes: Array<{
    id: string;
    stock_code: string;
    description: string;
    unit_of_measure: string;
  }>;
  invoices: InvoiceDraft[];
  onChange: (invoices: InvoiceDraft[]) => void;
}

let draftCounter = 0;
const nextDraftId = () => `inv-${++draftCounter}`;

const emptyDraft = (): InvoiceDraft => ({
  id: nextDraftId(),
  invoice_number: '',
  customer_name: '',
  file_name: null,
  file: null,
  lines: [],
  unmatched: 0,
  parsing: false,
  parsed: false,
});

/**
 * Lets the lady group several customer invoices into one delivery and turn
 * each uploaded document into the picking requirements.
 *
 * The document itself is parsed with the existing `parseInvoiceFile`, which is
 * the same parser the Receiving Log already uses for supplier invoices - it
 * reads PDF/CSV/XLSX/TXT and ties each line to a stock code.
 */
export const InvoiceUploadPanel = ({
  stockCodes,
  invoices,
  onChange,
}: InvoiceUploadPanelProps) => {
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const update = (id: string, patch: Partial<InvoiceDraft>) => {
    onChange(invoices.map((inv) => (inv.id === id ? { ...inv, ...patch } : inv)));
  };

  const addInvoice = () => onChange([...invoices, emptyDraft()]);

  const removeInvoice = (id: string) => onChange(invoices.filter((inv) => inv.id !== id));

  /** Parse the chosen file and turn every matched line into a requirement. */
  const handleFile = async (draft: InvoiceDraft, file: File | null) => {
    if (!file) return;

    const invoiceNumber =
      draft.invoice_number.trim() || file.name.replace(/\.[^.]+$/, '').trim();

    if (!draft.invoice_number.trim()) {
      update(draft.id, { invoice_number: invoiceNumber });
    }

    update(draft.id, { file, file_name: file.name, parsing: true });

    try {
      const result = await parseInvoiceFile(file, stockCodes);
      const matched = result.items.filter((i) => i.matched && i.stock_code_id);

      if (matched.length === 0) {
        update(draft.id, { lines: [], unmatched: result.items.length, parsing: false, parsed: true });
        toast.warning(
          'No line items on that document matched your stock codes. Check the file, or add the products by hand below.',
        );
        return;
      }

      // Merge repeated lines for the same product on one invoice.
      const merged = new Map<string, InvoiceLine>();
      for (const item of matched) {
        const sc = stockCodes.find((s) => s.id === item.stock_code_id)!;
        const existing = merged.get(item.stock_code_id);
        if (existing) {
          existing.quantity_required += item.quantity;
        } else {
          merged.set(item.stock_code_id, {
            key: `${draft.id}-${item.stock_code_id}`,
            stock_code_id: sc.id,
            stock_code: sc.stock_code,
            description: sc.description,
            uom: item.uom || sc.unit_of_measure,
            quantity_required: item.quantity,
            invoice_number: invoiceNumber,
          });
        }
      }

      const lines = Array.from(merged.values());
      const unmatched = result.items.length - matched.length;

      update(draft.id, { lines, unmatched, parsing: false, parsed: true });

      if (unmatched > 0) {
        toast.warning(
          `Read ${lines.length} product line(s); ${unmatched} line(s) did not match a stock code and were skipped.`,
        );
      } else {
        toast.success(`Invoice read: ${lines.length} product line(s) added to the picking list.`);
      }
    } catch (err: unknown) {
      console.error('Dispatch invoice parse error:', err);
      update(draft.id, { parsing: false, parsed: false, lines: [] });
      toast.error(err instanceof Error ? err.message : 'Could not read that file.');
    }
  };

  /** Manually add a product line (for invoices the parser cannot read). */
  const addManualLine = (draft: InvoiceDraft, stockCodeId: string) => {
    if (!stockCodeId) return;
    const sc = stockCodes.find((s) => s.id === stockCodeId);
    if (!sc) return;

    const invoiceNumber = draft.invoice_number.trim() || draft.file_name || 'Manual';
    const existing = draft.lines.find((l) => l.stock_code_id === stockCodeId);

    if (existing) {
      update(draft.id, {
        lines: draft.lines.map((l) =>
          l.stock_code_id === stockCodeId
            ? { ...l, quantity_required: l.quantity_required + 1 }
            : l,
        ),
      });
      return;
    }

    update(draft.id, {
      lines: [
        ...draft.lines,
        {
          key: `${draft.id}-${sc.id}`,
          stock_code_id: sc.id,
          stock_code: sc.stock_code,
          description: sc.description,
          uom: sc.unit_of_measure,
          quantity_required: 1,
          invoice_number: invoiceNumber,
        },
      ],
    });
  };

  const setLineQuantity = (draft: InvoiceDraft, key: string, quantity: number) => {
    update(draft.id, {
      lines: draft.lines.map((l) =>
        l.key === key ? { ...l, quantity_required: Math.max(1, Math.trunc(quantity) || 1) } : l,
      ),
    });
  };

  const removeLine = (draft: InvoiceDraft, key: string) => {
    update(draft.id, { lines: draft.lines.filter((l) => l.key !== key) });
  };

  const finishedGoods = stockCodes.filter(
    (s) => s.unit_of_measure === 'units' || s.unit_of_measure === 'each',
  );
  const productOptions = finishedGoods.length > 0 ? finishedGoods : stockCodes;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Customer invoices in this delivery</Label>
        <Button type="button" variant="outline" size="sm" onClick={addInvoice}>
          <Plus className="mr-1 h-4 w-4" />
          Add invoice
        </Button>
      </div>

      {invoices.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Add each customer invoice that belongs to this delivery. Type the products in,
            or upload the invoice file and let the system read them.
          </p>
        </div>
      )}

      {invoices.map((draft) => (
        <div key={draft.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[10rem] space-y-1">
              <Label className="text-xs text-muted-foreground">Invoice number *</Label>
              <Input
                value={draft.invoice_number}
                onChange={(e) => update(draft.id, { invoice_number: e.target.value })}
                placeholder="e.g. INV-202609-0031"
              />
            </div>
            <div className="flex-1 min-w-[10rem] space-y-1">
              <Label className="text-xs text-muted-foreground">Customer</Label>
              <Input
                value={draft.customer_name}
                onChange={(e) => update(draft.id, { customer_name: e.target.value })}
                placeholder="e.g. Pick n Pay"
              />
            </div>
            <input
              ref={(el) => { fileInputs.current[draft.id] = el; }}
              type="file"
              accept=".pdf,.csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={(e) => handleFile(draft, e.target.files?.[0] || null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={draft.parsing}
              title="Optional: upload the invoice to read the product lines automatically"
              onClick={() => fileInputs.current[draft.id]?.click()}
            >
              {draft.parsing ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1 h-4 w-4" />
              )}
              {draft.parsing ? 'Reading…' : draft.file_name || 'Upload invoice (optional)'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeInvoice(draft.id)}
              title="Remove invoice"
            >
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          {draft.unmatched > 0 && (
            <p className="flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {draft.unmatched} line(s) did not match a stock code and were skipped.
            </p>
          )}

          {draft.lines.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {draft.lines.length} product line(s) from this invoice
              </p>
              {draft.lines.map((line) => (
                <div key={line.key} className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1.5">
                  <Badge variant="outline" className="shrink-0 font-mono">{line.stock_code}</Badge>
                  <span className="flex-1 truncate text-sm">{line.description}</span>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity_required}
                    onChange={(e) => setLineQuantity(draft, line.key, Number(e.target.value))}
                    className="w-20"
                  />
                  <span className="w-10 text-xs text-muted-foreground">{line.uom}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeLine(draft, line.key)}
                    title="Remove line"
                  >
                    <X className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            draft.parsed && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" />
                Nothing was read from that file. Add the products by hand:
              </p>
            )
          )}

          {(!draft.parsed || draft.lines.length === 0) && (
            <p className="text-xs text-muted-foreground">
              Add the products by hand, or upload the invoice to read them automatically:
            </p>
          )}

          {/* Always available: the invoice can be typed in OR uploaded. The
              upload is a shortcut, never a requirement. */}
          <div className="flex items-center gap-2">
            <select
              value=""
              onChange={(e) => {
                addManualLine(draft, e.target.value);
                e.target.value = '';
              }}
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">+ Add a product by hand…</option>
              {productOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.stock_code} — {s.description}</option>
              ))}
            </select>
          </div>

          {draft.lines.length > 0 && (
            <p className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Packers will verify these lines against their scans.
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

export default InvoiceUploadPanel;
