import React, { useState, useMemo, useEffect } from 'react';
import { useFMSData, formatDate, formatDateTime } from '@/hooks/useFMSData';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { useDeletePermission } from '@/hooks/useDeletePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Factory, Printer, Eye, Play, CheckCircle, XCircle, Clock, FileText, Loader2, QrCode, Trash2, Download, Edit2, Camera, Table, Copy } from 'lucide-react';
import { generateQRCodePair, printQRCodes, downloadQRCodeWithLabel, generateQRCodeImage, copyQRCodeWithLabel } from '@/lib/qrCodeUtils';
import { QRScanner } from '@/components/QRScanner';
import { exportToExcel } from '@/lib/exportUtils';
import { format } from 'date-fns';
import { extractBestScanIdentifier } from '@/lib/scanParser';
type BatchStatus = 'draft' | 'pre_weighing' | 'manufacturing' | 'in_progress' | 'closed' | 'cancelled';
type QualityCheckResult = 'pass' | 'fail' | 'pending';

interface ProcessingStep {
  id: string;
  step_order: number;
  step_name: string;
  description?: string;
  required_time?: number;
  completed: boolean;
  completed_at?: string;
  completed_by?: string;
}

interface OrganolepticCheck {
  name: string;
  expected_value: string;
  result: 'pass' | 'fail' | 'pending';
  checked_at?: string;
  checked_by?: string;
}

interface PreWeighMaterial {
  material_id: string;
  material_name: string;
  stock_code: string;
  required_quantity: number;
  quantity_weighed?: number;
  uom: string;
  raw_material_batch_number: string; // This is now "External Batch Number"
  internal_lot_number: string; // Links to receiving record LOT-YYYY-XXXX
  expiry_date?: string; // Expiry from receiving record
  approved: boolean;
}

interface FinalQualityChecks {
  product_appearance: boolean;
  packaging_check: boolean;
  label_check: boolean;
  weight_check: boolean;
  notes?: string;
}

const defaultProcessingSteps: Omit<ProcessingStep, 'id'>[] = [
  { step_order: 1, step_name: 'Mixing', description: 'Combine all ingredients', required_time: 15, completed: false },
  { step_order: 2, step_name: 'Processing', description: 'Main processing step', completed: false },
  { step_order: 3, step_name: 'Cooling', description: 'Cool to room temperature', completed: false },
  { step_order: 4, step_name: 'Packing', description: 'Pack finished product', completed: false },
];

