import React, { useState } from 'react';
import { useFMSData } from '@/hooks/useFMSData';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useDeletePermission } from '@/hooks/useDeletePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Package, Edit, Filter, Loader2, Trash2, DollarSign, Download } from 'lucide-react';
import { useSupplierPrices, formatZAR } from '@/hooks/useSupplierPrices';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type ItemType = 'raw_material' | 'packaging' | 'work_in_progress' | 'finished_good';
type StorageCondition = 'ambient' | 'chilled' | 'frozen';
type UnitOfMeasure = 'kg' | 'g' | 'litres' | 'ml' | 'units' | 'each';
type StockStatus = 'active' | 'inactive';
type AllergenType = 'celery' | 'gluten' | 'crustaceans' | 'eggs' | 'fish' | 'lupin' | 'milk' | 'molluscs' | 'mustard' | 'nuts' | 'peanuts' | 'sesame' | 'soybeans' | 'sulphites';

const itemTypes: { value: ItemType; label: string }[] = [
  { value: 'raw_material', label: 'Raw Material' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'work_in_progress', label: 'Work in Progress' },
  { value: 'finished_good', label: 'Finished Good' },
];

const storageConditions: { value: StorageCondition; label: string }[] = [
  { value: 'ambient', label: 'Ambient' },
  { value: 'chilled', label: 'Chilled' },
  { value: 'frozen', label: 'Frozen' },
];

const unitsOfMeasure: { value: UnitOfMeasure; label: string }[] = [
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'g', label: 'Grams (g)' },
  { value: 'litres', label: 'Litres' },
  { value: 'ml', label: 'Millilitres (ml)' },
  { value: 'units', label: 'Units' },
  { value: 'each', label: 'Each' },
];

const allergenTypes: { value: AllergenType; label: string }[] = [
  { value: 'celery', label: 'Celery' },
  { value: 'gluten', label: 'Gluten/Wheat' },
  { value: 'crustaceans', label: 'Crustaceans/Shellfish' },
  { value: 'eggs', label: 'Eggs' },
  { value: 'fish', label: 'Fish' },
  { value: 'lupin', label: 'Lupin' },
  { value: 'milk', label: 'Milk/Dairy' },
  { value: 'molluscs', label: 'Molluscs' },
  { value: 'mustard', label: 'Mustard' },
  { value: 'nuts', label: 'Tree Nuts' },
  { value: 'peanuts', label: 'Peanuts/Groundnuts' },
  { value: 'sesame', label: 'Sesame' },
  { value: 'soybeans', label: 'Soy/Soybeans' },
  { value: 'sulphites', label: 'Sulphites/SO2' },
];

const StockCodes: React.FC = () => {
  const { stockCodes, suppliers, loading, addStockCode, updateStockCode, refreshData, getSupplierById, stockLevels } = useFMSData();
  const { canDelete } = useDeletePermission();
  const { logActivity } = useActivityLog();
  const { pricesForSupplier, prices: allPrices } = useSupplierPrices();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<ItemType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<StockStatus | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<typeof stockCodes[0] | null>(null);
  const [pricingItem, setPricingItem] = useState<typeof stockCodes[0] | null>(null);

  const [formData, setFormData] = useState({
    stock_code: '',
    description: '',
    item_type: 'raw_material' as ItemType,
    unit_of_measure: 'kg' as UnitOfMeasure,
    storage_condition: 'ambient' as StorageCondition,
    has_allergens: false,
    allergen_types: [] as AllergenType[],
    approved_supplier_ids: [] as string[],
    status: 'active' as StockStatus,
    low_stock_threshold: '0',
  });

  const resetForm = () => {
    setFormData({
      stock_code: '',
      description: '',
      item_type: 'raw_material',
      unit_of_measure: 'kg',
      storage_condition: 'ambient',
      has_allergens: false,
      allergen_types: [],
      approved_supplier_ids: [],
      status: 'active',
      low_stock_threshold: '0',
    });
    setEditingItem(null);
  };

  const handleOpenDialog = (item?: typeof stockCodes[0]) => {
    if (item) {
      setEditingItem(item);
      const level = stockLevels.find(sl => sl.stock_code_id === item.id);
      setFormData({
        stock_code: item.stock_code,
        description: item.description,
        item_type: item.item_type as ItemType,
        unit_of_measure: item.unit_of_measure as UnitOfMeasure,
        storage_condition: item.storage_condition as StorageCondition,
        has_allergens: item.has_allergens || false,
        allergen_types: (item.allergen_types || []) as AllergenType[],
        approved_supplier_ids: item.approved_supplier_ids || [],
        status: item.status as StockStatus,
        low_stock_threshold: level ? String(level.low_stock_threshold) : '0',
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.stock_code || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Save low stock threshold to stock levels table
    const threshold = parseFloat(formData.low_stock_threshold) || 0;
    if (editingItem) {
      // Upsert the stock level threshold
      const { error: levelError } = await (supabase.from('fms_stock_levels' as any) as any)
        .upsert({
          stock_code_id: editingItem.id,
          low_stock_threshold: threshold,
        }, { onConflict: 'stock_code_id' });
      if (levelError) {
        console.error('[FMS] Failed to save low stock threshold:', levelError);
      }

      const { stock_code, description, item_type, unit_of_measure, storage_condition, has_allergens, allergen_types, approved_supplier_ids, status } = formData;
      await updateStockCode(editingItem.id, { stock_code, description, item_type, unit_of_measure, storage_condition, has_allergens, allergen_types, approved_supplier_ids, status });
      logActivity({
        action_type: 'update',
        entity_type: 'stock_code',
        entity_id: formData.stock_code,
        entity_name: formData.description,
        details: {
          stock_code: formData.stock_code,
          item_type: formData.item_type.replace('_', ' '),
          status: formData.status,
          has_allergens: formData.has_allergens,
          allergens: formData.allergen_types.length > 0 ? formData.allergen_types.join(', ') : undefined,
        },
      });
      toast.success('Stock code updated successfully');
    } else {
      if (stockCodes.some(sc => sc.stock_code === formData.stock_code)) {
        toast.error('Stock code already exists');
        return;
      }
      const { stock_code, description, item_type, unit_of_measure, storage_condition, has_allergens, allergen_types, approved_supplier_ids, status } = formData;
      const newStockCode = await addStockCode({ stock_code, description, item_type, unit_of_measure, storage_condition, has_allergens, allergen_types, approved_supplier_ids, status });
      
      // Create stock level record with threshold for new stock code
      if (newStockCode) {
        const { error: levelError } = await (supabase.from('fms_stock_levels' as any) as any)
          .upsert({
            stock_code_id: newStockCode.id,
            low_stock_threshold: threshold,
            quantity_on_hand: 0,
          }, { onConflict: 'stock_code_id' });
        if (levelError) {
          console.error('[FMS] Failed to create stock level:', levelError);
        }
      }
      logActivity({
        action_type: 'create',
        entity_type: 'stock_code',
        entity_id: formData.stock_code,
        entity_name: formData.description,
        details: {
          stock_code: formData.stock_code,
          item_type: formData.item_type.replace('_', ' '),
          status: formData.status,
          has_allergens: formData.has_allergens,
          allergens: formData.allergen_types.length > 0 ? formData.allergen_types.join(', ') : undefined,
        },
      });
      toast.success('Stock code created successfully');
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleDeleteStockCode = async (id: string) => {
    const stockCode = stockCodes.find(sc => sc.id === id);
    const { error } = await supabase.from('fms_stock_codes').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete stock code');
      return;
    }
    logActivity({
      action_type: 'delete',
      entity_type: 'stock_code',
      entity_id: stockCode?.stock_code || id,
      entity_name: stockCode?.description || 'Unknown',
      details: {
        stock_code: stockCode?.stock_code,
        item_type: stockCode?.item_type?.replace('_', ' '),
        description: stockCode?.description,
      },
    });
    toast.success('Stock code deleted successfully');
    await refreshData();
  };

  const handleAllergenToggle = (allergen: AllergenType) => {
    setFormData(prev => ({
      ...prev,
      allergen_types: prev.allergen_types.includes(allergen)
        ? prev.allergen_types.filter(a => a !== allergen)
        : [...prev.allergen_types, allergen],
    }));
  };

  const handleSupplierToggle = (supplierId: string) => {
    setFormData(prev => ({
      ...prev,
      approved_supplier_ids: prev.approved_supplier_ids.includes(supplierId)
        ? prev.approved_supplier_ids.filter(id => id !== supplierId)
        : [...prev.approved_supplier_ids, supplierId],
    }));
  };

  const filteredStockCodes = stockCodes.filter(sc => {
    const matchesSearch = sc.stock_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sc.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || sc.item_type === filterType;
    const matchesStatus = filterStatus === 'all' || sc.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading stock codes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-muted-foreground">
            {stockCodes.length.toLocaleString()} stock codes in database
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                const rows = filteredStockCodes.map(sc => ({
                  'Stock Code': sc.stock_code,
                  Description: sc.description,
                  Type: sc.item_type.replace('_', ' '),
                  UOM: sc.unit_of_measure,
                  Storage: sc.storage_condition,
                  Allergens: sc.has_allergens ? (sc.allergen_types || []).join(', ') : 'None',
                  Status: sc.status,
                }));
                exportToExcel(rows, 'stock_codes');
              }}>Export to Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const rows = filteredStockCodes.map(sc => ({
                  'Stock Code': sc.stock_code,
                  Description: sc.description,
                  Type: sc.item_type.replace('_', ' '),
                  UOM: sc.unit_of_measure,
                  Status: sc.status,
                }));
                exportToPDF(rows, 'stock_codes');
              }}>Export to PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Stock Code
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Stock Code' : 'Add New Stock Code'}</DialogTitle>
              <DialogDescription>
                {editingItem ? 'Update the stock code details below' : 'Create a new stock code for materials, packaging, or finished goods'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock_code">Stock Code *</Label>
                  <Input
                    id="stock_code"
                    value={formData.stock_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock_code: e.target.value.toUpperCase() }))}
                    placeholder="e.g., RM-FLOUR-001"
                    disabled={!!editingItem}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item_type">Item Type *</Label>
                  <Select value={formData.item_type} onValueChange={(value: ItemType) => setFormData(prev => ({ ...prev, item_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {itemTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g., All Purpose Flour"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit_of_measure">Unit of Measure *</Label>
                  <Select value={formData.unit_of_measure} onValueChange={(value: UnitOfMeasure) => setFormData(prev => ({ ...prev, unit_of_measure: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unitsOfMeasure.map(unit => (
                        <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storage_condition">Storage Condition *</Label>
                  <Select value={formData.storage_condition} onValueChange={(value: StorageCondition) => setFormData(prev => ({ ...prev, storage_condition: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {storageConditions.map(cond => (
                        <SelectItem key={cond.value} value={cond.value}>{cond.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Allergens */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Contains Allergens</Label>
                  <Switch
                    checked={formData.has_allergens}
                    onCheckedChange={(checked) => setFormData(prev => ({ 
                      ...prev, 
                      has_allergens: checked,
                      allergen_types: checked ? prev.allergen_types : []
                    }))}
                  />
                </div>
                {formData.has_allergens && (
                  <div className="grid grid-cols-3 gap-2 rounded-lg border border-border p-3">
                    {allergenTypes.map(allergen => (
                      <div key={allergen.value} className="flex items-center gap-2">
                        <Checkbox
                          id={allergen.value}
                          checked={formData.allergen_types.includes(allergen.value)}
                          onCheckedChange={() => handleAllergenToggle(allergen.value)}
                        />
                        <Label htmlFor={allergen.value} className="text-sm font-normal cursor-pointer">
                          {allergen.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Approved Suppliers */}
              {formData.item_type !== 'finished_good' && formData.item_type !== 'work_in_progress' && suppliers.length > 0 && (
                <div className="space-y-3">
                  <Label>Approved Suppliers</Label>
                  <div className="grid gap-2 rounded-lg border border-border p-3 max-h-40 overflow-y-auto">
                    {suppliers.filter(s => s.is_approved).map(supplier => (
                      <div key={supplier.id} className="flex items-center gap-2">
                        <Checkbox
                          id={supplier.id}
                          checked={formData.approved_supplier_ids.includes(supplier.id)}
                          onCheckedChange={() => handleSupplierToggle(supplier.id)}
                        />
                        <Label htmlFor={supplier.id} className="text-sm font-normal cursor-pointer">
                          {supplier.name} ({supplier.code})
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Low Stock Threshold */}
              <div className="space-y-2">
                <Label htmlFor="low_stock_threshold">Low Stock Threshold</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="low_stock_threshold"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.low_stock_threshold}
                    onChange={(e) => setFormData(prev => ({ ...prev, low_stock_threshold: e.target.value }))}
                    placeholder="e.g., 10"
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">{formData.unit_of_measure}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  When stock on hand drops to or below this level, a low stock warning will be shown.
                </p>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label>Active Status</Label>
                  <p className="text-sm text-muted-foreground">Inactive items cannot be received or used</p>
                </div>
                <Switch
                  checked={formData.status === 'active'}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, status: checked ? 'active' : 'inactive' }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>{editingItem ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search stock codes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={(value) => setFilterType(value as ItemType | 'all')}>
            <SelectTrigger className="w-[160px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {itemTypes.map(type => (
                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as StockStatus | 'all')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredStockCodes.length.toLocaleString()} of {stockCodes.length.toLocaleString()} stock codes
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="data-table">
            <thead className="sticky top-0 bg-card z-10">
              <tr>
                <th>Stock Code</th>
                <th>Description</th>
                <th>Type</th>
                <th>UOM</th>
                <th>Storage</th>
                <th>Allergens</th>
                <th>Low Stock</th>
                <th>Status</th>
                <th className="w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStockCodes.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium">{item.stock_code}</td>
                  <td>{item.description}</td>
                  <td>
                    <Badge variant="outline" className="capitalize">
                      {item.item_type.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td>{item.unit_of_measure}</td>
                  <td className="capitalize">{item.storage_condition}</td>
                  <td>
                    {item.has_allergens && item.allergen_types && item.allergen_types.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.allergen_types.slice(0, 2).map((a, idx) => (
                          <Badge key={`${item.id}-${a}-${idx}`} variant="destructive" className="text-xs capitalize">
                            {a}
                          </Badge>
                        ))}
                        {item.allergen_types.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{item.allergen_types.length - 2}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </td>
                  <td>
                    {(() => {
                      const level = stockLevels.find(sl => sl.stock_code_id === item.id);
                      const qty = level?.quantity_on_hand ?? 0;
                      const threshold = level?.low_stock_threshold ?? 0;
                      const isLow = qty < 0 || qty <= threshold;
                      return (
                        <div className="text-xs">
                          <span className={isLow ? 'text-warning font-semibold' : 'text-muted-foreground'}>
                            {qty.toFixed(2)} {item.unit_of_measure}
                          </span>
                          <span className="text-muted-foreground block">Threshold: {threshold}</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td>
                    <span className={item.status === 'active' ? 'badge-active' : 'badge-inactive'}>
                      {item.status}
                    </span>
                  </td>
                  <td className="flex gap-1">
                    {(item.item_type === 'raw_material' || item.item_type === 'packaging') && (
                      <Button variant="ghost" size="icon" onClick={() => setPricingItem(item)} title="Supplier pricing">
                        <DollarSign className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(item)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Stock Code?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete {item.stock_code}. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteStockCode(item.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </td>
                </tr>
              ))}
                  {filteredStockCodes.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p>No stock codes found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Pricing Dialog (read-only) */}
      <Dialog open={!!pricingItem} onOpenChange={(o) => !o && setPricingItem(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Supplier Pricing — {pricingItem?.stock_code}</DialogTitle>
            <DialogDescription>{pricingItem?.description}</DialogDescription>
          </DialogHeader>
          {pricingItem && (() => {
            const rows = allPrices.filter(p => p.stock_code_id === pricingItem.id);
            const approved = (pricingItem.approved_supplier_ids || []).map(getSupplierById).filter(Boolean);
            const avg = rows.length ? rows.reduce((s, r) => s + Number(r.cost_price_per_kg), 0) / rows.length : null;
            return (
              <div className="space-y-3">
                <div className="rounded-lg border border-border p-3 text-sm">
                  <span className="text-muted-foreground">Average price / kg: </span>
                  <span className="font-semibold">{formatZAR(avg)}</span>
                </div>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="data-table">
                    <thead><tr><th>Supplier</th><th>Price / kg</th><th>Updated</th></tr></thead>
                    <tbody>
                      {approved.map(sup => {
                        const row = rows.find(r => r.supplier_id === sup!.id);
                        return (
                          <tr key={sup!.id}>
                            <td>{sup!.name}</td>
                            <td>{row ? formatZAR(Number(row.cost_price_per_kg)) : <span className="text-muted-foreground">Not set</span>}</td>
                            <td className="text-xs text-muted-foreground">{row ? new Date(row.updated_at).toLocaleDateString('en-GB') : '—'}</td>
                          </tr>
                        );
                      })}
                      {approved.length === 0 && (
                        <tr><td colSpan={3} className="py-4 text-center text-muted-foreground text-sm">No approved suppliers linked. Set them in the stock code editor.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">Edit prices in Suppliers → Materials &amp; Pricing.</p>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockCodes;
