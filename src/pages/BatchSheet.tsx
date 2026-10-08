import React, { useState, useMemo, useEffect } from 'react';
import { useFMSData, formatDate, formatDateTime, FMSStockReservation } from '@/hooks/useFMSData';
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
import { Plus, Search, Factory, Printer, Eye, Play, CheckCircle, XCircle, Clock, FileText, Loader2, QrCode, Trash2, Download, Edit2, Camera, Table, Copy, Tag, Sparkles, CalendarDays, BarChart3, ArrowRight } from 'lucide-react';
import { generateQRCodePair, printQRCodes, downloadQRCodeWithLabel, generateQRCodeImage, copyQRCodeWithLabel, renderExpirySticker, downloadExpirySticker, printExpiryStickers } from '@/lib/qrCodeUtils';
import { QRScanner } from '@/components/QRScanner';
import { PickleBatchWorkflow, ensurePickleRunForBatch, isPickleBatch, computeBatchMaterialRequirements, fetchFreshBomsForPlan } from '@/components/pickle/PickleBatchWorkflow';
import { exportToExcel } from '@/lib/exportUtils';
import { format } from 'date-fns';
import { extractBestScanIdentifier } from '@/lib/scanParser';
import { DEFAULT_STICKER_COPIES, queueBestBeforeSticker } from '@/lib/printQueue';
import { aggregateRawMaterialUsage, summariseUsageByUom } from '@/lib/rawMaterialUsage';
import { SuggestedBatchSheets } from '@/components/dashboard/SuggestedBatchSheets';
import { PlannedProductionQueue } from '@/components/dashboard/PlannedProductionQueue';
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
    const { stockCodes, boms, receivingRecords, productionBatches, loading, addProductionBatch,updateProductionBatch, getStockCodeById, getBOMByFinishedGoodId, refreshData, deductStockForBatch, stockLevels, fifoAllocateLots, recordLotUsage, stockReservations, reserveStockForBatch, releaseBatchReservations, consumeBatchReservations, getReservationsForBatch, getReceivingById } = useFMSData();

  const getBOMById = (bomId: string | null | undefined) => {
  if (!bomId) return null;
  return boms.find(bom => bom.id === bomId) || null;
};
  // Helper to get BOM by ID

  const { canDelete } = useDeletePermission();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BatchStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [materialFilter, setMaterialFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [showRawMaterialUsage, setShowRawMaterialUsage] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<typeof productionBatches[0] | null>(null);

  // Queued batch sheets ("Add Another Batch Sheet" — same concept as Receiving Log)
  const [batchLines, setBatchLines] = useState<BatchConfig[]>([]);
  const [creatingBatch, setCreatingBatch] = useState(false);

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

  // Raw materials used across all active BOMs — for filtering batches by material
  const materialOptions: SearchableSelectOption[] = useMemo(() => {
    const uniqueIds = new Set<string>();
    boms.forEach(bom => {
      if (bom.status !== 'active') return;
      (bom.components || []).forEach(c => uniqueIds.add(c.material_stock_code_id));
    });
    return Array.from(uniqueIds)
      .map(id => getStockCodeById(id))
      .filter((sc): sc is NonNullable<typeof sc> => !!sc)
      .map(sc => ({ value: sc.id, label: sc.stock_code, sublabel: sc.description }));
  }, [boms, getStockCodeById]);

  // Finished products that actually appear on batch sheets — for filtering
  const finishedProductFilterOptions: SearchableSelectOption[] = useMemo(() => {
    const distinctIds = new Set(productionBatches.map(b => b.finished_good_id));
    return Array.from(distinctIds)
      .map(id => getStockCodeById(id))
      .filter((sc): sc is NonNullable<typeof sc> => !!sc)
      .map(sc => ({ value: sc.id, label: sc.stock_code, sublabel: sc.description }));
  }, [productionBatches, getStockCodeById]);

  // Reset all filters back to defaults
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setMaterialFilter('all');
    setProductFilter('all');
  };

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
      const stockLevel = stockLevels.find(sl => sl.stock_code_id === comp.material_stock_code_id);
      const physicalStock = stockLevel?.quantity_on_hand ?? 0;
      const reserved = stockLevel?.reserved_quantity ?? 0;
      const netStock = physicalStock - reserved;
      const isAvailable = netStock >= requiredQuantity;
      return {
        ...comp,
        material,
        requiredQuantity,
        physicalStock,
        reserved,
        netStock,
        availableStock: netStock,
        isAvailable,
        shortage: Math.max(0, requiredQuantity - netStock),
      };
    });
  }, [formData.finished_good_id, formData.planned_batch_size, getBOMByFinishedGoodId, getStockCodeById, stockLevels]);

  // Check if all materials have sufficient stock
  const hasInsufficientStock = selectedBOMMaterials.some(item => !item.isAvailable);
  const insufficientCount = selectedBOMMaterials.filter(item => !item.isAvailable).length;

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
  interface BatchConfig {
    finished_good_id: string;
    planned_batch_size: string;
    planned_production_date: string;
    production_instructions: string;
    number_of_batches: string;
  }

  const handleCreateBatch = async () => {
    // All queued lines plus whatever is currently in the form
    const currentLine: BatchConfig[] =
      formData.finished_good_id && parseFloat(formData.planned_batch_size) > 0
        ? [{ ...formData }]
        : [];
    const lines = [...batchLines, ...currentLine];

    if (lines.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCreatingBatch(true);
    try {
      let totalCreated = 0;
      let failedLines = 0;
      for (const line of lines) {
        const created = await createBatchesFor(line);
        if (created > 0) {
          totalCreated += created;
        } else {
          failedLines++;
        }
      }

      if (totalCreated > 0) {
        toast.success(
          `Successfully created ${totalCreated} batch sheet${totalCreated > 1 ? 's' : ''}` +
            (lines.length - failedLines > 1 ? ` across ${lines.length - failedLines} product lines` : '')
        );
        setDialogOpen(false);
        setBatchLines([]);
        resetForm();
      } else {
        toast.error('No batch sheets were created — check stock availability and BOMs');
      }
    } finally {
      setCreatingBatch(false);
    }
  };

  // "Add Another Batch Sheet" — queue the current entry and reset line-level
  // fields, keeping the shared date/instructions (same UX as Receiving Log)

  //add another batch sheet -que the current entry and reset line levels fields, keeping the shared date/ints
  const handleAddAnotherBatch = () => {
    if (!formData.finished_good_id || !(parseFloat(formData.planned_batch_size) > 0)) {
      toast.error('Select a product and enter a planned batch size first');
      return;
    }
    const bom = getBOMByFinishedGoodId(formData.finished_good_id);
    if (!bom) {
      toast.error('No active BOM found for this product');
      return;
    }
    setBatchLines(prev => [...prev, { ...formData }]);
    setFormData(prev => ({
      ...prev,
      finished_good_id: '',
      planned_batch_size: '',
      number_of_batches: '1',
    }));
    toast.success('Batch sheet added — add another or click Create Batch');
  };

  const handleRemoveBatchLine = (idx: number) => {
    setBatchLines(prev => prev.filter((_, i) => i !== idx));
  };

  const openCreateDialog = () => {
    setBatchLines([]);
    resetForm();
    setDialogOpen(true);
  };

  // Core creation logic — shared by the single and multi-batch-sheet dialogs
  const createBatchesFor = async (cfg: BatchConfig): Promise<number> => {
    const numberOfBatches = Math.max(1, Math.min(50, parseInt(cfg.number_of_batches) || 1));

    const bom = getBOMByFinishedGoodId(cfg.finished_good_id);
    if (!bom) {
      toast.error('No active BOM found for this product');
      return;
    }

    const bomData = bom as any;

    // Percentage BOMs (bom_uses_percentage): component values are percentages
    // of their parent quantity, so the full BOM/WIP tree is expanded
    // recursively with parentQty × (percentage / 100) quantities and shared
    // WIPs deduplicated. Non-percentage BOMs keep the existing per-batch
    // quantity behaviour (quantity_per_batch × batch size).
    const plannedQty = parseFloat(cfg.planned_batch_size) || 0;
    const usesPercentageBom = (getStockCodeById(cfg.finished_good_id) as any)?.bom_uses_percentage === true;
    const requirementList: { stock_code_id: string; quantity: number }[] = usesPercentageBom
      ? computeBatchMaterialRequirements(stockCodes, boms, cfg.finished_good_id, plannedQty)
      : bom.components.map(comp => ({
          stock_code_id: comp.material_stock_code_id,
          quantity: comp.quantity_per_batch * plannedQty,
        }));

    // Use steps from BOM if available, otherwise default
    const bomSteps = bomData.processing_steps as ProcessingStep[] | undefined;

    let createdCount = 0;
    const lowStockWarnings: string[] = [];

    // Net stock already promised to batches created earlier in this same
    // multi-sheet run. `stockLevels` is a snapshot taken before the loop, so
    // without this each sheet would see the same net stock and over-reserve.
    const reservedSoFar = new Map<string, number>();

    // Low-stock check: warn but DO NOT block. A batch sheet may still be created
    // even when there is no/insufficient stock — the shortage is surfaced here
    // (and again as LOW STOCK warnings after creation) so the manager can decide.
    // Net Stock = Physical Stock (quantity_on_hand) - Reserved.
    const totalRequired = requirementList.map((req) => {
      const stockLevel = stockLevels.find(sl => sl.stock_code_id === req.stock_code_id);
      const physical = stockLevel?.quantity_on_hand ?? 0;
      const reserved = stockLevel?.reserved_quantity ?? 0;
      const netStock = physical - reserved;
      const required = req.quantity * numberOfBatches;
      return { material: getStockCodeById(req.stock_code_id), required, netStock };
    });
    const shortMaterials = totalRequired.filter(m => m.required > m.netStock);
    if (shortMaterials.length > 0) {
      lowStockWarnings.push(
        `${shortMaterials.map(m => `${m.material?.stock_code || 'material'} (need ${m.required.toFixed(2)}, net available ${m.netStock.toFixed(2)})`).join(', ')}`
      );
    }
    
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

      // Create pre-weigh materials from BOM components with FIFO lot allocation
      const preWeighMaterials: PreWeighMaterial[] = [];
      const noLotsMaterials: string[] = [];
      const lotUsages: { stock_code_id: string; receiving_record_id: string; internal_lot_number: string; quantity_used: number }[] = [];
      
      for (const req of requirementList) {
        const material = getStockCodeById(req.stock_code_id);
        const requiredQty = req.quantity;
        
        // Get FIFO-allocated lots for this material
        const allocatedLots = await fifoAllocateLots(req.stock_code_id, requiredQty);
        
        if (allocatedLots.length > 0) {
                    // Use the first (oldest) lot - this is the primary lot
          const primaryLot = allocatedLots[0];
          
          // Fetch the underlying receiving record for the correct field mapping
          const primaryLotRec = getReceivingById(primaryLot.receiving_record_id);
          
          // Record all lots that will be consumed
          for (const lot of allocatedLots) {
            lotUsages.push({
              stock_code_id: req.stock_code_id,
              receiving_record_id: lot.receiving_record_id,
              internal_lot_number: lot.internal_lot_number || '',
              quantity_used: lot.quantity_to_use,
            });
          }
          
                    preWeighMaterials.push({
            material_id: req.stock_code_id,
            material_name: material?.description || '',
            stock_code: material?.stock_code || '',
            required_quantity: requiredQty,
            quantity_weighed: undefined,
            uom: material?.unit_of_measure || '',

            // Pull all three fields from the actual receiving record:
            // External Batch No. = supplier_batch_number (supplier's reference)
            // Internal Lot No.   = internal_lot_number (LOT-YYYY-XXXX)
            // Expiry             = expiry_date
            raw_material_batch_number: primaryLotRec?.supplier_batch_number || '',
            internal_lot_number: primaryLotRec?.internal_lot_number || primaryLot.internal_lot_number || '',
            expiry_date: primaryLotRec?.expiry_date || primaryLot.expiry_date || '',
            approved: false,
          });
        } else {
          // No lots available - create with empty fields
          preWeighMaterials.push({
            material_id: req.stock_code_id,
            material_name: material?.description || '',
            stock_code: material?.stock_code || '',
            required_quantity: requiredQty,
            quantity_weighed: undefined,
            uom: material?.unit_of_measure || '',
            raw_material_batch_number: '',
            internal_lot_number: '',
            expiry_date: '',
            approved: false,
          });
          noLotsMaterials.push(material?.stock_code || req.stock_code_id);
        }
      }

      if (noLotsMaterials.length > 0) {
        toast.warning(
          `No stock lots found for: ${[...new Set(noLotsMaterials)].join(', ')}. ` +
          'Lot numbers will be blank — check that this material has accepted receiving records and that the FIFO SQL migration is applied.',
          { duration: 10000 }
        );
      }

      const result = await addProductionBatch({
        finished_good_id: cfg.finished_good_id,
        bom_id: bom.id,
        planned_batch_size: parseFloat(cfg.planned_batch_size),
        status: 'draft',
        planned_production_date: cfg.planned_production_date,
        production_instructions: cfg.production_instructions,
        processing_steps: processingSteps,
        quality_checks: organolepticChecks,
        pre_weigh_approved: false,
        retention_sample_taken: false,
        operator_id: user?.id || '',
        pre_weigh_materials: preWeighMaterials,
      } as any);

      if (result) {
        // Reserve the EXACT quantity the BOM requires for every ingredient,
        // expressed in that ingredient's own stock-code UOM
        // (fms_stock_codes.unit_of_measure). Every quantity in this chain is
        // already denominated in the ingredient's UOM: `quantity_per_batch`
        // is authored per material, and stock levels/movements are keyed by
        // stock code, so on-hand is in the same unit. No conversion happens
        // and none is needed.
        //
        // Built from requirementList (not lotUsages) so that EVERY ingredient
        // is reserved. Previously this branched on `lotUsages.length > 0`:
        // as soon as any one ingredient had a FIFO lot, the reservation list
        // was built from lotUsages alone and every ingredient WITHOUT a lot
        // was silently dropped from the reservation.
        //
        // FIFO lot detail is still carried through where it exists, so
        // reservations stay lot-traceable for consumption.
        const lotQuantitiesByStock = new Map<string, number>();
        for (const lot of lotUsages) {
          lotQuantitiesByStock.set(
            lot.stock_code_id,
            (lotQuantitiesByStock.get(lot.stock_code_id) ?? 0) + Number(lot.quantity_used),
          );
        }

        const reservations: {
          stock_code_id: string;
          receiving_record_id: string | null;
          internal_lot_number: string | null;
          quantity: number;
        }[] = [];

        for (const req of requirementList) {
          const requiredQty = Number(req.quantity) || 0;
          if (requiredQty <= 0) continue;

          const material = getStockCodeById(req.stock_code_id);
          const uom = material?.unit_of_measure || '';

          // Cap at what is actually free, so the all-or-nothing RPC
          // (fms_reserve_batch_stock raises if ANY ingredient is short)
          // cannot void the reservations of every other ingredient. The
          // shortfall is reported in the low-stock warning instead.
          const stockLevel = stockLevels.find(sl => sl.stock_code_id === req.stock_code_id);
          const physical = stockLevel?.quantity_on_hand ?? 0;
          const alreadyReserved = stockLevel?.reserved_quantity ?? 0;
          const netAvailable =
            physical - alreadyReserved - (reservedSoFar.get(req.stock_code_id) ?? 0);
          const toReserve = Math.min(requiredQty, Math.max(0, netAvailable));

          if (toReserve <= 0) {
            lowStockWarnings.push(
              `${result.batch_number}: ${material?.stock_code || req.stock_code_id} needs ${requiredQty.toFixed(2)}${uom ? ' ' + uom : ''} but none is available.`,
            );
            continue;
          }

          reservedSoFar.set(req.stock_code_id, (reservedSoFar.get(req.stock_code_id) ?? 0) + toReserve);

          // Attach lot detail where FIFO managed to allocate it, so the
          // reservation (and its later consumption) stays lot-traceable.
          // Lots are drawn down against a running remainder so their SUM can
          // never exceed toReserve — capping each lot individually would let
          // several lots each claim the full amount and trip the RPC's
          // net-stock check, voiding the whole batch's reservation.
          const lotQty = lotQuantitiesByStock.get(req.stock_code_id) ?? 0;
          let remainder = toReserve;
          for (const lot of lotUsages) {
            if (lot.stock_code_id !== req.stock_code_id) continue;
            if (remainder <= 0) break;
            const take = Math.min(Number(lot.quantity_used) || 0, remainder);
            if (take <= 0) continue;
            reservations.push({
              stock_code_id: lot.stock_code_id,
              receiving_record_id: lot.receiving_record_id,
              internal_lot_number: lot.internal_lot_number,
              quantity: take,
            });
            remainder -= take;
          }

          // Any quantity not covered by a specific lot is still reserved at
          // stock-code level so the hold is never lost.
          if (remainder > 0) {
            reservations.push({
              stock_code_id: req.stock_code_id,
              receiving_record_id: null,
              internal_lot_number: null,
              quantity: remainder,
            });
          }

          if (toReserve < requiredQty) {
            lowStockWarnings.push(
              `${result.batch_number}: ${material?.stock_code || req.stock_code_id} - reserved ${toReserve.toFixed(2)}${uom ? ' ' + uom : ''} of ${requiredQty.toFixed(2)}${uom ? ' ' + uom : ''} required (short ${(requiredQty - toReserve).toFixed(2)}).`,
            );
          }
        }

        let reserveResults: Awaited<ReturnType<typeof reserveStockForBatch>> = null;
        if (reservations.length > 0) {
          reserveResults = await reserveStockForBatch(result.id, result.batch_number, reservations);
        }

        if (reserveResults === null && reservations.length > 0) {
          // Reservation could not be placed. Keep the batch sheet — it was
          // explicitly allowed to be created with low/no stock — and only
          // skip the reservation. Stock can be reserved once received.
          lowStockWarnings.push(`${result.batch_number}: stock could not be reserved (insufficient net stock) — batch created without reservation.`);
        }
        createdCount++;
      }
    }

    await refreshData();
    if (createdCount > 0) {
      toast.success(`Successfully created ${createdCount} batch sheet${createdCount > 1 ? 's' : ''}`);
      
      // Show low stock warnings (non-blocking - batch still created)
      if (lowStockWarnings.length > 0) {
        const uniqueWarnings = [...new Set(lowStockWarnings)];
        toast.warning(`¸⚠️ LOW STOCK: ${uniqueWarnings.join(', ')}`, {
          duration: 8000,
        });
      }
    }

    return createdCount;
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

    // Starting production converts the Batch Sheet's reserved set-aside into
    // actual consumption. This is what the reservation was for: the material
    // was already set aside at CREATION time, so by the time the line starts,
    // the stock is committed and leaves physical stock.
    //
    // Idempotent: fms_consume_batch_reservations only touches rows still in
    // 'reserved', so a batch that was never reserved (or already consumed) is
    // a no-op here rather than a double deduction.
    const consumptionResults = await consumeBatchReservations(
      batchId,
      batch?.batch_number || '',
    );

    const startLowStockWarnings: string[] = [];
    for (const cr of consumptionResults) {
      if (cr.is_low) {
        const sc = getStockCodeById(cr.stock_code_id);
        startLowStockWarnings.push(
          `${sc?.stock_code || cr.stock_code_id} (${cr.new_quantity_on_hand.toFixed(2)} remaining)`,
        );
      }
    }
    // Pickle finished products: generate the pickle stage workflow from the
    // product's BOM dependencies (idempotent). Non-pickle batches are unaffected.
    // ensurePickleRunForBatch plans against freshly fetched BOMs internally, so
    // a just-saved parent_finished_good_id link is honoured immediately.
    if (batch && isPickleBatch(batch, getStockCodeById)) {
      const runId = await ensurePickleRunForBatch({ batch, stockCodes, boms, userId: user?.id });
      // Refresh the shared BOM/batch context so the workflow dialog (and any
      // reopen) sees the same BOM headers the generator just planned against.
      await refreshData().catch(() => undefined);
      try {
        const fresh = await fetchFreshBomsForPlan();
        console.log('[PickleBatchPlan] post-start verification for', batch.batch_number, ':',
          (fresh ?? boms).filter((b: any) => ['active', undefined, null].includes(b.status) || b.status !== 'obsolete').length,
          'live BOMs; plan stages:',
          (await import('@/components/pickle/PickleBatchWorkflow')).buildPickleBatchPlan(
            stockCodes, fresh ?? boms, batch.finished_good_id, Number(batch.planned_batch_size) || 0,
          ).map((s: any) => `${(stockCodes.find((sc: any) => sc.id === s.stockCodeId)?.stock_code) || s.stockCodeId}=${s.totalQty}`).join(', '));
      } catch { /* verification log only */ }
      // Open the batch detail immediately with the started status so the pickle
      // stages show underneath the header (the local `batch` copy is stale).
      setSelectedBatch({ ...batch, status: 'pre_weighing', production_start: new Date().toISOString() });
      setViewDialogOpen(true);
      if (runId) {
        toast.success('Production started — pickle stages generated');
      } else {
        toast.error('Production started, but pickle stages could not be generated.');
      }
      return;
    }
    toast.success('Production started');
    if (startLowStockWarnings.length > 0) {
      toast.warning(`⚠️ LOW STOCK: ${startLowStockWarnings.join(', ')}`, { duration: 8000 });
    }
    await refreshData();
  };

  /**
   * Return stock that a STARTED batch had already consumed.
   *
   * Once production starts, the reservation becomes real consumption and the
   * physical stock is gone. If the batch is then cancelled or deleted, it has
   * to be given back.
   *
   * Driven by the actual reservation rows rather than by BOM maths, so it is
   * also correct for percentage BOMs - there `quantity_per_batch` is a fraction,
   * so BOM x batch-size would restore the wrong amount. Also clears the
   * lot-usage rows so FIFO can re-allocate those lots.
   */
  const restoreConsumedStock = async (batchId: string, batchNumber: string) => {
    const consumed = getReservationsForBatch(batchId).filter((r) => r.status === 'consumed');
    if (consumed.length === 0) return 0;

    const byStockCode = new Map<string, number>();
    for (const r of consumed) {
      byStockCode.set(
        r.stock_code_id,
        (byStockCode.get(r.stock_code_id) ?? 0) + Number(r.quantity_reserved ?? 0),
      );
    }

    let restored = 0;
    for (const [stockCodeId, quantity] of byStockCode) {
      if (quantity <= 0) continue;
      await (supabase.rpc as any)('fms_apply_stock_movement', {
        p_stock_code_id: stockCodeId,
        p_movement_type: 'adjustment',
        p_quantity_change: quantity,
        p_batch_id: batchId,
        p_batch_number: batchNumber,
        p_reference_id: batchNumber,
        p_notes: `Batch ${batchNumber} stopped after start - consumed stock returned`,
        p_created_by: user?.id || null,
      });
      restored += quantity;
    }

    // Mark the consumed holds as released so nothing is left consuming.
    await (supabase.from('fms_stock_reservations') as any)
      .update({
        status: 'released',
        released_by: user?.id || null,
        released_at: new Date().toISOString(),
      })
      .eq('batch_id', batchId)
      .eq('status', 'consumed');

    // Drop the lot-usage rows so FIFO can re-allocate those lots.
    await (supabase.from('fms_materials_used') as any)
      .delete()
      .eq('batch_id', batchId);

    return restored;
  };

  const handleCancelBatch = async (batchId: string) => {
    const batch = productionBatches.find(b => b.id === batchId);
    if (!batch) return;

    // How this batch's stock was handled depends on how far it got:
    //   pending  -> reserved at creation, never deducted  -> just release
    //   consumed -> production STARTED, stock already deducted -> put it back
    //   neither  -> legacy batch that deducted at creation -> old restore path
    const reservations = getReservationsForBatch(batchId);
    const pendingReservations = reservations.filter(r => r.status === 'reserved');
    const consumedReservations = reservations.filter(r => r.status === 'consumed');

    if (pendingReservations.length > 0) {
      // Never started: the set-aside was never deducted, so freeing the
      // reservation restores the available Net Stock.
      try {
        const released = await releaseBatchReservations(batchId, batch.batch_number);
        if (!released) {
          console.warn('[FMS] No active reservations released on cancel (may be legacy batch).');
        }
      } catch (err) {
        console.error('[FMS] Failed to release reservations on cancel:', err);
      }
    } else if (consumedReservations.length > 0) {
      // Production had started, so the reservation was already turned into
      // real consumption and physical stock was deducted. Cancelling has to
      // give that stock back.
      try {
        await restoreConsumedStock(batchId, batch.batch_number);
      } catch (err) {
        console.error('[FMS] Failed to restore consumed stock on cancel:', err);
      }
    } else {
      // Legacy fallback: older batches deducted stock at creation, so restore it.
      try {
        // Get the materials used for this batch
        const { data: materialsUsed } = await (supabase.from('fms_materials_used') as any)
          .select('receiving_record_id, quantity_used')
          .eq('batch_id', batchId);

        // Remove lot usage records so FIFO re-allocates to this lot
        await (supabase.from('fms_materials_used') as any)
          .delete()
          .eq('batch_id', batchId);

        // Restore stock for each material from the active BOM
         const bom = getBOMById(batch.bom_id);
        if (bom) {
          const materialsToRestore = bom.components.map(comp => ({
            stock_code_id: comp.material_stock_code_id,
            quantity: comp.quantity_per_batch * batch.planned_batch_size,
          }));

          for (const mat of materialsToRestore) {
            await (supabase.rpc as any)('fms_apply_stock_movement', {
              p_stock_code_id: mat.stock_code_id,
              p_movement_type: 'adjustment',
              p_quantity_change: mat.quantity,
              p_batch_id: batchId,
              p_batch_number: batch.batch_number,
              p_reference_id: batch.batch_number,
              p_notes: `Batch ${batch.batch_number} cancelled - stock restored`,
              p_created_by: user?.id || null,
            });
          }
        }
      } catch (err) {
        console.error('[FMS] Failed to restore stock on cancel:', err);
      }
    }

    await updateProductionBatch(batchId, {
      status: 'cancelled',
      production_end: new Date().toISOString(),
    } as any);
    toast.success(
      consumedReservations.length > 0
        ? 'Batch cancelled - consumed stock returned'
        : 'Batch cancelled - reserved stock released',
    );
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

  const handleApprovePreWeigh = async (
  batchId: string,
  preWeighMaterials: PreWeighMaterial[]
) => {
  const updates = {
    pre_weigh_approved: true,
    pre_weigh_approved_by: user?.id || '',
    pre_weigh_approved_at: new Date().toISOString(),
    pre_weigh_materials: preWeighMaterials,
    status: 'manufacturing' as const,
  };

  await updateProductionBatch(batchId, updates as any);

  setSelectedBatch(prev =>
    prev
      ? {
          ...prev,
          ...updates,
        }
      : null
  );

  toast.success('Pre-weigh checks approved');
};

 const handleUpdateStep = async (
  batchId: string,
  stepId: string,
  completed: boolean
) => {
  const batch = productionBatches.find(b => b.id === batchId);
  if (!batch) return;

  const updatedSteps = (batch.processing_steps as ProcessingStep[]).map(step =>
    step.id === stepId
      ? {
          ...step,
          completed,
          completed_at: completed
            ? new Date().toISOString()
            : undefined,
          completed_by: completed ? user?.id : undefined,
        }
      : step
  );

  await updateProductionBatch(batchId, {
    processing_steps: updatedSteps,
  });

  // Update the open batch immediately
  setSelectedBatch(prev =>
    prev
      ? {
          ...prev,
          processing_steps: updatedSteps,
        }
      : null
  );
};
  
const handleUpdateOrganolepticCheck = async (
  batchId: string,
  checkName: string,
  result: 'pass' | 'fail'
) => {
  const batch = productionBatches.find(b => b.id === batchId);
  if (!batch) return;

  const updatedChecks = (batch.quality_checks as OrganolepticCheck[]).map(check =>
    check.name === checkName
      ? {
          ...check,
          result,
          checked_at: new Date().toISOString(),
          checked_by: user?.id,
        }
      : check
  );

  await updateProductionBatch(batchId, {
    quality_checks: updatedChecks,
  });

  // Update the open batch immediately
  setSelectedBatch(prev =>
    prev
      ? {
          ...prev,
          quality_checks: updatedChecks,
        }
      : null
  );
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
    // Consumption normally already happened at START (see handleStartProduction).
    // This call is kept as an idempotent safety net: it only touches reservation
    // rows still in 'reserved', so for a batch started after that change it is a
    // no-op, and for a legacy batch that was started before it, it still
    // converts the set-aside into real usage exactly once. Either way no
    // reservation is left behind when the batch closes.
    const batch = productionBatches.find(b => b.id === batchId);
    const consumptionResults = await consumeBatchReservations(batchId, batch?.batch_number || '');

    // Collect low stock warnings from the material consumption
    const closeLowStockWarnings: string[] = [];
    for (const cr of consumptionResults) {
      if (cr.is_low) {
        const sc = getStockCodeById(cr.stock_code_id);
        closeLowStockWarnings.push(`${sc?.stock_code || cr.stock_code_id} (${cr.new_quantity_on_hand.toFixed(2)} remaining)`);
      }
    }

    toast.success('Batch closed successfully');
    if (closeLowStockWarnings.length > 0) {
      const uniqueWarnings = [...new Set(closeLowStockWarnings)];
      toast.warning(`⚠️ LOW STOCK: ${uniqueWarnings.join(', ')}`, {
        duration: 8000,
      });
    }
    // NOTE: consumeBatchReservations already performs a forced full data
    // refresh (fetchData(true)) in its finally block, so no extra
    // refreshData() call is needed here.
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
        <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 11px;">${preWeighMat?.approved ? 'âœ“' : 'â—‹'}</td>
      </tr>`;
    }).join('') || '';

    const stepsHtml = (batch.processing_steps as ProcessingStep[] || []).map((step, index) => 
      `<tr>
        <td style="padding: 6px; border: 1px solid #ddd; font-size: 11px;">${index + 1}</td>
        <td style="padding: 6px; border: 1px solid #ddd; font-size: 11px;">${escapeHtml(step.step_name || '')}</td>
        <td style="padding: 6px; border: 1px solid #ddd; font-size: 11px;">${escapeHtml(step.description || '')}</td>
        <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 11px;">${step.completed ? 'âœ“' : 'â—‹'}</td>
      </tr>`
    ).join('');

    const organolepticHtml = (batch.quality_checks as OrganolepticCheck[] || []).map((check) => 
      `<tr>
        <td style="padding: 6px; border: 1px solid #ddd; font-size: 11px;">${escapeHtml(check.name || '')}</td>
        <td style="padding: 6px; border: 1px solid #ddd; font-size: 11px;">${escapeHtml(check.expected_value || '')}</td>
        <td style="padding: 6px; border: 1px solid #ddd; text-align: center; font-size: 11px;">${check.result === 'pass' ? 'P' : check.result === 'fail' ? 'F' : 'â—‹'}</td>
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
          <div class="info-item"><div class="info-label">Expected Qty (Â±100g)</div><div class="info-value">${batch.planned_batch_size} kg</div></div>
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

  // ---- Best-Before (expiry) sticker — 30 x 30 mm ----
  const [stickerDialogBatch, setStickerDialogBatch] = useState<typeof productionBatches[0] | null>(null);
  const [stickerManufDate, setStickerManufDate] = useState('');
  const [stickerBestBefore, setStickerBestBefore] = useState('');
  const [stickerCopies, setStickerCopies] = useState(DEFAULT_STICKER_COPIES);
  const [stickerSaving, setStickerSaving] = useState(false);

  const handleOpenExpirySticker = (batch: typeof productionBatches[0]) => {
    setStickerDialogBatch(batch);
    setStickerManufDate(String(batch.planned_production_date || '').slice(0, 10));
    // Pre-fill from the batch so a date set previously is visible and can be
    // corrected, rather than silently forgotten.
    setStickerBestBefore(String(batch.best_before_date || '').slice(0, 10));
    setStickerCopies(batch.sticker_copies || DEFAULT_STICKER_COPIES);
  };

  const fmtStickerDate = (raw: string) => {
    if (!raw) return '';
    const d = new Date(`${raw.slice(0, 10)}T00:00:00`);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleDownloadSticker = () => {
    if (!stickerDialogBatch) return;
    if (!stickerBestBefore) { toast.error('Please enter a Best Before date'); return; }
    downloadExpirySticker(
      stickerDialogBatch.batch_number,
      fmtStickerDate(stickerManufDate),
      fmtStickerDate(stickerBestBefore)
    );
    toast.success('Best-before sticker downloaded');
  };

  const handlePrintSticker = () => {
    if (!stickerDialogBatch) return;
    if (!stickerBestBefore) { toast.error('Please enter a Best Before date'); return; }
    printExpiryStickers(
      stickerDialogBatch.batch_number,
      fmtStickerDate(stickerManufDate),
      fmtStickerDate(stickerBestBefore),
      stickerCopies
    );
  };

  /**
   * Save the Best Before date and sticker count onto the batch, then queue the
   * stickers for the midnight print run.
   *
   * The date belongs to THIS batch. Many batches may carry the exact same date;
   * it is never treated as an identifier and never groups anything. If a sticker
   * job is already pending for this batch it is updated rather than duplicated.
   */
  const handleSaveAndQueueSticker = async () => {
    if (!stickerDialogBatch) return;
    if (!stickerBestBefore) {
      toast.error('Please enter a Best Before date before queuing');
      return;
    }
    const batchId = stickerDialogBatch.id;
    const copies = Math.max(1, stickerCopies);
    setStickerSaving(true);

    try {
      // 1. Persist the date and copy count on the batch.
      const { error: saveError } = await supabase
        .from('fms_production_batches')
        .update({ best_before_date: stickerBestBefore, sticker_copies: copies })
        .eq('id', batchId);

      if (saveError) {
        // The new columns are not there yet if the migration has not run.
        if (/PGRST204|42P01|column .* does not exist|schema cache/i.test(saveError.message)) {
          toast.error(
            'The print queue columns are not set up yet. Apply the print queue migration, then try again.',
            { duration: 10000 },
          );
        } else {
          toast.error(saveError.message || 'Could not save the Best Before date');
        }
        return;
      }

      // 2. Queue the sticker job for the midnight run.
      const result = await queueBestBeforeSticker({ batchId, copies });

      if (!result.ok) {
        toast.error(
          result.schemaMissing
            ? 'The print queue is not set up yet. Apply the print queue migration, then try again.'
            : result.reason,
          { duration: 10000 },
        );
        return;
      }

      toast.success(
        result.updated
          ? `Updated the queued stickers for ${stickerDialogBatch.batch_number} (${copies})`
          : `${copies} sticker(s) queued for ${stickerDialogBatch.batch_number}`,
        { description: 'They will print automatically at midnight.' },
      );

      setStickerDialogBatch(null);
      await refreshData();
    } finally {
      setStickerSaving(false);
    }
  };

//Dekete Batch Function
  const handleDeleteBatch = async (batchId: string) => {
    const batch = productionBatches.find(b => b.id === batchId);
    if (!batch) return;

    // Restore stock and lot usage for this batch before deletion.
    //  pending  -> reserved, never deducted          -> release
    //  consumed -> production started, stock gone     -> give it back
    //  neither  -> legacy batch that deducted early  -> old restore path
    const reservations = getReservationsForBatch(batchId);
    const pendingReservations = reservations.filter(r => r.status === 'reserved');
    const consumedReservations = reservations.filter(r => r.status === 'consumed');

    if (pendingReservations.length > 0) {
      const released = await releaseBatchReservations(batchId, batch.batch_number);

      if (!released) {
        toast.error("Batch was not deleted because it's reserved stock could not be released");
        return;
      }

    } else if (consumedReservations.length > 0) {
      try {
        await restoreConsumedStock(batchId, batch.batch_number);
      } catch (err) {
        console.error('[FMS] Failed to restore consumed stock on delete:', err);
      }
    } else {
      // Legacy fallback: restore just-in-time deducted stock
      try {
        await (supabase.from('fms_materials_used') as any)
          .delete()
          .eq('batch_id', batchId);

        const bom = getBOMByFinishedGoodId(batch.finished_good_id);
        if (bom) {
          const materialsToRestore = bom.components.map(comp => ({
            stock_code_id: comp.material_stock_code_id,
            quantity: comp.quantity_per_batch * batch.planned_batch_size,
          }));

          for (const mat of materialsToRestore) {
            await (supabase.rpc as any)('fms_apply_stock_movement', {
              p_stock_code_id: mat.stock_code_id,
              p_movement_type: 'adjustment',
              p_quantity_change: mat.quantity,
              p_batch_id: batchId,
              p_batch_number: batch.batch_number,
              p_reference_id: batch.batch_number,
              p_notes: `Batch ${batch.batch_number} deleted - stock restored`,
              p_created_by: user?.id || null,
            });
          }
        }
      } catch (err) {
        console.error('[FMS] Failed to restore stock on delete:', err);
      }
    }

    const { error } = await supabase.from('fms_production_batches').delete().eq('id', batchId);
    if (error) {
      toast.error('Failed to delete batch');
      return;
    }
    toast.success('Batch deleted - reserved stock released');
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

  const matchesSearch =
    batch.batch_number.toLowerCase().includes(query) ||
    productName.includes(query);

  const matchesStatus =
    statusFilter === 'all' || batch.status === statusFilter;

  // Drafted-date range filter
  const draftDate = (batch.created_at || '').slice(0, 10);

  const matchesDate =
    (!dateFrom || draftDate >= dateFrom) &&
    (!dateTo || draftDate <= dateTo);

  // Raw material filter — use the exact BOM assigned to this batch
  const matchesMaterial =
    materialFilter === 'all' ||
    (() => {
      const bom = getBOMById(batch.bom_id);

      return (
        !!bom &&
        (bom.components || []).some(
          c => c.material_stock_code_id === materialFilter
        )
      );
    })();

  const matchesProduct =
    productFilter === 'all' ||
    batch.finished_good_id === productFilter;

  return (
    matchesSearch &&
    matchesStatus &&
    matchesDate &&
    matchesMaterial &&
    matchesProduct
  );
});

// Total quantity of the selected raw material used across the filtered batches
const filteredMaterialTotal = useMemo(() => {
  if (materialFilter === 'all') return 0;

  return filteredBatches.reduce((sum, batch) => {
    const bom = getBOMById(batch.bom_id);

    const comp = (bom?.components || []).find(
      c => c.material_stock_code_id === materialFilter
    );

    return comp
      ? sum + comp.quantity_per_batch * batch.planned_batch_size
      : sum;
  }, 0);
}, [filteredBatches, materialFilter, boms]);

  const selectedFilterMaterial = materialFilter !== 'all' ? getStockCodeById(materialFilter) : null;

  /**
   * Raw materials used across the currently filtered batches, and what each was
   * used for. Built from `pre_weigh_materials` (what was actually weighed),
   * falling back to the BOM recipe for batches that were never pre-weighed.
   *
   * It follows the same filters as the batch list above, so narrowing by date,
   * status, product or raw material narrows this report too.
   */
  const rawMaterialUsage = useMemo(
    () =>
      aggregateRawMaterialUsage(
        filteredBatches.map((b) => ({
          id: b.id,
          batch_number: b.batch_number,
          finished_good_id: b.finished_good_id,
          production_date: String(
            b.planned_production_date || b.production_end || b.planned_production_date || '',
          ).slice(0, 10) || null,
          pre_weigh_materials: (b.pre_weigh_materials as any) ?? null,
        })),
        { stockCode: (id) => getStockCodeById(id ?? '') },
        // Recipe fallback only. This mirrors how the batch itself was created
        // (see createBatchesFor) so the estimate matches the app: percentage
        // BOMs are expanded down the whole WIP tree, everything else uses
        // quantity_per_batch x planned size.
        (batchId, materialId) => {
          if (!materialId) return null;
          const batch = productionBatches.find((b) => b.id === batchId);
          if (!batch) return null;

          const plannedQty = parseFloat(String(batch.planned_batch_size)) || 0;
          const usesPercentageBom =
            (getStockCodeById(batch.finished_good_id) as any)?.bom_uses_percentage === true;

          const requirementList = usesPercentageBom
            ? computeBatchMaterialRequirements(
                stockCodes,
                boms,
                batch.finished_good_id,
                plannedQty,
              )
            : (getBOMById(batch.bom_id)?.components || []).map((comp) => ({
                stock_code_id: comp.material_stock_code_id,
                quantity: comp.quantity_per_batch * plannedQty,
              }));

          const match = requirementList.find((r) => r.stock_code_id === materialId);
          return match ? match.quantity : null;
        },
      ),
    [filteredBatches, getStockCodeById, getBOMById, boms, productionBatches, stockCodes],
  );

  // Totals are grouped by unit: adding kilograms to units to litres would
  // produce a meaningless number.
  const rawMaterialUsageTotals = useMemo(
    () => summariseUsageByUom(rawMaterialUsage),
    [rawMaterialUsage],
  );


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
    <Tabs defaultValue="batches" className="w-full">
      <TabsList className="grid w-full max-w-2xl grid-cols-3">
        <TabsTrigger value="batches" className="gap-2 text-xs sm:text-sm">
          <Factory className="h-4 w-4" />
          Batch Sheets
        </TabsTrigger>
        <TabsTrigger value="planned" className="gap-2 text-xs sm:text-sm">
          <CalendarDays className="h-4 w-4" />
          Queued Printing
        </TabsTrigger>
        <TabsTrigger value="suggested" className="gap-2 text-xs sm:text-sm">
          <Sparkles className="h-4 w-4" />
          Suggested Batch Sheets
        </TabsTrigger>
      </TabsList>

      {/* Planned Production Queue for the next working day. Selecting a batch
          here only queues its Batch Sheet for printing: it does not start
          production and does not change the batch status. The operator starts
          production the next morning with the existing Start action above. */}
      <TabsContent value="planned" className="mt-4">
        <PlannedProductionQueue
          productionBatches={productionBatches}
          getStockCodeById={getStockCodeById}
        />
      </TabsContent>

      <TabsContent value="batches">
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
          <Button
            onClick={openCreateDialog}
            size="sm"
            className="gap-2 transition-transform hover:scale-105"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create Batch Sheet</span>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                    <p className="text-sm font-semibold mb-2">Recipe preview & stock availability</p>
                    {selectedBOMMaterials.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Enter a valid batch size to preview required materials from the BOM.</p>
                    ) : (
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr>
                            <th className="text-left py-2">Material</th>
                            <th className="text-right py-2">Required</th>
                            <th className="text-right py-2">Physical Stock</th>
                            <th className="text-right py-2">Reserved</th>
                            <th className="text-right py-2">Net Stock</th>
                            <th className="text-center py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                          {selectedBOMMaterials.map((item) => (
                            <tr key={item.id} className="border-t border-border">
                              <td className="py-2 pr-3">{item.material?.stock_code || 'Unknown'}</td>
                              <td className="py-2 text-right">{item.requiredQuantity.toFixed(2)} {item.material?.unit_of_measure}</td>
                              <td className="py-2 text-right">{item.physicalStock.toFixed(2)} {item.material?.unit_of_measure}</td>
                              <td className="py-2 text-right">{item.reserved.toFixed(2)} {item.material?.unit_of_measure}</td>
                              <td className={`py-2 text-right ${item.netStock < item.requiredQuantity ? 'text-destructive font-semibold' : 'text-success font-semibold'}`}>
                                {item.netStock.toFixed(2)} {item.material?.unit_of_measure}
                              </td>
                              <td className="py-2 text-center">
                                {item.isAvailable ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success px-2 py-0.5 text-xs font-medium">
                                    <CheckCircle className="h-3 w-3" /> In Stock
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-medium">
                                    <XCircle className="h-3 w-3" /> Short by {item.shortage.toFixed(2)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Insufficient stock warning */}
                  {hasInsufficientStock && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 animate-fade-in">
                      <div className="flex items-start gap-2">
                        <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-destructive">
                            âš ï¸ Insufficient Stock - {insufficientCount} material{insufficientCount > 1 ? 's' : ''} below required level
                          </p>
                          <p className="text-sm text-destructive/80 mt-1">
                            You can still proceed, but stock will go negative for these materials.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
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

              {batchLines.length > 0 && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-sm font-semibold mb-2">
                    Queued batch sheets ({batchLines.reduce((sum, l) => sum + (parseInt(l.number_of_batches) || 1), 0)} total)
                  </p>
                  <div className="space-y-2">
                    {batchLines.map((line, idx) => {
                      const product = getStockCodeById(line.finished_good_id);
                      return (
                        <div key={idx} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {product?.stock_code || 'Unknown'} - {product?.description || ''}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {line.planned_batch_size} kg × {parseInt(line.number_of_batches) || 1} sheet(s) · {line.planned_production_date}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveBatchLine(idx)} disabled={creatingBatch}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creatingBatch}>Cancel</Button>
              <Button
                variant="outline"
                onClick={handleAddAnotherBatch}
                disabled={creatingBatch || !selectedBOM}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Another Batch Sheet
              </Button>
              {hasInsufficientStock ? (
                <Button
                  onClick={handleCreateBatch}
                  disabled={creatingBatch || (!selectedBOM && batchLines.length === 0)}
                  variant="destructive"
                  className="gap-2"
                >
                  {creatingBatch && <Loader2 className="h-4 w-4 animate-spin" />}
                  <XCircle className="h-4 w-4" />
                  Proceed Anyway ({insufficientCount} low)
                </Button>
              ) : (
                <Button onClick={handleCreateBatch} disabled={creatingBatch || (!selectedBOM && batchLines.length === 0)} className="gap-2">
                  {creatingBatch && <Loader2 className="h-4 w-4 animate-spin" />}
                  <CheckCircle className="h-4 w-4" />
                  Create Batch{batchLines.length > 0 ? ` (${batchLines.reduce((sum, l) => sum + (parseInt(l.number_of_batches) || 1), 0) + (formData.finished_good_id && parseFloat(formData.planned_batch_size) > 0 ? (parseInt(formData.number_of_batches) || 1) : 0)} sheets)` : ''}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
          </Dialog>

          {/* Best-Before (expiry) sticker — 30 x 30 mm */}
          <Dialog open={!!stickerDialogBatch} onOpenChange={(o) => { if (!o) setStickerDialogBatch(null); }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Best-Before Sticker (30 x 30 mm)</DialogTitle>
                <DialogDescription>
                  Download or print a best-before label for this finished batch. These stickers are printed separately and stuck on the finished goods.
                </DialogDescription>
              </DialogHeader>

              {stickerDialogBatch && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                    <p className="font-semibold">{stickerDialogBatch.batch_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {getStockCodeById(stickerDialogBatch.finished_good_id)?.description || 'Finished good'}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sticker-manuf">Manufactured Date</Label>
                      <Input id="sticker-manuf" type="date" value={stickerManufDate} onChange={(e) => setStickerManufDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sticker-bb">Best Before *</Label>
                      <Input id="sticker-bb" type="date" value={stickerBestBefore} onChange={(e) => setStickerBestBefore(e.target.value)} required />
                    </div>
                  </div>

                  {/* Live preview */}
                  <div className="flex justify-center rounded-lg border border-border bg-white p-4">
                    {(stickerManufDate || stickerBestBefore) ? (() => {
                      const preview = renderExpirySticker(
                        stickerDialogBatch.batch_number,
                        fmtStickerDate(stickerManufDate),
                        fmtStickerDate(stickerBestBefore)
                      );
                      return preview ? (
                        <img
                          src={preview.toDataURL('image/png')}
                          alt="Best-before sticker preview (30 x 30 mm)"
                          className="h-40 w-40 rounded border border-gray-300 object-contain"
                        />
                      ) : (
                        <p className="py-10 text-center text-sm text-muted-foreground">Could not render preview</p>
                      );
                    })() : (
                      <p className="py-10 text-center text-sm text-muted-foreground">Enter dates above to preview the sticker</p>
                    )}
                  </div>

                  {/* Print copies */}
                  <div className="space-y-2">
                    <Label htmlFor="sticker-copies">Print copies</Label>
                    <Input
                      id="sticker-copies"
                      type="number"
                      min={1}
                      max={50}
                      value={stickerCopies}
                      onChange={(e) => setStickerCopies(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-28"
                    />
                    <p className="text-xs text-muted-foreground">
                      Saved on this batch. Many batches may share the same Best Before date —
                      each keeps its own date and its own queued stickers.
                    </p>
                  </div>
                </div>
              )}

              {/* Four actions no longer fit on one line, so the footer wraps instead of
                  overlapping. The queue action is full width on its own row. */}
              <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <Button variant="outline" onClick={() => setStickerDialogBatch(null)}>Close</Button>
                <Button variant="outline" onClick={handlePrintSticker} disabled={!stickerBestBefore} className="gap-2">
                  <Printer className="h-4 w-4" /> Print ({stickerCopies})
                </Button>
                <Button onClick={handleDownloadSticker} disabled={!stickerBestBefore} className="gap-2">
                  <Download className="h-4 w-4" /> Download Sticker
                </Button>
                {/* Saves the date on the batch and queues the stickers for the
                    midnight run. Separate from the Batch Sheet QR job. */}
                <Button
                  onClick={handleSaveAndQueueSticker}
                  disabled={!stickerBestBefore || stickerSaving}
                  className="w-full gap-2 sm:w-auto sm:ml-auto"
                >
                  {stickerSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  Save &amp; Queue for Midnight ({stickerCopies})
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>

      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="relative flex-1">
            <Label className="mb-1 block text-xs text-muted-foreground">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search batch number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Status</Label>
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
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Drafted From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full sm:w-[160px]" />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Drafted To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full sm:w-[160px]" />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:w-[260px]">
            <Label className="mb-1 block text-xs text-muted-foreground">Raw Material</Label>
            <SearchableSelect
              options={[{ value: 'all', label: 'All Raw Materials' }, ...materialOptions]}
              value={materialFilter}
              onValueChange={setMaterialFilter}
              placeholder="All raw materials"
            />
          </div>
          <div className="w-full sm:w-[260px]">
            <Label className="mb-1 block text-xs text-muted-foreground">Finished Product</Label>
            <SearchableSelect
              options={[{ value: 'all', label: 'All Finished Products' }, ...finishedProductFilterOptions]}
              value={productFilter}
              onValueChange={setProductFilter}
              placeholder="All finished products"
            />
          </div>
          {/* Toggles the "raw materials used, and what for" breakdown for the
              batches currently matching the filters above. */}
          <Button
            variant={showRawMaterialUsage ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={() => setShowRawMaterialUsage((v) => !v)}
          >
            <BarChart3 className="h-4 w-4" />
            Raw Materials Used
          </Button>
        </div>
        {/* Summary */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">
            Batch sheets: <span className="font-semibold text-foreground">{filteredBatches.length}</span>
          </span>
          {selectedFilterMaterial && (
            <span className="text-muted-foreground">
              {selectedFilterMaterial.stock_code}
              {selectedFilterMaterial.description ? ` (${selectedFilterMaterial.description})` : ''} used:{' '}
              <span className="font-semibold text-foreground">{filteredMaterialTotal.toFixed(2)} kg</span>
            </span>
          )}
          {(dateFrom || dateTo || materialFilter !== 'all' || productFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto gap-1">
              <XCircle className="h-4 w-4" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Raw materials used in this range, and what they were used for. */}
        {showRawMaterialUsage && (
          <div className="border-t border-border pt-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm font-semibold">Raw materials used</Label>
              <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                <span>{rawMaterialUsage.length} material(s) across {filteredBatches.length} batch sheet(s)</span>
                {/* Totals are per unit of measure - they are never added
                    together, because kg + units + litres is meaningless. */}
                {rawMaterialUsageTotals.map((t) => (
                  <span key={t.uom}>
                    <span className="font-semibold text-foreground">
                      {t.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>{' '}
                    {t.uom}
                  </span>
                ))}
              </span>
            </div>

            {rawMaterialUsage.length === 0 ? (
              <p className="rounded border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No raw materials recorded on the batches matching these filters.
              </p>
            ) : (
              <div className="max-h-96 overflow-y-auto rounded border border-border">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Raw Material</th>
                      <th>Description</th>
                      <th className="text-right">Total Used</th>
                      <th>Used for (batch → product)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawMaterialUsage.map((row) => (
                      <tr key={row.material_id ?? row.stock_code}>
                        <td className="font-mono text-xs">{row.stock_code}</td>
                        <td className="text-xs">{row.description}</td>
                        <td className="whitespace-nowrap text-right font-semibold">
                          {row.total_used.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          {row.uom ? ` ${row.uom}` : ''}
                        </td>
                        <td className="text-xs">
                          <ul className="space-y-1">
                            {row.uses.map((use) => {
                              const fg = getStockCodeById(use.finished_good_id);
                              return (
                                <li key={`${row.stock_code}-${use.batch_id}`} className="flex flex-wrap items-center gap-1">
                                  <span className="font-mono">{use.batch_number}</span>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  <span>{fg?.stock_code ?? use.finished_good_id}</span>
                                  {fg?.description && (
                                    <span className="text-muted-foreground">({fg.description})</span>
                                  )}
                                  <span className="text-muted-foreground">
                                    · {use.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    {row.uom ? ` ${row.uom}` : ''}
                                  </span>
                                  {use.internal_lot_number && (
                                    <Badge variant="outline" className="font-mono text-[10px]">
                                      {use.internal_lot_number}
                                    </Badge>
                                  )}
                                  {!use.measured && (
                                    <Badge variant="outline" className="text-[10px]" title="No weighed quantity was recorded; the BOM recipe was used instead">
                                      recipe
                                    </Badge>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              Quantities come from what was recorded at pre-weigh. Items marked &quot;recipe&quot;
              had no weighed quantity, so the batch BOM was used instead.
            </p>
          </div>
        )}
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
                <Button variant="outline" size="sm" onClick={() => handleOpenExpirySticker(batch)} title="Expiry Sticker" className="hidden sm:inline-flex">
                  <Tag className="h-4 w-4" />
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
          {selectedBatch && isPickleBatch(selectedBatch, getStockCodeById) && selectedBatch.status !== 'draft' && (
            <PickleBatchWorkflow
              batch={selectedBatch}
              stockCodes={stockCodes}
              boms={boms}
              receivingRecords={receivingRecords}
              onChanged={async () => { await refreshData(); }}
            />
          )}
          {/* Pickle batches (after Start): the pickle stage workflow replaces the
              normal batch management view, so there is only one workflow. Draft
              pickle batches keep the normal view and the stages stay hidden.
              Non-pickle batches always render BatchManagement, unchanged. */}
          {selectedBatch && (!isPickleBatch(selectedBatch, getStockCodeById) || selectedBatch.status === 'draft') && (
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

                setSelectedBatch(prev =>
                  prev ? { ...prev, ...updates } : null
                );
        }}

                            reservations={getReservationsForBatch(selectedBatch.id)}
              fifoAllocateLots={fifoAllocateLots}
              getReceivingById={getReceivingById}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
      </TabsContent>

      <TabsContent value="suggested">
        <SuggestedBatchSheets
          stockCodes={stockCodes}
          productionBatches={productionBatches}
        />
      </TabsContent>
    </Tabs>
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
    reservations?: FMSStockReservation[];
  fifoAllocateLots?: (stockCodeId: string, quantityRequired: number) => Promise<{ receiving_record_id: string; internal_lot_number?: string; quantity_to_use: number; expiry_date?: string }[]>;
  getReceivingById?: (id: string | null | undefined) => any;
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
  reservations,
  fifoAllocateLots,
  getReceivingById,
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

  // Auto-populate lot numbers from the database for materials that are missing
  // them. Prefers the batch's own reserved lots (recorded at batch creation),
  // falling back to a fresh FIFO allocation. The user should only need to enter
  // Qty Weighed and tick the approval check.
  const autoFilledRef = React.useRef(false);
    useEffect(() => {
    if (autoFilledRef.current) return;
    if (batch.pre_weigh_approved || batch.status === 'closed' || batch.status === 'cancelled') return;

    const needsFill = initialMaterials.some(m => !(m.internal_lot_number || '').trim());
    if (!needsFill) {
      autoFilledRef.current = true;
      return;
    }

    const fillMissingLots = async () => {
      let changed = false;
      const stillMissing: string[] = [];
      const next: PreWeighMaterial[] = [];
      for (const m of initialMaterials) {
        if ((m.internal_lot_number || '').trim()) {
          next.push(m);
          continue;
        }
        // 1. Prefer this batch's own reserved lots (exact traceability match)
        const res = (reservations || []).find(
          r => r.stock_code_id === m.material_id && r.status === 'reserved' && r.internal_lot_number
        );
        if (res?.internal_lot_number) {
          changed = true;
          const rec = getReceivingById?.(res.receiving_record_id);
          next.push({
            ...m,
            raw_material_batch_number: m.raw_material_batch_number || rec?.supplier_batch_number || '',
            internal_lot_number: rec?.internal_lot_number || res.internal_lot_number,
            expiry_date: m.expiry_date || rec?.expiry_date || '',
          });
          continue;
        }
        // 2. Fall back to a fresh FIFO allocation from receiving records
        if (fifoAllocateLots && m.required_quantity > 0) {
          try {
            const lots = await fifoAllocateLots(m.material_id, m.required_quantity);
            if (lots.length > 0) {
              changed = true;
              const rec0 = getReceivingById?.(lots[0].receiving_record_id);
              next.push({
                ...m,
                raw_material_batch_number: m.raw_material_batch_number || rec0?.supplier_batch_number || '',
                internal_lot_number: rec0?.internal_lot_number || lots[0].internal_lot_number || '',
                expiry_date: m.expiry_date || rec0?.expiry_date || lots[0].expiry_date || '',
              });
              continue;
            }
          } catch (err) {
            console.error('[BatchSheet] FIFO auto-fill error:', err);
          }
        }
        stillMissing.push(m.stock_code || m.material_name || 'material');
        next.push(m);
      }
      autoFilledRef.current = true;
      if (changed) {
        setPreWeighMaterials(next);
        onUpdateBatch({ pre_weigh_materials: next });
      }
      if (stillMissing.length > 0) {
        toast.warning(
          `Could not auto-fill lot numbers for: ${[...new Set(stillMissing)].join(', ')}. ` +
          'Check that the material has accepted receiving records, and that the stock reservation/FIFO SQL migrations have been applied to the database.',
          { duration: 10000 }
        );
      }
    };

    fillMissingLots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Persist pre-weigh material edits to the database on blur
  const savePreWeighMaterials = () => {
    onUpdateBatch({ pre_weigh_materials: preWeighMaterials });
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
                            <span className="font-medium">{mat.quantity_weighed != null ? `${mat.quantity_weighed} ${mat.uom}` : 'â€”'}</span>
                          )}
                        </td>
                        <td className="p-2 border">
                          {batch.status === 'pre_weighing' && !batch.pre_weigh_approved ? (
                            <Input
                              type="text"
                              value={mat.raw_material_batch_number || ''}
                              onChange={(e) => handlePreWeighMaterialChange(index, 'raw_material_batch_number', e.target.value)}
                              placeholder="External batch no."
                              className={`text-sm h-8 w-full ${!mat.raw_material_batch_number && '!border-red-500 !focus:ring-red-500'}`}
                              onBlur={savePreWeighMaterials}
                            />
                          ) : (
                            <span className="font-medium">
                              {mat.raw_material_batch_number || '-'}
                            </span>
                          )}
                        </td>
                        <td className="p-2 border">
                          {batch.status === 'pre_weighing' && !batch.pre_weigh_approved ? (
                            <Input
                              type="text"
                              value={mat.internal_lot_number || ''}
                              onChange={(e) => handlePreWeighMaterialChange(index, 'internal_lot_number', e.target.value)}
                              placeholder="Internal lot no."
                              className={`text-sm h-8 w-full ${!(mat.internal_lot_number) && '!border-red-500 !focus:ring-red-500'}`}
                              onBlur={savePreWeighMaterials}
                            />
                          ) : (
                            <span className="font-medium">
                                                                                      {mat.internal_lot_number || '—'}
                            </span>
                          )}
                        </td>
                        <td className="p-2 border">
                          <span className="font-medium">
                            {mat.expiry_date ? formatDate(mat.expiry_date) : '—'}
                          </span>
                        </td>
                        <td className="p-2 border text-center">
                          {batch.status === 'pre_weighing' && !batch.pre_weigh_approved ? (
                            <Switch
                                checked={mat.approved}
                                onCheckedChange={(checked) =>
                                  handlePreWeighMaterialChange(index, 'approved', checked)
                                }
                                className={mat.approved ? 'data-[state=checked]:bg-green-600' : ''}
                              />
                          ) : (
                            <span className={`text-lg ${mat.approved ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {mat.approved ? 'âœ“' : 'â—‹'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

                            {batch.status === 'pre_weighing' && !batch.pre_weigh_approved && (
                <>
                  {!allMaterialsApproved && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Approve button is disabled until all materials have a checked ✓, an External Batch No., and an Internal Lot No.
                    </p>
                  )}
                  <Button
                    onClick={() => onApprovePreWeigh(preWeighMaterials)}
                    className="w-full"
                    disabled={!allMaterialsApproved}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve Pre-Weigh ({preWeighMaterials.filter(m => m.approved).length}/{preWeighMaterials.length})
                  </Button>
                </>
              )}
            </>
          ) : (
            <div className="p-4 text-center text-muted-foreground rounded-lg border border-dashed">
              No materials defined in BOM for this batch.
            </div>
          )}
        </div>
{/* Reserved Stock / Reservation Traceability */}
        {reservations && reservations.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-semibold mb-2">Reserved Stock (Lot Traceability)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2 border font-medium">Stock Code</th>
                    <th className="text-left p-2 border font-medium">Lot No.</th>
                    <th className="text-right p-2 border font-medium">Quantity Reserved</th>
                    <th className="text-center p-2 border font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((res) => {
                    const sc = getStockCodeById(res.stock_code_id);
                    return (
                      <tr key={res.id}>
                        <td className="p-2 border">{sc?.stock_code || res.stock_code_id}</td>
                        <td className="p-2 border">{res.internal_lot_number || '—'}</td>
                        <td className="p-2 border text-right font-medium">{Number(res.quantity_reserved).toFixed(2)}</td>
                        <td className="p-2 border text-center">
                          {res.status === 'reserved' && <Badge variant="outline" className="text-amber-600 border-amber-600">Reserved</Badge>}
                          {res.status === 'consumed' && <Badge variant="outline" className="text-green-600 border-green-600">Consumed</Badge>}
                          {res.status === 'released' && <Badge variant="outline" className="text-muted-foreground border-border">Released</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
                âš ï¸ Immediately inform head office - {check.name} check failed
              </div>
            )}
          </div>
        ))}
        
        {/* Warning for any failed checks */}
        {organolepticChecks.some(c => c.result === 'fail') && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive text-destructive font-semibold">
            âš ï¸ ATTENTION: One or more quality checks have FAILED. Immediately inform head office.
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
            <span className="text-sm font-medium">Expected Quantity (Â±100g tolerance):</span>
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
                âš ï¸ Quarantine batch for investigation. Variance exceeds Â±100g tolerance.
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
