import React, { useState } from 'react';
import { useFMSData } from '@/hooks/useFMSData';
import { useActivityLog } from '@/hooks/useActivityLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Search, ArrowRight, ArrowLeft, FileText, Download, AlertTriangle, Package, Truck, Factory, Send, Loader2, Camera, Users } from 'lucide-react';
import { exportToPDF, exportToExcel } from '@/lib/exportUtils';
import { QRScanner } from '@/components/QRScanner';
import { extractBestScanIdentifier } from '@/lib/scanParser';
const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (date: string | Date): string => {
  return new Date(date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

interface ExportField {
  key: string;
  label: string;
  checked: boolean;
}

const Traceability: React.FC = () => {
  const { stockCodes, suppliers, receivingRecords, productionBatches, dispatchRecords, loading } = useFMSData();
  const { logActivity } = useActivityLog();

  const [searchType, setSearchType] = useState<'forward' | 'backward'>('backward');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  
  // Export field selection
  const [backwardFields, setBackwardFields] = useState<ExportField[]>([
    { key: 'internal_lot_number', label: 'Lot Number', checked: true },
    { key: 'material', label: 'Material', checked: true },
    { key: 'supplier', label: 'Supplier', checked: true },
    { key: 'quantity', label: 'Quantity', checked: true },
    { key: 'expiry_date', label: 'Expiry Date', checked: true },
    { key: 'received_at', label: 'Received Date', checked: false },
    { key: 'status', label: 'Status', checked: false },
  ]);
  
  const [forwardFields, setForwardFields] = useState<ExportField[]>([
    { key: 'batch_number', label: 'Batch Number', checked: true },
    { key: 'product', label: 'Product', checked: true },
    { key: 'quantity', label: 'Quantity', checked: true },
    { key: 'production_date', label: 'Production Date', checked: true },
    { key: 'customer', label: 'Customer', checked: true },
    { key: 'status', label: 'Status', checked: false },
  ]);

  const getStockCode = (id: string) => stockCodes.find(sc => sc.id === id);
  const getSupplier = (id: string) => suppliers.find(s => s.id === id);

  // Backward trace: From batch number, find raw materials and if this batch was used as RM in other batches
  const handleBackwardTrace = (query: string) => {
    // First, check if it's a batch number
    const batch = productionBatches.find(b => b.batch_number.toLowerCase().includes(query.toLowerCase()));

    if (batch) {
      const finishedGood = getStockCode(batch.finished_good_id);
      const batchData = batch as any;
      
      // Get raw materials from pre-weigh materials
      const preWeighMaterials = batchData.pre_weigh_materials || [];
      
      // Find if this batch was used as raw material in other batches
      const usedInBatches = productionBatches.filter(b => {
        if (b.id === batch.id) return false;
        const materials = (b as any).pre_weigh_materials || [];
        return materials.some((m: any) => 
          m.raw_material_batch_number?.toLowerCase().includes(batch.batch_number.toLowerCase())
        );
      });

      // Get receiving records that might be linked
      const linkedReceiving = receivingRecords.filter(r => {
        return preWeighMaterials.some((m: any) => 
          m.raw_material_batch_number && 
          (r.internal_lot_number.toLowerCase().includes(m.raw_material_batch_number.toLowerCase()) ||
           r.supplier_batch_number.toLowerCase().includes(m.raw_material_batch_number.toLowerCase()))
        );
      });

      setSearchResults({
        type: 'backward',
        batch,
        finishedGood,
        preWeighMaterials,
        linkedReceiving: linkedReceiving.map(r => ({ 
          ...r, 
          stockCode: getStockCode(r.stock_code_id), 
          supplier: getSupplier(r.supplier_id) 
        })),
        usedInBatches: usedInBatches.map(b => ({
          ...b,
          finishedGood: getStockCode(b.finished_good_id),
        })),
      });
      return;
    }

    // Check if it's a raw material batch number used in production batches
    const batchesUsingRM = productionBatches.filter(b => {
      const materials = (b as any).pre_weigh_materials || [];
      return materials.some((m: any) => 
        m.raw_material_batch_number?.toLowerCase().includes(query.toLowerCase())
      );
    });

    if (batchesUsingRM.length > 0) {
      setSearchResults({
        type: 'backward_rm',
        searchQuery: query,
        affectedBatches: batchesUsingRM.map(b => ({
          ...b,
          finishedGood: getStockCode(b.finished_good_id),
        })),
      });
      return;
    }

    toast.error('No matching batch or raw material batch number found');
    setSearchResults(null);
  };

  // Forward trace: From lot/batch number, find all batches that used it and their dispatch destinations
  const handleForwardTrace = (query: string) => {
    // Check receiving records
    const receiving = receivingRecords.find(r =>
      r.internal_lot_number.toLowerCase().includes(query.toLowerCase()) ||
      r.supplier_batch_number.toLowerCase().includes(query.toLowerCase())
    );

    // Also check if searching for a batch number
    const batch = productionBatches.find(b => b.batch_number.toLowerCase().includes(query.toLowerCase()));

    if (receiving) {
      const stockCode = getStockCode(receiving.stock_code_id);
      const supplier = getSupplier(receiving.supplier_id);
      
      // Find batches that used this lot number in their pre-weigh materials
      const affectedBatches = productionBatches.filter(b => {
        const materials = (b as any).pre_weigh_materials || [];
        return materials.some((m: any) => 
          m.raw_material_batch_number?.toLowerCase().includes(receiving.internal_lot_number.toLowerCase()) ||
          m.raw_material_batch_number?.toLowerCase().includes(receiving.supplier_batch_number.toLowerCase())
        );
      });
      // Find dispatches that contain these batches
      const affectedBatchIds = affectedBatches.map(b => b.id);
      const affectedDispatches = dispatchRecords.filter(d => 
        d.items?.some((item: any) => affectedBatchIds.includes(item.batch_id))
      );

      setSearchResults({
        type: 'forward',
        receiving: { ...receiving, stockCode, supplier },
        affectedBatches: affectedBatches.map(b => ({ 
          ...b, 
          finishedGood: getStockCode(b.finished_good_id) 
        })),
        affectedDispatches: affectedDispatches.map(d => ({
          ...d,
          batchNumbers: d.items?.map((item: any) => {
            const batch = productionBatches.find(b => b.id === item.batch_id);
            return batch?.batch_number || '';
          }).filter(Boolean) || [],
        })),
      });
      return;
    }

    if (batch) {
      const finishedGood = getStockCode(batch.finished_good_id);
      
      // Find dispatches that contain this batch
      const affectedDispatches = dispatchRecords.filter(d => 
        d.items?.some((item: any) => item.batch_id === batch.id)
      );

      setSearchResults({
        type: 'forward_batch',
        batch: { ...batch, finishedGood },
        affectedDispatches: affectedDispatches.map(d => ({
          ...d,
          dispatchedQuantity: d.items?.find((item: any) => item.batch_id === batch.id)?.quantity || 0,
        })),
      });
      return;
    }

    toast.error('No matching receiving record or batch found');
    setSearchResults(null);
  };

  const handleSearch = () => {
    const parsed = extractBestScanIdentifier(searchQuery);
    if (!parsed) { toast.error('Please enter a search query'); return; }
    if (searchType === 'backward') handleBackwardTrace(parsed);
    else handleForwardTrace(parsed);
  };

  const handleQRScan = (result: string) => {
    const parsed = extractBestScanIdentifier(result);
    setSearchQuery(parsed);
    if (searchType === 'backward') handleBackwardTrace(parsed);
    else handleForwardTrace(parsed);
  };

  const toggleExportField = (type: 'backward' | 'forward', key: string) => {
    if (type === 'backward') {
      setBackwardFields(prev => prev.map(f => f.key === key ? { ...f, checked: !f.checked } : f));
    } else {
      setForwardFields(prev => prev.map(f => f.key === key ? { ...f, checked: !f.checked } : f));
    }
  };

  const getExportData = () => {
    if (!searchResults) return [];
    
    const fields = searchResults.type.startsWith('backward') ? backwardFields : forwardFields;
    const selectedKeys = fields.filter(f => f.checked).map(f => f.key);
    
    if (searchResults.type === 'backward') {
      return searchResults.linkedReceiving.map((rm: any) => {
        const row: Record<string, any> = {};
        if (selectedKeys.includes('internal_lot_number')) row['Lot Number'] = rm.internal_lot_number;
        if (selectedKeys.includes('material')) row['Material'] = rm.stockCode?.description || '';
        if (selectedKeys.includes('supplier')) row['Supplier'] = rm.supplier?.name || '';
        if (selectedKeys.includes('quantity')) row['Quantity'] = rm.quantity_received;
        if (selectedKeys.includes('expiry_date')) row['Expiry Date'] = rm.expiry_date ? formatDate(rm.expiry_date) : '';
        if (selectedKeys.includes('received_at')) row['Received Date'] = rm.received_at ? formatDate(rm.received_at) : '';
        if (selectedKeys.includes('status')) row['Status'] = rm.status;
        return row;
      });
    } else if (searchResults.type === 'forward' || searchResults.type === 'forward_batch') {
      const batches = searchResults.affectedBatches || [searchResults.batch];
      return batches.map((b: any) => {
        const row: Record<string, any> = {};
        if (selectedKeys.includes('batch_number')) row['Batch Number'] = b.batch_number;
        if (selectedKeys.includes('product')) row['Product'] = b.finishedGood?.description || '';
        if (selectedKeys.includes('quantity')) row['Quantity'] = b.planned_batch_size;
        if (selectedKeys.includes('production_date')) row['Production Date'] = formatDate(b.planned_production_date);
        if (selectedKeys.includes('customer')) {
          const dispatches = searchResults.affectedDispatches || [];
          const customers = dispatches.map((d: any) => d.customer_name).join(', ');
          row['Customer'] = customers || 'Not Dispatched';
        }
        if (selectedKeys.includes('status')) row['Status'] = b.status;
        return row;
      });
    }
    return [];
  };

  const handleExportPDF = () => {
    if (!searchResults) { toast.error('Please run a trace first'); return; }
    const data = getExportData();
    if (data.length === 0) { toast.error('No data to export'); return; }
    exportToPDF(data, `Trace_${searchResults.type}`);
    toast.success('PDF exported');
  };

  const handleExportExcel = () => {
    if (!searchResults) { toast.error('Please run a trace first'); return; }
    const data = getExportData();
    if (data.length === 0) { toast.error('No data to export'); return; }
    exportToExcel(data, `Trace_${searchResults.type}`);
    toast.success('Excel exported');
  };

  const currentFields = searchResults?.type?.startsWith('backward') ? backwardFields : forwardFields;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-2">Loading...</span></div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in px-2 sm:px-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm sm:text-base">Trace products forward or backward through the supply chain</p>
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
          <Button variant="outline" size="sm" onClick={handleExportPDF}><FileText className="mr-2 h-4 w-4" /><span className="hidden sm:inline">Export PDF</span></Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}><Download className="mr-2 h-4 w-4" /><span className="hidden sm:inline">Export Excel</span></Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <Tabs value={searchType} onValueChange={(v) => setSearchType(v as 'forward' | 'backward')}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="backward" className="gap-2 text-xs sm:text-sm"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Backward</span> Trace</TabsTrigger>
            <TabsTrigger value="forward" className="gap-2 text-xs sm:text-sm"><ArrowRight className="h-4 w-4" /><span className="hidden sm:inline">Forward</span> Trace</TabsTrigger>
          </TabsList>
          <TabsContent value="backward" className="mt-4">
            <p className="text-sm text-muted-foreground">Enter a batch number or raw material batch number to trace backwards to raw materials and find where this batch was used.</p>
          </TabsContent>
          <TabsContent value="forward" className="mt-4">
            <p className="text-sm text-muted-foreground">Enter a lot number or batch number to find which batches used this material and which customers received them.</p>
          </TabsContent>
        </Tabs>
        <div className="mt-4 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder={searchType === 'backward' ? 'Enter batch number or RM batch number...' : 'Enter lot number or batch number...'} 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="pl-9" 
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()} 
            />
          </div>
          <Button onClick={handleSearch} className="w-full sm:w-auto"><Search className="mr-2 h-4 w-4" />Trace</Button>
        </div>
      </div>

      {searchResults && (
        <div className="space-y-4 sm:space-y-6 animate-fade-in">
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
            <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" /><h3 className="font-semibold">Trace Complete</h3></div>
          </div>

          {/* Export Field Selection */}
          <div className="rounded-xl border border-border bg-card p-4">
            <Label className="text-base font-semibold mb-3 block">Select Fields to Export</Label>
            <div className="flex flex-wrap gap-4">
              {currentFields.map((field) => (
                <div key={field.key} className="flex items-center gap-2">
                  <Checkbox 
                    id={field.key} 
                    checked={field.checked} 
                    onCheckedChange={() => toggleExportField(searchResults.type.startsWith('backward') ? 'backward' : 'forward', field.key)} 
                  />
                  <Label htmlFor={field.key} className="text-sm cursor-pointer">{field.label}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Backward Trace Results */}
          {searchResults.type === 'backward' && (
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Factory className="h-5 w-5 text-primary" /></div>
                <div><h3 className="font-semibold">Production Batch</h3><p className="text-sm text-muted-foreground">{searchResults.batch.batch_number}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                <div><Label className="text-muted-foreground">Product</Label><p className="font-medium">{searchResults.finishedGood?.description}</p></div>
                <div><Label className="text-muted-foreground">Quantity</Label><p className="font-medium">{searchResults.batch.planned_batch_size}</p></div>
                <div><Label className="text-muted-foreground">Date</Label><p className="font-medium">{formatDate(searchResults.batch.planned_production_date)}</p></div>
                <div><Label className="text-muted-foreground">Status</Label><Badge variant="outline">{searchResults.batch.status}</Badge></div>
              </div>
              
              {/* Pre-Weigh Materials */}
              {searchResults.preWeighMaterials?.length > 0 && (
                <div className="mt-6">
                  <Label className="text-base font-semibold mb-3 block">Pre-Weigh Materials ({searchResults.preWeighMaterials.length})</Label>
                  <div className="rounded-lg border border-border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Stock Code</th>
                          <th className="px-4 py-2 text-left font-medium">Material</th>
                          <th className="px-4 py-2 text-right font-medium">Qty</th>
                          <th className="px-4 py-2 text-left font-medium">RM Batch No.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.preWeighMaterials.map((mat: any, index: number) => (
                          <tr key={index} className="border-t border-border">
                            <td className="px-4 py-2 font-medium">{mat.stock_code}</td>
                            <td className="px-4 py-2">{mat.material_name}</td>
                            <td className="px-4 py-2 text-right">{mat.required_quantity} {mat.uom}</td>
                            <td className="px-4 py-2">{mat.raw_material_batch_number || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Linked Receiving Records */}
              {searchResults.linkedReceiving?.length > 0 && (
                <div className="mt-6">
                  <Label className="text-base font-semibold mb-3 block">Linked Receiving Records ({searchResults.linkedReceiving.length})</Label>
                  <div className="rounded-lg border border-border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Lot Number</th>
                          <th className="px-4 py-2 text-left font-medium">Material</th>
                          <th className="px-4 py-2 text-left font-medium">Supplier</th>
                          <th className="px-4 py-2 text-right font-medium">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.linkedReceiving.map((rm: any) => (
                          <tr key={rm.id} className="border-t border-border">
                            <td className="px-4 py-2 font-medium">{rm.internal_lot_number}</td>
                            <td className="px-4 py-2">{rm.stockCode?.description}</td>
                            <td className="px-4 py-2">{rm.supplier?.name}</td>
                            <td className="px-4 py-2 text-right">{rm.quantity_received}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Used In Other Batches */}
              {searchResults.usedInBatches?.length > 0 && (
                <div className="mt-6">
                  <Label className="text-base font-semibold mb-3 block flex items-center gap-2">
                    <Factory className="h-4 w-4" />
                    Used as Raw Material In ({searchResults.usedInBatches.length} batches)
                  </Label>
                  <div className="rounded-lg border border-border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Batch Number</th>
                          <th className="px-4 py-2 text-left font-medium">Product</th>
                          <th className="px-4 py-2 text-left font-medium">Date</th>
                          <th className="px-4 py-2 text-left font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.usedInBatches.map((b: any) => (
                          <tr key={b.id} className="border-t border-border">
                            <td className="px-4 py-2 font-medium">{b.batch_number}</td>
                            <td className="px-4 py-2">{b.finishedGood?.description}</td>
                            <td className="px-4 py-2">{formatDate(b.planned_production_date)}</td>
                            <td className="px-4 py-2"><Badge variant="outline">{b.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Backward RM Trace Results */}
          {searchResults.type === 'backward_rm' && (
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10"><Package className="h-5 w-5 text-warning" /></div>
                <div><h3 className="font-semibold">Raw Material Batch Number Search</h3><p className="text-sm text-muted-foreground">"{searchResults.searchQuery}"</p></div>
              </div>
              
              <div className="mt-4">
                <Label className="text-base font-semibold mb-3 block">Used in Batches ({searchResults.affectedBatches.length})</Label>
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Batch Number</th>
                        <th className="px-4 py-2 text-left font-medium">Product</th>
                        <th className="px-4 py-2 text-left font-medium">Date</th>
                        <th className="px-4 py-2 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.affectedBatches.map((b: any) => (
                        <tr key={b.id} className="border-t border-border">
                          <td className="px-4 py-2 font-medium">{b.batch_number}</td>
                          <td className="px-4 py-2">{b.finishedGood?.description}</td>
                          <td className="px-4 py-2">{formatDate(b.planned_production_date)}</td>
                          <td className="px-4 py-2"><Badge variant="outline">{b.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Forward Trace Results - Receiving */}
          {searchResults.type === 'forward' && (
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10"><Truck className="h-5 w-5 text-success" /></div>
                <div><h3 className="font-semibold">Source Material</h3><p className="text-sm text-muted-foreground">{searchResults.receiving.internal_lot_number}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                <div><Label className="text-muted-foreground">Material</Label><p className="font-medium">{searchResults.receiving.stockCode?.description}</p></div>
                <div><Label className="text-muted-foreground">Supplier</Label><p className="font-medium">{searchResults.receiving.supplier?.name}</p></div>
                <div><Label className="text-muted-foreground">Quantity</Label><p className="font-medium">{searchResults.receiving.quantity_received}</p></div>
                <div><Label className="text-muted-foreground">Status</Label><Badge variant="outline">{searchResults.receiving.status}</Badge></div>
              </div>
              
              {/* Affected Batches */}
              {searchResults.affectedBatches?.length > 0 && (
                <div className="mt-6">
                  <Label className="text-base font-semibold mb-3 block">Affected Batches ({searchResults.affectedBatches.length})</Label>
                  <div className="rounded-lg border border-border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Batch Number</th>
                          <th className="px-4 py-2 text-left font-medium">Product</th>
                          <th className="px-4 py-2 text-left font-medium">Date</th>
                          <th className="px-4 py-2 text-left font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.affectedBatches.map((b: any) => (
                          <tr key={b.id} className="border-t border-border">
                            <td className="px-4 py-2 font-medium">{b.batch_number}</td>
                            <td className="px-4 py-2">{b.finishedGood?.description}</td>
                            <td className="px-4 py-2">{formatDate(b.planned_production_date)}</td>
                            <td className="px-4 py-2"><Badge variant="outline">{b.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Customer Dispatches */}
              {searchResults.affectedDispatches?.length > 0 && (
                <div className="mt-6">
                  <Label className="text-base font-semibold mb-3 block flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Customer Dispatches ({searchResults.affectedDispatches.length})
                  </Label>
                  <div className="rounded-lg border border-border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Invoice No.</th>
                          <th className="px-4 py-2 text-left font-medium">Customer</th>
                          <th className="px-4 py-2 text-left font-medium">Date</th>
                          <th className="px-4 py-2 text-left font-medium">Batches</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.affectedDispatches.map((d: any) => (
                          <tr key={d.id} className="border-t border-border">
                            <td className="px-4 py-2 font-medium">{d.invoice_number}</td>
                            <td className="px-4 py-2">{d.customer_name}</td>
                            <td className="px-4 py-2">{formatDate(d.dispatch_date || d.created_at)}</td>
                            <td className="px-4 py-2">{d.batchNumbers?.join(', ') || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {searchResults.affectedDispatches?.length === 0 && (
                <div className="mt-6 p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-muted-foreground">No customer dispatches found for affected batches</p>
                </div>
              )}
            </div>
          )}

          {/* Forward Trace Results - Batch to Customers */}
          {searchResults.type === 'forward_batch' && (
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Factory className="h-5 w-5 text-primary" /></div>
                <div><h3 className="font-semibold">Production Batch</h3><p className="text-sm text-muted-foreground">{searchResults.batch.batch_number}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                <div><Label className="text-muted-foreground">Product</Label><p className="font-medium">{searchResults.batch.finishedGood?.description}</p></div>
                <div><Label className="text-muted-foreground">Quantity</Label><p className="font-medium">{searchResults.batch.planned_batch_size}</p></div>
                <div><Label className="text-muted-foreground">Date</Label><p className="font-medium">{formatDate(searchResults.batch.planned_production_date)}</p></div>
                <div><Label className="text-muted-foreground">Status</Label><Badge variant="outline">{searchResults.batch.status}</Badge></div>
              </div>
              
              {/* Customer Dispatches */}
              {searchResults.affectedDispatches?.length > 0 ? (
                <div className="mt-6">
                  <Label className="text-base font-semibold mb-3 block flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Dispatched to Customers ({searchResults.affectedDispatches.length})
                  </Label>
                  <div className="rounded-lg border border-border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Invoice No.</th>
                          <th className="px-4 py-2 text-left font-medium">Customer</th>
                          <th className="px-4 py-2 text-left font-medium">Date</th>
                          <th className="px-4 py-2 text-right font-medium">Qty Dispatched</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.affectedDispatches.map((d: any) => (
                          <tr key={d.id} className="border-t border-border">
                            <td className="px-4 py-2 font-medium">{d.invoice_number}</td>
                            <td className="px-4 py-2">{d.customer_name}</td>
                            <td className="px-4 py-2">{formatDate(d.dispatch_date || d.created_at)}</td>
                            <td className="px-4 py-2 text-right">{d.dispatchedQuantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="mt-6 p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-muted-foreground">This batch has not been dispatched to any customers yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Traceability;