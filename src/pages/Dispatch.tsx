import React, { useState, useMemo, useCallback } from 'react';
import { useFMSData, formatDateTime, type FMSDispatch, type FMSDispatchStatus } from '@/hooks/useFMSData';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { useDeletePermission } from '@/hooks/useDeletePermission';
import { useActivityLog } from '@/hooks/useActivityLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Eye, Trash2, QrCode, Loader2, Download, Send, FileText } from 'lucide-react';
import { generateQRCodePair, printQRCodes, downloadQRCodeWithLabel, generateQRCodeImage } from '@/lib/qrCodeUtils';
import { InvoiceUploadPanel, type InvoiceDraft } from '@/components/dispatch/InvoiceUploadPanel';
import { DispatchScanPanel } from '@/components/dispatch/DispatchScanPanel';
import { dispatchProgress } from '@/lib/dispatchRequirements';

/** Presentation for the four dispatch states. */
const STATUS_META: Record<FMSDispatchStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  picking: { label: 'Picking', className: 'bg-amber-500/15 text-amber-700 border-amber-500/30' },
  ready: { label: 'Ready', className: 'bg-green-500/15 text-green-700 border-green-500/30' },
  dispatched: { label: 'Dispatched', className: 'bg-blue-500/15 text-blue-700 border-blue-500/30' },
};

const statusMeta = (status?: string) =>
  STATUS_META[(status as FMSDispatchStatus) ?? 'dispatched'] ?? STATUS_META.dispatched;

const Dispatch: React.FC = () => {
  const { user } = useFMSAuth();
  const {
    dispatchRecords,
    productionBatches,
    stockCodes,
    loading,
    createDispatchFromInvoices,
    recordDispatchScan,
    undoDispatchScan,
    confirmDispatch,
    refreshData,
  } = useFMSData();
  const { canDelete } = useDeletePermission();
  const { logActivity } = useActivityLog();

  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FMSDispatch | null>(null);
  const selectedRequirements = dispatchRecords.find((record) => record.id === selectedRecord?.id)?.requirements ?? selectedRecord?.requirements ?? [];
  const [invoiceDrafts, setInvoiceDrafts] = useState<InvoiceDraft[]>([]);
  const [creating, setCreating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [busyScan, setBusyScan] = useState(false);

  // ---- Invoice upload -> dispatch ----
  const resetForm = () => setInvoiceDrafts([]);

  /** Flatten every invoice's parsed lines into the dispatch requirements. */
  const collectedRequirements = useMemo(
    () => invoiceDrafts.flatMap((draft) => draft.lines),
    [invoiceDrafts],
  );

  const invoiceNumbers = useMemo(
    () =>
      Array.from(
        new Set(
          invoiceDrafts
            .map((d) => d.invoice_number.trim())
            .filter((n) => n.length > 0),
        ),
      ),
    [invoiceDrafts],
  );

  const primaryCustomer = useMemo(
    () => invoiceDrafts.find((d) => d.customer_name.trim())?.customer_name.trim() ?? '',
    [invoiceDrafts],
  );

  const handleCreateDispatch = async () => {
    if (invoiceNumbers.length === 0) {
      toast.error('Add at least one invoice number');
      return;
    }
    if (collectedRequirements.length === 0) {
      toast.error('Upload an invoice, or add at least one product line, before creating the dispatch');
      return;
    }

    setCreating(true);
    try {
      const created = await createDispatchFromInvoices({
        invoiceNumbers,
        customerName: primaryCustomer,
        // Only the first invoice's file is stored on the header row; the rest
        // still get an invoice row so the delivery is fully traceable.
        file: invoiceDrafts.find((d) => d.file)?.file ?? null,
        requirements: collectedRequirements,
        dispatchedBy: user?.id || '',
      });

      

      if (created) {
        logActivity({
          action_type: 'create',
          entity_type: 'dispatch',
          entity_id: invoiceNumbers[0],
          entity_name: primaryCustomer || 'No customer specified',
          details: {
            invoice_numbers: invoiceNumbers,
            customer: primaryCustomer || 'N/A',
            lines: collectedRequirements.length,
          },
        });
        toast.success('Dispatch created. Packers can now scan against the invoice.');
        setDialogOpen(false);
        resetForm();
        await refreshData();

        const fresh = dispatchRecords.find((r) => r.id === created.id);
        if (fresh) handleViewRecord(fresh);
      }
    } finally {
      setCreating(false);
    }
  };

  // ---- Pack scan verification ----
 const handleRecordScan = useCallback(
  async (
    requirement: Parameters<typeof recordDispatchScan>[0],
    batchId?: string,
  ) => {
    setBusyScan(true);
    try {
      const result = await recordDispatchScan(
        requirement,
        user?.id || '',
        batchId,
      );

      if (result.ok) {
        await refreshData();
      }

      return result.ok;
    } finally {
      setBusyScan(false);
    }
  },
  [recordDispatchScan, user?.id, refreshData],
);

  const handleUndoScan = useCallback(
    async (requirement: Parameters<typeof undoDispatchScan>[0]) => {
      const ok = await undoDispatchScan(requirement);
      if (ok) toast.info('One scan removed');
      return ok;
    },
    [undoDispatchScan],
  );

  /** The explicit confirm. This is the ONLY thing that dispatches a load. */
  const handleConfirmDispatch = useCallback(async () => {
    if (!selectedRecord) return;
    setIsConfirming(true);
    try {
      const ok = await confirmDispatch(selectedRecord.id, user?.id || '');
      if (ok) {
        logActivity({
          action_type: 'update',
          entity_type: 'dispatch',
          entity_id: selectedRecord.invoice_number,
          entity_name: selectedRecord.customer_name || 'Dispatch',
          details: { invoice_number: selectedRecord.invoice_number, status: 'dispatched' },
        });
        toast.success('Dispatch confirmed');
        await refreshData();
        const fresh = dispatchRecords.find((r) => r.id === selectedRecord.id);
        if (fresh) setSelectedRecord(fresh);
      }
    } finally {
      setIsConfirming(false);
    }
  }, [selectedRecord, confirmDispatch, dispatchRecords, logActivity, refreshData, user?.id]);

  const handleViewRecord = (record: FMSDispatch) => {
    setSelectedRecord(record);
    setViewDialogOpen(true);
  };

  const handlePrintQRCode = async (record: FMSDispatch) => {
    const { qr1, qr2 } = await generateQRCodePair(record.invoice_number, {
      type: 'dispatch',
      dispatchId: record.id,
      invoiceNumber: record.invoice_number,
      customerName: record.customer_name,
      dispatchDate: record.dispatch_date,
      itemCount: record.items?.length || 0,
    });
    
    printQRCodes(qr1, qr2, record.invoice_number, {
      product: `Customer: ${record.customer_name}`,
      date: formatDateTime(record.dispatch_date),
    });
    toast.success('QR codes generated');
  };

  const handleDownloadQRCode = async (record: FMSDispatch) => {
    const qrDataUrl = await generateQRCodeImage(JSON.stringify({
      type: 'dispatch',
      invoiceNumber: record.invoice_number,
      customerName: record.customer_name,
      dispatchDate: record.dispatch_date,
    }));
    
    await downloadQRCodeWithLabel(
      qrDataUrl, 
      `QR_${record.invoice_number}`, 
      record.invoice_number
    );
    toast.success('QR code downloaded');
  };

  const handleDeleteDispatch = async (id: string) => {
    const record = dispatchRecords.find(r => r.id === id);
    // Children first so the delete is explicit and does not depend on cascade
    // behaviour differing between the child RLS policies.
    await supabase.from('fms_dispatch_requirements').delete().eq('dispatch_id', id);
    await supabase.from('fms_dispatch_invoices').delete().eq('dispatch_id', id);
    await supabase.from('fms_dispatch_items').delete().eq('dispatch_id', id);
    const { error } = await supabase.from('fms_dispatch').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete dispatch');
      return;
    }
    logActivity({
      action_type: 'delete',
      entity_type: 'dispatch',
      entity_id: record?.invoice_number || id,
      entity_name: record?.customer_name || 'Unknown customer',
      details: {
        invoice_number: record?.invoice_number,
        customer: record?.customer_name,
        items_count: record?.requirements?.length || record?.items?.length || 0,
      },
    });
    toast.success('Dispatch deleted successfully');
    await refreshData();
  };
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return dispatchRecords;
    return dispatchRecords.filter(
      (rec) =>
        rec.invoice_number.toLowerCase().includes(q) ||
        rec.customer_name.toLowerCase().includes(q) ||
        (rec.invoices || []).some((inv) => inv.invoice_number.toLowerCase().includes(q)),
    );
  }, [dispatchRecords, searchQuery]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }


  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-muted-foreground">
            Upload customer invoices, then verify every packed item with the TOVI scanner
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="gap-2 transition-transform hover:scale-105">
              <Plus className="h-4 w-4" />
              New Dispatch
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
            <DialogHeader>
              <DialogTitle>New Dispatch from invoices</DialogTitle>
              <DialogDescription>
                Group the customer invoices that belong to one delivery. Uploading an invoice
                fills in the picking list, which the packers will then verify by scanning.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <InvoiceUploadPanel
                stockCodes={stockCodes}
                invoices={invoiceDrafts}
                onChange={setInvoiceDrafts}
              />

              {collectedRequirements.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                  <p className="font-medium">
                    Combined picking list:{' '}
                    {collectedRequirements.length} line(s) across {invoiceNumbers.length} invoice(s)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total {collectedRequirements.reduce((s, r) => s + r.quantity_required, 0)} unit(s)
                    to scan before this dispatch can be confirmed.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateDispatch} disabled={creating}>
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Create dispatch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex gap-4 rounded-xl border border-border bg-card p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by invoice number or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Dispatch Date</th>
                <th>Customer</th>
                <th>Scanned</th>
                <th>Status</th>
                <th className="w-[150px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record, index) => {
                const progress = dispatchProgress(record.requirements ?? []);
                const meta = statusMeta(record.status);
                const otherInvoices = (record.invoices ?? []).length - 1;
                return (
                  <tr key={record.id} className="transition-colors" style={{ animationDelay: `${index * 30}ms` }}>
                    <td className="font-medium">
                      {record.invoice_number}
                      {otherInvoices > 0 && (
                        <Badge variant="outline" className="ml-2">
                          +{otherInvoices} more
                        </Badge>
                      )}
                    </td>
                    <td>{formatDateTime(record.dispatch_date)}</td>
                    <td>{record.customer_name || '—'}</td>
                    <td className="text-sm">
                      {(record.requirements?.length ?? 0) > 0 ? (
                        <span>
                          <span className="text-green-600">{progress.quantity_scanned}</span>
                          <span className="text-muted-foreground"> / {progress.quantity_required}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>
                      <Badge className={meta.className} variant="outline">{meta.label}</Badge>
                    </td>
                    <td className="flex flex-wrap gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleViewRecord(record)} title="View and scan">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handlePrintQRCode(record)} title="Print QR labels">
                        <QrCode className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDownloadQRCode(record)} title="Download QR">
                        <Download className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Delete">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Dispatch?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete invoice {record.invoice_number} and all its
                                scanned records. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteDispatch(record.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredRecords.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No dispatches yet. Create one by uploading a customer invoice.
            </p>
          )}
        </div>
      </div>

      {/* Pack and verify: the TOVI scanning surface */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
          {selectedRecord && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {selectedRecord.invoice_number}
                </DialogTitle>
                <DialogDescription>
                  {selectedRecord.customer_name || 'No customer'} ·{' '}
                  {formatDateTime(selectedRecord.dispatch_date)}
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                {(selectedRecord.invoices ?? []).length > 1 && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    Invoices in this delivery:{' '}
                    {(selectedRecord.invoices ?? []).map((i) => i.invoice_number).join(', ')}
                  </p>
                )}

                {selectedRecord.status === 'dispatched' ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-center">
                      <p className="font-medium text-green-700">This dispatch was confirmed</p>
                      {selectedRecord.confirmed_at && (
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(selectedRecord.confirmed_at)}
                        </p>
                      )}
                    </div>
                    {selectedRecord.items && selectedRecord.items.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">Batches shipped</p>
                        {selectedRecord.items.map((item) => {
                          const batch = productionBatches.find((b) => b.id === item.batch_id);
                          return (
                            <p key={item.id} className="text-sm text-muted-foreground">
                              {batch?.batch_number ?? 'Unknown batch'} · {item.quantity} units
                            </p>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (selectedRecord.requirements?.length ?? 0) === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    This dispatch has no invoice lines, so there is nothing to verify.
                  </p>
                ) : (
                    <DispatchScanPanel
                      requirements={selectedRequirements}
                      productionBatches={productionBatches}
                      stockCodes={stockCodes}
                      canConfirm={dispatchProgress(selectedRequirements).complete}
                      isConfirming={isConfirming || busyScan}
                      onScan={handleRecordScan}
                      onUndo={handleUndoScan}
                      onConfirm={handleConfirmDispatch}
                    />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dispatch;
