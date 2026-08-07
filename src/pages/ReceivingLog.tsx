import React, { useState, useEffect, useMemo } from 'react';
import { useFMSData } from '@/hooks/useFMSData';
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
import { Plus, Search, Truck, CheckCircle, XCircle, Eye, FileText, Loader2, QrCode, Trash2, Download, Camera } from 'lucide-react';
import { useActivityLog } from '@/hooks/useActivityLog';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';
import { format } from 'date-fns';
import { generateQRCodePair, printQRCodes, downloadQRCodeWithLabel, generateQRCodeImage } from '@/lib/qrCodeUtils';
import { QRScanner } from '@/components/QRScanner';
import { extractBestScanIdentifier } from '@/lib/scanParser';
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
  const { receivingRecords, stockCodes, suppliers, loading, addReceivingRecord, refreshData } = useFMSData();
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

    if (!formData.expiry_date) {
      toast.error('Please enter Expiry Date');
      return;
    }

    if (new Date(formData.expiry_date) < new Date()) {
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
      expiry_date: formData.expiry_date,
      delivery_note_number: formData.invoice_number || undefined,
      quality_checks: qualityChecks,
      status: hasFailed ? 'rejected' : 'accepted',
      rejection_reason: hasFailed ? 'Quality check failed' : undefined,
      received_by: user?.id || '',
      cost_price_per_kg: costNum != null && !isNaN(costNum) ? costNum : null,
    } as any);

    if (result) {
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
        await refreshPrices();
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
      await refreshPrices();
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
      expiryDate: record.expiry_date,
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
        'Expiry': formatDate(rec.expiry_date),
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
        'Expiry Date': formatDate(rec.expiry_date),
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
                      <Label>Expiry Date *</Label>
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
                    <td className="hidden md:table-cell">{formatDate(rec.expiry_date)}</td>
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
                  <div><Label className="text-muted-foreground">Expiry Date</Label><p className="font-medium">{formatDate(selectedRecord.expiry_date)}</p></div>
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