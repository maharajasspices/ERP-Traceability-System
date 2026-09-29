import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFMSData } from '@/hooks/useFMSData';
import type { FMSStockOrder } from '@/hooks/useFMSData';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { useDeletePermission } from '@/hooks/useDeletePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Truck, CheckCircle, XCircle, Eye, FileText, Loader2, QrCode, Trash2, Download, Camera, ClipboardList, PackageCheck, Upload, X, Inbox } from 'lucide-react';
import { useActivityLog } from '@/hooks/useActivityLog';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';
import { format, set } from 'date-fns';
import { generateQRCodePair, printQRCodes, downloadQRCodeWithLabel, generateQRCodeImage } from '@/lib/qrCodeUtils';
import { QRScanner } from '@/components/QRScanner';
import { extractBestScanIdentifier } from '@/lib/scanParser';
import {
  parseToviScan,
  findReceivingRecordForToviScan,
} from '@/lib/toviParser';
import { parseInvoiceFile } from '@/lib/invoiceParser';
import { useSupplierPrices, formatZAR } from '@/hooks/useSupplierPrices';

const receivingQualityChecksList = [
  { key: 'coa_received', label: 'COA/COC Provided' },
  { key: 'vehicle_clean', label: 'Clean Vehicle' },
  { key: 'no_foreign_odours', label: 'No Foreign Odours/Chemicals' },
  { key: 'no_pest_activity', label: 'No Sign of Pest Activity' },
  { key: 'packaging_intact', label: 'Packaging Intact/No Breakage' },
  { key: 'correct_labelling', label: 'Labelling Clear' },
  { key: 'organoleptic_ok', label: 'Quality Checks Passed (Organoleptic)' },
];

const generateLotNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `LOT-${year}-${random}`;
};

