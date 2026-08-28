import React, { useState, useEffect, useMemo } from 'react';
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
import { Plus, Search, Truck, CheckCircle, XCircle, Eye, FileText, Loader2, QrCode, Trash2, Download, Camera, ClipboardList, PackageCheck, Upload, X } from 'lucide-react';
import { useActivityLog } from '@/hooks/useActivityLog';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';
import { format } from 'date-fns';
import { generateQRCodePair, printQRCodes, downloadQRCodeWithLabel, generateQRCodeImage } from '@/lib/qrCodeUtils';
import { QRScanner } from '@/components/QRScanner';
import { extractBestScanIdentifier } from '@/lib/scanParser';
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
  const { user } = useFMSAuth();
  const { receivingRecords, stockCodes, suppliers, loading, addReceivingRecord, refreshData, addStockForReceipt, stockOrders, createStockOrder } = useFMSData();
  const { prices: supplierPrices, refresh: refreshPrices } = useSupplierPrices();
  const { logActivity } = useActivityLog();
  const { canDelete } = useDeletePermission();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<typeof receivingRecords[0] | null>(null);
  const [editCoaContent, setEditCoaContent] = useState('');
  const [editCostPrice, setEditCostPrice] = useState('');
  const [savingCoa, setSavingCoa] = useState(false);
  const [savingCost, setSavingCost] = useState(false);
  
  const [stockCodeSearch, setStockCodeSearch] = useState('');
  const [showStockCodeDropdown, setShowStockCodeDropdown] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');

  // ---- Stock orders (uploaded invoice awaiting receipt) ----
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [orderSupplierSearch, setOrderSupplierSearch] = useState('');
  const [showOrderSupplierDropdown, setShowOrderSupplierDropdown] = useState(false);
  const [orderItemSearch, setOrderItemSearch] = useState('');
  const [showOrderItemDropdown, setShowOrderItemDropdown] = useState(false);
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
  const [confirmState, setConfirmState] = useState<Record<string, { checked: boolean; qty: string }>>({});
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);

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
    receiver_name: '',
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
    setStockCodeSearch('');
    setSupplierSearch('');
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
  };

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
    if (!formData.stock_code_id || !formData.supplier_id || !formData.quantity_received) {
      toast.error('Please fill in Stock Code, Supplier, and Quantity');
      return;
    }

    // Expiry date is optional - only validate it if provided
    if (formData.expiry_date && new Date(formData.expiry_date) < new Date()) {
      toast.error('Cannot receive expired materials');
      return;
    }

    const qualityChecks = {
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

    const costNum = formData.cost_price_per_kg ? parseFloat(formData.cost_price_per_kg) : null;

    const result = await addReceivingRecord({
      internal_lot_number: formData.internal_lot_number,
      received_at: new Date(formData.date_received).toISOString(),
      stock_code_id: formData.stock_code_id,
      quantity_received: parseFloat(formData.quantity_received),
      supplier_id: formData.supplier_id,
      supplier_batch_number: formData.supplier_batch_number,
      manufacturing_date: formData.production_date || undefined,
      expiry_date: formData.expiry_date || null,
      delivery_note_number: formData.invoice_number || undefined,
      quality_checks: qualityChecks,
      status: hasFailed ? 'rejected' : 'accepted',
      rejection_reason: hasFailed ? 'Quality check failed' : undefined,
      received_by: user?.id || '',
      cost_price_per_kg: costNum != null && !isNaN(costNum) ? costNum : null,
    } as any);

    if (result) {
      // Add stock to inventory for accepted receipts
      if (!hasFailed) {
        const newQty = await addStockForReceipt(
          formData.stock_code_id,
          parseFloat(formData.quantity_received),
          formData.internal_lot_number,
          `Receipt ${formData.internal_lot_number} - ${formData.material_description}`
        );
        if (newQty === null) {
          console.warn('[FMS] Failed to update stock level for receipt', formData.internal_lot_number);
        }
      }

      // Sync cost price back to supplier_material_prices so rest of system stays in sync
      if (costNum != null && !isNaN(costNum) && costNum >= 0) {
        const existing = supplierPrices.find(
          p => p.stock_code_id === formData.stock_code_id && p.supplier_id === formData.supplier_id
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
              stock_code_id: formData.stock_code_id,
              cost_price_per_kg: costNum,
              currency: 'ZAR',
              updated_by: user?.id,
            });
        }
        await refreshPrices(true);
      }

      const failedChecks = Object.entries(qualityChecks)
        .filter(([_, v]) => v !== 'pass')
        .map(([k]) => k.replace(/_/g, ' '));
      
      logActivity({ 
        action_type: 'create', 
        entity_type: 'receiving', 
        entity_id: formData.internal_lot_number, 
        entity_name: formData.material_description,
        details: {
          lot_number: formData.internal_lot_number,
          stock_code: formData.stock_code,
          supplier: formData.supplier_name,
          quantity: `${formData.quantity_received} ${formData.uom}`,
          supplier_batch: formData.supplier_batch_number,
          status: hasFailed ? 'rejected' : 'accepted',
          failed_checks: failedChecks.length > 0 ? failedChecks : undefined,
          receiver: formData.receiver_name,
          cost_price_per_kg: costNum,
        },
      });
      toast.success(`Material ${hasFailed ? 'rejected' : 'received'} successfully`);
      setDialogOpen(false);
      resetForm();
      await refreshData();
    }
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
    setOrderItemSearch('');
  };

  const handleAddOrderItem = (sc: typeof stockCodes[0]) => {
    if (orderItems.some(i => i.stock_code_id === sc.id)) {
      toast.error('This material is already on the order');
      return;
    }
    setOrderItems(prev => [...prev, {
      stock_code_id: sc.id,
      stock_code: sc.stock_code,
      description: sc.description,
      quantity_ordered: '',
      uom: sc.unit_of_measure,
    }]);
    setOrderItemSearch('');
    setShowOrderItemDropdown(false);
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
        toast.warning('No line items could be read from the document. Add them manually below.');
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
        toast.warning(`Invoice read: ${matched.length} of ${result.items.length} line item(s) matched your stock codes — check the list and fix any missing ones manually.`);
      }
    } catch (err: any) {
      console.error('Invoice parse error:', err);
      toast.error(err?.message || 'Could not read the invoice. Add the line items manually below.');
    } finally {
      setParsingInvoice(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!orderFormData.supplier_id) { toast.error('Select a supplier'); return; }
    const validItems = orderItems
      .map(i => ({ ...i, qty: parseFloat(i.quantity_ordered) }))
      .filter(i => i.qty > 0);
    if (validItems.length === 0) { toast.error('Add at least one line item with a quantity'); return; }

    setSavingOrder(true);
    try {
      // Optional invoice upload to the private 'order-documents' bucket
      let invoiceFilePath: string | null = null;
      if (invoiceFile) {
        const filePath = `${orderFormData.po_number}/${Date.now()}-${invoiceFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('order-documents')
          .upload(filePath, invoiceFile, { contentType: invoiceFile.type || 'application/octet-stream' });
        if (uploadError) {
          console.error('Invoice upload error:', uploadError);
          toast.warning(`Invoice file could not be uploaded (${uploadError.message}). Creating the order without it.`);
        } else {
          invoiceFilePath = filePath;
        }
      }

      const ok = await createStockOrder(
        {
          po_number: orderFormData.po_number.trim(),
          supplier_id: orderFormData.supplier_id,
          invoice_number: orderFormData.invoice_number || undefined,
          invoice_file_path: invoiceFilePath,
          order_date: orderFormData.order_date,
          notes: orderFormData.notes || undefined,
        },
        validItems.map(i => ({
          stock_code_id: i.stock_code_id,
          quantity_ordered: i.qty,
          uom: i.uom,
        }))
      );
      if (ok) {
        setOrderDialogOpen(false);
        resetOrderForm();
      }
    } finally {
      setSavingOrder(false);
    }
  };

  const openConfirmDialog = (order: FMSStockOrder) => {
    const state: Record<string, { checked: boolean; qty: string }> = {};
    order.items.forEach(it => {
      state[it.id] = { checked: false, qty: it.received ? String(it.quantity_received ?? '') : String(it.quantity_ordered) };
    });
    setConfirmState(state);
    setConfirmOrder(order);
  };

  const handleConfirmReceipt = async () => {
    if (!confirmOrder) return;
    const checked = confirmOrder.items.filter(it => confirmState[it.id]?.checked);
    if (checked.length === 0) { toast.error('Tick at least one item that has arrived'); return; }

    setConfirmingReceipt(true);
    try {
      let allOk = true;
      for (const it of checked) {
        const qty = parseFloat(confirmState[it.id]?.qty || '');
        if (!(qty > 0)) {
          toast.error(`Enter the actual weight/quantity for ${getStockCode(it.stock_code_id)?.description || 'item'}`);
          allOk = false;
          continue;
        }
        const lotNumber = generateLotNumber();
        const result = await addReceivingRecord({
          internal_lot_number: lotNumber,
          received_at: new Date().toISOString(),
          stock_code_id: it.stock_code_id,
          quantity_received: qty,
          supplier_id: confirmOrder.supplier_id,
          supplier_batch_number: confirmOrder.invoice_number || confirmOrder.po_number,
          quality_checks: { received_from_order: true, po_number: confirmOrder.po_number },
          status: 'accepted',
          received_by: user?.id || '',
        } as any);
        if (result) {
          await addStockForReceipt(
            it.stock_code_id,
            qty,
            lotNumber,
            `Receipt ${lotNumber} - ${getStockCode(it.stock_code_id)?.description || ''} (${confirmOrder.po_number})`
          );
          const { error: itemError } = await (supabase.from('fms_stock_order_items' as any) as any)
            .update({
              received: true,
              quantity_received: qty,
              received_lot_number: lotNumber,
              received_at: new Date().toISOString(),
              received_by: user?.id || null,
            })
            .eq('id', it.id);
          if (itemError) { console.error(itemError); allOk = false; }
        } else {
          allOk = false;
        }
      }

      // Update order status: received when every line item is ticked
      const remaining = confirmOrder.items.filter(it => !confirmState[it.id]?.checked && !it.received).length;
      const newStatus = remaining === 0 ? 'received' : 'partial';
      const { error: orderError } = await (supabase.from('fms_stock_orders' as any) as any)
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', confirmOrder.id);
      if (orderError) console.error(orderError);

      if (allOk) {
        logActivity({
          action_type: 'update',
          entity_type: 'stock_order',
          entity_id: confirmOrder.po_number,
          entity_name: confirmOrder.po_number,
          details: { confirmed_items: checked.length, status: newStatus },
        });
        toast.success(`Stock confirmed for ${checked.length} item(s). Order marked ${newStatus.replace('_', ' ')}.`);
        setConfirmOrder(null);
        await refreshData();
      }
    } finally {
      setConfirmingReceipt(false);
    }
  };

  const filteredRecords = receivingRecords.filter(rec => {
    const stockCode = getStockCode(rec.stock_code_id);
    return (
      rec.internal_lot_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.supplier_batch_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stockCode?.description.toLowerCase().includes(searchQuery.toLowerCase())
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
    const data = filteredRecords.map(rec => {
      const stockCode = getStockCode(rec.stock_code_id);
      const supplier = getSupplier(rec.supplier_id);
      return {
        'Lot Number': rec.internal_lot_number,
        'Date': formatDate(rec.received_at || rec.created_at || ''),
        'Stock Code': stockCode?.stock_code || '',
        'Description': stockCode?.description || '',
        'Qty': rec.quantity_received,
        'Supplier': supplier?.name || '',
        'Batch No': rec.supplier_batch_number,
        'Expiry': rec.expiry_date ? formatDate(rec.expiry_date) : '',
        'Status': rec.status,
      };
    });
    exportToPDF(data, 'Receiving_Log');
    toast.success('PDF exported successfully');
  };

//export excel function
  const handleExportExcel = () => {
    const data = filteredRecords.map(rec => {
      const stockCode = getStockCode(rec.stock_code_id);
      const supplier = getSupplier(rec.supplier_id);
      return {
        'Internal Lot Number': rec.internal_lot_number,
        'Date Received': formatDateTime(rec.received_at || rec.created_at || ''),
        'Stock Code': stockCode?.stock_code || '',
        'Material Description': stockCode?.description || '',
        'Quantity Received': rec.quantity_received,
        'UOM': stockCode?.unit_of_measure || '',
        'Supplier Name': supplier?.name || '',
        'Batch Number': rec.supplier_batch_number,
        'Production Date': rec.manufacturing_date ? formatDate(rec.manufacturing_date) : '',
        'Expiry Date': rec.expiry_date ? formatDate(rec.expiry_date) : '',
        'Invoice Number': rec.delivery_note_number || '',
        'Status': rec.status,
      };
    });
    exportToExcel(data, 'Receiving_Log');
    toast.success('Excel exported successfully');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading receiving records...</span>
      </div>
    );
  }

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
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Export PDF</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Export Excel</span>
          </Button>
          <Dialog open={orderDialogOpen} onOpenChange={(open) => { setOrderDialogOpen(open); if (!open) resetOrderForm(); }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Upload Order</span>
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
                            s.name.toLowerCase().includes(orderSupplierSearch.toLowerCase()) ||
                            s.code.toLowerCase().includes(orderSupplierSearch.toLowerCase())
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
                        Upload a PDF/CSV/Excel invoice and its line items fill the table below automatically (add or fix any that don't match). Stored privately in the order-documents bucket.
                      </p>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Notes</Label>
                      <Textarea rows={2} value={orderFormData.notes} onChange={(e) => setOrderFormData(prev => ({ ...prev, notes: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h3 className="font-semibold mb-4 text-primary">LINE ITEMS ({orderItems.length})</h3>
                  <p className="text-xs text-muted-foreground mb-2">Populated automatically from the uploaded invoice — edit quantities or add/remove rows as needed.</p>
                  <div className="space-y-2 relative mb-4">
                    <Label>Add Material</Label>
                    <Input
                      value={orderItemSearch}
                      onChange={(e) => { setOrderItemSearch(e.target.value); setShowOrderItemDropdown(true); }}
                      placeholder="Start typing to search stock codes..."
                      onFocus={() => orderItemSearch.length > 0 && setShowOrderItemDropdown(true)}
                    />
                    {showOrderItemDropdown && orderItemSearch.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                        {stockCodes.filter(sc =>
                          sc.stock_code.toLowerCase().includes(orderItemSearch.toLowerCase()) ||
                          sc.description.toLowerCase().includes(orderItemSearch.toLowerCase())
                        ).slice(0, 20).map((item) => (
                          <div key={item.id} className="px-3 py-2 hover:bg-accent cursor-pointer text-sm" onClick={() => handleAddOrderItem(item)}>
                            <span className="font-medium">{item.stock_code}</span> - {item.description}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {orderItems.map((item, idx) => (
                    <div key={item.stock_code_id} className="flex flex-wrap items-end gap-2 py-2 border-b last:border-b-0">
                      <div className="flex-1 min-w-[180px]">
                        <Label className="text-xs text-muted-foreground">Material {idx + 1}</Label>
                        <p className="text-sm font-medium">{item.stock_code} - {item.description}</p>
                      </div>
                      <div className="w-28 space-y-1">
                        <Label className="text-xs">Qty Ordered *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity_ordered}
                          onChange={(e) => setOrderItems(prev => prev.map((p, i) => i === idx ? { ...p, quantity_ordered: e.target.value } : p))}
                        />
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-xs">UOM</Label>
                        <Input value={item.uom} readOnly disabled className="bg-muted" />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setOrderItems(prev => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {orderItems.length === 0 && (
                    <p className="text-sm text-muted-foreground">No line items yet — search and add the materials on the invoice.</p>
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
                      <Input type="date" value={formData.date_received} onChange={(e) => setFormData(prev => ({ ...prev, date_received: e.target.value }))} />
                    </div>
                    <div className="col-span-1 sm:col-span-2 space-y-2 relative">
                      <Label>Stock Code *</Label>
                      <Input
                        value={stockCodeSearch}
                        onChange={(e) => { setStockCodeSearch(e.target.value); setShowStockCodeDropdown(true); }}
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

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit}>Record Receiving</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-4 rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by lot number, batch, or description..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
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
                        <span className="badge-inactive flex items-center gap-1 text-xs"><XCircle className="h-3 w-3" /><span className="hidden sm:inline">Rejected</span></span>
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

      {stockOrders.filter(o => o.status !== 'received').length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Orders Awaiting Receipt</h3>
            <Badge variant="outline">{stockOrders.filter(o => o.status !== 'received').length} open</Badge>
          </div>
          <div className="space-y-3">
            {stockOrders.filter(o => o.status !== 'received').map(order => {
              const supplier = getSupplier(order.supplier_id);
              const receivedCount = order.items.filter(i => i.received).length;
              return (
                <div key={order.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium">{order.po_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {supplier?.name || 'Unknown supplier'}
                      {order.invoice_number ? ` · Invoice ${order.invoice_number}` : ''} · {formatDate(order.order_date)}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {order.items.length} line item(s) · {receivedCount} received
                  </div>
                  {order.status === 'partial' && <Badge className="bg-amber-500">Partial</Badge>}
                  {order.status === 'awaiting_receipt' && <Badge variant="outline">Awaiting receipt</Badge>}
                  <Button size="sm" className="gap-2" onClick={() => openConfirmDialog(order)}>
                    <PackageCheck className="h-4 w-4" />
                    Confirm Stock
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!confirmOrder} onOpenChange={(open) => { if (!open) setConfirmOrder(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Confirm Stock Received — {confirmOrder?.po_number}</DialogTitle>
            <DialogDescription>Tick the items that have arrived and enter the actual weight/quantity received.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {confirmOrder?.items.map(it => {
              const sc = getStockCode(it.stock_code_id);
              const state = confirmState[it.id] || { checked: false, qty: String(it.quantity_ordered) };
              return (
                <div key={it.id} className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${it.received ? 'opacity-60' : ''}`}>
                  <Checkbox
                    checked={it.received ? true : state.checked}
                    disabled={it.received}
                    onCheckedChange={(v) => setConfirmState(prev => ({ ...prev, [it.id]: { ...state, checked: v === true } }))}
                  />
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-sm font-medium">{sc?.stock_code} - {sc?.description || 'Unknown material'}</p>
                    <p className="text-xs text-muted-foreground">Ordered: {it.quantity_ordered} {it.uom}</p>
                    {it.received && (
                      <p className="text-xs text-green-600">
                        Received {it.quantity_received} {it.uom} · Lot {it.received_lot_number}
                      </p>
                    )}
                  </div>
                  <div className="w-32 space-y-1">
                    <Label className="text-xs">Actual Weight *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.received ? String(it.quantity_received ?? '') : state.qty}
                      disabled={it.received}
                      onChange={(e) => setConfirmState(prev => ({ ...prev, [it.id]: { ...state, qty: e.target.value } }))}
                    />
                  </div>
                  <div className="w-16 text-sm text-muted-foreground">{it.uom}</div>
                </div>
              );
            })}
            {confirmOrder && confirmOrder.items.every(i => i.received) && (
              <p className="text-sm text-green-600 font-medium">All items on this order have been received.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOrder(null)}>Cancel</Button>
            <Button onClick={handleConfirmReceipt} disabled={confirmingReceipt || (!!confirmOrder && confirmOrder.items.every(i => i.received))} className="gap-2">
              {confirmingReceipt && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm Received Items
            </Button>
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
                    <p>{selectedRecord.status === 'accepted' ? <span className="badge-active">Accepted</span> : <span className="badge-inactive">Rejected</span>}</p>
                    {/* Admin-only status change */}
                    {canDelete && (
                      <div className="mt-2">
                        <Select
                          value={selectedRecord.status}
                          onValueChange={async (value) => {
                            const { error } = await supabase
                              .from('fms_receiving')
                              .update({ status: value, rejection_reason: value === 'rejected' ? 'Status changed by administrator' : null })
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
                            <SelectItem value="rejected">Rejected</SelectItem>
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