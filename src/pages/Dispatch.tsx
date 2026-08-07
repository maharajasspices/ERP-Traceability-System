import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useFMSData, formatDateTime } from '@/hooks/useFMSData';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { useDeletePermission } from '@/hooks/useDeletePermission';
import { useActivityLog } from '@/hooks/useActivityLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Send, Eye, Trash2, QrCode, Loader2, Download, Wand2, Camera } from 'lucide-react';
import { generateQRCodePair, printQRCodes, downloadQRCodeWithLabel, generateQRCodeImage } from '@/lib/qrCodeUtils';
import { QRScanner } from '@/components/QRScanner';
import { extractBatchNumberFromScan } from '@/lib/scanParser';
const Dispatch: React.FC = () => {
  const { user } = useFMSAuth();
  const { dispatchRecords, productionBatches, loading, addDispatchRecord, getStockCodeById, refreshData } = useFMSData();
  const { canDelete } = useDeletePermission();
  const { logActivity } = useActivityLog();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<typeof dispatchRecords[0] | null>(null);

  const closedBatches = productionBatches.filter(b => b.status === 'closed');
  const scannerBufferRef = useRef('');
  const scannerTimeoutRef = useRef<number | null>(null);
  const scannerLastKeyTsRef = useRef(0);
  const scannerFastKeyCountRef = useRef(0);

  // Searchable batch options
  const batchOptions: SearchableSelectOption[] = useMemo(() => 
    closedBatches.map(b => {
      const prod = getStockCodeById(b.finished_good_id);
      return {
        value: b.id,
        label: b.batch_number,
        sublabel: prod?.description || 'Unknown product',
        badge: `${b.actual_quantity_produced || b.planned_batch_size} units`,
      };
    }),
    [closedBatches, getStockCodeById]
  );

  // Form state
  const [formData, setFormData] = useState({
    invoice_number: '',
    customer_name: '',
    items: [] as { batch_id: string; quantity: string }[],
  });

  const resetForm = () => {
    setFormData({
      invoice_number: '',
      customer_name: '',
      items: [],
    });
  };

  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    setFormData(prev => ({ ...prev, invoice_number: `INV-${year}${month}-${random}` }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { batch_id: '', quantity: '1' }],
    }));
  };

  // Extract ONLY the batch number from any scanned payload
  const extractBatchNumber = useCallback((rawInput: string): string | null => {
    return extractBatchNumberFromScan(rawInput);
  }, []);

  // Resolve extracted batch number against closed batches
  const resolveClosedBatchFromScan = useCallback((rawResult: string) => {
    const batchNumber = extractBatchNumber(rawResult);
    if (!batchNumber) return null;

    const compact = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const target = batchNumber.toLowerCase().trim();
    const targetCompact = compact(batchNumber);

    const direct = closedBatches.find((batch) => {
      const candidate = batch.batch_number.toLowerCase().trim();
      return candidate === target || compact(candidate) === targetCompact;
    });

    if (direct) {
      return { batch: direct, quantity: 1 };
    }

    const fuzzyMatch = closedBatches.find((batch) => {
      const candidate = batch.batch_number.toLowerCase().trim();
      const candidateCompact = compact(candidate);
      return (
        candidate.includes(target) ||
        target.includes(candidate) ||
        candidateCompact.includes(targetCompact) ||
        targetCompact.includes(candidateCompact)
      );
    });

    if (fuzzyMatch) {
      return { batch: fuzzyMatch, quantity: 1 };
    }

    return null;
  }, [closedBatches, extractBatchNumber]);

  // Handle scan result and auto-populate dispatch items
  const handleScanForItem = useCallback((result: string) => {
    const resolved = resolveClosedBatchFromScan(result);

    if (resolved?.batch) {
      setFormData(prev => {
        const existingIndex = prev.items.findIndex(item => item.batch_id === resolved.batch.id);
        if (existingIndex >= 0) {
          const updatedItems = [...prev.items];
          const currentQty = Number(updatedItems[existingIndex].quantity) || 0;
          updatedItems[existingIndex] = {
            ...updatedItems[existingIndex],
            quantity: String(currentQty + resolved.quantity),
          };
          return { ...prev, items: updatedItems };
        }

        return {
          ...prev,
          items: [...prev.items, { batch_id: resolved.batch.id, quantity: String(resolved.quantity) }],
        };
      });

      toast.success(`Added ${resolved.batch.batch_number} x${resolved.quantity}`);
      return;
    }

    toast.error('No closed batch found for scanned code');
  }, [resolveClosedBatchFromScan]);

  // Dispatch-only hardware scanner support (e.g. TA2 keyboard wedge)
  useEffect(() => {
    if (!dialogOpen) return;

    const flushScannerBuffer = () => {
      const value = scannerBufferRef.current.trim();
      const isLikelyScannerInput = scannerFastKeyCountRef.current >= 3;
      const hasScanSignature = /@batch@>@/i.test(value) || /PB[-\/]\d{4}[-\/]\d{3,}/i.test(value);

      if ((isLikelyScannerInput || hasScanSignature) && value.length >= 4) {
        handleScanForItem(value);
      }

      scannerBufferRef.current = '';
      scannerFastKeyCountRef.current = 0;
      scannerLastKeyTsRef.current = 0;

      if (scannerTimeoutRef.current) {
        window.clearTimeout(scannerTimeoutRef.current);
        scannerTimeoutRef.current = null;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === 'Enter' || event.key === 'Tab') {
        if (scannerBufferRef.current) {
          event.preventDefault();
          flushScannerBuffer();
        }
        return;
      }

      if (event.key.length !== 1) return;

      const now = Date.now();
      const delta = now - scannerLastKeyTsRef.current;
      scannerFastKeyCountRef.current = delta > 0 && delta < 50
        ? scannerFastKeyCountRef.current + 1
        : 1;
      scannerLastKeyTsRef.current = now;

      scannerBufferRef.current += event.key;
      if (scannerTimeoutRef.current) {
        window.clearTimeout(scannerTimeoutRef.current);
      }
      scannerTimeoutRef.current = window.setTimeout(flushScannerBuffer, 120);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (scannerTimeoutRef.current) {
        window.clearTimeout(scannerTimeoutRef.current);
        scannerTimeoutRef.current = null;
      }
      scannerBufferRef.current = '';
      scannerFastKeyCountRef.current = 0;
      scannerLastKeyTsRef.current = 0;
    };
  }, [dialogOpen, handleScanForItem]);

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index: number, field: 'batch_id' | 'quantity', value: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.invoice_number) {
      toast.error('Please fill in invoice number');
      return;
    }

    if (formData.items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    const invalidItems = formData.items.some(
      item => !item.batch_id || !item.quantity || parseInt(item.quantity) <= 0
    );
    if (invalidItems) {
      toast.error('Please fill in all item details');
      return;
    }

    const dispatchItems = formData.items.map((item) => ({
      batch_id: item.batch_id,
      quantity: parseInt(item.quantity),
    }));

    const result = await addDispatchRecord(
      {
        invoice_number: formData.invoice_number,
        dispatch_date: new Date().toISOString(),
        customer_name: formData.customer_name,
        dispatched_by: user?.id || '',
      },
      dispatchItems
    );

    if (result) {
      logActivity({
        action_type: 'create',
        entity_type: 'dispatch',
        entity_id: formData.invoice_number,
        entity_name: formData.customer_name || 'No customer specified',
        details: {
          invoice_number: formData.invoice_number,
          customer: formData.customer_name || 'N/A',
          items_count: formData.items.length,
          items: formData.items.map(item => {
            const batch = productionBatches.find(b => b.id === item.batch_id);
            return {
              batch_number: batch?.batch_number || 'Unknown',
              quantity: item.quantity,
            };
          }),
        },
      });
      toast.success('Dispatch recorded successfully');
      setDialogOpen(false);
      resetForm();
      await refreshData();
    }
  };

  const handleViewRecord = (record: typeof dispatchRecords[0]) => {
    setSelectedRecord(record);
    setViewDialogOpen(true);
  };

  const handlePrintQRCode = async (record: typeof dispatchRecords[0]) => {
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

  const handleDownloadQRCode = async (record: typeof dispatchRecords[0]) => {
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
        items_count: record?.items?.length || 0,
      },
    });
    toast.success('Dispatch deleted successfully');
    await refreshData();
  };

  const filteredRecords = dispatchRecords.filter(rec =>
    rec.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rec.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            Track outbound shipments and link finished goods to customers
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="gap-2 transition-transform hover:scale-105">
              <Plus className="h-4 w-4" />
              New Dispatch
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Record Dispatch</DialogTitle>
              <DialogDescription>
                Record an outbound shipment to a customer
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Number *</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.invoice_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                      placeholder="e.g., INV-2024-001"
                      className="flex-1"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      onClick={generateInvoiceNumber}
                      title="Auto-generate invoice number"
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Customer Name (optional)</Label>
                  <Input
                    value={formData.customer_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                    placeholder="Customer name (optional)"
                  />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Items to Dispatch</Label>
                </div>

                {formData.items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center">
                    <Send className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No items added yet</p>
                    <div className="flex justify-center gap-2 mt-3">
                      <Button type="button" variant="outline" size="sm" onClick={addItem}>
                        <Plus className="mr-1 h-4 w-4" />
                        Add Item
                      </Button>
                      <QRScanner
                        onScanResult={handleScanForItem}
                        triggerButton={
                          <Button type="button" variant="outline" size="sm">
                            <Camera className="mr-1 h-4 w-4" />
                            Scan Item
                          </Button>
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.items.map((item, index) => {
                      const batch = item.batch_id ? productionBatches.find(b => b.id === item.batch_id) : null;
                      const product = batch ? getStockCodeById(batch.finished_good_id) : null;
                      return (
                        <div key={index} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 animate-fade-in">
                          <div className="flex-1">
                            <SearchableSelect
                              options={batchOptions}
                              value={item.batch_id}
                              onValueChange={(value) => updateItem(index, 'batch_id', value)}
                              placeholder="Search batch..."
                            />
                            {product && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Available: {batch?.actual_quantity_produced || batch?.planned_batch_size} units
                              </p>
                            )}
                          </div>
                          <div className="w-24">
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                              placeholder="Qty"
                              min="1"
                            />
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                    
                    {/* Always-visible Add/Scan buttons at bottom */}
                    <div className="flex gap-2 pt-2 border-t border-border mt-3">
                      <Button type="button" variant="outline" size="sm" onClick={addItem} className="flex-1">
                        <Plus className="mr-1 h-4 w-4" />
                        Add Item
                      </Button>
                      <QRScanner
                        onScanResult={handleScanForItem}
                        triggerButton={
                          <Button type="button" variant="outline" size="sm" className="flex-1">
                            <Camera className="mr-1 h-4 w-4" />
                            Scan Item
                          </Button>
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>Record Dispatch</Button>
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
                <th>Items</th>
                <th className="w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record, index) => (
                <tr key={record.id} className="transition-colors" style={{ animationDelay: `${index * 30}ms` }}>
                  <td className="font-medium">{record.invoice_number}</td>
                  <td>{formatDateTime(record.dispatch_date)}</td>
                  <td>{record.customer_name}</td>
                  <td>
                    <Badge variant="outline">{record.items?.length || 0} item(s)</Badge>
                  </td>
                  <td className="flex flex-wrap gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleViewRecord(record)} title="View details">
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
                              This will permanently delete invoice {record.invoice_number}. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteDispatch(record.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    <Send className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p>No dispatch records found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Dispatch Details</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Invoice Number</Label>
                  <p className="font-medium">{selectedRecord.invoice_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Dispatch Date</Label>
                  <p className="font-medium">{formatDateTime(selectedRecord.dispatch_date)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Customer</Label>
                  <p className="font-medium">{selectedRecord.customer_name}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Items</Label>
                <div className="rounded-lg border border-border">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Batch</th>
                        <th>Product</th>
                        <th className="text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedRecord.items || []).map((item) => {
                        const batch = productionBatches.find(b => b.id === item.batch_id);
                        const product = batch ? getStockCodeById(batch.finished_good_id) : null;
                        return (
                          <tr key={item.id}>
                            <td className="font-medium">{batch?.batch_number || 'N/A'}</td>
                            <td>{product?.description || 'N/A'}</td>
                            <td className="text-right">{item.quantity}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dispatch;