const Production: React.FC = () => {
  const { user } = useFMSAuth();
  const { stockCodes, boms, productionBatches, loading, addProductionBatch, updateProductionBatch, getStockCodeById, getBOMByFinishedGoodId, refreshData } = useFMSData();
  
  // Helper to get BOM by ID
  const getBOMById = (bomId: string) => boms.find(b => b.id === bomId);
  const { canDelete } = useDeletePermission();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BatchStatus | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<typeof productionBatches[0] | null>(null);

  // Allow FG, WIP, and RM for batch sheet creation
  const eligibleProducts = stockCodes.filter(sc => 
    (sc.item_type === 'finished_good' || sc.item_type === 'work_in_progress' || sc.item_type === 'raw_material') && 
    sc.status === 'active'
  );

  // Searchable options
  const productOptions: SearchableSelectOption[] = useMemo(() => 
    eligibleProducts.map(p => ({
      value: p.id,
      label: p.stock_code,
      sublabel: p.description,
      badge: p.item_type.replace('_', ' '),
    })),
    [eligibleProducts]
  );

  // Form state
  const [formData, setFormData] = useState({
    finished_good_id: '',
    planned_batch_size: '',
    planned_production_date: new Date().toISOString().split('T')[0],
    production_instructions: '',
    number_of_batches: '1',
  });

  const selectedBOMMaterials = React.useMemo(() => {
    if (!formData.finished_good_id) return [];
    const bom = getBOMByFinishedGoodId(formData.finished_good_id);
    if (!bom) return [];
    const batchSize = parseFloat(formData.planned_batch_size);
    if (Number.isNaN(batchSize) || batchSize <= 0) return [];

    return bom.components.map((comp) => {
      const material = getStockCodeById(comp.material_stock_code_id);
      const requiredQuantity = comp.quantity_per_batch * batchSize;
      return {
        ...comp,
        material,
        requiredQuantity,
      };
    });
  }, [formData.finished_good_id, formData.planned_batch_size, getBOMByFinishedGoodId, getStockCodeById]);
// reset from data 
  const resetForm = () => {
    setFormData({
      finished_good_id: '',
      planned_batch_size: '',
      planned_production_date: new Date().toISOString().split('T')[0],
      production_instructions: '',
      number_of_batches: '1',
    });
  };
// create batch function
  const handleCreateBatch = async () => {
    if (!formData.finished_good_id || !formData.planned_batch_size) {
      toast.error('Please fill in all required fields');
      return;
    }

    const numberOfBatches = Math.max(1, Math.min(50, parseInt(formData.number_of_batches) || 1));

    const bom = getBOMByFinishedGoodId(formData.finished_good_id);
    if (!bom) {
      toast.error('No active BOM found for this product');
      return;
    }

    const bomData = bom as any;

    // Use steps from BOM if available, otherwise default
    const bomSteps = bomData.processing_steps as ProcessingStep[] | undefined;

    let createdCount = 0;
    for (let b = 0; b < numberOfBatches; b++) {
      const processingSteps: ProcessingStep[] = bomSteps && bomSteps.length > 0
        ? bomSteps.map((step, index) => ({
            ...step,
            id: `step-${Date.now()}-${b}-${index}`,
            completed: false,
            completed_at: undefined,
            completed_by: undefined,
          }))
        : defaultProcessingSteps.map((step, index) => ({
            ...step,
            id: `step-${Date.now()}-${b}-${index}`,
          }));

      // Use organoleptic parameters from BOM if available
      const bomOrganoleptic = bomData.organoleptic_parameters || [];
      const organolepticChecks: OrganolepticCheck[] = bomOrganoleptic.length > 0
        ? bomOrganoleptic.map((param: any) => ({
            name: param.name,
            expected_value: param.expected_value,
            result: 'pending' as const,
          }))
        : [
            { name: 'Colour', expected_value: '', result: 'pending' as const },
            { name: 'Texture', expected_value: '', result: 'pending' as const },
            { name: 'Taste', expected_value: '', result: 'pending' as const },
            { name: 'Smell', expected_value: '', result: 'pending' as const },
          ];

      // Create pre-weigh materials from BOM components
      const preWeighMaterials: PreWeighMaterial[] = bom.components.map(comp => {
        const material = getStockCodeById(comp.material_stock_code_id);
        return {
          material_id: comp.material_stock_code_id,
          material_name: material?.description || '',
          stock_code: material?.stock_code || '',
          required_quantity: comp.quantity_per_batch * parseFloat(formData.planned_batch_size),
          quantity_weighed: undefined,
          uom: material?.unit_of_measure || '',
          raw_material_batch_number: '',
          internal_lot_number: '',
          expiry_date: '',
          approved: false,
        };
      });

      const result = await addProductionBatch({
        finished_good_id: formData.finished_good_id,
        bom_id: bom.id,
        planned_batch_size: parseFloat(formData.planned_batch_size),
        status: 'draft',
        planned_production_date: formData.planned_production_date,
        production_instructions: formData.production_instructions,
        processing_steps: processingSteps,
        quality_checks: organolepticChecks,
        pre_weigh_approved: false,
        retention_sample_taken: false,
        operator_id: user?.id || '',
        pre_weigh_materials: preWeighMaterials,
      } as any);

      if (result) createdCount++;
    }

    if (createdCount > 0) {
      setDialogOpen(false);
      resetForm();
      await refreshData();
      toast.success(`Successfully created ${createdCount} batch sheet${createdCount > 1 ? 's' : ''}`);
    }
  };

  const handleStartProduction = async (batchId: string) => {
    const batch = productionBatches.find(b => b.id === batchId);
    if (batch?.status === 'cancelled') {
      toast.error('Cannot start a cancelled batch. Reactivate it first.');
      return;
    }
    await updateProductionBatch(batchId, { 
      status: 'pre_weighing',
      production_start: new Date().toISOString(),
    });
    toast.success('Production started');
    await refreshData();
  };

  const handleCancelBatch = async (batchId: string) => {
    await updateProductionBatch(batchId, {
      status: 'cancelled',
      production_end: new Date().toISOString(),
    } as any);
    toast.success('Batch cancelled');
    await refreshData();
  };

  const handleReactivateBatch = async (batchId: string) => {
    await updateProductionBatch(batchId, {
      status: 'draft',
      production_start: null,
      production_end: null,
    } as any);
    toast.success('Batch reactivated to draft');
    await refreshData();
  };

  const handleApprovePreWeigh = async (batchId: string, preWeighMaterials: PreWeighMaterial[]) => {
    await updateProductionBatch(batchId, { 
      pre_weigh_approved: true,
      pre_weigh_approved_by: user?.id,
      pre_weigh_approved_at: new Date().toISOString(),
      pre_weigh_materials: preWeighMaterials,
      status: 'manufacturing',
    } as any);
    toast.success('Pre-weigh checks approved');
    await refreshData();
  };

  const handleUpdateStep = async (batchId: string, stepId: string, completed: boolean) => {
    const batch = productionBatches.find(b => b.id === batchId);
    if (!batch) return;

    const updatedSteps = (batch.processing_steps as ProcessingStep[]).map(step => 
      step.id === stepId 
        ? { ...step, completed, completed_at: completed ? new Date().toISOString() : undefined, completed_by: completed ? user?.id : undefined }
        : step
    );

    await updateProductionBatch(batchId, { processing_steps: updatedSteps });
    await refreshData();
    // Update local state immediately
    setSelectedBatch(prev => prev ? { ...prev, processing_steps: updatedSteps } : null);
  };

  const handleUpdateOrganolepticCheck = async (batchId: string, checkName: string, result: 'pass' | 'fail') => {
    const batch = productionBatches.find(b => b.id === batchId);
    if (!batch) return;

    const updatedChecks = (batch.quality_checks as OrganolepticCheck[]).map(check => 
      check.name === checkName 
        ? { ...check, result, checked_at: new Date().toISOString(), checked_by: user?.id }
        : check
    );

    await updateProductionBatch(batchId, { quality_checks: updatedChecks });
    await refreshData();
    // Update local state immediately
    setSelectedBatch(prev => prev ? { ...prev, quality_checks: updatedChecks } : null);
  };

  const handleCloseBatch = async (batchId: string, finalData: {
    actual_quantity: number;
    product_size: number;
    product_size_uom: string;
    scrap_waste: number;
    scrap_waste_uom: string;
    waste_notes: string;
    retention_sample_taken: boolean;
    final_checks: FinalQualityChecks;
  }) => {
    await updateProductionBatch(batchId, {
      status: 'closed',
      actual_quantity_produced: finalData.actual_quantity,
      product_size: finalData.product_size,
      scrap_waste: finalData.scrap_waste,
      waste_notes: finalData.waste_notes,
      retention_sample_taken: finalData.retention_sample_taken,
      final_quality_checks: { ...finalData.final_checks, product_size_uom: finalData.product_size_uom, scrap_waste_uom: finalData.scrap_waste_uom },
      production_end: new Date().toISOString(),
      closed_at: new Date().toISOString(),
      supervisor_id: user?.id,
    });
    toast.success('Batch closed successfully');
    await refreshData();
  };

  // HTML escape utility to prevent XSS
  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const handlePrintBatchSheet = async (batch: typeof productionBatches[0]) => {
    const finishedGood = getStockCodeById(batch.finished_good_id);
    const bom = getBOMByFinishedGoodId(batch.finished_good_id);
    const batchData = batch as any;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Fetch print logo setting
    let printLogoUrl = '/images/print-logo.png';
    try {
      const { data } = await supabase
        .from('fms_settings')
        .select('setting_value')
        .eq('setting_key', 'print_logo_url')
        .single();
      if (data?.setting_value) {
        printLogoUrl = typeof data.setting_value === 'string' 
          ? data.setting_value.replace(/^"|"$/g, '') 
          : String(data.setting_value);
      }
    } catch (e) {
      console.error('Error fetching print logo:', e);
    }

    // Materials from BOM components (with batch numbers if available)
    const preWeighMaterials = batchData.pre_weigh_materials || [];
    const materialsFromBOM = bom?.components?.map((comp) => {
      const material = getStockCodeById(comp.material_stock_code_id);
      const qtyRequired = comp.quantity_per_batch * batch.planned_batch_size;
      // Find matching pre-weigh material for batch number
      const preWeighMat = preWeighMaterials.find((m: any) => m.material_id === comp.material_stock_code_id);
      return `<tr>
        <td style="padding: 6px; border: 1px solid #ddd; font-size: 11px;">${escapeHtml(material?.stock_code || '')}</td>
        <td style="padding: 6px; border: 1px solid #ddd; font-size: 11px;">${escapeHtml(material?.description || '')}</td>
        <td style="padding: 6px; border: 1px solid #ddd; text-align: right; font-size: 11px;">${qtyRequired.toFixed(2)} ${escapeHtml(material?.unit_of_measure || '')}</td>
        <td style="padding: 6px; border: 1px solid #ddd; text-align: right; font-size: 11px;">${preWeighMat?.quantity_weighed != null ? `${preWeighMat.quantity_weighed} ${escapeHtml(material?.unit_of_measure || '')}` : ''}</td>
        <td style="padding: 6px; border: 1px solid #ddd; font-size: 11px;">${escapeHtml(preWeighMat?.raw_material_batch_number || '')}</td>
        <td style="padding: 6px; border: 1px solid #ddd; font-size: 11px;">${escapeHtml(preWeighMat?.internal_lot_number || '')}</td>
        <td style="padding: 6px; border: 1px solid #ddd; font-size: 11px;">${preWeighMat?.expiry_date ? escapeHtml(formatDate(preWeighMat.expiry_date)) : ''}</td>
        <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 11px;">${preWeighMat?.approved ? '✓' : '○'}</td>
      </tr>`;
    }).join('') || '';

    const stepsHtml = (batch.processing_steps as ProcessingStep[] || []).map((step, index) => 
      `<tr>
        <td style="padding: 6px; border: 1px solid #ddd; font-size: 11px;">${index + 1}</td>
        <td style="padding: 6px; border: 1px solid #ddd; font-size: 11px;">${escapeHtml(step.step_name || '')}</td>
        <td style="padding: 6px; border: 1px solid #ddd; font-size: 11px;">${escapeHtml(step.description || '')}</td>
        <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 11px;">${step.completed ? '✓' : '○'}</td>
      </tr>`
    ).join('');

    const organolepticHtml = (batch.quality_checks as OrganolepticCheck[] || []).map((check) => 
      `<tr>
        <td style="padding: 6px; border: 1px solid #ddd; font-size: 11px;">${escapeHtml(check.name || '')}</td>
        <td style="padding: 6px; border: 1px solid #ddd; font-size: 11px;">${escapeHtml(check.expected_value || '')}</td>
        <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 11px;">${check.result === 'pass' ? 'P' : check.result === 'fail' ? 'F' : '○'}</td>
      </tr>`
    ).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Batch Sheet - ${escapeHtml(batch.batch_number)}</title>
        <style>
          @page { size: A4; margin: 10mm; }
          body { font-family: Arial, sans-serif; padding: 10px; max-width: 100%; margin: 0 auto; font-size: 11px; }
          h1 { font-size: 16px; margin-bottom: 5px; }
          h2 { font-size: 14px; margin-bottom: 5px; margin-top: 12px; border-bottom: 1px solid #333; padding-bottom: 3px; }
          .header { border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-start; }
          .header-left { flex: 1; }
          .header-logo { width: 60px; height: 60px; object-fit: contain; }
          .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
          .info-item { padding: 5px; background: #f5f5f5; border-radius: 3px; font-size: 10px; }
          .info-label { font-size: 9px; color: #666; }
          .info-value { font-weight: bold; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
          th { background: #333; color: white; padding: 5px; text-align: left; font-size: 10px; }
          td { font-size: 11px; }
          .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px; }
          .signature-line { border-bottom: 1px solid #333; height: 30px; margin-top: 5px; }
          @media print { .no-print { display: none; } body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <h1>PRODUCTION BATCH SHEET</h1>
            <p style="margin: 0; font-size: 10px;">Document No: MS Q004 | ${escapeHtml(batch.batch_number)} | Date: ${escapeHtml(formatDate(batch.planned_production_date))}</p>
          </div>
          <img src="${escapeHtml(printLogoUrl)}" alt="Logo" class="header-logo" onerror="this.style.display='none'" />
        </div>
        
        <div class="info-grid">
          <div class="info-item"><div class="info-label">Product</div><div class="info-value">${escapeHtml(finishedGood?.description || 'N/A')}</div></div>
          <div class="info-item"><div class="info-label">Stock Code</div><div class="info-value">${escapeHtml(finishedGood?.stock_code || 'N/A')}</div></div>
          <div class="info-item"><div class="info-label">Planned Batch Size</div><div class="info-value">${escapeHtml(String(batch.planned_batch_size))} kg</div></div>
          <div class="info-item"><div class="info-label">BOM Version</div><div class="info-value">${bom ? escapeHtml(String(bom.version_number)) : 'N/A'}</div></div>
        </div>
        
        <h2>1. DISPENSING MATERIALS</h2>
        <table>
          <thead><tr><th>Stock Code</th><th>Material Description</th><th style="text-align: right;">Qty Required</th><th style="text-align: right;">Qty Weighed</th><th>Ext. Batch No.</th><th>Int. Lot No.</th><th>Expiry</th><th style="text-align: center;">Check</th></tr></thead>
          <tbody>${materialsFromBOM}</tbody>
        </table>

        <h2>2. PRODUCTION PROCESS</h2>
        <table>
          <thead><tr><th>Step</th><th>Description</th><th>Notes</th><th style="text-align: center;">Tick</th></tr></thead>
          <tbody>${stepsHtml || '<tr><td colspan="4" style="padding: 10px; text-align: center; color: #666;">No processing steps defined</td></tr>'}</tbody>
        </table>

        <h2>3. PRODUCT QUALITY TEST</h2>
        <table>
          <thead><tr><th>Parameter</th><th>Specification</th><th style="text-align: center;">P/F</th></tr></thead>
          <tbody>${organolepticHtml || '<tr><td colspan="3" style="padding: 10px; text-align: center; color: #666;">No parameters defined</td></tr>'}</tbody>
        </table>

        <h2>4. BATCH INFORMATION</h2>
        <div class="info-grid">
          <div class="info-item"><div class="info-label">Expected Qty (±100g)</div><div class="info-value">${batch.planned_batch_size} kg</div></div>
          <div class="info-item"><div class="info-label">Actual Qty Produced</div><div class="info-value">${batch.actual_quantity_produced || '_______'}</div></div>
          <div class="info-item"><div class="info-label">Scrap/Waste</div><div class="info-value">${batch.scrap_waste || '_______'}</div></div>
          <div class="info-item"><div class="info-label">Checker Name</div><div class="info-value">_________________</div></div>
        </div>

        <div class="signature-grid">
          <div><div class="info-label">Operator Signature</div><div class="signature-line"></div><div style="font-size: 9px; margin-top: 3px;">Date: ___________</div></div>
          <div><div class="info-label">Supervisor Signature</div><div class="signature-line"></div><div style="font-size: 9px; margin-top: 3px;">Date: ___________</div></div>
        </div>

        <p style="margin-top: 15px; font-size: 9px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">
          By signing this document, I confirm that I have checked and verified all required fields prior to signing.
        </p>

        <br/>
        <button class="no-print" onclick="window.print()">Print</button>
        <script>setTimeout(() => window.print(), 500);</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };
//prints QR codes
  const handlePrintQRCode = async (batch: typeof productionBatches[0]) => {
    const finishedGood = getStockCodeById(batch.finished_good_id);
    const { qr1, qr2 } = await generateQRCodePair(batch.batch_number, {
      productId: batch.finished_good_id,
      productName: finishedGood?.description,
      plannedSize: batch.planned_batch_size,
      productionDate: batch.planned_production_date,
    });
    
    printQRCodes(qr1, qr2, batch.batch_number, {
      product: finishedGood?.description,
      date: formatDate(batch.planned_production_date),
    });
    toast.success('QR codes generated - print window opened');
  };

  const handleDownloadQRCode = async (batch: typeof productionBatches[0]) => {
    const finishedGood = getStockCodeById(batch.finished_good_id);
    const qrDataUrl = await generateQRCodeImage(JSON.stringify({
      batch: batch.batch_number,
      productId: batch.finished_good_id,
      productName: finishedGood?.description,
    }));
    
    await downloadQRCodeWithLabel(
      qrDataUrl, 
      `QR_${batch.batch_number}`, 
      batch.batch_number
    );
    toast.success('QR code downloaded');
  };

  const handleCopyQRCode = async (batch: typeof productionBatches[0]) => {
    try {
      const finishedGood = getStockCodeById(batch.finished_good_id);
      const qrDataUrl = await generateQRCodeImage(JSON.stringify({
        batch: batch.batch_number,
        productId: batch.finished_good_id,
        productName: finishedGood?.description,
      }));
      await copyQRCodeWithLabel(qrDataUrl, batch.batch_number);
      toast.success('QR code copied to clipboard');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to copy QR code');
    }
  };

//Dekete Batch Function
  const handleDeleteBatch = async (batchId: string) => {
    await supabase.from('fms_materials_used').delete().eq('batch_id', batchId);
    const { error } = await supabase.from('fms_production_batches').delete().eq('id', batchId);
    if (error) {
      toast.error('Failed to delete batch');
      return;
    }
    toast.success('Batch deleted successfully');
    await refreshData();
  };

  //View Batch Function
  const handleViewBatch = (batch: typeof productionBatches[0]) => {
    setSelectedBatch(batch);
    setViewDialogOpen(true);
  };

  const handleQRScan = (result: string) => {
    const parsed = extractBestScanIdentifier(result);
    setSearchQuery(parsed);
    toast.success(`Search updated with: ${parsed}`);
  };

  const handleExportBatchToExcel = (batch: typeof productionBatches[0]) => {
    const finishedGood = getStockCodeById(batch.finished_good_id);
    const batchData = batch as any;
    const preWeighMaterials = batchData.pre_weigh_materials || [];
    const steps = batch.processing_steps as ProcessingStep[] || [];
    const orgChecks = batch.quality_checks as OrganolepticCheck[] || [];
    
    // Create materials data
    const materialsData = preWeighMaterials.map((mat: any) => ({
      'Stock Code': mat.stock_code || '',
      'Material': mat.material_name || '',
      'Qty Required': `${mat.required_quantity} ${mat.uom}`,
      'Qty Weighed': mat.quantity_weighed != null ? `${mat.quantity_weighed} ${mat.uom}` : '',
      'External Batch No': mat.raw_material_batch_number || '',
      'Internal Lot No': mat.internal_lot_number || '',
      'Expiry': mat.expiry_date ? format(new Date(mat.expiry_date), 'dd MMM yyyy') : '',
      'Approved': mat.approved ? 'Yes' : 'No',
    }));
    
    // Create summary data
    const summaryData = [{
      'Batch Number': batch.batch_number,
      'Product': finishedGood?.description || '',
      'Planned Size': `${batch.planned_batch_size} kg`,
      'Actual Qty': batch.actual_quantity_produced || '',
      'Status': batch.status,
      'Planned Date': format(new Date(batch.planned_production_date), 'dd MMM yyyy'),
      'Info Checker': batchData.info_checker_name || '',
      'Steps Checker': batchData.steps_checker_name || '',
      'Quality Checker': batchData.quality_checker_name || '',
    }];
    
    exportToExcel([...summaryData, {}, ...materialsData], `BatchSheet_${batch.batch_number}`);
    toast.success('Batch sheet exported to Excel');
  };

  const filteredBatches = productionBatches.filter(batch => {
    const query = searchQuery.toLowerCase();
    const finishedGood = getStockCodeById(batch.finished_good_id);
    const productName = finishedGood?.description?.toLowerCase() || '';
    const matchesSearch = batch.batch_number.toLowerCase().includes(query) || productName.includes(query);
    const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedProduct = formData.finished_good_id 
    ? getStockCodeById(formData.finished_good_id) 
    : null;
  const selectedBOM = formData.finished_good_id 
    ? getBOMByFinishedGoodId(formData.finished_good_id) 
    : null;

  const getStatusColor = (status: BatchStatus) => {
    switch (status) {
      case 'draft': return 'badge-inactive';
      case 'pre_weighing': return 'badge-warning';
      case 'manufacturing': return 'badge-warning';
      case 'in_progress': return 'badge-warning';
      case 'closed': return 'badge-active';
      case 'cancelled': return 'badge-danger';
      default: return 'badge-inactive';
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-muted-foreground text-sm sm:text-base">
            Create batch sheets, manage manufacturing, and quality control
          </p>
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} size="sm" className="gap-2 transition-transform hover:scale-105">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create Batch Sheet</span>
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Batch Sheet</DialogTitle>
              <DialogDescription>
                Create a new production batch for manufacturing
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Product (FG / WIP / RM) *</Label>
                <SearchableSelect
                  options={productOptions}
                  value={formData.finished_good_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, finished_good_id: value }))}
                  placeholder="Type to search products..."
                />
              </div>

              {selectedProduct && selectedBOM && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3 animate-fade-in">
                  <div>
                    <p className="font-medium">{selectedProduct.description}</p>
                    <p className="text-sm text-muted-foreground">
                      BOM Version {selectedBOM.version_number} • {selectedBOM.components?.length || 0} components
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-3 overflow-x-auto">
                    <p className="text-sm font-semibold mb-2">Recipe preview</p>
                    {selectedBOMMaterials.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Enter a valid batch size to preview required materials from the BOM.</p>
                    ) : (
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr>
                            <th className="text-left py-2">Material</th>
                            <th className="text-right py-2">Required</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBOMMaterials.map((item) => (
                            <tr key={item.id} className="border-t border-border">
                              <td className="py-2 pr-3">{item.material?.stock_code || 'Unknown'}</td>
                              <td className="py-2 text-right">{item.requiredQuantity.toFixed(2)} {item.material?.unit_of_measure}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                </div>
              )}

              {selectedProduct && !selectedBOM && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 animate-fade-in">
                  <p className="text-sm text-destructive">No active BOM found for this product. Please create a BOM first.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Planned Batch Size (kg) *</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.planned_batch_size}
                      onChange={(e) => setFormData(prev => ({ ...prev, planned_batch_size: e.target.value }))}
                      placeholder="e.g., 100"
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">kg</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Planned Production Date *</Label>
                  <Input
                    type="date"
                    value={formData.planned_production_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, planned_production_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Number of Batch Sheets</Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.number_of_batches}
                    onChange={(e) => setFormData(prev => ({ ...prev, number_of_batches: e.target.value }))}
                    placeholder="1"
                  />
                  <p className="text-xs text-muted-foreground">Each will get a unique batch number (max 50)</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Production Instructions</Label>
                <Textarea
                  value={formData.production_instructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, production_instructions: e.target.value }))}
                  placeholder="Special instructions for this batch..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateBatch} disabled={!selectedBOM}>Create Batch</Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-3 sm:p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search batch number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as BatchStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pre_weighing">Pre-Weighing</SelectItem>
            <SelectItem value="manufacturing">Manufacturing</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Batch Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredBatches.map((batch, index) => {
          const finishedGood = getStockCodeById(batch.finished_good_id);
          const steps = batch.processing_steps as ProcessingStep[] || [];
          const completedSteps = steps.filter(s => s.completed).length;
          const totalSteps = steps.length;
          
          return (
            <div 
              key={batch.id} 
              className="module-card transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground text-sm sm:text-base">
                    {batch.batch_number}
                    {batch.status === 'cancelled' && (
                      <span className="ml-2 text-xs font-bold text-destructive">(CANCELLED)</span>
                    )}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">{finishedGood?.description}</p>
                </div>
                <span className={`${getStatusColor(batch.status as BatchStatus)} text-xs`}>
                  {batch.status.replace('_', ' ')}
                </span>
              </div>
              
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Planned Size:</span>
                  <span className="font-medium">{batch.planned_batch_size} kg</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">{formatDate(batch.planned_production_date)}</span>
                </div>
                {batch.status !== 'draft' && batch.status !== 'closed' && batch.status !== 'cancelled' && (
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Progress:</span>
                    <span className="font-medium">{completedSteps}/{totalSteps} steps</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewBatch(batch)}>
                  <Eye className="mr-1 h-4 w-4" />
                  {batch.status === 'draft' || batch.status === 'cancelled' ? 'View' : 'Manage'}
                </Button>
                {batch.status === 'draft' && (
                  <Button size="sm" className="flex-1" onClick={() => handleStartProduction(batch.id)}>
                    <Play className="mr-1 h-4 w-4" />
                    Start
                  </Button>
                )}
                {batch.status === 'cancelled' && (
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleReactivateBatch(batch.id)}>
                    <Play className="mr-1 h-4 w-4" />
                    Reactivate
                  </Button>
                )}
                {batch.status !== 'closed' && batch.status !== 'cancelled' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" title="Cancel batch" className="text-destructive hover:bg-destructive/10">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Batch?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {batch.status === 'draft'
                            ? `Batch ${batch.batch_number} will be moved to Cancelled. It cannot be started until reactivated.`
                            : `Batch ${batch.batch_number} is in progress. Cancelling will stop production and move it to Cancelled.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Batch</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleCancelBatch(batch.id)}>Cancel Batch</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button variant="outline" size="sm" onClick={() => handlePrintBatchSheet(batch)} title="Print batch sheet">
                  <Printer className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handlePrintQRCode(batch)} title="Print QR labels" className="hidden sm:inline-flex">
                  <QrCode className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDownloadQRCode(batch)} title="Download QR" className="hidden sm:inline-flex">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleCopyQRCode(batch)} title="Copy QR to clipboard" className="hidden sm:inline-flex">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExportBatchToExcel(batch)} title="Export to Excel" className="hidden sm:inline-flex">
                  <Table className="h-4 w-4" />
                </Button>
                {canDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Batch?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete batch {batch.batch_number}. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteBatch(batch.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          );
        })}
        {filteredBatches.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border p-12 text-center">
            <Factory className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-foreground">No Production Batches</h3>
            <p className="mt-1 text-muted-foreground">Create your first batch sheet to start production</p>
          </div>
        )}
      </div>

      {/* View/Manage Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Batch Sheet: {selectedBatch?.batch_number}</DialogTitle>
          </DialogHeader>
          {selectedBatch && (
            <BatchManagement 
              batch={selectedBatch}
              getStockCodeById={getStockCodeById}
              getBOMById={getBOMById}
              onApprovePreWeigh={(materials) => handleApprovePreWeigh(selectedBatch.id, materials)}
              onUpdateStep={(stepId, completed) => handleUpdateStep(selectedBatch.id, stepId, completed)}
              onUpdateOrganolepticCheck={(checkName, result) => handleUpdateOrganolepticCheck(selectedBatch.id, checkName, result)}
              onCloseBatch={(data) => {
                handleCloseBatch(selectedBatch.id, data);
                setViewDialogOpen(false);
              }}
              onUpdateBatch={async (updates) => {
                await updateProductionBatch(selectedBatch.id, updates);
                await refreshData();
                setSelectedBatch(prev => prev ? { ...prev, ...updates } : null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Batch Management Component with editable steps
interface BatchManagementProps {
  batch: any;
  getStockCodeById: (id: string) => any;
  getBOMById: (bomId: string) => any;
  onApprovePreWeigh: (materials: PreWeighMaterial[]) => void;
  onUpdateStep: (stepId: string, completed: boolean) => void;
  onUpdateOrganolepticCheck: (checkName: string, result: 'pass' | 'fail') => void;
  onCloseBatch: (data: any) => void;
  onUpdateBatch: (updates: any) => Promise<void>;
}

const BatchManagement: React.FC<BatchManagementProps> = ({
  batch,
  getStockCodeById,
  getBOMById,
  onApprovePreWeigh,
  onUpdateStep,
  onUpdateOrganolepticCheck,
  onCloseBatch,
  onUpdateBatch,
}) => {
  const finishedGood = getStockCodeById(batch.finished_good_id);
  
  // Build materials list from BOM if pre_weigh_materials is empty
  const buildMaterialsFromBOM = (): PreWeighMaterial[] => {
    const bom = getBOMById(batch.bom_id);
    if (!bom?.components?.length) return [];
    
    return bom.components.map((comp: any) => {
      const material = getStockCodeById(comp.material_stock_code_id);
      return {
        material_id: comp.material_stock_code_id,
        material_name: material?.description || '',
        stock_code: material?.stock_code || '',
        required_quantity: comp.quantity_per_batch * batch.planned_batch_size,
        uom: material?.unit_of_measure || '',
        raw_material_batch_number: '',
        internal_lot_number: '',
        expiry_date: '',
        approved: false,
      };
    });
  };
  
  // Use stored pre_weigh_materials if available, otherwise build from BOM
  const initialMaterials = (batch.pre_weigh_materials && batch.pre_weigh_materials.length > 0) 
    ? batch.pre_weigh_materials 
    : buildMaterialsFromBOM();
  
  const [preWeighMaterials, setPreWeighMaterials] = useState<PreWeighMaterial[]>(initialMaterials);
  const [checkerName, setCheckerName] = useState((batch.final_quality_checks as any)?.checker_name || '');
  const [infoCheckerName, setInfoCheckerName] = useState((batch as any)?.info_checker_name || '');
  const [stepsCheckerName, setStepsCheckerName] = useState((batch as any)?.steps_checker_name || '');
  const [qualityCheckerName, setQualityCheckerName] = useState((batch as any)?.quality_checker_name || '');
  const [finalData, setFinalData] = useState({
    actual_quantity: batch.actual_quantity_produced || '',
    product_size: batch.product_size || '',
    product_size_uom: (batch.final_quality_checks as any)?.product_size_uom || 'g',
    scrap_waste: batch.scrap_waste || '',
    scrap_waste_uom: (batch.final_quality_checks as any)?.scrap_waste_uom || 'g',
    waste_notes: batch.waste_notes || '',
    retention_sample_taken: batch.retention_sample_taken || false,
  });
  const [finalChecks, setFinalChecks] = useState<FinalQualityChecks>({
    product_appearance: (batch.final_quality_checks as any)?.product_appearance || false,
    packaging_check: (batch.final_quality_checks as any)?.packaging_check || false,
    label_check: (batch.final_quality_checks as any)?.label_check || false,
    weight_check: (batch.final_quality_checks as any)?.weight_check || false,
    notes: '',
  });
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [editStepData, setEditStepData] = useState({ step_name: '', description: '' });

  const processingSteps = batch.processing_steps as ProcessingStep[] || [];
  const organolepticChecks = batch.quality_checks as OrganolepticCheck[] || [];

  const allStepsComplete = processingSteps.every(s => s.completed);
  const allOrganolepticPassed = organolepticChecks.every(c => c.result === 'pass');
  const allFinalChecks = finalChecks.product_appearance && finalChecks.packaging_check && finalChecks.label_check && finalChecks.weight_check;
  const expectedQuantity = batch.planned_batch_size;
  const quantityVariance = finalData.actual_quantity ? Math.abs(parseFloat(finalData.actual_quantity as string) - expectedQuantity) : 0;
  const withinTolerance = quantityVariance <= 0.1; // 100g = 0.1kg
  const allCheckersFilled = infoCheckerName.trim() !== '' && stepsCheckerName.trim() !== '' && qualityCheckerName.trim() !== '' && checkerName.trim() !== '';
  const canClose = allStepsComplete && allOrganolepticPassed && allFinalChecks && finalData.actual_quantity && finalData.retention_sample_taken && allCheckersFilled;

  const handleFinalCheckChange = (key: keyof FinalQualityChecks, value: boolean | string) => {
    setFinalChecks(prev => ({ ...prev, [key]: value }));
  };

  const handleEditStep = (step: ProcessingStep) => {
    setEditingStep(step.id);
    setEditStepData({ step_name: step.step_name, description: step.description || '' });
  };

  const handleSaveStep = async () => {
    if (!editingStep) return;
    const updatedSteps = processingSteps.map(step =>
      step.id === editingStep
        ? { ...step, step_name: editStepData.step_name, description: editStepData.description }
        : step
    );
    await onUpdateBatch({ processing_steps: updatedSteps });
    setEditingStep(null);
    toast.success('Step updated');
  };

  const handlePreWeighMaterialChange = (index: number, field: keyof PreWeighMaterial, value: any) => {
    setPreWeighMaterials(prev => prev.map((mat, i) => 
      i === index ? { ...mat, [field]: value } : mat
    ));
  };

  const allMaterialsApproved = preWeighMaterials.every(m => m.approved && m.raw_material_batch_number.trim() !== '' && (m.internal_lot_number || '').trim() !== '');

  return (
    <Tabs defaultValue="info" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="info" className="text-xs sm:text-sm">Info</TabsTrigger>
        <TabsTrigger value="steps" className="text-xs sm:text-sm">Steps</TabsTrigger>
        <TabsTrigger value="quality" className="text-xs sm:text-sm">Quality</TabsTrigger>
        <TabsTrigger value="close" className="text-xs sm:text-sm">Close</TabsTrigger>
      </TabsList>

      <TabsContent value="info" className="space-y-4 animate-fade-in">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground">Batch Number</Label>
            <p className="font-medium">{batch.batch_number}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Status</Label>
            <p className="font-medium capitalize">{batch.status.replace('_', ' ')}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Product</Label>
            <p className="font-medium">{finishedGood?.description || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Planned Size</Label>
            <p className="font-medium">{batch.planned_batch_size} kg</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Planned Date</Label>
            <p className="font-medium">{formatDate(batch.planned_production_date)}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Pre-Weigh Approved</Label>
            <p className="font-medium">{batch.pre_weigh_approved ? 'Yes' : 'No'}</p>
          </div>
        </div>

        {/* Dispensing Materials Section - Same as print version */}
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">1. Dispensing Materials</Label>
            {batch.status === 'pre_weighing' && !batch.pre_weigh_approved && (
              <Badge variant="outline" className="text-amber-600 border-amber-600">Pending Approval</Badge>
            )}
            {batch.pre_weigh_approved && (
              <Badge variant="outline" className="text-green-600 border-green-600">Approved</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {batch.status === 'pre_weighing' && !batch.pre_weigh_approved 
              ? 'Verify and approve each material with its batch number before proceeding.'
              : 'Materials required for this batch with quantities.'}
          </p>
          
          {preWeighMaterials.length > 0 ? (
            <>
              {/* Table header - matches print layout with new columns */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-2 border font-medium">Stock Code</th>
                      <th className="text-left p-2 border font-medium">Material Description</th>
                      <th className="text-right p-2 border font-medium">Qty Required</th>
                      <th className="text-right p-2 border font-medium">Qty Weighed</th>
                      <th className="text-left p-2 border font-medium">External Batch No.</th>
                      <th className="text-left p-2 border font-medium">Internal Lot No.</th>
                      <th className="text-left p-2 border font-medium">Expiry</th>
                      <th className="text-center p-2 border font-medium w-16">Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preWeighMaterials.map((mat, index) => (
                      <tr key={mat.material_id} className={mat.approved ? 'bg-green-50 dark:bg-green-900/20' : ''}>
                        <td className="p-2 border font-medium">{mat.stock_code}</td>
                        <td className="p-2 border text-muted-foreground">{mat.material_name}</td>
                        <td className="p-2 border text-right font-medium">{mat.required_quantity.toFixed(2)} {mat.uom}</td>
                        <td className="p-2 border text-right">
                          {batch.status === 'pre_weighing' && !batch.pre_weigh_approved ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={mat.quantity_weighed ?? ''}
                              onChange={(e) => handlePreWeighMaterialChange(index, 'quantity_weighed', e.target.value ? parseFloat(e.target.value) : undefined)}
                              placeholder="0.00"
                              className="text-sm h-8 text-right w-24"
                            />
                          ) : (
                            <span className="font-medium">{mat.quantity_weighed != null ? `${mat.quantity_weighed} ${mat.uom}` : '—'}</span>
                          )}
                        </td>
                        <td className="p-2 border">
                          {batch.status === 'pre_weighing' && !batch.pre_weigh_approved ? (
                            <Input
                              value={mat.raw_material_batch_number}
                              onChange={(e) => handlePreWeighMaterialChange(index, 'raw_material_batch_number', e.target.value)}
                              placeholder="External batch..."
                              className="text-sm h-8"
                            />
                          ) : (
                            <span className="font-medium">{mat.raw_material_batch_number || '—'}</span>
                          )}
                        </td>
                        <td className="p-2 border">
                          {batch.status === 'pre_weighing' && !batch.pre_weigh_approved ? (
                            <Input
                              value={mat.internal_lot_number || ''}
                              onChange={(e) => handlePreWeighMaterialChange(index, 'internal_lot_number', e.target.value)}
                              placeholder="LOT-..."
                              className="text-sm h-8"
                            />
                          ) : (
                            <span className="font-medium">{mat.internal_lot_number || '—'}</span>
                          )}
                        </td>
                        <td className="p-2 border">
                          {batch.status === 'pre_weighing' && !batch.pre_weigh_approved ? (
                            <Input
                              type="date"
                              value={mat.expiry_date || ''}
                              onChange={(e) => handlePreWeighMaterialChange(index, 'expiry_date', e.target.value)}
                              className="text-sm h-8"
                            />
                          ) : (
                            <span className="font-medium">{mat.expiry_date ? formatDate(mat.expiry_date) : '—'}</span>
                          )}
                        </td>
                        <td className="p-2 border text-center">
                          {batch.status === 'pre_weighing' && !batch.pre_weigh_approved ? (
                            <Switch
                              checked={mat.approved}
                              onCheckedChange={(checked) => handlePreWeighMaterialChange(index, 'approved', checked)}
                              disabled={mat.raw_material_batch_number.trim() === '' || (mat.internal_lot_number || '').trim() === ''}
                              className={mat.approved ? 'data-[state=checked]:bg-green-600' : ''}
                            />
                          ) : (
                            <span className={`text-lg ${mat.approved ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {mat.approved ? '✓' : '○'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {batch.status === 'pre_weighing' && !batch.pre_weigh_approved && (
                <Button 
                  onClick={() => onApprovePreWeigh(preWeighMaterials)} 
                  className="w-full"
                  disabled={!allMaterialsApproved}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve Pre-Weigh ({preWeighMaterials.filter(m => m.approved).length}/{preWeighMaterials.length})
                </Button>
              )}
            </>
          ) : (
            <div className="p-4 text-center text-muted-foreground rounded-lg border border-dashed">
              No materials defined in BOM for this batch.
            </div>
          )}
        </div>

        {batch.pre_weigh_approved && (
          <div className="rounded-lg bg-success/10 border border-success/20 p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              <span className="font-medium text-success">Pre-Weigh Approved</span>
            </div>
          </div>
        )}

        {/* Info Checker Name */}
        <div className="border-t pt-4 mt-4 space-y-2">
          <Label>Checker Name (Info Section) *</Label>
          <Input
            value={infoCheckerName}
            onChange={(e) => setInfoCheckerName(e.target.value)}
            placeholder="Enter name of person checking info"
            className={!infoCheckerName.trim() ? 'border-amber-500' : ''}
            onBlur={async () => {
              if (infoCheckerName.trim()) {
                await onUpdateBatch({ info_checker_name: infoCheckerName } as any);
              }
            }}
          />
          {!infoCheckerName.trim() && (
            <p className="text-xs text-amber-600">Required before closing batch</p>
          )}
        </div>
      </TabsContent>

      <TabsContent value="steps" className="space-y-4 animate-fade-in">
        {processingSteps.length === 0 && (
          <div className="p-4 text-center text-muted-foreground rounded-lg border border-dashed">
            No processing steps defined in BOM. Steps should be added in the Bill of Materials.
          </div>
        )}
        {processingSteps.map((step) => (
          <div key={step.id} className={`flex items-center justify-between rounded-lg border p-3 transition-all hover:bg-muted/30 ${step.completed ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-border'}`}>
            <div className="flex items-center gap-3 flex-1">
              {step.completed ? (
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              ) : (
                <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              {editingStep === step.id ? (
                <div className="flex-1 space-y-2">
                  <Input
                    value={editStepData.step_name}
                    onChange={(e) => setEditStepData(prev => ({ ...prev, step_name: e.target.value }))}
                    placeholder="Step name"
                  />
                  <Input
                    value={editStepData.description}
                    onChange={(e) => setEditStepData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Description"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveStep}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingStep(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm ${step.completed ? 'text-green-700 dark:text-green-400' : ''}`}>{step.step_order}. {step.step_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                </div>
              )}
            </div>
            {batch.status !== 'draft' && batch.status !== 'closed' && !editingStep && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleEditStep(step)} className="hidden sm:inline-flex">
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Switch
                  checked={step.completed}
                  onCheckedChange={(checked) => onUpdateStep(step.id, checked)}
                  className={step.completed ? 'data-[state=checked]:bg-green-600' : ''}
                />
              </div>
            )}
          </div>
        ))}

        {/* Steps Checker Name */}
        <div className="border-t pt-4 mt-4 space-y-2">
          <Label>Checker Name (Steps Section) *</Label>
          <Input
            value={stepsCheckerName}
            onChange={(e) => setStepsCheckerName(e.target.value)}
            placeholder="Enter name of person verifying steps"
            className={!stepsCheckerName.trim() ? 'border-amber-500' : ''}
            onBlur={async () => {
              if (stepsCheckerName.trim()) {
                await onUpdateBatch({ steps_checker_name: stepsCheckerName } as any);
              }
            }}
          />
          {!stepsCheckerName.trim() && (
            <p className="text-xs text-amber-600">Required before closing batch</p>
          )}
        </div>
      </TabsContent>

      <TabsContent value="quality" className="space-y-4 animate-fade-in">
        <Label className="text-base font-semibold">Organoleptic Parameters</Label>
        <p className="text-sm text-muted-foreground">Verify each sensory parameter meets the expected standard.</p>
        
        {organolepticChecks.map((check) => (
          <div key={check.name} className={`rounded-lg border p-3 transition-all hover:bg-muted/30 ${check.result === 'pass' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : check.result === 'fail' ? 'border-destructive bg-destructive/10' : 'border-border'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex-1">
                <p className={`font-medium ${check.result === 'pass' ? 'text-green-700 dark:text-green-400' : check.result === 'fail' ? 'text-destructive' : ''}`}>{check.name}</p>
                {check.expected_value && (
                  <p className="text-sm text-muted-foreground">Expected: {check.expected_value}</p>
                )}
              </div>
              {batch.status !== 'draft' && batch.status !== 'closed' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={check.result === 'pass' ? 'default' : 'outline'}
                    onClick={() => onUpdateOrganolepticCheck(check.name, 'pass')}
                    className={`gap-1 ${check.result === 'pass' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Passed</span>
                  </Button>
                  <Button
                    size="sm"
                    variant={check.result === 'fail' ? 'destructive' : 'outline'}
                    onClick={() => onUpdateOrganolepticCheck(check.name, 'fail')}
                    className="gap-1"
                  >
                    <XCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Failed</span>
                  </Button>
                </div>
              )}
              {(batch.status === 'draft' || batch.status === 'closed') && (
                <Badge variant={check.result === 'pass' ? 'default' : check.result === 'fail' ? 'destructive' : 'outline'} className={check.result === 'pass' ? 'bg-green-600' : ''}>
                  {check.result === 'pass' ? 'Passed' : check.result === 'fail' ? 'Failed' : 'Pending'}
                </Badge>
              )}
            </div>
            {check.result === 'fail' && (
              <div className="mt-2 p-2 rounded bg-destructive/20 text-destructive text-sm font-semibold">
                ⚠️ Immediately inform head office - {check.name} check failed
              </div>
            )}
          </div>
        ))}
        
        {/* Warning for any failed checks */}
        {organolepticChecks.some(c => c.result === 'fail') && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive text-destructive font-semibold">
            ⚠️ ATTENTION: One or more quality checks have FAILED. Immediately inform head office.
          </div>
        )}

        {/* Quality Checker Name */}
        <div className="border-t pt-4 mt-4 space-y-2">
          <Label>Checker Name (Quality Section) *</Label>
          <Input
            value={qualityCheckerName}
            onChange={(e) => setQualityCheckerName(e.target.value)}
            placeholder="Enter name of person checking quality"
            className={!qualityCheckerName.trim() ? 'border-amber-500' : ''}
            onBlur={async () => {
              if (qualityCheckerName.trim()) {
                await onUpdateBatch({ quality_checker_name: qualityCheckerName } as any);
              }
            }}
          />
          {!qualityCheckerName.trim() && (
            <p className="text-xs text-amber-600">Required before closing batch</p>
          )}
        </div>
      </TabsContent>

      <TabsContent value="close" className="space-y-4 animate-fade-in">
        {/* Expected vs Actual Quantity */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Expected Quantity (±100g tolerance):</span>
            <span className="font-bold">{expectedQuantity} kg</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Actual Quantity Produced (kg) *</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={finalData.actual_quantity}
                onChange={(e) => setFinalData(prev => ({ ...prev, actual_quantity: e.target.value }))}
                placeholder="e.g., 95"
                className={`flex-1 ${finalData.actual_quantity && !withinTolerance ? 'border-warning' : ''}`}
              />
              <span className="text-sm text-muted-foreground pt-2 w-12">kg</span>
            </div>
            {finalData.actual_quantity && !withinTolerance && (
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-500 text-amber-800 dark:text-amber-200 text-sm font-semibold">
                ⚠️ Quarantine batch for investigation. Variance exceeds ±100g tolerance.
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Checker Name *</Label>
            <Input
              value={checkerName}
              onChange={(e) => setCheckerName(e.target.value)}
              placeholder="Enter name of person performing checks"
            />
          </div>
          <div className="space-y-2">
            <Label>Product Size</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={finalData.product_size}
                onChange={(e) => setFinalData(prev => ({ ...prev, product_size: e.target.value }))}
                placeholder="e.g., 500"
                className="flex-1"
              />
              <Select value={finalData.product_size_uom} onValueChange={(v) => setFinalData(prev => ({ ...prev, product_size_uom: v }))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="L">L</SelectItem>
                  <SelectItem value="units">units</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Scrap/Waste</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={finalData.scrap_waste}
                onChange={(e) => setFinalData(prev => ({ ...prev, scrap_waste: e.target.value }))}
                placeholder="e.g., 5"
                className="flex-1"
              />
              <Select value={finalData.scrap_waste_uom} onValueChange={(v) => setFinalData(prev => ({ ...prev, scrap_waste_uom: v }))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="L">L</SelectItem>
                  <SelectItem value="units">units</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Waste Notes</Label>
            <Input
              value={finalData.waste_notes}
              onChange={(e) => setFinalData(prev => ({ ...prev, waste_notes: e.target.value }))}
              placeholder="Reason for waste..."
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-semibold">Final Quality Checks</Label>
          {[
            { key: 'product_appearance', label: 'Product Appearance Passed' },
            { key: 'packaging_check', label: 'Packaging Check Passed' },
            { key: 'label_check', label: 'Label Check Passed' },
            { key: 'weight_check', label: 'Weight Check Passed' },
          ].map(({ key, label }) => {
            const isChecked = finalChecks[key as keyof FinalQualityChecks] as boolean;
            return (
              <div key={key} className={`flex items-center justify-between rounded-lg border p-3 transition-all ${isChecked ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-border'}`}>
                <span className={`text-sm ${isChecked ? 'text-green-700 dark:text-green-400 font-medium' : ''}`}>{label}</span>
                <Switch
                  checked={isChecked}
                  onCheckedChange={(checked) => handleFinalCheckChange(key as keyof FinalQualityChecks, checked)}
                  className={isChecked ? 'data-[state=checked]:bg-green-600' : ''}
                />
              </div>
            );
          })}
        </div>

        <div className={`flex items-center justify-between rounded-lg border p-3 transition-all ${finalData.retention_sample_taken ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-border'}`}>
          <span className={finalData.retention_sample_taken ? 'text-green-700 dark:text-green-400 font-medium' : ''}>Retention Sample Taken *</span>
          <Switch
            checked={finalData.retention_sample_taken}
            onCheckedChange={(checked) => setFinalData(prev => ({ ...prev, retention_sample_taken: checked }))}
            className={finalData.retention_sample_taken ? 'data-[state=checked]:bg-green-600' : ''}
          />
        </div>

        <Button
          className="w-full"
          disabled={!canClose || batch.status === 'closed'}
          onClick={() => onCloseBatch({
            actual_quantity: parseInt(finalData.actual_quantity as string),
            product_size: parseFloat(finalData.product_size as string) || 0,
            product_size_uom: finalData.product_size_uom,
            scrap_waste: parseFloat(finalData.scrap_waste as string) || 0,
            scrap_waste_uom: finalData.scrap_waste_uom,
            waste_notes: finalData.waste_notes,
            retention_sample_taken: finalData.retention_sample_taken,
            final_checks: finalChecks,
          })}
        >
          <FileText className="mr-2 h-4 w-4" />
          Close Batch
        </Button>
      </TabsContent>
    </Tabs>
  );
};

export default Production;