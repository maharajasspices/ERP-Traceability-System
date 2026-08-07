import React, { useState, useMemo } from 'react';
import { useFMSData } from '@/hooks/useFMSData';
import { useSupplierPrices, formatZAR } from '@/hooks/useSupplierPrices';
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
import { Plus, Search, FileText, Trash2, Eye, Copy, Loader2, Printer, LayoutGrid, Table } from 'lucide-react';

const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// Organoleptic Parameters interface
interface OrganolepticParameter {
  name: string;
  expected_value: string;
}

interface ProcessingStep {
  step_order: number;
  step_name: string;
  description: string;
}

const BillOfMaterials: React.FC = () => {
  const { user } = useFMSAuth();
  const { canDelete } = useDeletePermission();
  const { boms, stockCodes, loading, addBOM, updateBOM, refreshData } = useFMSData();
  const { avgPriceForStockCode } = useSupplierPrices();

  // Recursive per-kg cost: raw/packaging -> supplier avg price;
  // WIP / finished_good -> sum of (component qty * recursive cost) from active BOM.
  // Returns null if any leg is missing a price (partial cost).
  const costPerKg = React.useCallback((stockCodeId: string, visited: Set<string> = new Set()): number | null => {
    if (visited.has(stockCodeId)) return null; // cycle guard
    const sc = stockCodes.find(s => s.id === stockCodeId);
    if (!sc) return null;
    if (sc.item_type === 'raw_material' || sc.item_type === 'packaging') {
      return avgPriceForStockCode(stockCodeId);
    }
    // WIP or finished_good -> look up active BOM and recurse
    const bom = boms.find(b => b.finished_good_id === stockCodeId && b.status === 'active');
    if (!bom || !bom.components || bom.components.length === 0) {
      return avgPriceForStockCode(stockCodeId); // fallback to direct supplier price if any
    }
    const next = new Set(visited); next.add(stockCodeId);
    let total = 0;
    let hasAny = false;
    for (const c of bom.components) {
      const child = costPerKg(c.material_stock_code_id, next);
      if (child == null) return null;
      total += child * Number(c.quantity_per_batch);
      hasAny = true;
    }
    return hasAny ? total : null;
  }, [boms, stockCodes, avgPriceForStockCode]);
  const { logActivity } = useActivityLog();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedBOM, setSelectedBOM] = useState<typeof boms[0] | null>(null);
  const [editingOrganoleptic, setEditingOrganoleptic] = useState(false);
  const [editOrganolepticParams, setEditOrganolepticParams] = useState<OrganolepticParameter[]>([]);
  const [savingOrganoleptic, setSavingOrganoleptic] = useState(false);

  const handleSaveOrganoleptic = async () => {
    if (!selectedBOM) return;
    setSavingOrganoleptic(true);
    try {
      const paramsToSave = editOrganolepticParams.filter(p => p.expected_value.trim() !== '');
      const { error } = await supabase
        .from('fms_bom')
        .update({ organoleptic_parameters: paramsToSave as any })
        .eq('id', selectedBOM.id);
      if (error) throw error;
      toast.success('Organoleptic parameters updated');
      setEditingOrganoleptic(false);
      await refreshData();
      // Update selectedBOM locally
      setSelectedBOM(prev => prev ? { ...prev, organoleptic_parameters: paramsToSave as any } : null);
    } catch (e: any) {
      toast.error('Failed to save: ' + (e.message || 'Unknown error'));
    } finally {
      setSavingOrganoleptic(false);
    }
  };

  const finishedGoods = stockCodes.filter(sc => 
    (sc.item_type === 'finished_good' || sc.item_type === 'work_in_progress') && 
    sc.status === 'active'
  );
  const materials = stockCodes.filter(sc => 
    (sc.item_type === 'raw_material' || sc.item_type === 'packaging' || sc.item_type === 'work_in_progress') && 
    sc.status === 'active'
  );

  // Searchable options for finished goods
  const finishedGoodOptions: SearchableSelectOption[] = useMemo(() => 
    finishedGoods.map(fg => ({
      value: fg.id,
      label: fg.stock_code,
      sublabel: fg.description,
      badge: fg.item_type.replace('_', ' '),
    })),
    [finishedGoods]
  );

  const [componentSearch, setComponentSearch] = useState<Record<number, string>>({});
  const [showComponentDropdown, setShowComponentDropdown] = useState<Record<number, boolean>>({});

  const [formData, setFormData] = useState({
    finished_good_id: '',
    effective_date: new Date().toISOString().split('T')[0],
    components: [] as { material_id: string; quantity: string }[],
    processing_steps: [] as ProcessingStep[],
    organoleptic_parameters: [
      { name: 'Colour', expected_value: '' },
      { name: 'Texture', expected_value: '' },
      { name: 'Taste', expected_value: '' },
      { name: 'Smell', expected_value: '' },
    ] as OrganolepticParameter[],
  });

  const resetForm = () => {
    setFormData({
      finished_good_id: '',
      effective_date: new Date().toISOString().split('T')[0],
      components: [],
      processing_steps: [],
      organoleptic_parameters: [
        { name: 'Colour', expected_value: '' },
        { name: 'Texture', expected_value: '' },
        { name: 'Taste', expected_value: '' },
        { name: 'Smell', expected_value: '' },
      ],
    });
    setComponentSearch({});
    setShowComponentDropdown({});
  };

  const addProcessingStep = () => {
    setFormData(prev => ({
      ...prev,
      processing_steps: [...prev.processing_steps, { 
        step_order: prev.processing_steps.length + 1, 
        step_name: '', 
        description: '' 
      }],
    }));
  };

  const removeProcessingStep = (index: number) => {
    setFormData(prev => ({
      ...prev,
      processing_steps: prev.processing_steps
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, step_order: i + 1 })),
    }));
  };

  const updateProcessingStep = (index: number, field: 'step_name' | 'description', value: string) => {
    setFormData(prev => ({
      ...prev,
      processing_steps: prev.processing_steps.map((step, i) => 
        i === index ? { ...step, [field]: value } : step
      ),
    }));
  };

  const updateOrganolepticParameter = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      organoleptic_parameters: prev.organoleptic_parameters.map((param, i) => 
        i === index ? { ...param, expected_value: value } : param
      ),
    }));
  };

  const addComponent = () => {
    const newIndex = formData.components.length;
    setFormData(prev => ({
      ...prev,
      components: [...prev.components, { material_id: '', quantity: '' }],
    }));
    setComponentSearch(prev => ({ ...prev, [newIndex]: '' }));
  };

  const removeComponent = (index: number) => {
    setFormData(prev => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index),
    }));
    setComponentSearch(prev => {
      const newSearch = { ...prev };
      delete newSearch[index];
      return newSearch;
    });
    setShowComponentDropdown(prev => {
      const newDropdown = { ...prev };
      delete newDropdown[index];
      return newDropdown;
    });
  };

  const updateComponent = (index: number, field: 'material_id' | 'quantity', value: string) => {
    setFormData(prev => ({
      ...prev,
      components: prev.components.map((comp, i) => 
        i === index ? { ...comp, [field]: value } : comp
      ),
    }));
    if (field === 'material_id') {
      const material = getStockCode(value);
      if (material) {
        setComponentSearch(prev => ({ ...prev, [index]: material.stock_code }));
      }
      setShowComponentDropdown(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleComponentSearch = (index: number, searchValue: string) => {
    setComponentSearch(prev => ({ ...prev, [index]: searchValue }));
    setShowComponentDropdown(prev => ({ ...prev, [index]: searchValue.length > 0 }));
  };

  const getFilteredMaterials = (searchValue: string) => {
    if (!searchValue) return materials.slice(0, 15);
    return materials.filter(m =>
      m.stock_code.toLowerCase().includes(searchValue.toLowerCase()) ||
      m.description.toLowerCase().includes(searchValue.toLowerCase())
    ).slice(0, 15);
  };

  const getStockCode = (id: string) => stockCodes.find(sc => sc.id === id);

  const handleSubmit = async () => {
    if (!formData.finished_good_id) {
      toast.error('Please select a finished good');
      return;
    }

    if (formData.components.length === 0) {
      toast.error('Please add at least one component');
      return;
    }

    const invalidComponents = formData.components.some(
      c => !c.material_id || !c.quantity || parseFloat(c.quantity) <= 0
    );
    if (invalidComponents) {
      toast.error('Please fill in all component details');
      return;
    }

    const existingBOMs = boms.filter(b => b.finished_good_id === formData.finished_good_id);
    const newVersion = existingBOMs.length > 0 
      ? Math.max(...existingBOMs.map(b => b.version_number)) + 1 
      : 1;

    for (const bom of existingBOMs) {
      if (bom.status === 'active') {
        await updateBOM(bom.id, { status: 'obsolete', obsolete_reason: 'New version created' });
      }
    }

    const components = formData.components.map((comp) => ({
      material_stock_code_id: comp.material_id,
      quantity_per_batch: parseFloat(comp.quantity),
    }));

    // Include processing steps and organoleptic parameters in the BOM
    const bomData = {
      finished_good_id: formData.finished_good_id,
      version_number: newVersion,
      effective_date: formData.effective_date,
      status: 'active',
      created_by: user?.id || '',
      processing_steps: formData.processing_steps,
      organoleptic_parameters: formData.organoleptic_parameters.filter(p => p.expected_value.trim() !== ''),
    };

    const result = await addBOM(bomData as any, components);
    
    if (result) {
      const fg = getStockCode(formData.finished_good_id);
      logActivity({
        action_type: 'create',
        entity_type: 'bom',
        entity_id: `${fg?.stock_code || 'Unknown'} v${newVersion}`,
        entity_name: fg?.description || 'Unknown product',
        details: {
          finished_good: fg?.stock_code,
          version: newVersion,
          components_count: formData.components.length,
          total_quantity: formData.components.reduce((sum, c) => sum + parseFloat(c.quantity || '0'), 0),
          processing_steps_count: formData.processing_steps.length,
        },
      });
      toast.success('Bill of Materials created successfully');
      setDialogOpen(false);
      resetForm();
      await refreshData();
    }
  };

  const handleViewBOM = (bom: typeof boms[0]) => {
    setSelectedBOM(bom);
    setViewDialogOpen(true);
  };

  const handleCreateNewVersion = (bom: typeof boms[0]) => {
    const bomData = bom as any;
    const defaultParams: OrganolepticParameter[] = [
      { name: 'Colour', expected_value: '' },
      { name: 'Texture', expected_value: '' },
      { name: 'Taste', expected_value: '' },
      { name: 'Smell', expected_value: '' },
    ];
    const existingParams: OrganolepticParameter[] = bomData.organoleptic_parameters || [];
    const mergedParams = defaultParams.map(dp => {
      const found = existingParams.find((ep: OrganolepticParameter) => ep.name === dp.name);
      return found ? { ...dp, expected_value: found.expected_value } : dp;
    });
    const customParams = existingParams.filter((ep: OrganolepticParameter) => !defaultParams.some(dp => dp.name === ep.name));

    setFormData({
      finished_good_id: bom.finished_good_id,
      effective_date: new Date().toISOString().split('T')[0],
      components: bom.components.map(c => ({
        material_id: c.material_stock_code_id,
        quantity: c.quantity_per_batch.toString(),
      })),
      processing_steps: (bomData.processing_steps || []).map((step: any, index: number) => ({
        step_order: index + 1,
        step_name: step.step_name || '',
        description: step.description || '',
      })),
      organoleptic_parameters: [...mergedParams, ...customParams],
    });
    setDialogOpen(true);
  };

  const handleDeleteBOM = async (bomId: string) => {
    const bomToDelete = boms.find(b => b.id === bomId);
    const fg = bomToDelete ? getStockCode(bomToDelete.finished_good_id) : null;
    
    const { error: compError } = await supabase
      .from('fms_bom_components')
      .delete()
      .eq('bom_id', bomId);
    
    if (compError) {
      toast.error('Failed to delete BOM components');
      return;
    }

    const { error } = await supabase
      .from('fms_bom')
      .delete()
      .eq('id', bomId);

    if (error) {
      toast.error('Failed to delete BOM');
      return;
    }

    logActivity({
      action_type: 'delete',
      entity_type: 'bom',
      entity_id: `${fg?.stock_code || 'Unknown'} v${bomToDelete?.version_number}`,
      entity_name: fg?.description || 'Unknown product',
      details: {
        finished_good: fg?.stock_code,
        version: bomToDelete?.version_number,
        components_count: bomToDelete?.components?.length || 0,
      },
    });
    
    toast.success('BOM deleted successfully');
    await refreshData();
  };

  // HTML escape utility to prevent XSS
  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const handlePrintBOM = async (bom: typeof boms[0]) => {
    const finishedGood = getStockCode(bom.finished_good_id);
    const bomData = bom as any;
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

    const componentsHtml = bom.components.map((comp) => {
      const material = getStockCode(comp.material_stock_code_id);
      return `<tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(material?.stock_code || '')}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(material?.description || '')}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${escapeHtml(String(comp.quantity_per_batch))} ${escapeHtml(material?.unit_of_measure || '')}</td>
      </tr>`;
    }).join('');

    const stepsHtml = (bomData.processing_steps || []).map((step: any, index: number) => 
      `<tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${index + 1}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(step.step_name || '')}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(step.description || '')}</td>
      </tr>`
    ).join('');

    const organolepticHtml = (bomData.organoleptic_parameters || []).map((param: any) => 
      `<tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(param.name || '')}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(param.expected_value || '')}</td>
      </tr>`
    ).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>BOM - ${escapeHtml(finishedGood?.stock_code || 'Unknown')}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { color: #333; margin-bottom: 5px; }
          .header { border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
          .header-left { flex: 1; }
          .header-logo { width: 60px; height: 60px; object-fit: contain; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
          .info-item { padding: 8px; background: #f5f5f5; border-radius: 4px; }
          .info-label { font-size: 12px; color: #666; }
          .info-value { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
          th { background: #333; color: white; padding: 10px; text-align: left; }
          h3 { margin-top: 20px; color: #333; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <h1>Bill of Materials</h1>
            <p style="color: #666; margin: 0;">Version ${escapeHtml(String(bom.version_number))} • Effective: ${escapeHtml(formatDate(bom.effective_date))}</p>
          </div>
          <img src="${escapeHtml(printLogoUrl)}" alt="Logo" class="header-logo" onerror="this.style.display='none'" />
        </div>
        <div class="info-grid">
          <div class="info-item"><div class="info-label">Stock Code</div><div class="info-value">${escapeHtml(finishedGood?.stock_code || 'N/A')}</div></div>
          <div class="info-item"><div class="info-label">Description</div><div class="info-value">${escapeHtml(finishedGood?.description || 'N/A')}</div></div>
          <div class="info-item"><div class="info-label">Status</div><div class="info-value">${escapeHtml(bom.status)}</div></div>
          <div class="info-item"><div class="info-label">Components</div><div class="info-value">${escapeHtml(String(bom.components.length))}</div></div>
        </div>
        <h3>Components</h3>
        <table>
          <thead><tr><th>Stock Code</th><th>Description</th><th style="text-align: right;">Qty per Batch</th></tr></thead>
          <tbody>${componentsHtml}</tbody>
        </table>
        ${stepsHtml ? `
        <h3>Processing Steps</h3>
        <table>
          <thead><tr><th>Step</th><th>Name</th><th>Description</th></tr></thead>
          <tbody>${stepsHtml}</tbody>
        </table>
        ` : ''}
        ${organolepticHtml ? `
        <h3>Organoleptic Parameters</h3>
        <table>
          <thead><tr><th>Parameter</th><th>Expected Value</th></tr></thead>
          <tbody>${organolepticHtml}</tbody>
        </table>
        ` : ''}
        <br/><br/>
        <button class="no-print" onclick="window.print()">Print</button>
        <script>setTimeout(() => window.print(), 500);</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const activeBOMs = boms.filter(b => b.status === 'active');
  const obsoleteBOMs = boms.filter(b => b.status === 'obsolete');
  const [showObsolete, setShowObsolete] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  
  const displayBOMs = showObsolete ? boms : activeBOMs;
  const filteredBOMs = displayBOMs.filter(bom => {
    const finishedGood = getStockCode(bom.finished_good_id);
    return (
      finishedGood?.stock_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      finishedGood?.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const selectedFinishedGood = formData.finished_good_id 
    ? getStockCode(formData.finished_good_id) 
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading BOMs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in px-2 sm:px-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-muted-foreground text-sm sm:text-base">{boms.length} BOMs in database ({activeBOMs.length} active, {obsoleteBOMs.length} archived)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* View Mode Toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <Button 
              variant={viewMode === 'card' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('card')}
              className="rounded-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'table' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('table')}
              className="rounded-none"
            >
              <Table className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Toggle to show archived/obsolete BOMs - admin only */}
          {canDelete && obsoleteBOMs.length > 0 && (
            <Button 
              variant={showObsolete ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setShowObsolete(!showObsolete)}
            >
              {showObsolete ? 'Hide Archived' : `Show Archived (${obsoleteBOMs.length})`}
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Create BOM
              </Button>
            </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
            <DialogHeader>
              <DialogTitle>Create Bill of Materials</DialogTitle>
              <DialogDescription>Define the components, processing steps, and quality parameters for a finished product</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Finished Good *</Label>
                  <SearchableSelect
                    options={finishedGoodOptions}
                    value={formData.finished_good_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, finished_good_id: value }))}
                    placeholder="Type to search finished goods..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Effective Date *</Label>
                  <Input type="date" value={formData.effective_date} onChange={(e) => setFormData(prev => ({ ...prev, effective_date: e.target.value }))} />
                </div>
              </div>

              {selectedFinishedGood && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="font-medium">{selectedFinishedGood.description}</p>
                  <div className="mt-1 flex gap-2">
                    <Badge variant="outline">{selectedFinishedGood.unit_of_measure}</Badge>
                    {selectedFinishedGood.has_allergens && <Badge variant="destructive">Contains Allergens</Badge>}
                  </div>
                </div>
              )}

              {/* Components Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Components</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addComponent}>
                    <Plus className="mr-1 h-4 w-4" />Add Component
                  </Button>
                </div>

                {formData.components.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center">
                    <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No components added yet</p>
                    <Button type="button" variant="link" onClick={addComponent}>Add your first component</Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.components.map((comp, index) => {
                      const material = comp.material_id ? getStockCode(comp.material_id) : null;
                      const filteredMats = getFilteredMaterials(componentSearch[index] || '');
                      return (
                        <div key={index} className="flex flex-col sm:flex-row items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
                          <div className="flex-1 relative w-full">
                            <Input
                              value={componentSearch[index] ?? (material ? material.stock_code : '')}
                              onChange={(e) => handleComponentSearch(index, e.target.value)}
                              onFocus={() => setShowComponentDropdown(prev => ({ ...prev, [index]: true }))}
                              onBlur={() => setTimeout(() => setShowComponentDropdown(prev => ({ ...prev, [index]: false })), 200)}
                              placeholder="Search material..."
                            />
                            {showComponentDropdown[index] && filteredMats.length > 0 && (
                              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                                {filteredMats.map((m) => (
                                  <div 
                                    key={m.id} 
                                    className="px-3 py-2 hover:bg-accent cursor-pointer text-sm" 
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => updateComponent(index, 'material_id', m.id)}
                                  >
                                    <div className="font-medium">{m.stock_code}</div>
                                    <div className="text-xs text-muted-foreground">{m.description}</div>
                                    <Badge variant="outline" className="text-xs mt-1">{m.item_type.replace('_', ' ')}</Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                            {material && (
                              <div className="text-xs text-muted-foreground mt-1">{material.description}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="w-24">
                              <Input type="number" value={comp.quantity} onChange={(e) => updateComponent(index, 'quantity', e.target.value)} placeholder="Qty" min="0" step="0.01" />
                            </div>
                            <div className="w-16 text-sm text-muted-foreground pt-2">{material?.unit_of_measure || 'UOM'}</div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeComponent(index)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {formData.components.length > 0 && (() => {
                  const total = formData.components.reduce((s, c) => s + (parseFloat(c.quantity) || 0), 0);
                  const display = total.toFixed(4).replace(/\.?0+$/, '');
                  const off = Math.abs(total - 1) > 0.0001;
                  return (
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                      <span className="font-semibold">Total Qty per Batch</span>
                      <div className="flex items-center gap-2">
                        {off && (
                          <span className="text-xs italic text-muted-foreground">suggested should equal 1</span>
                        )}
                        <span className="font-semibold">{display}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Processing Steps Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Processing Steps</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addProcessingStep}>
                    <Plus className="mr-1 h-4 w-4" />Add Step
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Define the manufacturing steps. These will be pre-populated in batch sheets.</p>

                {formData.processing_steps.length > 0 && (
                  <div className="space-y-2">
                    {formData.processing_steps.map((step, index) => (
                      <div key={index} className="flex flex-col sm:flex-row items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary shrink-0">
                          {step.step_order}
                        </div>
                        <div className="flex-1 space-y-2 w-full">
                          <Input
                            value={step.step_name}
                            onChange={(e) => updateProcessingStep(index, 'step_name', e.target.value)}
                            placeholder="Step name (e.g., Mixing, Processing, Packing)"
                          />
                          <Input
                            value={step.description}
                            onChange={(e) => updateProcessingStep(index, 'description', e.target.value)}
                            placeholder="Description (optional)"
                          />
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeProcessingStep(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Organoleptic Parameters Section */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Organoleptic Parameters</Label>
                <p className="text-sm text-muted-foreground">Define expected values for sensory quality checks (Colour, Texture, Taste, Smell). These will appear on batch sheets for pass/fail verification.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {formData.organoleptic_parameters.map((param, index) => (
                    <div key={param.name} className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                      <Label className="font-medium">{param.name}</Label>
                      <Input
                        value={param.expected_value}
                        onChange={(e) => updateOrganolepticParameter(index, e.target.value)}
                        placeholder={`Expected ${param.name.toLowerCase()} (e.g., ${
                          param.name === 'Colour' ? 'Golden brown' :
                          param.name === 'Texture' ? 'Fine powder' :
                          param.name === 'Taste' ? 'Mildly spicy' :
                          'Aromatic, no off-odours'
                        })`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>Create BOM</Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-4 rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by product code or description..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Stock Code</th>
                  <th>Description</th>
                  <th>Version</th>
                  <th>Components</th>
                  <th>Steps</th>
                  <th>Effective Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBOMs.map((bom) => {
                  const finishedGood = getStockCode(bom.finished_good_id);
                  const bomData = bom as any;
                  return (
                    <tr key={bom.id}>
                      <td className="font-medium">{finishedGood?.stock_code}</td>
                      <td className="max-w-xs truncate">{finishedGood?.description}</td>
                      <td><Badge variant="outline">v{bom.version_number}</Badge></td>
                      <td>{bom.components.length}</td>
                      <td>{bomData.processing_steps?.length || 0}</td>
                      <td>{formatDate(bom.effective_date)}</td>
                      <td>
                        <span className={bom.status === 'active' ? 'badge-active' : 'badge-inactive'}>
                          {bom.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleViewBOM(bom)} title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handlePrintBOM(bom)} title="Print">
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleCreateNewVersion(bom)} title="New Version">
                            <Copy className="h-4 w-4" />
                          </Button>
                          {canDelete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete BOM?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete this Bill of Materials. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteBOM(bom.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredBOMs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12">
                      <FileText className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                      <h3 className="text-lg font-semibold text-foreground">No Bills of Materials</h3>
                      <p className="mt-1 text-muted-foreground">Create your first BOM to define product formulations</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card View */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBOMs.map((bom) => {
            const finishedGood = getStockCode(bom.finished_good_id);
            const bomData = bom as any;
            return (
              <div key={bom.id} className="module-card">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge variant="outline" className="mb-2">Version {bom.version_number}</Badge>
                    <h3 className="font-semibold text-foreground">{finishedGood?.stock_code}</h3>
                    <p className="text-sm text-muted-foreground">{finishedGood?.description}</p>
                  </div>
                  <span className={bom.status === 'active' ? 'badge-active' : 'badge-inactive'}>{bom.status}</span>
                </div>
                
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-muted-foreground"><strong>{bom.components.length}</strong> components</p>
                  {bomData.processing_steps?.length > 0 && (
                    <p className="text-sm text-muted-foreground"><strong>{bomData.processing_steps.length}</strong> processing steps</p>
                  )}
                  <p className="text-sm text-muted-foreground">Effective: {formatDate(bom.effective_date)}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewBOM(bom)}>
                    <Eye className="mr-1 h-4 w-4" />View
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handlePrintBOM(bom)} title="Print BOM">
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleCreateNewVersion(bom)}>
                    <Copy className="mr-1 h-4 w-4" />New Version
                  </Button>
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete BOM?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this Bill of Materials. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteBOM(bom.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            );
          })}
          {filteredBOMs.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border p-12 text-center">
              <FileText className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold text-foreground">No Bills of Materials</h3>
              <p className="mt-1 text-muted-foreground">Create your first BOM to define product formulations</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={viewDialogOpen} onOpenChange={(open) => { setViewDialogOpen(open); if (!open) setEditingOrganoleptic(false); }}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Bill of Materials Details</DialogTitle></DialogHeader>
          {selectedBOM && (() => {
            const bomData = selectedBOM as any;
            const defaultParams = [
              { name: 'Colour', expected_value: '' },
              { name: 'Texture', expected_value: '' },
              { name: 'Taste', expected_value: '' },
              { name: 'Smell', expected_value: '' },
            ];
            // Merge existing params with defaults so all 4 always show
            const existingParams: OrganolepticParameter[] = bomData.organoleptic_parameters || [];
            const mergedParams = defaultParams.map(dp => {
              const found = existingParams.find((ep: OrganolepticParameter) => ep.name === dp.name);
              return found ? { ...dp, expected_value: found.expected_value } : dp;
            });
            // Also add any custom params not in defaults
            const customParams = existingParams.filter((ep: OrganolepticParameter) => !defaultParams.some(dp => dp.name === ep.name));
            const allParams = [...mergedParams, ...customParams];

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Finished Good</Label>
                    <p className="font-medium">{getStockCode(selectedBOM.finished_good_id)?.description}</p>
                    <p className="text-sm text-muted-foreground">{getStockCode(selectedBOM.finished_good_id)?.stock_code}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Version</Label>
                    <p className="font-medium">Version {selectedBOM.version_number}</p>
                    <p className="text-sm text-muted-foreground">Effective: {formatDate(selectedBOM.effective_date)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold">Components</Label>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="data-table">
                      <thead><tr><th>Material</th><th>Description</th><th className="text-right">Qty per Batch</th><th className="text-right">Price / kg</th><th className="text-right">Line Cost</th></tr></thead>
                      <tbody>
                        {selectedBOM.components.map((comp) => {
                          const material = getStockCode(comp.material_stock_code_id);
                          const price = costPerKg(comp.material_stock_code_id);
                          const lineCost = price != null ? price * Number(comp.quantity_per_batch) : null;
                          return (
                            <tr key={comp.id}>
                              <td className="font-medium">{material?.stock_code}</td>
                              <td>{material?.description}</td>
                              <td className="text-right">{comp.quantity_per_batch} {material?.unit_of_measure}</td>
                              <td className="text-right">{formatZAR(price)}</td>
                              <td className="text-right">{formatZAR(lineCost)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        {(() => {
                          const totalQty = selectedBOM.components.reduce((s, c) => s + (Number(c.quantity_per_batch) || 0), 0);
                          const totalCost = selectedBOM.components.reduce((s, c) => {
                            const p = costPerKg(c.material_stock_code_id);
                            return p != null ? s + p * Number(c.quantity_per_batch) : s;
                          }, 0);
                          const missing = selectedBOM.components.some(c => costPerKg(c.material_stock_code_id) == null);
                          return (
                            <tr className="border-t font-semibold bg-muted/30">
                              <td colSpan={2} className="text-right">Total</td>
                              <td className="text-right">{totalQty.toFixed(4).replace(/\.?0+$/, '')}</td>
                              <td className="text-right text-xs text-muted-foreground">{missing ? '(partial)' : ''}</td>
                              <td className="text-right">{formatZAR(totalCost)}</td>
                            </tr>
                          );
                        })()}
                      </tfoot>
                    </table>
                  </div>
                  {(() => {
                    const total = selectedBOM.components.reduce((s, c) => s + (Number(c.quantity_per_batch) || 0), 0);
                    const missing = selectedBOM.components.some(c => costPerKg(c.material_stock_code_id) == null);
                    return (
                      <>
                        {Math.abs(total - 1) > 0.0001 && (
                          <p className="text-xs text-muted-foreground italic">Note: suggested total should equal 1 (current: {total.toFixed(4).replace(/\.?0+$/, '')}).</p>
                        )}
                        {missing && (
                          <p className="text-xs text-amber-600 italic">Some materials have no price available — total cost is partial. Set prices under Suppliers → Materials & Pricing, or ensure WIP components have an active BOM.</p>
                        )}
                        <p className="text-xs text-muted-foreground">Price / kg for raw materials uses the supplier average; WIP components roll up from their own active BOM.</p>
                      </>
                    );
                  })()}
                </div>

                {bomData.processing_steps?.length > 0 && (
                  <div className="space-y-2">
                    <Label className="font-semibold">Processing Steps</Label>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="data-table">
                        <thead><tr><th>Step</th><th>Name</th><th>Description</th></tr></thead>
                        <tbody>
                          {bomData.processing_steps.map((step: any, index: number) => (
                            <tr key={index}>
                              <td className="font-medium">{index + 1}</td>
                              <td>{step.step_name}</td>
                              <td>{step.description || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Organoleptic Parameters</Label>
                    {!editingOrganoleptic ? (
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditOrganolepticParams(allParams);
                        setEditingOrganoleptic(true);
                      }}>
                        Edit Parameters
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingOrganoleptic(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSaveOrganoleptic} disabled={savingOrganoleptic}>
                          {savingOrganoleptic ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                          Save
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {editingOrganoleptic ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {editOrganolepticParams.map((param, index) => (
                        <div key={param.name} className="space-y-1 rounded-lg border border-border bg-muted/30 p-3">
                          <Label className="font-medium text-sm">{param.name}</Label>
                          <Input
                            value={param.expected_value}
                            onChange={(e) => {
                              setEditOrganolepticParams(prev => prev.map((p, i) => 
                                i === index ? { ...p, expected_value: e.target.value } : p
                              ));
                            }}
                            placeholder={`Expected ${param.name.toLowerCase()}`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="data-table">
                        <thead><tr><th>Parameter</th><th>Expected Value</th></tr></thead>
                        <tbody>
                          {allParams.map((param, index) => (
                            <tr key={index}>
                              <td className="font-medium">{param.name}</td>
                              <td>{param.expected_value || <span className="text-muted-foreground italic">Not set</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BillOfMaterials;