const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};
const formatDateTime = (date: string | Date): string => {
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ReceivingLog: React.FC = () => {
  const { user, fmsUser } = useFMSAuth();
  const {
    receivingRecords,
    stockCodes,
    suppliers,
    loading,
    addReceivingRecord,
    refreshData,
    addStockForReceipt,
    stockOrders,
    createStockOrder,
    supplierOrderEmails,
    updateSupplierOrderEmailStatus,
    getStockCodeById,
  } = useFMSData();

  /**
   * Dedicated handler for the "Scan lot with TOVI..." input.
   *
   * Uses `toviParser` rather than the shared `scanParser`, so the camera QR
   * scanner and the normal Receiving Log search keep their existing behaviour.
   * The TOVI scanner is a keyboard wedge, so the payload can be a bare lot
   * number, a slash-separated lot, a tag-delimited string or the JSON printed
   * on a Receiving QR. In every case the result is matched to the Maharaja
   * internal lot number.
   */
  const handleToviLotScan = (lotNumber: string) => {
    const scan = parseToviScan(lotNumber);

    if (!scan.ok) {
      setToviLotResult(null);
      setToviMatchedOn(null);
      toast.error(
        scan.source === 'empty'
          ? 'Please scan or enter a lot number'
          : `No lot number found in scan: ${lotNumber}`,
      );
      return;
    }

    const match = findReceivingRecordForToviScan(receivingRecords, scan);

    if (!match) {
      setToviLotResult(null);
      setToviMatchedOn(null);
      toast.error(`Lot not found: ${scan.lotNumber}`);
      return;
    }

    setToviLotResult(match.record);
    setToviMatchedOn(match.matchedOn);
    toast.success(`Lot found: ${match.record.internal_lot_number}`);
  };

  /** Clear the TOVI result panel and the scanned value. */
  const clearToviResult = () => {
    setToviLotResult(null);
    setToviMatchedOn(null);
    setToviLotNumber('');
  };

  /** Open the full Receiving Record Details dialog for the scanned lot. */
  const viewToviRecord = () => {
    if (toviLotResult) handleViewRecord(toviLotResult);
  };

  
  const { prices: supplierPrices, refresh: refreshPrices } = useSupplierPrices();
  const { logActivity } = useActivityLog();
  const { canDelete } = useDeletePermission();
  const [searchQuery, setSearchQuery] = useState('');
  const [toviLotNumber, setToviLotNumber] = useState('');
  const [toviLotResult, setToviLotResult] = useState<typeof receivingRecords[0] | null>(null);
  /**
   * How the TOVI scan was matched. When a Receiving QR is resolved via the
   * supplier's own batch we still show the Maharaja internal lot, but flag it
   * so the operator knows the code was matched on the supplier field.
   */
  const [toviMatchedOn, setToviMatchedOn] = useState<
    'internal_lot_number' | 'supplier_batch_number' | null
  >(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<typeof receivingRecords[0] | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  receivingRecords
  const [editCoaContent, setEditCoaContent] = useState('');
  const [editCostPrice, setEditCostPrice] = useState('');
  const [savingCoa, setSavingCoa] = useState(false);
  const [savingCost, setSavingCost] = useState(false);

const [exportFilters, setExportFilters] = useState({
  dateFrom: '',
  dateTo: '',
  supplierId: 'all',
  stockCodeId: 'all',
  status: 'all',
  lotNumber: '',
});

const [showExportDialog, setShowExportDialog] = useState(false);

  
  const [stockCodeSearch, setStockCodeSearch] = useState('');
  const [showStockCodeDropdown, setShowStockCodeDropdown] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');

  // ---- Sub-tabs ----
  const [activeTab, setActiveTab] = useState('receiving');

  // ---- Stock orders (uploaded invoice awaiting receipt) ----
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [orderSupplierSearch, setOrderSupplierSearch] = useState('');
  const [showOrderSupplierDropdown, setShowOrderSupplierDropdown] = useState(false);
  const [parsingInvoice, setParsingInvoice] = useState(false);
  const [parseStatus, setParseStatus] = useState<{ found: number; matched: number } | null>(null);
  const [orderItems, setOrderItems] = useState<{ stock_code_id: string; stock_code: string; description: string; quantity_ordered: string; uom: string }[]>([]);
  const [orderFormData, setOrderFormData] = useState({
    po_number: `PO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
    order_date: new Date().toISOString().split('T')[0],
    supplier_id: '',
    supplier_name: '',
    invoice_number: '',
    notes: '',
  });
  // Confirm receipt dialog
  const [confirmOrder, setConfirmOrder] = useState<FMSStockOrder | null>(null);
  const [confirmState, setConfirmState] = useState<Record<string, { qty: string; lot: string; expiry: string }>>({});
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);
  const [confirmReceiverName, setConfirmReceiverName] = useState('');
  const [confirmCoaContent, setConfirmCoaContent] = useState('');
  const [confirmQualityChecks, setConfirmQualityChecks] = useState<Record<string, boolean>>({});

  // Emailed order confirmation state - matches receiving log form
  const [confirmingEmailOrder, setConfirmingEmailOrder] = useState<typeof supplierOrderEmails[0] | null>(null);
  const [emailOrderFormData, setEmailOrderFormData] = useState({
    internal_lot_number: generateLotNumber(),
    date_received: new Date().toISOString().split('T')[0],
    stock_code_id: '',
    stock_code: '',
    material_description: '',
    quantity_received: '',
    actual_quantity: '', // Actual kg received (may differ from ordered)
    uom: 'kg',
    supplier_id: '',
    supplier_name: '',
    supplier_batch_number: '',
    production_date: '',
    expiry_date: '',
    invoice_number: '',
    receiver_name: '',
    notes: '',
    coa_content: '',
    cost_price_per_kg: '',
    quality_checks: {
      coa_received: false,
      vehicle_clean: false,
      no_foreign_odours: false,
      no_pest_activity: false,
      packaging_intact: false,
      correct_labelling: false,
      organoleptic_ok: false,
    } as Record<string, boolean>,
  });

   const [confirmingEmailReceipt, setConfirmingEmailReceipt] = useState(false);
   const [orderUsers, setOrderUsers] = useState<Record<string, string>>({});
   const [viewOrder, setViewOrder] = useState<FMSStockOrder | null>(null);
   const [deletingOrder, setDeletingOrder] = useState<FMSStockOrder | null>(null);
   const [deletingOrderBusy, setDeletingOrderBusy] = useState(false);
   const [deletingAllOpen, setDeletingAllOpen] = useState(false);
   const [deletingAllBusy, setDeletingAllBusy] = useState(false);

  const handleDeleteOrder = async (order: FMSStockOrder) => {
    setDeletingOrderBusy(true);
    try {
      let error: any = null;
      const rpcRes = await (supabase.rpc as any)('fms_delete_stock_orders', {
        p_ids: [order.id],
      });
      error = rpcRes?.error ?? null;

      if (error) {
        console.error('RPC delete failed, falling back to direct delete:', error);
        const direct = await supabase
          .from('fms_stock_orders')
          .delete()
          .eq('id', order.id);
        error = direct.error ?? null;
      }

      if (error) {
        console.error(error);
        toast.error(`Failed to delete order: ${error.message}`);
        return;
      }

      await logActivity({
        action_type: 'delete',
        entity_type: 'stock_order',
        entity_id: order.po_number,
        entity_name: order.po_number,
        details: { invoice_number: order.invoice_number || '' },
      });
      toast.success(`Invoice order ${order.po_number} deleted`);
      setDeletingOrder(null);
      await refreshData();
    } catch (err) {
      console.error('Delete order unexpected error:', err);
      toast.error('Failed to delete order — an unexpected error occurred.');
    } finally {
      setDeletingOrderBusy(false);
    }
  };

  // Delete ALL orders awaiting confirmation (status !== 'CHECKED')
  const handleDeleteAllOrders = async () => {
    const targets = stockOrders.filter(o => o.status !== 'CHECKED');
    if (targets.length === 0) return;

    setDeletingAllBusy(true);
    try {
      const ids = targets.map(o => o.id);

      // Prefer the SECURITY DEFINER RPC; fall back to a direct bulk delete.
      let error: any = null;
      const rpcRes = await (supabase.rpc as any)('fms_delete_stock_orders', {
        p_ids: ids,
      });
      error = rpcRes?.error ?? null;

      if (error) {
        console.error('RPC bulk delete failed, falling back to direct:', error);
        const direct = await supabase
          .from('fms_stock_orders')
          .delete()
          .in('id', ids)
          .neq('status', 'CHECKED');
        error = direct.error ?? null;
      }

      if (error) {
        console.error(error);
        toast.error(`Failed to delete orders: ${error.message}`);
        return;
      }

      toast.success(`${targets.length} invoice order(s) deleted`);
      setDeletingAllOpen(false);
      await refreshData();
    } catch (err) {
      console.error('Delete-all unexpected error:', err);
      toast.error('Failed to delete orders — an unexpected error occurred.');
    } finally {
      setDeletingAllBusy(false);
    }
  };

  // Map of user ids to names (for "confirmed by" display)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('fms_users' as any).select('user_id, name' as any);
      if (!error && data) {
        const map: Record<string, string> = {};
        (data as any[]).forEach(u => { map[u.user_id] = u.name; });
        setOrderUsers(map);
      }
    })();
  }, []);

  const getUserName = (userId: string | null | undefined): string => {
    if (!userId) return 'Unknown';
    return orderUsers[userId] || 'Unknown user';
  };

  // Safety net: whenever an order's confirmed quantities match the invoice
  // (every item received >= ordered), force its status to CHECKED so it
  // moves out of the Warehouse Confirmation queue — even if a previous
  // run left it PARTIALLY_RECEIVED. Idempotent via attemptedIds ref.
const statusFixAttempted = useRef<Set<string>>(new Set());
  useEffect(() => {
    const stale = stockOrders.filter(o =>
      o.status !== 'CHECKED' &&
      o.items.length > 0 &&
      o.items.every(it => Number(it.quantity_received ?? 0) >= Number(it.quantity_ordered)) &&
      !statusFixAttempted.current.has(o.id)
    );
    if (stale.length === 0) return;
    stale.forEach(o => statusFixAttempted.current.add(o.id));
    (async () => {
      for (const order of stale) {
        const { error } = await (supabase.from('fms_stock_orders' as any) as any)
          .update({ status: 'CHECKED', updated_at: new Date().toISOString() })
          .eq('id', order.id);
        if (error) console.error(`Failed to set ${order.po_number} to CHECKED:`, error);
      }
      await refreshData();
    })();
  }, [stockOrders]);

  const [formData, setFormData] = useState({
    internal_lot_number: generateLotNumber(),
    date_received: new Date().toISOString().split('T')[0],
    stock_code_id: '',
    stock_code: '',
    material_description: '',
    quantity_received: '',
    uom: 'kg',
    supplier_id: '',
    supplier_name: '',
    supplier_batch_number: '',
    production_date: '',
    expiry_date: '',
    invoice_number: '',
    receiver_name: fmsUser?.name || '', // Pre-populate with logged-in user
    notes: '',
    coa_content: '', // NEW: Optional COA text content
    cost_price_per_kg: '', // Auto-pulled from supplier price, editable
    quality_checks: {
      coa_received: false,
      vehicle_clean: false,
      no_foreign_odours: false,
      no_pest_activity: false,
      packaging_intact: false,
      correct_labelling: false,
      organoleptic_ok: false,
    } as Record<string, boolean>,
  });

  // Multi-line receiving: queued line items sharing the same delivery details
  // (date received, supplier, invoice, receiver, quality checks, COA/COC)
  const [receivingLines, setReceivingLines] = useState<{
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
  }[]>([]);

  // Optional invoice attachment for additional information
  const [receivingInvoiceFile, setReceivingInvoiceFile] = useState<File | null>(null);

  const stockCodeResults = useMemo(() => {
    if (stockCodeSearch.length === 0) return [];
    return stockCodes.filter(sc => 
      sc.stock_code.toLowerCase().includes(stockCodeSearch.toLowerCase()) ||
      sc.description.toLowerCase().includes(stockCodeSearch.toLowerCase())
    ).slice(0, 20);
  }, [stockCodeSearch, stockCodes]);

  const supplierResults = useMemo(() => {
    return suppliers.filter(s => s.is_approved);
  }, [suppliers]);

  const resetForm = () => {
    setFormData({
      internal_lot_number: generateLotNumber(),
      date_received: new Date().toISOString().split('T')[0],
      stock_code_id: '',
      stock_code: '',
      material_description: '',
      quantity_received: '',
      uom: 'kg',
      supplier_id: '',
      supplier_name: '',
      supplier_batch_number: '',
      production_date: new Date().toISOString().split('T')[0], // Defaults to date of receiving
      expiry_date: '',
      invoice_number: '',
      receiver_name: fmsUser?.name || '', // Pre-populate with logged-in user
      notes: '',
      coa_content: '',
      cost_price_per_kg: '',
      quality_checks: {
        coa_received: false,
        vehicle_clean: false,
        no_foreign_odours: false,
        no_pest_activity: false,
        packaging_intact: false,
        correct_labelling: false,
        organoleptic_ok: false,
      },
    });
    setStockCodeSearch('');
    setSupplierSearch('');
    setReceivingLines([]);
    setReceivingInvoiceFile(null);
  };

  // Queue the current entry as a line item and reset line-level fields,
  // keeping the shared delivery details (date, supplier, invoice, checks, COA)
  const handleAddLineToBatch = () => {
    if (!formData.stock_code_id || !formData.supplier_id || !(parseFloat(formData.quantity_received) > 0)) {
      toast.error('Fill in Stock Code, Supplier and Quantity before adding the line item');
      return;
    }
    setReceivingLines(prev => [...prev, {
      internal_lot_number: formData.internal_lot_number,
      stock_code_id: formData.stock_code_id,
      stock_code: formData.stock_code,
      material_description: formData.material_description,
      quantity_received: formData.quantity_received,
      uom: formData.uom,
      supplier_batch_number: formData.supplier_batch_number,
      production_date: formData.production_date,
      expiry_date: formData.expiry_date,
      cost_price_per_kg: formData.cost_price_per_kg,
    }]);
    setFormData(prev => ({
      ...prev,
      internal_lot_number: generateLotNumber(),
      stock_code_id: '',
      stock_code: '',
      material_description: '',
      quantity_received: '',
      uom: 'kg',
      supplier_batch_number: '',
      expiry_date: '',
      cost_price_per_kg: '',
    }));
    setStockCodeSearch('');
    toast.success('Line item added — enter the next material, or click Record Receiving to save all');
  };

  const handleRemoveLine = (idx: number) => {
    setReceivingLines(prev => prev.filter((_, i) => i !== idx));
  };

  const handleStockCodeSelect = (item: typeof stockCodes[0]) => {
    setFormData(prev => ({
      ...prev,
      stock_code_id: item.id,
      stock_code: item.stock_code,
      material_description: item.description,
      uom: item.unit_of_measure,
    }));
    setStockCodeSearch(item.stock_code);
    setShowStockCodeDropdown(false);
    autoFillSupplierForStockCode(item.id);
  };

  // Auto-pull the supplier for a stock code:
  // 1. Supplier from the most recent receiving record for that material
  // 2. Fallback: supplier from the most recent price entry for that material
  const autoFillSupplierForStockCode = (stockCodeId: string) => {
    if (!stockCodeId) return;
    let autoSupplierId = '';
    const lastReceipt = receivingRecords
      .filter(r => r.stock_code_id === stockCodeId && r.supplier_id)
      .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())[0];
    if (lastReceipt) {
      autoSupplierId = lastReceipt.supplier_id;
    } else {
      const prices = supplierPrices.filter(p => p.stock_code_id === stockCodeId);
      if (prices.length === 1) {
        autoSupplierId = prices[0].supplier_id;
      } else if (prices.length > 1) {
        // Multiple suppliers have priced this material — use the most recently priced one
        const mostRecent = [...prices].sort(
          (a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
        )[0];
        autoSupplierId = mostRecent.supplier_id;
      }
    }
    if (autoSupplierId) {
      const supplier = suppliers.find(s => s.id === autoSupplierId);
      if (supplier) {
        setFormData(prev => ({
          ...prev,
          supplier_id: supplier.id,
          supplier_name: supplier.name,
        }));
        setSupplierSearch(supplier.name);
        setShowSupplierDropdown(false);
      }
    }
  };

  // Keep receiver name in sync if auth loads after the form state initialised
  useEffect(() => {
    setFormData(prev => (prev.receiver_name ? prev : { ...prev, receiver_name: fmsUser?.name || '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fmsUser?.name]);

  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  const handleSupplierSelect = (supplier: typeof suppliers[0]) => {
    setFormData(prev => ({
      ...prev,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
    }));
    setSupplierSearch(supplier.name);
    setShowSupplierDropdown(false);
  };

  // Auto-pull existing supplier price for selected stock_code + supplier
  useEffect(() => {
    if (!formData.stock_code_id || !formData.supplier_id) return;
    const match = supplierPrices.find(
      p => p.stock_code_id === formData.stock_code_id && p.supplier_id === formData.supplier_id
    );
    if (match) {
      setFormData(prev => ({ ...prev, cost_price_per_kg: String(match.cost_price_per_kg) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.stock_code_id, formData.supplier_id, supplierPrices]);

  const handleQualityCheckChange = (key: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      quality_checks: { ...prev.quality_checks, [key]: checked },
    }));
  };
 
  const handleSubmit = async () => {
    // Lines queued via "Add Another Item" plus the current form entry
    const currentLine = formData.stock_code_id && parseFloat(formData.quantity_received) > 0 ? [{
      internal_lot_number: formData.internal_lot_number,
      stock_code_id: formData.stock_code_id,
      stock_code: formData.stock_code,
      material_description: formData.material_description,
      quantity_received: formData.quantity_received,
      uom: formData.uom,
      supplier_batch_number: formData.supplier_batch_number,
      production_date: formData.production_date,
      expiry_date: formData.expiry_date,
      cost_price_per_kg: formData.cost_price_per_kg,
    }] : [];
    const lines = [...receivingLines, ...currentLine];

    if (!formData.supplier_id) {
      toast.error('Please select a Supplier');
      return;
    }
    if (lines.length === 0) {
      toast.error('Please fill in Stock Code, Supplier, and Quantity');
      return;
    }
    for (const line of lines) {
      if (!line.stock_code_id || !(parseFloat(line.quantity_received) > 0)) {
        toast.error('Each line item needs a Stock Code and a Quantity greater than 0');
        return;
      }
      // Expiry date is optional - only validate it if provided
      if (line.expiry_date && new Date(line.expiry_date) < new Date()) {
        toast.error(`Cannot receive expired materials (lot ${line.internal_lot_number})`);
        return;
      }
    }

    const qualityChecks: Record<string, any> = {
      vehicle_clean: formData.quality_checks.vehicle_clean ? 'pass' : 'fail',
      no_foreign_odours: formData.quality_checks.no_foreign_odours ? 'pass' : 'fail',
      no_pest_activity: formData.quality_checks.no_pest_activity ? 'pass' : 'fail',
      packaging_intact: formData.quality_checks.packaging_intact ? 'pass' : 'fail',
      correct_labelling: formData.quality_checks.correct_labelling ? 'pass' : 'fail',
      organoleptic_ok: formData.quality_checks.organoleptic_ok ? 'pass' : 'fail',
      coa_received: formData.quality_checks.coa_received ? 'pass' : 'fail',
      coa_content: formData.coa_content || '', // Store COA text content
      notes: formData.notes,
    };

    // COA/COC is optional and does not cause rejection
    const hasFailed = Object.entries(qualityChecks).some(([k, v]) => k !== 'coa_content' && k !== 'coa_received' && k !== 'notes' && v === 'fail');

    // Upload the optional invoice attachment (for additional information only)
    let invoiceFilePath: string | null = null;
    if (receivingInvoiceFile) {
      const safeFileName = receivingInvoiceFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `receiving/${formData.date_received}/${Date.now()}-${safeFileName}`;
      const { error: uploadError } = await supabase.storage
        .from('order-documents')
        .upload(filePath, receivingInvoiceFile, {
          contentType: receivingInvoiceFile.type || 'application/octet-stream',
        });
      if (uploadError) {
        console.error('Receiving invoice upload error:', uploadError);
        toast.warning(`Invoice file could not be uploaded (${uploadError.message}). Recording the receiving without it.`);
      } else {
        invoiceFilePath = filePath;
      }
    }

    if (invoiceFilePath) {
      qualityChecks.invoice_file_path = invoiceFilePath;
    }

    let saved = 0;

    for (const line of lines) {
      const costNum = line.cost_price_per_kg ? parseFloat(line.cost_price_per_kg) : null;
      // Production date defaults to the date of receiving
      const productionDate = line.production_date || formData.date_received;

      const result = await addReceivingRecord({
        internal_lot_number: line.internal_lot_number,
        received_at: new Date(formData.date_received).toISOString(),
        stock_code_id: line.stock_code_id,
        quantity_received: parseFloat(line.quantity_received),
        supplier_id: formData.supplier_id,
        supplier_batch_number: line.supplier_batch_number,
        manufacturing_date: productionDate,
        expiry_date: line.expiry_date || null,
        delivery_note_number: formData.invoice_number || undefined,
        quality_checks: qualityChecks,
        status: hasFailed ? 'declined' : 'accepted',
        rejection_reason: hasFailed ? 'Quality check failed' : undefined,
        received_by: user?.id || '',
        cost_price_per_kg: costNum != null && !isNaN(costNum) ? costNum : null,
      } as any);

      if (!result) continue;
      saved++;

      // Add stock to inventory for accepted receipts
      if (!hasFailed) {
        const newQty = await addStockForReceipt(
          line.stock_code_id,
          parseFloat(line.quantity_received),
          line.internal_lot_number,
          `Receipt ${line.internal_lot_number} - ${line.material_description}`
        );
        if (newQty === null) {
          console.warn('[FMS] Failed to update stock level for receipt', line.internal_lot_number);
        }
      }

      // Sync cost price back to supplier_material_prices so rest of system stays in sync
      if (costNum != null && !isNaN(costNum) && costNum >= 0) {
        const existing = supplierPrices.find(
          p => p.stock_code_id === line.stock_code_id && p.supplier_id === formData.supplier_id
        );
        if (existing) {
          if (Number(existing.cost_price_per_kg) !== costNum) {
            await (supabase.from('fms_supplier_material_prices' as any) as any)
              .update({ cost_price_per_kg: costNum, updated_by: user?.id })
              .eq('id', existing.id);
          }
        } else {
          await (supabase.from('fms_supplier_material_prices' as any) as any)
            .insert({
              supplier_id: formData.supplier_id,
              stock_code_id: line.stock_code_id,
              cost_price_per_kg: costNum,
              currency: 'ZAR',
              updated_by: user?.id,
            });
        }
      }

      const failedChecks = Object.entries(qualityChecks)
        .filter(([_, v]) => v !== 'pass')
        .map(([k]) => k.replace(/_/g, ' '));

      logActivity({
        action_type: 'create',
        entity_type: 'receiving',
        entity_id: line.internal_lot_number,
        entity_name: line.material_description,
        details: {
          lot_number: line.internal_lot_number,
          stock_code: line.stock_code,
          supplier: formData.supplier_name,
          quantity: `${line.quantity_received} ${line.uom}`,
          supplier_batch: line.supplier_batch_number,
          status: hasFailed ? 'declined' : 'accepted',
          failed_checks: failedChecks.length > 0 ? failedChecks : undefined,
          receiver: formData.receiver_name,
          cost_price_per_kg: costNum,
          part_of_multi_receiving: lines.length > 1,
        },
      });
    }

    await refreshPrices(true);

    if (saved === 0) {
      toast.error('Failed to save receiving record(s)');
      return;
    }

    toast.success(`${saved} material${saved > 1 ? 's' : ''} ${hasFailed ? 'declined' : 'received'} successfully`);
    setDialogOpen(false);
    resetForm();
    await refreshData();
  };

  const getStockCode = (id: string) => stockCodes.find(sc => sc.id === id);
  const getSupplier = (id: string) => suppliers.find(s => s.id === id);

  // ---- Stock orders: create + confirm receipt -------------------------
  const resetOrderForm = () => {
    setOrderFormData({
      po_number: `PO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      order_date: new Date().toISOString().split('T')[0],
      supplier_id: '',
      supplier_name: '',
      invoice_number: '',
      notes: '',
    });
    setOrderItems([]);
    setInvoiceFile(null);
    setOrderSupplierSearch('');
  };

  // Parse the uploaded invoice document and auto-populate line items
  const handleInvoiceFileChange = async (file: File | null) => {
    setInvoiceFile(file);
    setParseStatus(null);
    if (!file) return;
    setParsingInvoice(true);
    try {
      const result = await parseInvoiceFile(file, stockCodes);
      const matched = result.items.filter(i => i.matched);
      setParseStatus({ found: result.items.length, matched: matched.length });
      if (result.items.length === 0) {
        toast.warning('No line items could be read from the document. Please check the invoice file and try again.');
        return;
      }
      // Replace the table with items parsed from the document
      setOrderItems(matched.map(i => {
        const sc = stockCodes.find(sc => sc.id === i.stock_code_id)!;
        return {
          stock_code_id: sc.id,
          stock_code: sc.stock_code,
          description: sc.description,
          quantity_ordered: String(i.quantity),
          uom: i.uom || sc.unit_of_measure,
        };
      }));
      if (matched.length === result.items.length) {
        toast.success(`Invoice read: ${matched.length} item(s) imported from the document.`);
      } else {
        toast.warning(`Invoice read: ${matched.length} of ${result.items.length} line item(s) matched your stock codes — review the list and remove any that don't belong.`);
      }
    } catch (err: any) {
      console.error('Invoice parse error:', err);
      toast.error(err?.message || 'Could not read the invoice. Please check the file and try again.');
    } finally {
      setParsingInvoice(false);
    }
  };

  

  const openConfirmDialog = (order: FMSStockOrder) => {
    const state: Record<string, { qty: string; lot: string; expiry: string }> = {};
    order.items.forEach(it => {
      // For already (partially) received items, pre-fill the outstanding balance
      const ordered = Number(it.quantity_ordered);
      const already = it.received ? Number(it.quantity_received ?? 0) : 0;
      const balance = Math.max(0, ordered - already);
      state[it.id] = {
        qty: balance > 0 ? String(balance) : '',
        lot: generateLotNumber(),
        expiry: '',
      };
    });
    setConfirmState(state);
    setConfirmReceiverName(fmsUser?.name || '');
    setConfirmCoaContent('');
    setConfirmQualityChecks({
      coa_received: false,
      vehicle_clean: false,
      no_foreign_odours: false,
      no_pest_activity: false,
      packaging_intact: false,
      correct_labelling: false,
      organoleptic_ok: false,
    });
    setConfirmOrder(order);
  };

  // Open confirmation dialog for an emailed order
  const openEmailOrderConfirmDialog = (emailOrder: typeof supplierOrderEmails[0]) => {
    const sc = getStockCode(emailOrder.stock_code_id);
    const supplier = getSupplier(emailOrder.supplier_id);

    // Auto-pull existing supplier price
    const priceMatch = supplierPrices.find(
      p => p.stock_code_id === emailOrder.stock_code_id && p.supplier_id === emailOrder.supplier_id
    );

    setEmailOrderFormData({
      internal_lot_number: generateLotNumber(),
      date_received: new Date().toISOString().split('T')[0],
      stock_code_id: emailOrder.stock_code_id,
      stock_code: sc?.stock_code || '',
      material_description: sc?.description || '',
      quantity_received: String(emailOrder.quantity),
      actual_quantity: String(emailOrder.quantity), // Pre-fill with ordered quantity
      uom: sc?.unit_of_measure || 'kg',
      supplier_id: emailOrder.supplier_id,
      supplier_name: supplier?.name || '',
      supplier_batch_number: '',
      production_date: '',
      expiry_date: '',
      invoice_number: '',
      receiver_name: fmsUser?.name || '', // Pre-populate with logged-in user
      notes: emailOrder.notes || '',
      coa_content: '',
      cost_price_per_kg: priceMatch ? String(priceMatch.cost_price_per_kg) : '',
      quality_checks: {
        coa_received: false,
        vehicle_clean: false,
        no_foreign_odours: false,
        no_pest_activity: false,
        packaging_intact: false,
        correct_labelling: false,
        organoleptic_ok: false,
      },
    });

    setConfirmingEmailOrder(emailOrder);
  };
 
const handleSelectAllQualityChecks = () => {
  setFormData((prev) => ({
    ...prev,
    quality_checks: {
      coa_received: true,
      vehicle_clean: true,
      no_foreign_odours: true,
      no_pest_activity: true,
      packaging_intact: true,
      correct_labelling: true,
      organoleptic_ok: true,
    },
  }));
};



  // Reset email order form
  const resetEmailOrderForm = () => {
    setEmailOrderFormData({
      internal_lot_number: generateLotNumber(),
      date_received: new Date().toISOString().split('T')[0],
      stock_code_id: '',
      stock_code: '',
      material_description: '',
      quantity_received: '',
      actual_quantity: '',
      uom: 'kg',
      supplier_id: '',
      supplier_name: '',
      supplier_batch_number: '',
      production_date: '',
      expiry_date: '',
      invoice_number: '',
      receiver_name: '',
      notes: '',
      coa_content: '',
      cost_price_per_kg: '',
      quality_checks: {
        coa_received: false,
        vehicle_clean: false,
        no_foreign_odours: false,
        no_pest_activity: false,
        packaging_intact: false,
        correct_labelling: false,
        organoleptic_ok: false,
      },
    });
    setConfirmingEmailOrder(null);
  };

  const handleConfirmReceipt = async () => {
  if (!confirmOrder) return;

  const toReceive = confirmOrder.items.filter(
    it => parseFloat(confirmState[it.id]?.qty || '') > 0
  );

  const skipped = confirmOrder.items.filter(
    it => !toReceive.includes(it)
  );

  // Validate items being received
  for (const it of toReceive) {
    const name =
      getStockCode(it.stock_code_id)?.description || 'item';

    const state = confirmState[it.id];

    if (!(parseFloat(state?.qty || '') > 0)) {
      toast.error(`Enter the quantity received for ${name}`);
      return;
    }

    if (!state?.lot || state.lot.trim().length < 5) {
      toast.error(
        `Enter a LOT number for ${name} (required for traceability)`
      );
      return;
    }

    if (!state?.expiry) {
      toast.error(
        `Enter an expiry date for ${name} (required for traceability)`
      );
      return;
    }

    if (
      new Date(state.expiry) <
      new Date(new Date().toDateString())
    ) {
      toast.error(`Expiry date for ${name} cannot be in the past`);
      return;
    }
  }

  setConfirmingReceipt(true);

  try {
    // Build quality checks (same as receiving log)
    const qualityChecks = {
      vehicle_clean: confirmQualityChecks.vehicle_clean ? 'pass' : 'fail',
      no_foreign_odours: confirmQualityChecks.no_foreign_odours ? 'pass' : 'fail',
      no_pest_activity: confirmQualityChecks.no_pest_activity ? 'pass' : 'fail',
      packaging_intact: confirmQualityChecks.packaging_intact ? 'pass' : 'fail',
      correct_labelling: confirmQualityChecks.correct_labelling ? 'pass' : 'fail',
      organoleptic_ok: confirmQualityChecks.organoleptic_ok ? 'pass' : 'fail',
      coa_received: confirmQualityChecks.coa_received ? 'pass' : 'fail',
      coa_content: confirmCoaContent || '', // Store COA/COC text content
      receiver_name: confirmReceiverName || fmsUser?.name || '',
      received_from_order: true,
      po_number: confirmOrder.po_number,
    };

    // COA/COC is optional and does not cause rejection
    const hasFailed = Object.entries(qualityChecks).some(([k, v]) => !['coa_content', 'coa_received', 'receiver_name', 'received_from_order', 'po_number'].includes(k) && v === 'fail');

    let allOk = true;

    const receivedNow = new Map<string, number>();

    for (const it of toReceive) {
      const state = confirmState[it.id];
      const qty = parseFloat(state.qty);
      const lotNumber = state.lot.trim();

      // Save the receiving record
      const result = await addReceivingRecord({
        internal_lot_number: lotNumber,
        received_at: new Date().toISOString(),
        stock_code_id: it.stock_code_id,
        quantity_received: qty,
        supplier_id: confirmOrder.supplier_id,
        supplier_batch_number:
          confirmOrder.invoice_number || confirmOrder.po_number,
        expiry_date: state.expiry,
        quality_checks: qualityChecks,
        status: hasFailed ? 'declined' : 'accepted',
        rejection_reason: hasFailed ? 'Quality check failed' : undefined,
        received_by: user?.id || '',
      } as any);

      if (!result) {
        allOk = false;
        continue;
      }

      // Add received quantity to stock (only for accepted receipts)
      if (!hasFailed) {
        await addStockForReceipt(
          it.stock_code_id,
          qty,
          lotNumber,
          `Receipt ${lotNumber} - ${
            getStockCode(it.stock_code_id)?.description || ''
          } (${confirmOrder.po_number})`
        );
      }

      // Calculate total received for this item
      const newQuantityReceived =
        Number(it.quantity_received ?? 0) + qty;

      // IMPORTANT:
      // Only update columns that actually exist in the database.
      const { error: itemError } = await (
        supabase.from('fms_stock_order_items' as any) as any
      )
        .update({
          quantity_received: newQuantityReceived,
        })
        .eq('id', it.id);

      if (itemError) {
        console.error(itemError);

        toast.error(
          `Failed to save received quantity: ${itemError.message}`
        );

        allOk = false;
      } else {
        receivedNow.set(it.id, qty);
      }
    }

    // Get the latest quantities directly from the database
    const {
      data: freshItems,
      error: refetchError,
    } = await (
      supabase.from('fms_stock_order_items' as any) as any
    )
      .select('id, quantity_ordered, quantity_received')
      .eq('order_id', confirmOrder.id);

    if (refetchError) {
      console.error(refetchError);

      toast.error(
        `Could not re-read order items: ${refetchError.message}`
      );
    }

    let outstanding = 0;

    if (freshItems && freshItems.length > 0) {
      outstanding = (freshItems as any[]).filter(
        row =>
          Number(row.quantity_received ?? 0) <
          Number(row.quantity_ordered ?? 0)
      ).length;
    } else {
      // Fallback if database re-read fails
      outstanding = confirmOrder.items.filter(it => {
        const receivedQty =
          Number(it.quantity_received ?? 0) +
          (receivedNow.get(it.id) ?? 0);

        return (
          receivedQty <
          Number(it.quantity_ordered ?? 0)
        );
      }).length;
    }

    // Determine ORDER status
    const newStatus =
      outstanding === 0
        ? 'CHECKED'
        : 'PARTIALLY_RECEIVED';

    // Update the stock order
    const {
      error: orderError,
    } = await (
      supabase.from('fms_stock_orders' as any) as any
    )
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', confirmOrder.id);

    if (orderError) {
      console.error(orderError);

      toast.error(
        `Failed to update order status: ${orderError.message}`
      );

      allOk = false;
    }

    if (allOk) {
      logActivity({
        action_type: 'update',
        entity_type: 'stock_order',
        entity_id: confirmOrder.po_number,
        entity_name: confirmOrder.po_number,
        details: {
          confirmed_items: toReceive.length,
          skipped_items: skipped.length,
          status: newStatus,
        },
      });

      toast.success(
        newStatus === 'CHECKED'
          ? 'Stock confirmed — Order is COMPLETE.'
          : `Stock confirmed — Order is PARTIALLY RECEIVED. ${outstanding} item(s) still outstanding.`
      );

      setConfirmOrder(null);

      await refreshData();
    } else {
      toast.error(
        'Some receiving information could not be saved. Please check the error above.'
      );
    }
  } finally {
    setConfirmingReceipt(false);
  }
};

  // Confirm receipt for an emailed order - same process as receiving log
  const handleConfirmEmailOrderReceipt = async () => {
    if (!confirmingEmailOrder) return;

    // Validate required fields (same as receiving log)
    if (!emailOrderFormData.stock_code_id || !emailOrderFormData.supplier_id || !emailOrderFormData.quantity_received) {
      toast.error('Please fill in Stock Code, Supplier, and Quantity');
      return;
    }

    // Expiry date is required
    if (!emailOrderFormData.expiry_date) {
      toast.error('Expiry date is required');
      return;
    }
    if (new Date(emailOrderFormData.expiry_date) < new Date()) {
      toast.error('Cannot receive expired materials');
      return;
    }

    // Build quality checks (same as receiving log)
    const qualityChecks = {
      vehicle_clean: emailOrderFormData.quality_checks.vehicle_clean ? 'pass' : 'fail',
      no_foreign_odours: emailOrderFormData.quality_checks.no_foreign_odours ? 'pass' : 'fail',
      no_pest_activity: emailOrderFormData.quality_checks.no_pest_activity ? 'pass' : 'fail',
      packaging_intact: emailOrderFormData.quality_checks.packaging_intact ? 'pass' : 'fail',
      correct_labelling: emailOrderFormData.quality_checks.correct_labelling ? 'pass' : 'fail',
      organoleptic_ok: emailOrderFormData.quality_checks.organoleptic_ok ? 'pass' : 'fail',
      coa_received: emailOrderFormData.quality_checks.coa_received ? 'pass' : 'fail',
      coa_content: emailOrderFormData.coa_content || '',
      notes: emailOrderFormData.notes,
      email_order_id: confirmingEmailOrder.id,
    };

    // COA/COC is optional and does not cause rejection
    const hasFailed = Object.entries(qualityChecks).some(([k, v]) => k !== 'coa_content' && k !== 'coa_received' && k !== 'notes' && k !== 'email_order_id' && v === 'fail');

    const costNum = emailOrderFormData.cost_price_per_kg ? parseFloat(emailOrderFormData.cost_price_per_kg) : null;

    // Use actual_quantity if provided, otherwise fall back to quantity_received
    const actualQty = emailOrderFormData.actual_quantity ? parseFloat(emailOrderFormData.actual_quantity) : parseFloat(emailOrderFormData.quantity_received);

    setConfirmingEmailReceipt(true);

    try {
      const result = await addReceivingRecord({
        internal_lot_number: emailOrderFormData.internal_lot_number,
        received_at: new Date(emailOrderFormData.date_received).toISOString(),
        stock_code_id: emailOrderFormData.stock_code_id,
        quantity_received: actualQty, // Use actual quantity received
        supplier_id: emailOrderFormData.supplier_id,
        supplier_batch_number: emailOrderFormData.supplier_batch_number,
        manufacturing_date: emailOrderFormData.production_date || undefined,
        expiry_date: emailOrderFormData.expiry_date || null,
        delivery_note_number: emailOrderFormData.invoice_number || undefined,
        quality_checks: qualityChecks,
        status: hasFailed ? 'declined' : 'accepted',
        rejection_reason: hasFailed ? 'Quality check failed' : undefined,
        received_by: user?.id || '',
        cost_price_per_kg: costNum != null && !isNaN(costNum) ? costNum : null,
      } as any);

      if (!result) {
        toast.error('Failed to save receiving record');
        return;
      }

      // Add stock to inventory for accepted receipts
      if (!hasFailed) {
        const newQty = await addStockForReceipt(
          emailOrderFormData.stock_code_id,
          actualQty, // Use actual quantity received
          emailOrderFormData.internal_lot_number,
          `Receipt ${emailOrderFormData.internal_lot_number} - ${emailOrderFormData.material_description} (Email Order)`
        );
        if (newQty === null) {
          console.warn('[FMS] Failed to update stock level for email order receipt', emailOrderFormData.internal_lot_number);
        }
      }

      // Sync cost price back to supplier_material_prices
      if (costNum != null && !isNaN(costNum) && costNum >= 0) {
        const existing = supplierPrices.find(
          p => p.stock_code_id === emailOrderFormData.stock_code_id && p.supplier_id === emailOrderFormData.supplier_id
        );
        if (existing) {
          if (Number(existing.cost_price_per_kg) !== costNum) {
            await (supabase.from('fms_supplier_material_prices' as any) as any)
              .update({ cost_price_per_kg: costNum, updated_by: user?.id })
              .eq('id', existing.id);
          }
        } else {
          await (supabase.from('fms_supplier_material_prices' as any) as any)
            .insert({
              supplier_id: emailOrderFormData.supplier_id,
              stock_code_id: emailOrderFormData.stock_code_id,
              cost_price_per_kg: costNum,
              created_by: user?.id,
            });
        }
      }

      // Update the email order status to received
      await updateSupplierOrderEmailStatus(confirmingEmailOrder.id, 'received');

      // Log activity
      const failedChecks = Object.entries(qualityChecks)
        .filter(([_, v]) => v !== 'pass')
        .map(([k]) => k.replace(/_/g, ' '));

      logActivity({
        action_type: 'create',
        entity_type: 'receiving',
        entity_id: emailOrderFormData.internal_lot_number,
        entity_name: emailOrderFormData.material_description,
        details: {
          lot_number: emailOrderFormData.internal_lot_number,
          stock_code: emailOrderFormData.stock_code,
          supplier: emailOrderFormData.supplier_name,
          quantity_ordered: `${emailOrderFormData.quantity_received} ${emailOrderFormData.uom}`,
          quantity_received: `${actualQty} ${emailOrderFormData.uom}`,
          supplier_batch: emailOrderFormData.supplier_batch_number,
          status: hasFailed ? 'declined' : 'accepted',
          failed_checks: failedChecks.length > 0 ? failedChecks : undefined,
          receiver: emailOrderFormData.receiver_name,
          cost_price_per_kg: costNum,
          from_email_order: true,
        },
      });

      toast.success(`Material ${hasFailed ? 'declined' : 'received'} successfully`);
      resetEmailOrderForm();
      await refreshData();
    } catch (error: any) {
      console.error('Error confirming email order receipt:', error);
      toast.error(error?.message || 'Failed to confirm receipt');
    } finally {
      setConfirmingEmailReceipt(false);
    }
  };

const filteredRecords = receivingRecords.filter(rec => {
  const stockCode = getStockCode(rec.stock_code_id);

  return (
    (rec.internal_lot_number ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (rec.supplier_batch_number ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (stockCode?.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );
});

  const handleViewRecord = (record: typeof receivingRecords[0]) => {
    setSelectedRecord(record);
    const qc = (record.quality_checks || {}) as any;
    setEditCoaContent(qc.coa_content || '');
    const cp = (record as any).cost_price_per_kg;
    setEditCostPrice(cp != null ? String(cp) : '');
    setViewDialogOpen(true);
  };

  const handleSaveCostPrice = async () => {
    if (!selectedRecord) return;
    const costNum = editCostPrice ? parseFloat(editCostPrice) : null;
    if (editCostPrice && (isNaN(costNum as number) || (costNum as number) < 0)) {
      toast.error('Enter a valid non-negative price');
      return;
    }
    setSavingCost(true);
    const { error } = await (supabase.from('fms_receiving') as any)
      .update({ cost_price_per_kg: costNum })
      .eq('id', selectedRecord.id);
    if (error) {
      setSavingCost(false);
      toast.error('Failed to update cost price');
      return;
    }
    // Sync back to supplier_material_prices
    if (costNum != null) {
      const existing = supplierPrices.find(
        p => p.stock_code_id === selectedRecord.stock_code_id && p.supplier_id === selectedRecord.supplier_id
      );
      if (existing) {
        if (Number(existing.cost_price_per_kg) !== costNum) {
          await (supabase.from('fms_supplier_material_prices' as any) as any)
            .update({ cost_price_per_kg: costNum, updated_by: user?.id })
            .eq('id', existing.id);
        }
      } else {
        await (supabase.from('fms_supplier_material_prices' as any) as any)
          .insert({
            supplier_id: selectedRecord.supplier_id,
            stock_code_id: selectedRecord.stock_code_id,
            cost_price_per_kg: costNum,
            currency: 'ZAR',
            updated_by: user?.id,
          });
      }
      await refreshPrices(true);
    }
    setSavingCost(false);
    toast.success('Cost price updated and synced to suppliers');
    logActivity({
      action_type: 'update',
      entity_type: 'receiving',
      entity_id: selectedRecord.internal_lot_number,
      entity_name: 'Cost price',
      details: { lot_number: selectedRecord.internal_lot_number, cost_price_per_kg: costNum },
    });
    await refreshData();
    setSelectedRecord({ ...selectedRecord, cost_price_per_kg: costNum } as any);
  };

  const handleSaveCoa = async () => {
    if (!selectedRecord) return;
    setSavingCoa(true);
    const existing = (selectedRecord.quality_checks || {}) as any;
    const updated = {
      ...existing,
      coa_content: editCoaContent,
      coa_received: editCoaContent.trim().length > 0 ? 'pass' : (existing.coa_received || 'fail'),
    };
    const { error } = await supabase
      .from('fms_receiving')
      .update({ quality_checks: updated })
      .eq('id', selectedRecord.id);
    setSavingCoa(false);
    if (error) {
      toast.error('Failed to update COA/COC');
      return;
    }
    toast.success('COA/COC updated');
    logActivity({
      action_type: 'update',
      entity_type: 'receiving',
      entity_id: selectedRecord.internal_lot_number,
      entity_name: 'COA/COC content',
      details: { lot_number: selectedRecord.internal_lot_number },
    });
    await refreshData();
    setSelectedRecord({ ...selectedRecord, quality_checks: updated });
  };


  const handlePrintQRCode = async (record: typeof receivingRecords[0]) => {
    const stockCode = getStockCode(record.stock_code_id);
    const supplier = getSupplier(record.supplier_id);
    
    const { qr1, qr2 } = await generateQRCodePair(record.internal_lot_number, {
      type: 'receiving',
      receivingId: record.id,
      lotNumber: record.internal_lot_number,
      stockCode: stockCode?.stock_code,
      stockCodeId: record.stock_code_id,
      materialDescription: stockCode?.description,
      supplierBatch: record.supplier_batch_number,
      supplierName: supplier?.name,
      expiryDate: record.expiry_date || '',
      quantity: record.quantity_received,
    });
    
    printQRCodes(qr1, qr2, record.internal_lot_number, {
      product: stockCode?.description,
      date: formatDate(record.received_at || record.created_at || new Date().toISOString()),
    });
    toast.success('QR codes generated');
  };

  const handleDownloadQRCode = async (record: typeof receivingRecords[0]) => {
    const stockCode = getStockCode(record.stock_code_id);
    const qrDataUrl = await generateQRCodeImage(JSON.stringify({
      lot: record.internal_lot_number,
      stockCode: stockCode?.stock_code,
      material: stockCode?.description,
    }));
    
    await downloadQRCodeWithLabel(
      qrDataUrl, 
      `QR_${record.internal_lot_number}`, 
      record.internal_lot_number
    );
    toast.success('QR code downloaded');
  };

  const handleQRScan = (result: string) => {
    const parsed = extractBestScanIdentifier(result);
    setSearchQuery(parsed);
    toast.success(`Search updated with: ${parsed}`);
  };

  const handleDeleteReceiving = async (id: string) => {
    const record = receivingRecords.find(r => r.id === id);
    const stockCode = record ? getStockCode(record.stock_code_id) : null;
    const supplier = record ? getSupplier(record.supplier_id) : null;
    
    const { error } = await supabase.from('fms_receiving').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete receiving record');
      return;
    }
    
    logActivity({
      action_type: 'delete',
      entity_type: 'receiving',
      entity_id: record?.internal_lot_number || id,
      entity_name: stockCode?.description || 'Unknown material',
      details: {
        lot_number: record?.internal_lot_number,
        stock_code: stockCode?.stock_code,
        supplier: supplier?.name,
        quantity: record?.quantity_received,
      },
    });
    
    toast.success('Receiving record deleted successfully');
    await refreshData();
  };
  
//export PDF function 
  const handleExportPDF = () => {
    const recordsToExport = getExportFilteredRecords();
    
    if (recordsToExport.length === 0 ) {
      toast.error('No receiving records match the selected filters');
      return;
    }

    const data = recordsToExport.map(rec => {
      const stockCode = getStockCode(rec.stock_code_id);
      const supplier = getSupplier(rec.supplier_id);

      return {
        'Lot Number': rec.internal_lot_number,
        'Date': formatDate(rec.received_at || rec.created_at || '' ),
        'Stock Code': stockCode?.stock_code ||'' ,
        'Description': stockCode?.description || '',
        'Qty': rec.quantity_received,
        'Supplier': supplier?.name || '',
        'Batch No': rec.supplier_batch_number,
        'Expiry': rec.expiry_date ? formatDate(rec.expiry_date) : '',
        'Status': rec.status
      };
    });

    exportToPDF(data, 'Receiving_Log');

    toast.success(
      `PDF exported successfully - ${recordsToExport.length} record(s)`
    );
  };
//export excel function
  const handleExportExcel =() => {
    const recordsToExport = getExportFilteredRecords();

    if (recordsToExport.length === 0) {
      toast.error('No receiving records match the selected filters')
    }

    const data = recordsToExport.map(rec => {
      const stockCode = getStockCode(rec.stock_code_id);
      const supplier = getSupplier(rec.supplier_id);

      return {
        'Internal Lot Number': rec.internal_lot_number,
        'Date Received': formatDateTime(
          rec.received_at || rec.created_at || ''
        ),
          'Stock Code': stockCode?.stock_code || '',
          'Material Description': stockCode?.description || '',
          'Quantity Received': rec.quantity_received,
          'UOM': stockCode?.unit_of_measure || '',
          'Supplier Name': supplier?.name || '',
          'Batch Number': rec.supplier_batch_number,
          'Production Date': rec.manufacturing_date
            ? formatDate(rec.manufacturing_date)
            : '',
          'Expiry Date': rec.expiry_date
            ? formatDate(rec.expiry_date)
            : '',
          'Invoice Number': rec.delivery_note_number || '',
          'Status': rec.status,
        };
      });

      exportToExcel(data, 'Receiving_Log');

      toast.success(
        `Excel exported successfully — ${recordsToExport.length} record(s)`
      );
    };
            
  

const handleCreateOrder = async () => {
  if (!orderFormData.supplier_id) {
    toast.error('Select a supplier');
    return;
  }

  const validItems = orderItems
    .map((item) => ({
      ...item,
      qty: Number(item.quantity_ordered),
    }))
    .filter(
      (item) =>
        Number.isFinite(item.qty) &&
        item.qty > 0
    );

  if (validItems.length === 0) {
    toast.error(
      'Enter a quantity for at least one order item.'
    );
    return;
  }

  setSavingOrder(true);

  try {
    let invoiceFilePath: string | null = null;

    if (invoiceFile) {
      const safeFileName = invoiceFile.name.replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      );

      const filePath = `${orderFormData.po_number}/${Date.now()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('order-documents')
        .upload(filePath, invoiceFile, {
          contentType:
            invoiceFile.type ||
            'application/octet-stream',
        });

      if (uploadError) {
        console.error(
          'Invoice upload error:',
          uploadError
        );

        toast.warning(
          `Invoice file could not be uploaded (${uploadError.message}). Creating the order without it.`
        );
      } else {
        invoiceFilePath = filePath;
      }
    }

    const ok = await createStockOrder(
      {
        po_number: orderFormData.po_number.trim(),
        supplier_id: orderFormData.supplier_id,
        invoice_number:
          orderFormData.invoice_number || undefined,
        invoice_file_path: invoiceFilePath,
        order_date: orderFormData.order_date,
        notes:
          orderFormData.notes || undefined,
      },
      validItems.map((item) => ({
        stock_code_id: item.stock_code_id,
        quantity_ordered: item.qty,
        uom: item.uom,
      }))
    );

    if (ok) {
      setOrderDialogOpen(false);
      resetOrderForm();
    }
  } catch (error) {
    console.error(
      'Create stock order error:',
      error
    );

    toast.error(
      error instanceof Error
        ? error.message
        : 'Failed to create stock order.'
    );
  } finally {
    setSavingOrder(false);
  }
};

const getExportFilteredRecords = () => {
  return receivingRecords.filter((rec) => {
    const receivedDate = rec.received_at || rec.created_at || '';

    // Date From
    if (exportFilters.dateFrom) {
      const recordDate = new Date(receivedDate);
      const fromDate = new Date(exportFilters.dateFrom);
      fromDate.setHours(0, 0, 0, 0);

      if (recordDate < fromDate) {
        return false;
      }
    }

    // Date To
    if (exportFilters.dateTo) {
      const recordDate = new Date(receivedDate);
      const toDate = new Date(exportFilters.dateTo);
      toDate.setHours(23, 59, 59, 999);

      if (recordDate > toDate) {
        return false;
      }
    }

    // Supplier
    if (
      exportFilters.supplierId !== 'all' &&
      rec.supplier_id !== exportFilters.supplierId
    ) {
      return false;
    }

    // Stock Code
    if (
      exportFilters.stockCodeId !== 'all' &&
      rec.stock_code_id !== exportFilters.stockCodeId
    ) {
      return false;
    }

    // Status
    if (
      exportFilters.status !== 'all' &&
      rec.status !== exportFilters.status
    ) {
      return false;
    }

    // LOT Number
    if (exportFilters.lotNumber.trim()) {
      const searchLot = exportFilters.lotNumber
        .trim()
        .toLowerCase();

      if (
        !rec.internal_lot_number
          ?.toLowerCase()
          .includes(searchLot)
      ) {
        return false;
      }
    }

    return true;
  });
};
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in px-2 sm:px-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Doc No: MS Q004 LOG 1 | Version: 4</div>
          <p className="text-muted-foreground text-sm sm:text-base">{receivingRecords.length} receiving records in database</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QRScanner 
            onScanResult={handleQRScan}
            triggerButton={
              <Button variant="outline" size="sm" className="gap-2">
                <Camera className="h-4 w-4" />
                <span className="hidden sm:inline">Scan QR</span>
              </Button>
            }
          />

<Dialog
  open={showExportDialog}
  onOpenChange={setShowExportDialog}
>
  <DialogTrigger asChild>
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">Export</span>
    </Button>
  </DialogTrigger>

  <DialogContent className="sm:max-w-[600px]">
    <DialogHeader>
      <DialogTitle>Export Receiving Log</DialogTitle>
      <DialogDescription>
        Select the filters you want to apply before exporting.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4 py-4">

      {/* Date Range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div className="space-y-2">
          <Label>Date From</Label>
          <Input
            type="date"
            value={exportFilters.dateFrom}
            onChange={(e) =>
              setExportFilters((prev) => ({
                ...prev,
                dateFrom: e.target.value,
              }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Date To</Label>
          <Input
            type="date"
            value={exportFilters.dateTo}
            onChange={(e) =>
              setExportFilters((prev) => ({
                ...prev,
                dateTo: e.target.value,
              }))
            }
          />
        </div>

      </div>

      {/* Supplier */}
      <div className="space-y-2">
        <Label>Supplier</Label>

        <Select
          value={exportFilters.supplierId}
          onValueChange={(value) =>
            setExportFilters((prev) => ({
              ...prev,
              supplierId: value,
            }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select supplier" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">
              All Suppliers
            </SelectItem>

            {suppliers.map((supplier) => (
              <SelectItem
                key={supplier.id}
                value={supplier.id}
              >
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stock Code */}
      <div className="space-y-2">
        <Label>Stock Code</Label>

        <Select
          value={exportFilters.stockCodeId}
          onValueChange={(value) =>
            setExportFilters((prev) => ({
              ...prev,
              stockCodeId: value,
            }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select stock code" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">
              All Stock Codes
            </SelectItem>

            {stockCodes.map((stockCode) => (
              <SelectItem
                key={stockCode.id}
                value={stockCode.id}
              >
                {stockCode.stock_code} - {stockCode.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label>Status</Label>

        <Select
          value={exportFilters.status}
          onValueChange={(value) =>
            setExportFilters((prev) => ({
              ...prev,
              status: value,
            }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">
              All Statuses
            </SelectItem>

            <SelectItem value="PENDING_RECEIPT">
              Pending Receipt
            </SelectItem>

            <SelectItem value="PARTIALLY_RECEIVED">
              Partially Received
            </SelectItem>

            <SelectItem value="CHECKED">
              Checked
            </SelectItem>

            <SelectItem value="CANCELLED">
              Cancelled
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* LOT Number */}
      <div className="space-y-2">
        <Label>LOT Number</Label>

        <Input
          placeholder="Search by LOT number..."
          value={exportFilters.lotNumber}
          onChange={(e) =>
            setExportFilters((prev) => ({
              ...prev,
              lotNumber: e.target.value,
            }))
          }
        />
      </div>

    </div>

    {/* Footer */}
    <DialogFooter className="flex-col sm:flex-row gap-2">

      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setExportFilters({
            dateFrom: '',
            dateTo: '',
            supplierId: 'all',
            stockCodeId: 'all',
            status: 'all',
            lotNumber: '',
          });
        }}
      >
        Clear Filters
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={() => {
          handleExportPDF();
          setShowExportDialog(false);
        }}
      >
        <FileText className="h-4 w-4 mr-2" />
        Export PDF
      </Button>

      <Button
        type="button"
        onClick={() => {
          handleExportExcel();
          setShowExportDialog(false);
        }}
      >
        <FileText className="h-4 w-4 mr-2" />
        Export Excel
      </Button>

    </DialogFooter>

  </DialogContent>
</Dialog>


<Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Upload Invoice</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
              <DialogHeader>
                <DialogTitle>Upload Order / Invoice</DialogTitle>
                <DialogDescription>Capture the order you placed. When the stock arrives, confirm receipt against this order.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h3 className="font-semibold mb-4 text-primary">ORDER DETAILS</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>PO Number *</Label>
                      <Input value={orderFormData.po_number} onChange={(e) => setOrderFormData(prev => ({ ...prev, po_number: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Order Date</Label>
                      <Input type="date" value={orderFormData.order_date} onChange={(e) => setOrderFormData(prev => ({ ...prev, order_date: e.target.value }))} />
                    </div>
                    <div className="space-y-2 relative">
                      <Label>Supplier *</Label>
                      <Input
                        value={orderSupplierSearch}
                        onChange={(e) => { setOrderSupplierSearch(e.target.value); setShowOrderSupplierDropdown(true); }}
                        placeholder={orderFormData.supplier_name || 'Type to search suppliers...'}
                        onFocus={() => setShowOrderSupplierDropdown(true)}
                        onBlur={() => setTimeout(() => setShowOrderSupplierDropdown(false), 200)}
                      />
                      {showOrderSupplierDropdown && orderSupplierSearch.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                          {supplierResults.filter(s =>
                              (s.name ?? '').toLowerCase().includes(orderSupplierSearch.toLowerCase()) ||
                              (s.code ?? '').toLowerCase().includes(orderSupplierSearch.toLowerCase())
                            ).map(s => (
                            <div key={s.id} className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                              onClick={() => {
                                setOrderFormData(prev => ({ ...prev, supplier_id: s.id, supplier_name: s.name }));
                                setOrderSupplierSearch('');
                                setShowOrderSupplierDropdown(false);
                              }}>
                              <span className="font-medium">{s.name}</span> ({s.code})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Invoice Number</Label>
                      <Input value={orderFormData.invoice_number} onChange={(e) => setOrderFormData(prev => ({ ...prev, invoice_number: e.target.value }))} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Upload Invoice (auto-fills line items)</Label>
                      {invoiceFile ? (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="flex-1 truncate">{invoiceFile.name}</span>
                          <Button variant="ghost" size="sm" onClick={() => { setInvoiceFile(null); setParseStatus(null); }}><X className="h-4 w-4" /></Button>
                        </div>
                      ) : (
                        <Input
                          type="file"
                          accept=".pdf,.csv,.xlsx,.xls,.txt,image/*"
                          disabled={parsingInvoice}
                          onChange={(e) => handleInvoiceFileChange(e.target.files?.[0] || null)}
                        />
                      )}
                      {parsingInvoice && (
                        <p className="text-sm text-primary flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Reading invoice and matching line items...
                        </p>
                      )}
                      {!parsingInvoice && parseStatus && (
                        <p className={`text-xs ${parseStatus.matched > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                          Parsed {parseStatus.found} line item(s) from the document — {parseStatus.matched} matched your stock codes.
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Upload a PDF/CSV/Excel invoice and its line items will fill the table below automatically. All items must be present in the invoice — items cannot be added manually. Stored privately in the order-documents bucket.
                      </p>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Notes</Label>
                      <Textarea rows={2} value={orderFormData.notes} onChange={(e) => setOrderFormData(prev => ({ ...prev, notes: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h3 className="font-semibold mb-4 text-primary">INVOICE LINE ITEMS ({orderItems.length})</h3>
                  <p className="text-xs text-muted-foreground mb-2">Read directly from the uploaded invoice — these details cannot be edited.</p>
                  {orderItems.length === 0 && (
                    <p className="text-sm text-muted-foreground">No line items yet — upload an invoice above to populate this list.</p>
                  )}
                  {orderItems.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">#</th>
                            <th className="px-3 py-2 text-left font-medium">Material</th>
                            <th className="px-3 py-2 text-right font-medium">Invoice Qty (kg)</th>
                            <th className="px-3 py-2 text-left font-medium">UOM</th>
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {orderItems.map((item, idx) => (
                            <tr key={`${item.stock_code_id}-${idx}`} className="border-t">
                              <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                              <td className="px-3 py-2 font-medium">{item.stock_code} - {item.description}</td>
                              <td className="px-3 py-2 text-right">{item.quantity_ordered}</td>
                              <td className="px-3 py-2 text-muted-foreground">{item.uom}</td>
                              <td className="px-3 py-2 text-right">
                                <Button variant="ghost" size="sm" onClick={() => setOrderItems(prev => prev.filter((_, i) => i !== idx))}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setOrderDialogOpen(false); resetOrderForm(); }}>Cancel</Button>
                <Button onClick={handleCreateOrder} disabled={savingOrder} className="gap-2">
                  {savingOrder && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Order
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
           
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Receiving</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[900px]">
              <DialogHeader>
                <DialogTitle>Receiving Log Entry</DialogTitle>
                <DialogDescription>RECEIVING LOG BOOK - NGUNI FACTORY</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h3 className="font-semibold mb-4 text-primary">GENERAL INFORMATION</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Internal Lot Number</Label>
                      <Input value={formData.internal_lot_number} readOnly disabled className="bg-muted cursor-not-allowed" />
                    </div>
                    <div className="space-y-2">
                      <Label>Date Received</Label>
                      <Input type="date" value={formData.date_received} onChange={(e) => setFormData(prev => ({ ...prev, date_received: e.target.value, production_date: e.target.value || prev.production_date }))} />
                    </div>
                    <div className="col-span-1 sm:col-span-2 space-y-2 relative">
                      <Label>Stock Code *</Label>
                      <Input
                        value={stockCodeSearch}

                        defaultValue={stockCodeSearch}
                        onChange={(e) => {
                          const value = e.target.value;
                          setStockCodeSearch(value);
                          setShowStockCodeDropdown(true);
                          
                          const exact = stockCodes.find(sc => sc.stock_code.toLowerCase() === value.trim().toLowerCase());
                          if (exact) handleStockCodeSelect(exact);
                        }}
                        placeholder="Start typing to search..."
                        onFocus={() => stockCodeSearch.length > 0 && setShowStockCodeDropdown(true)}
                      />
                      {showStockCodeDropdown && stockCodeResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                          {stockCodeResults.map((item) => (
                            <div key={item.id} className="px-3 py-2 hover:bg-accent cursor-pointer text-sm" onClick={() => handleStockCodeSelect(item)}>
                              <span className="font-medium">{item.stock_code}</span> - {item.description}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="col-span-1 sm:col-span-2 space-y-2">
                      <Label>Material Description</Label>
                      <Input value={formData.material_description} readOnly placeholder="Auto-filled from stock code" />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity Received *</Label>
                      <Input type="number" value={formData.quantity_received} onChange={(e) => setFormData(prev => ({ ...prev, quantity_received: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>UOM</Label>
                      <Input value={formData.uom} readOnly />
                    </div>
                    
                    <div className="col-span-1 sm:col-span-2 space-y-2 relative">
                      <Label>Supplier *</Label>
                      <Input
                        value={supplierSearch}
                        onChange={(e) => { setSupplierSearch(e.target.value); setShowSupplierDropdown(true); }}
                        placeholder="Type to search suppliers..."
                        onFocus={() => setShowSupplierDropdown(true)}
                        onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 200)}
                      />
                      {showSupplierDropdown && supplierSearch.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                          {supplierResults.filter(s => 
                            s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                            s.code.toLowerCase().includes(supplierSearch.toLowerCase())
                          ).map(s => (
                            <div key={s.id} className="px-3 py-2 hover:bg-accent cursor-pointer text-sm" onClick={() => handleSupplierSelect(s)}>
                              <span className="font-medium">{s.name}</span> ({s.code})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Batch Number</Label>
                      <Input value={formData.supplier_batch_number} onChange={(e) => setFormData(prev => ({ ...prev, supplier_batch_number: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Cost Price / kg (ZAR)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.cost_price_per_kg}
                        onChange={(e) => setFormData(prev => ({ ...prev, cost_price_per_kg: e.target.value }))}
                        placeholder={formData.stock_code_id && formData.supplier_id ? 'Auto-pulled, editable' : 'Select stock code & supplier'}
                      />
                      <p className="text-xs text-muted-foreground">Saving will update this supplier's price across the system.</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Production Date</Label>
                      <Input type="date" value={formData.production_date} onChange={(e) => setFormData(prev => ({ ...prev, production_date: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Expiry Date (Optional)</Label>
                      <Input type="date" value={formData.expiry_date} onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Invoice/DN Number</Label>
                      <Input value={formData.invoice_number} onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Receiver's Name</Label>
                      <Input value={formData.receiver_name} onChange={(e) => setFormData(prev => ({ ...prev, receiver_name: e.target.value }))} placeholder="Enter receiver's name" />
                    </div>
                  </div>
                </div>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h3 className="font-semibold mb-4 text-primary">QUALITY CHECKS</h3>
                  <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllQualityChecks}
                      >
                        Select All
                  </Button> 
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {receivingQualityChecksList.map(check => (
                      <div key={check.key} className="flex items-center gap-2">
                        <Checkbox id={check.key} checked={formData.quality_checks[check.key]} onCheckedChange={(checked) => handleQualityCheckChange(check.key, !!checked)} />
                        <Label htmlFor={check.key} className="text-sm cursor-pointer">{check.label}</Label>
                      </div>
                    ))}
                  </div>
                  {/* Warning if any quality check is not passed */}
                  {Object.values(formData.quality_checks).some(v => v === false) && (
                    <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive font-semibold text-sm">
                      ⚠️ Immediately inform head office - Quality check(s) not passed
                    </div>
                  )}
                </div>
                
                {/* Expiry date warning if less than 3 months */}
                {formData.expiry_date && (() => {
                  const expiryDate = new Date(formData.expiry_date);
                  const threeMonthsFromNow = new Date();
                  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
                  return expiryDate < threeMonthsFromNow ? (
                    <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning font-semibold text-sm">
                      ⚠️ Immediately inform head office - Expiry date is less than 3 months from today
                    </div>
                  ) : null;
                })()}

                {/* Invoice Attachment - Optional */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h3 className="font-semibold mb-2 text-primary">INVOICE ATTACHMENT (Optional)</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Attach the supplier invoice or delivery note for additional information. The file is stored with every receiving record in this delivery.
                  </p>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:text-primary-foreground hover:file:bg-primary/90"
                    onChange={(e) => setReceivingInvoiceFile(e.target.files?.[0] || null)}
                  />
                  {receivingInvoiceFile && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm truncate flex-1">{receivingInvoiceFile.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {(receivingInvoiceFile.size / 1024).toFixed(0)} KB
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          setReceivingInvoiceFile(null);
                        }}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* COA Content Section - Optional */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h3 className="font-semibold mb-2 text-primary">COA/COC CONTENT (Optional)</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Copy and paste the Certificate of Analysis or Certificate of Conformance content below.
                  </p>
                  <Textarea
                    value={formData.coa_content}
                    onChange={(e) => setFormData(prev => ({ ...prev, coa_content: e.target.value }))}
                    placeholder="Paste COA/COC content here..."
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

                {/* Queued line items for this delivery */}
                {receivingLines.length > 0 && (
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <h3 className="font-semibold mb-2 text-primary">
                      LINE ITEMS IN THIS DELIVERY ({receivingLines.length + (formData.stock_code_id && parseFloat(formData.quantity_received) > 0 ? 1 : 0)})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="px-2 py-1 text-left font-medium">Lot Number</th>
                            <th className="px-2 py-1 text-left font-medium">Material</th>
                            <th className="px-2 py-1 text-right font-medium">Qty</th>
                            <th className="px-2 py-1 text-left font-medium">Batch</th>
                            <th className="px-2 py-1 text-left font-medium">Production Date</th>
                            <th className="px-2 py-1 text-left font-medium">Expiry</th>
                            <th className="px-2 py-1" />
                          </tr>
                        </thead>
                        <tbody>
                          {receivingLines.map((line, idx) => (
                            <tr key={`${line.internal_lot_number}-${idx}`} className="border-t">
                              <td className="px-2 py-1 font-mono text-xs">{line.internal_lot_number}</td>
                              <td className="px-2 py-1">{line.stock_code} - {line.material_description}</td>
                              <td className="px-2 py-1 text-right">{line.quantity_received} {line.uom}</td>
                              <td className="px-2 py-1">{line.supplier_batch_number || '-'}</td>
                              <td className="px-2 py-1">{line.production_date || formData.date_received}</td>
                              <td className="px-2 py-1">{line.expiry_date || '-'}</td>
                              <td className="px-2 py-1 text-right">
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveLine(idx)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Fill in the next material above and click &quot;Add Another Item&quot; to queue it, or &quot;Record Receiving&quot; to save all line items.
                    </p>
                  </div>
                )}

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button variant="outline" onClick={handleAddLineToBatch}>Add Another Item</Button>
                <Button onClick={handleSubmit}>Record Receiving{receivingLines.length > 0 ? ` (${receivingLines.length + 1} items)` : ''}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="receiving" className="gap-2">
      <Truck className="h-4 w-4" />
      Receiving Log
    </TabsTrigger>

    <TabsTrigger value="warehouse" className="gap-2">
      <PackageCheck className="h-4 w-4" />
      Stock Ordered:

      {stockOrders.filter(o => o.status !== 'CHECKED').length + (supplierOrderEmails || []).filter(e => e.status === 'pending').length > 0 && (
        <span className="ml-1 rounded-full bg-warning/20 px-2 py-0.5 text-xs font-semibold text-warning">
          {stockOrders.filter(o => o.status !== 'CHECKED').length + (supplierOrderEmails || []).filter(e => e.status === 'pending').length}
        </span>
      )}
    </TabsTrigger>

    <TabsTrigger value="history" className="gap-2">
      <ClipboardList className="h-4 w-4" />
      Invoice Orders History
    </TabsTrigger>
  </TabsList>


        {/* =====================================================
            RECEIVING LOG
        ===================================================== */}
        <TabsContent value="receiving" className="mt-4 space-y-4">
      <div className="flex gap-4 rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by lot number, batch, or description..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className='mt-4 rounded-xl border border-border bg-card p-3 sm:p-4'>
        <div className='mb-2 flex items-start justify-between gap-2'>
          <div>
            <h3 className='text-sm font-semibold'>Scan Internal Lot</h3>
            <p className='text-xs text-muted-foreground'> Scan the lot QR code using the TOVI Scanner, then press Enter</p>
          </div>
          {toviLotResult && (
            <Button variant="ghost" size="icon" onClick={clearToviResult} title="Clear scan">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
     <Input
  placeholder="Scan lot with TOVI..."
  value={toviLotNumber}
  onChange={(e) => {
    setToviLotNumber(e.target.value);
  }}
  onKeyDown={(e) => {
    if (e.key === 'Enter') {
      handleToviLotScan(toviLotNumber);
    }
  }}
  className="pl-9"
/>

        {/* Details of the scanned lot */}
        {toviLotResult && (() => {
          const stockCode = getStockCode(toviLotResult.stock_code_id);
          const supplier = getSupplier(toviLotResult.supplier_id);
          const qualityChecks = (toviLotResult.quality_checks || {}) as Record<string, any>;
          const receivedDate = toviLotResult.received_at || toviLotResult.created_at;

          return (
            <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 sm:p-4 animate-fade-in">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PackageCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">Receiving Record</span>
                  <span className="font-mono text-sm">{toviLotResult.internal_lot_number}</span>
                </div>
                <div className="flex items-center gap-2">
                  {toviLotResult.status === 'accepted' ? (
                    <Badge variant="outline" className="gap-1 border-green-600 text-green-700">
                      <CheckCircle className="h-3 w-3" /> Accepted
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 border-destructive text-destructive">
                      <XCircle className="h-3 w-3" /> {toviLotResult.status || 'declined'}
                    </Badge>
                  )}
                  <Button variant="outline" size="sm" className="gap-2" onClick={viewToviRecord}>
                    <Eye className="h-4 w-4" /> Full details
                  </Button>
                </div>
              </div>

              {toviMatchedOn === 'supplier_batch_number' && (
                <p className="mb-3 rounded-md bg-warning/20 px-2 py-1 text-xs text-warning">
                  Matched on the supplier batch number. Showing the Maharaja internal lot.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Date Received</p>
                  <p className="text-sm font-medium">{receivedDate ? formatDate(receivedDate) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stock Code</p>
                  <p className="text-sm font-medium">{stockCode?.stock_code || '—'}</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="text-sm font-medium">{stockCode?.description || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Quantity</p>
                  <p className="text-sm font-medium">
                    {toviLotResult.quantity_received} {stockCode?.unit_of_measure || ''}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Supplier</p>
                  <p className="text-sm font-medium">{supplier?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Supplier Batch</p>
                  <p className="text-sm font-medium">{toviLotResult.supplier_batch_number || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expiry Date</p>
                  <p className="text-sm font-medium">
                    {toviLotResult.expiry_date ? formatDate(toviLotResult.expiry_date) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Manufactured</p>
                  <p className="text-sm font-medium">
                    {toviLotResult.manufacturing_date ? formatDate(toviLotResult.manufacturing_date) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Received By</p>
                  <p className="text-sm font-medium">{toviLotResult.received_by || '—'}</p>
                </div>
                {toviLotResult.delivery_note_number && (
                  <div>
                    <p className="text-xs text-muted-foreground">Delivery Note</p>
                    <p className="text-sm font-medium">{toviLotResult.delivery_note_number}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Cost Price / kg</p>
                  <p className="text-sm font-medium">
                    {toviLotResult.cost_price_per_kg != null ? formatZAR(toviLotResult.cost_price_per_kg) : '—'}
                  </p>
                </div>
              </div>

              {toviLotResult.rejection_reason && (
                <div className="mt-3 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
                  Rejection reason: {toviLotResult.rejection_reason}
                </div>
              )}

              {qualityChecks.coa_content && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">COA / COC</p>
                  <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md bg-card p-2 font-mono text-xs">
                    {qualityChecks.coa_content}
                  </pre>
                </div>
              )}

              <div className="mt-3">
                <p className="mb-1 text-xs text-muted-foreground">Quality Checks</p>
                <div className="flex flex-wrap gap-2">
                  {receivingQualityChecksList.map((check) => (
                    <Badge
                      key={check.key}
                      variant="outline"
                      className={
                        qualityChecks[check.key] === 'pass'
                          ? 'gap-1 border-green-600 text-green-700'
                          : 'gap-1'
                      }
                    >
                      {qualityChecks[check.key] === 'pass' ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {check.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
  
      

      <div className="text-sm text-muted-foreground">
        Showing {filteredRecords.length} of {receivingRecords.length} records
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="data-table">
            <thead className="sticky top-0 bg-card z-10">
              <tr>
                <th>Lot Number</th>
                <th className="hidden sm:table-cell">Date</th>
                <th className="hidden md:table-cell">Stock Code</th>
                <th>Description</th>
                <th className="hidden sm:table-cell">Qty</th>
                <th className="hidden lg:table-cell">Supplier</th>
                <th className="hidden md:table-cell">Expiry</th>
                <th>Status</th>
                <th className="w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((rec) => {
                const stockCode = getStockCode(rec.stock_code_id);
                const supplier = getSupplier(rec.supplier_id);
                return (
                  <tr key={rec.id}>
                    <td className="font-medium text-xs sm:text-sm">{rec.internal_lot_number}</td>
                    <td className="hidden sm:table-cell">{formatDate(rec.received_at || rec.created_at || '')}</td>
                    <td className="hidden md:table-cell">{stockCode?.stock_code}</td>
                    <td className="text-xs sm:text-sm max-w-[150px] truncate">{stockCode?.description}</td>
                    <td className="hidden sm:table-cell">{rec.quantity_received} {stockCode?.unit_of_measure}</td>
                    <td className="hidden lg:table-cell">{supplier?.name}</td>
                    <td className="hidden md:table-cell">{rec.expiry_date ? formatDate(rec.expiry_date) : '—'}</td>
                    <td>
                      {rec.status === 'accepted' ? (
                        <span className="badge-active flex items-center gap-1 text-xs"><CheckCircle className="h-3 w-3" /><span className="hidden sm:inline">Accepted</span></span>
                      ) : (
                        <span className="badge-inactive flex items-center gap-1 text-xs"><XCircle className="h-3 w-3" /><span className="hidden sm:inline">declined</span></span>
                      )}
                    </td>
                    <td className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleViewRecord(rec)} title="View details"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handlePrintQRCode(rec)} title="Print QR labels" className="hidden sm:inline-flex"><QrCode className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDownloadQRCode(rec)} title="Download QR" className="hidden sm:inline-flex"><Download className="h-4 w-4" /></Button>
                      {canDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Delete">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Receiving Record?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete lot {rec.internal_lot_number}. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteReceiving(rec.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-muted-foreground"><Truck className="mx-auto mb-2 h-8 w-8 opacity-50" /><p>No receiving records found</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </TabsContent>

        {/* =====================================================
            INVOICE ORDERS HISTORY (read-only)
        ===================================================== */}
        <TabsContent value="history" className="mt-4">
          <div className="space-y-3">
            {stockOrders.length === 0 && (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
                <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No invoice orders yet — upload an order to get started</p>
              </div>
            )}
            {stockOrders.map(order => {
              const supplier = getSupplier(order.supplier_id);
              const receivedCount = order.items.filter(item => item.received).length;
              const totalItems = order.items.length;
              return (
                <div key={order.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
                  <div className="flex-1 min-w-[220px]">
                    <p className="font-medium">{order.po_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {supplier?.name || 'Unknown supplier'}
                      {order.invoice_number ? ` · Invoice ${order.invoice_number}` : ''}
                      {' · '}
                      {formatDate(order.order_date)}
                    </p>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {totalItems} line item{totalItems !== 1 ? 's' : ''}
                    {receivedCount > 0 ? ` · ${receivedCount} received` : ''}
                  </div>

                  {/* Two statuses only: Complete Order / Incomplete Order */}
                  {order.status === 'CHECKED' ? (
                    <Badge className="bg-green-600 text-white">Complete Order</Badge>
                  ) : (
                    <Badge className="bg-amber-500 text-white">Incomplete Order</Badge>
                  )}

                  {/* Invoice Order History is read-only — confirmation
                      happens only in the Warehouse Confirmation tab. */}
                  <Button
                    variant="ghost"
                    size="icon"
                    title="View confirmation details"
                    onClick={() => setViewOrder(order)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* =====================================================
            WAREHOUSE CONFIRMATION
        ===================================================== */}
        <TabsContent value="warehouse" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="h-5 w-5 text-primary" />

              <h3 className="font-semibold">
                Orderes placed and pending deliveries.
              </h3>

              <Badge variant="outline">
                {stockOrders.filter(o => o.status !== 'CHECKED').length + (supplierOrderEmails || []).filter(e => e.status === 'pending').length}{' '}
                open
              </Badge>

              {stockOrders.filter(o => o.status !== 'CHECKED').length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 ml-auto text-destructive hover:text-destructive"
                  onClick={() => setDeletingAllOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete All
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {/* Emailed Supplier Orders (from Stock Tracking) */}
              {(supplierOrderEmails || [])
                .filter(e => e.status === 'pending')
                .map(emailOrder => {
                  const supplier = getSupplier(emailOrder.supplier_id);
                  const sc = getStockCode(emailOrder.stock_code_id);
                  const daysWaiting = Math.floor((Date.now() - new Date(emailOrder.emailed_at).getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <div
                      key={`email-${emailOrder.id}`}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3"
                    >
                      {/* Order details */}
                      <div className="flex-1 min-w-[220px]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {sc?.stock_code || 'Unknown'}
                          </span>
                          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                            Emailed Order
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground">
                          {supplier?.name || 'Unknown supplier'}
                          {' · '}
                          {sc?.description || 'Unknown item'}
                          {' · '}
                          Emailed {formatDate(emailOrder.emailed_at)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Qty Ordered: {Number(emailOrder.quantity).toFixed(2)} {sc?.unit_of_measure || ''}
                          {daysWaiting > 0 && (
                            <span className={`ml-2 ${daysWaiting > 7 ? 'text-destructive font-semibold' : daysWaiting > 3 ? 'text-amber-600 font-semibold' : ''}`}>
                              · Waiting {daysWaiting} day{daysWaiting !== 1 ? 's' : ''}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Status */}
                      <Badge className="bg-blue-500 text-white">
                        Awaiting Delivery
                      </Badge>

                      {/* Actions */}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Cancel order"
                        className="text-destructive hover:text-destructive"
                        onClick={async () => {
                          if (confirm('Cancel this emailed order?')) {
                            await updateSupplierOrderEmailStatus(emailOrder.id, 'cancelled');
                            await refreshData();
                            toast.success('Order cancelled');
                          }
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>

                      {/* Confirm button */}
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() => openEmailOrderConfirmDialog(emailOrder)}
                      >
                        <PackageCheck className="h-4 w-4" />
                        Confirm Stock
                      </Button>
                    </div>
                  );
              })}

              {/* Stock Orders (from Invoice Upload) */}
              {stockOrders
                .filter(o => o.status !== 'CHECKED')
                .map(order => {
          const supplier = getSupplier(order.supplier_id);

          const receivedCount = order.items.filter(
            item => item.received
          ).length;

          const totalItems = order.items.length;

          return (
            <div
              key={order.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
            >
              {/* Order details */}
              <div className="flex-1 min-w-[220px]">
                <p className="font-medium">
                  {order.po_number}
                </p>

                <p className="text-sm text-muted-foreground">
                  {supplier?.name || 'Unknown supplier'}

                  {order.invoice_number
                    ? ` · Invoice ${order.invoice_number}`
                    : ''}

                  {' · '}

                  {formatDate(order.order_date)}
                </p>
              </div>

              {/* Item count */}
              <div className="text-sm text-muted-foreground">
                {totalItems} line item
                {totalItems !== 1 ? 's' : ''}

                {receivedCount > 0
                  ? ` · ${receivedCount} received`
                  : ''}
              </div>

              {/* Status — two statuses only */}
              <Badge className="bg-amber-500 text-white">
                Incomplete Order
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                title="View confirmation details"
                onClick={() => setViewOrder(order)}>
                <Eye className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                title="Delete invoice order"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeletingOrder(order)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>

              {/* Confirm button — Warehouse Confirmation is the only
                  place stock receipt can be confirmed. */}
              <Button
                size="sm"
                className="gap-2"
                onClick={() => openConfirmDialog(order)}>
                <PackageCheck className="h-4 w-4" />
                Confirm Stock
              </Button>
            </div>
          );
        })}
              {stockOrders.filter(o => o.status !== 'CHECKED').length === 0 && (supplierOrderEmails || []).filter(e => e.status === 'pending').length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  <Inbox className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  No orders awaiting confirmation
                </p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
{/* Email Order Confirmation Dialog - Full Receiving Log Form */}
<Dialog
  open={!!confirmingEmailOrder}
  onOpenChange={(open) => {
    if (!open) {
      resetEmailOrderForm();
    }
  }}
>
  <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
    <DialogHeader>
      <DialogTitle>
        Confirm Stock Received — Emailed Order
      </DialogTitle>

      <DialogDescription>
        Complete the receiving record for this emailed order. All fields marked with * are required.
      </DialogDescription>
    </DialogHeader>

    {confirmingEmailOrder && (
      <div className="space-y-4 py-2">
        {/* Order Info (Read-only) */}
        <div className="rounded-lg border bg-blue-50/50 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className="bg-blue-100 text-blue-700 border-blue-300">
              Emailed Order
            </Badge>

            <span className="text-xs text-muted-foreground">
              Emailed {formatDateTime(confirmingEmailOrder.emailed_at)}
            </span>
          </div>

          <p className="text-sm font-medium">
            {emailOrderFormData.stock_code} - {emailOrderFormData.material_description}
          </p>

          <p className="text-xs text-muted-foreground">
            Supplier: {emailOrderFormData.supplier_name} · Qty Ordered:{" "}
            {Number(confirmingEmailOrder.quantity).toFixed(2)}{" "}
            {emailOrderFormData.uom}
          </p>
        </div>

        {/* Basic Fields */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">LOT Number *</Label>
            <Input
              value={emailOrderFormData.internal_lot_number}
              onChange={(e) =>
                setEmailOrderFormData((prev) => ({
                  ...prev,
                  internal_lot_number: e.target.value,
                }))
              }
              placeholder="LOT-YYYY-XXXX"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Date Received *</Label>
            <Input
              type="date"
              value={emailOrderFormData.date_received}
              onChange={(e) =>
                setEmailOrderFormData((prev) => ({
                  ...prev,
                  date_received: e.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Quantity Received *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={emailOrderFormData.quantity_received}
              onChange={(e) =>
                setEmailOrderFormData((prev) => ({
                  ...prev,
                  quantity_received: e.target.value,
                }))
              }
            />
          </div>
        </div>

        {/* Additional Fields */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Supplier Batch Number</Label>
            <Input
              value={emailOrderFormData.supplier_batch_number}
              onChange={(e) =>
                setEmailOrderFormData((prev) => ({
                  ...prev,
                  supplier_batch_number: e.target.value,
                }))
              }
              placeholder="Batch number"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Production Date</Label>
            <Input
              type="date"
              value={emailOrderFormData.production_date}
              onChange={(e) =>
                setEmailOrderFormData((prev) => ({
                  ...prev,
                  production_date: e.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Expiry Date</Label>
            <Input
              type="date"
              value={emailOrderFormData.expiry_date}
              onChange={(e) =>
                setEmailOrderFormData((prev) => ({
                  ...prev,
                  expiry_date: e.target.value,
                }))
              }
            />
          </div>
        </div>

        {/* Cost Price */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Cost Price / kg (ZAR)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={emailOrderFormData.cost_price_per_kg}
              onChange={(e) =>
                setEmailOrderFormData((prev) => ({
                  ...prev,
                  cost_price_per_kg: e.target.value,
                }))
              }
              placeholder="0.00"
            />

            <p className="text-xs text-muted-foreground">
              Auto-pulled from supplier price. Edit to update.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Receiver Name</Label>
            <Input
              value={emailOrderFormData.receiver_name}
              onChange={(e) =>
                setEmailOrderFormData((prev) => ({
                  ...prev,
                  receiver_name: e.target.value,
                }))
              }
              placeholder="Receiver name"
            />
          </div>
        </div>

        {/* Quality Checks */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Quality Checks</Label>
            <Button 
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAllQualityChecks}>
              Select All
            </Button>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {receivingQualityChecksList.map((check) => (
              <div key={check.key} className="flex items-center gap-2">
                <Checkbox
                  checked={emailOrderFormData.quality_checks[check.key]}
                  onCheckedChange={(checked) => {
                    setEmailOrderFormData((prev) => ({
                      ...prev,
                      quality_checks: {
                        ...prev.quality_checks,
                        [check.key] : checked === true,
                      },
                    }));
                  }}
                />

                <span className="text-sm">{check.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <Label className="text-xs">Notes</Label>

          <Textarea
            value={emailOrderFormData.notes}
            onChange={(e) =>
              setEmailOrderFormData((prev) => ({
                ...prev,
                notes: e.target.value,
              }))
            }
            placeholder="Additional notes..."
            rows={2}
          />
        </div>

        {/* COA Content */}
        <div className="space-y-1">
          <Label className="text-xs">COA/COC Content (Optional)</Label>

          <Textarea
            value={emailOrderFormData.coa_content}
            onChange={(e) =>
              setEmailOrderFormData((prev) => ({
                ...prev,
                coa_content: e.target.value,
              }))
            }
            placeholder="Paste COA/COC content here..."
            rows={3}
            className="font-mono text-sm"
          />
        </div>
      </div>
    )}

    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => resetEmailOrderForm()}
      >
        Cancel
      </Button>

      <Button
        onClick={handleConfirmEmailOrderReceipt}
        disabled={confirmingEmailReceipt}
        className="gap-2"
      >
        {confirmingEmailReceipt && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}

        {emailOrderFormData.quality_checks.vehicle_clean &&
        emailOrderFormData.quality_checks.no_foreign_odours &&
        emailOrderFormData.quality_checks.no_pest_activity &&
        emailOrderFormData.quality_checks.packaging_intact &&
        emailOrderFormData.quality_checks.correct_labelling &&
        emailOrderFormData.quality_checks.organoleptic_ok
          ? "Receive Material"
          : "Decline Material"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

      {/* Delete invoice order confirmation */}
      <AlertDialog
        open={!!deletingOrder}
        onOpenChange={(open) => {
          if (!open) setDeletingOrder(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete invoice order{' '}
              <strong>{deletingOrder?.po_number}</strong>
              {deletingOrder?.invoice_number ? ` (Invoice ${deletingOrder.invoice_number})` : ''} and all its
              line items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingOrderBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingOrderBusy}
              onClick={(e) => {
                e.preventDefault();
                if (deletingOrder) handleDeleteOrder(deletingOrder);
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deletingOrderBusy ? (<Loader2 className="h-4 w-4 animate-spin" />) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete ALL invoice orders awaiting confirmation */}
      <AlertDialog
        open={deletingAllOpen}
        onOpenChange={(open) => {
          if (!deletingAllBusy) setDeletingAllOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Awaiting Confirmation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <strong>{stockOrders.filter(o => o.status !== 'CHECKED').length}</strong>{' '}
              invoice order(s) still awaiting confirmation and all their line items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAllBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingAllBusy}
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAllOrders();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deletingAllBusy ? (<Loader2 className="h-4 w-4 animate-spin" />) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

<Dialog
  open={!!confirmOrder}
  onOpenChange={(open) => {
    if (!open) {
      setConfirmOrder(null);
    }
  }}
>
  <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
    <DialogHeader>
      <DialogTitle>
        Confirm Stock Received — {confirmOrder?.po_number}
      </DialogTitle>

      <DialogDescription>
        Enter the quantity received, LOT number and expiry
        date for each item. LOT number and expiry date are
        required for traceability. Leave the quantity blank
        to receive that item later.
      </DialogDescription>
    </DialogHeader>

          {/* Receiver, quality checks and COA/COC */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Receiver's Name</Label>
              <Input
                value={confirmReceiverName}
                onChange={(e) => setConfirmReceiverName(e.target.value)}
                placeholder="Enter receiver's name"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">COA/COC Content</Label>
              <Textarea
                value={confirmCoaContent}
                onChange={(e) => setConfirmCoaContent(e.target.value)}
                placeholder="Paste or capture the Certificate of Analysis / Conformance content (optional)"
                rows={3}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Quality Checks</Label>
              {/* <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAllQualityChecks}>
                Select All
              </Button> */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {receivingQualityChecksList.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={!!confirmQualityChecks[key]}
                      onCheckedChange={(checked) =>
                        setConfirmQualityChecks(prev => ({ ...prev, [key]: checked === true }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>

            </div>
          </div>

          <div className="space-y-3 py-2">
            {confirmOrder?.items.map(it => {
              const sc = getStockCode(it.stock_code_id);
              const state = confirmState[it.id] || { qty: '', lot: '', expiry: '' };
              const already = it.received ? Number(it.quantity_received ?? 0) : 0;
              const balance = Math.max(0, Number(it.quantity_ordered) - already);
              return (
                <div key={it.id} className={`rounded-lg border p-3 ${balance <= 0 ? 'opacity-70' : ''}`}>
                  <p className="text-sm font-medium">{sc?.stock_code} - {sc?.description || 'Unknown material'}</p>
                  <p className="mb-2 text-xs text-muted-foreground">
                    On invoice: {it.quantity_ordered} {it.uom}
                    {it.received && ` · Already received ${it.quantity_received} ${it.uom}`}
                    {it.received && it.received_lot_number && ` · Lot ${it.received_lot_number}`}
                  </p>
                  {balance > 0 && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-xs">On Invoice (kg)</Label>
                        <Input value={String(it.quantity_ordered)} readOnly disabled className="bg-muted cursor-not-allowed" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{it.received ? 'Balance to Receive *' : 'Quantity Received *'}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={state.qty}
                          onChange={(e) => setConfirmState(prev => ({ ...prev, [it.id]: { ...state, qty: e.target.value } }))}
                        />
                        {parseFloat(state.qty) > 0 && already + parseFloat(state.qty) !== Number(it.quantity_ordered) && (
                          <p className="text-xs font-medium text-amber-600">
                            {already + parseFloat(state.qty) < Number(it.quantity_ordered) ? 'Still outstanding after this receipt' : 'Exceeds invoiced quantity'}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">LOT Number *</Label>
                        <Input
                          value={state.lot}
                          placeholder="LOT-YYYY-XXXX"
                          onChange={(e) => setConfirmState(prev => ({ ...prev, [it.id]: { ...state, lot: e.target.value } }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Expiry Date *</Label>
                        <Input
                          type="date"
                          value={state.expiry}
                          onChange={(e) => setConfirmState(prev => ({ ...prev, [it.id]: { ...state, expiry: e.target.value } }))}
                        />
                      </div>
                    </div>
                  )}
                  {balance <= 0 && (
                    <p className="text-xs text-green-600">Fully received.</p>
                  )}
                </div>
              );
            })}
            {confirmOrder && confirmOrder.items.every(i => Number(i.quantity_received ?? 0) >= Number(i.quantity_ordered)) && (
              <p className="text-sm text-green-600 font-medium">All items on this order have been fully received.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOrder(null)}>Cancel</Button>
            <Button
              onClick={handleConfirmReceipt}
              disabled={confirmingReceipt}
              className="gap-2"
            >
              {confirmingReceipt && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm Received Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order confirmation details dialog */}
      <Dialog
        open={!!viewOrder}
        onOpenChange={(open) => {
          if (!open) setViewOrder(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Order Details — {viewOrder?.po_number}</DialogTitle>
            <DialogDescription>
              {viewOrder && `${getSupplier(viewOrder.supplier_id)?.name || 'Unknown supplier'}${viewOrder.invoice_number ? ` · Invoice ${viewOrder.invoice_number}` : ''} · ${formatDate(viewOrder.order_date)}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Material</th>
                    <th className="px-3 py-2 text-right font-medium">On Invoice</th>
                    <th className="px-3 py-2 text-right font-medium">Confirmed</th>
                    <th className="px-3 py-2 text-right font-medium">Difference</th>
                    <th className="px-3 py-2 text-left font-medium">Lot Number</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {viewOrder?.items.map(it => {
                    const sc = getStockCode(it.stock_code_id);
                    const ordered = Number(it.quantity_ordered);
                    const received = it.received ? Number(it.quantity_received) : null;
                    const diff = received != null ? received - ordered : null;
                    return (
                      <tr key={it.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{sc?.stock_code} - {sc?.description || 'Unknown material'}</td>
                        <td className="px-3 py-2 text-right">{ordered} {it.uom}</td>
                        <td className="px-3 py-2 text-right">
                          {received != null ? `${received} ${it.uom}` : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium ${diff == null ? 'text-muted-foreground' : diff === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                          {diff == null ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(2)} ${it.uom}`}
                        </td>
                        <td className="px-3 py-2">{it.received_lot_number || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-2">
                          {it.received ? (
                            <Badge className="bg-green-600 text-white">Confirmed</Badge>
                          ) : (
                            <Badge variant="outline">Not confirmed</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {viewOrder?.items.some(i => i.received) && (
              <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                {viewOrder.items.filter(i => i.received).map(i => (
                  <p key={i.id}>
                    {getStockCode(i.stock_code_id)?.stock_code || 'Item'} confirmed at {i.received_at ? formatDateTime(i.received_at) : '—'} by {getUserName(i.received_by)}
                  </p>
                ))}
              </div>
            )}
            {viewOrder && viewOrder.items.every(i => Number(i.quantity_received ?? 0) >= Number(i.quantity_ordered)) && (
              <p className="text-sm font-medium text-green-600">
                Complete Order — confirmed quantities match the invoice.
              </p>
            )}
            {viewOrder && viewOrder.items.some(i => Number(i.quantity_received ?? 0) > 0) && !viewOrder.items.every(i => Number(i.quantity_received ?? 0) >= Number(i.quantity_ordered)) && (
              <p className="text-sm font-medium text-amber-600">
                Incomplete Order — some items are still outstanding.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOrder(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Receiving Record Details</DialogTitle></DialogHeader>
          {selectedRecord && (() => {
            const stockCode = getStockCode(selectedRecord.stock_code_id);
            const supplier = getSupplier(selectedRecord.supplier_id);
            const qualityChecks = selectedRecord.quality_checks as any;
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-muted-foreground">Lot Number</Label><p className="font-medium">{selectedRecord.internal_lot_number}</p></div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <p>{selectedRecord.status === 'accepted' ? <span className="badge-active">Accepted</span> : <span className="badge-inactive">declined</span>}</p>
                    {/* Admin-only status change */}
                    {canDelete && (
                      <div className="mt-2">
                        <Select
                          value={selectedRecord.status}
                          onValueChange={async (value) => {
                            const { error } = await supabase
                              .from('fms_receiving')
                              .update({ status: value, rejection_reason: value === 'declined' ? 'Status changed by administrator' : null })
                              .eq('id', selectedRecord.id);
                            if (error) {
                              toast.error('Failed to update status');
                            } else {
                              toast.success(`Status updated to ${value}`);
                              await refreshData();
                              setViewDialogOpen(false);
                            }
                          }}
                        >
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="declined">declined</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">Admin: Change status</p>
                      </div>
                    )}
                  </div>
                  <div><Label className="text-muted-foreground">Stock Code</Label><p className="font-medium">{stockCode?.stock_code}</p><p className="text-sm text-muted-foreground">{stockCode?.description}</p></div>
                  <div><Label className="text-muted-foreground">Supplier</Label><p className="font-medium">{supplier?.name}</p><p className="text-sm text-muted-foreground">Batch: {selectedRecord.supplier_batch_number}</p></div>
                  <div><Label className="text-muted-foreground">Quantity</Label><p className="font-medium">{selectedRecord.quantity_received} {stockCode?.unit_of_measure}</p></div>
                  <div><Label className="text-muted-foreground">Expiry Date</Label><p className="font-medium">{selectedRecord.expiry_date ? formatDate(selectedRecord.expiry_date) : '—'}</p></div>
                </div>

                {/* Editable Cost Price (syncs back to supplier pricing) */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <Label className="text-muted-foreground font-semibold">Cost Price / kg (ZAR)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Current supplier price: {formatZAR(
                      supplierPrices.find(p => p.stock_code_id === selectedRecord.stock_code_id && p.supplier_id === selectedRecord.supplier_id)?.cost_price_per_kg ?? null
                    )}. Saving here will update the supplier's price for this material.
                  </p>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editCostPrice}
                      onChange={(e) => setEditCostPrice(e.target.value)}
                      placeholder="0.00"
                      className="max-w-[200px]"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveCostPrice}
                      disabled={savingCost || editCostPrice === ((selectedRecord as any).cost_price_per_kg != null ? String((selectedRecord as any).cost_price_per_kg) : '')}
                    >
                      {savingCost ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Price'}
                    </Button>
                  </div>
                </div>


                
                {/* Editable COA/COC Content (optional, add or update anytime) */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <Label className="text-muted-foreground font-semibold">COA/COC Content (Optional)</Label>
                  <Textarea
                    value={editCoaContent}
                    onChange={(e) => setEditCoaContent(e.target.value)}
                    placeholder="Paste or edit COA/COC content here..."
                    className="mt-2 min-h-[140px] font-mono text-sm"
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      size="sm"
                      onClick={handleSaveCoa}
                      disabled={savingCoa || editCoaContent === (qualityChecks?.coa_content || '')}
                    >
                      {savingCoa ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save COA/COC'}
                    </Button>
                  </div>
                </div>

              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReceivingLog;