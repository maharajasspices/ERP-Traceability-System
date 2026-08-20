import React, { useState, useMemo, useEffect } from 'react';
import { useFMSData } from '@/hooks/useFMSData';
import { useDeletePermission } from '@/hooks/useDeletePermission';
import { useSupplierPrices, formatZAR } from '@/hooks/useSupplierPrices';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Users, Edit, Loader2, Trash2, Wallet } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';

const Suppliers: React.FC = () => {
  const { suppliers, stockCodes, loading, addSupplier, updateSupplier, refreshData } = useFMSData();
  const { canDelete } = useDeletePermission();
  const { prices, refresh: refreshPrices, pricesForSupplier } = useSupplierPrices();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<typeof suppliers[0] | null>(null);

  // Pricing dialog state
  const [pricingSupplier, setPricingSupplier] = useState<typeof suppliers[0] | null>(null);
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [savingPrices, setSavingPrices] = useState(false);
  const [addMaterialId, setAddMaterialId] = useState<string>('');

  const [formData, setFormData] = useState({
    code: '', name: '', contact_name: '', email: '', phone: '', address: '', is_approved: true,
  });

  const resetForm = () => {
    setFormData({ code: '', name: '', contact_name: '', email: '', phone: '', address: '', is_approved: true });
    setEditingSupplier(null);
  };

  const handleOpenDialog = (supplier?: typeof suppliers[0]) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        code: supplier.code, name: supplier.name, contact_name: supplier.contact_name || '',
        email: supplier.email || '', phone: supplier.phone || '', address: supplier.address || '',
        is_approved: supplier.is_approved ?? true,
      });
    } else { resetForm(); }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.code || !formData.name) { toast.error('Code and name are required'); return; }
    let result;
    if (editingSupplier) {
      result = await updateSupplier(editingSupplier.id, formData);
    } else {
      result = await addSupplier(formData);
    }
    if (!result) return; // Error already toasted inside addSupplier/updateSupplier
    setDialogOpen(false);
    resetForm();
  };

  const handleDeleteSupplier = async (id: string) => {
    const { error } = await supabase.from('fms_suppliers').delete().eq('id', id);
    if (error) { toast.error('Failed to delete supplier'); return; }
    toast.success('Supplier deleted successfully');
    await refreshData();
  };

  // ----- Pricing dialog logic -----
  const rawMaterials = useMemo(
    () => stockCodes.filter(s => (s.item_type === 'raw_material' || s.item_type === 'packaging') && s.status === 'active'),
    [stockCodes]
  );

  const openPricingDialog = (supplier: typeof suppliers[0]) => {
    setPricingSupplier(supplier);
    const supPrices = pricesForSupplier(supplier.id);
    const edits: Record<string, string> = {};
    supPrices.forEach(p => { edits[p.stock_code_id] = String(p.cost_price_per_kg); });
    setPriceEdits(edits);
    setAddMaterialId('');
  };

  const handleAddMaterial = () => {
    if (!addMaterialId) return;
    if (priceEdits[addMaterialId] !== undefined) {
      toast.info('Already in the list — edit the price below.');
      return;
    }
    setPriceEdits(prev => ({ ...prev, [addMaterialId]: '' }));
    setAddMaterialId('');
  };

  const handleRemovePrice = async (stockCodeId: string) => {
    if (!pricingSupplier) return;
    // Remove from local edits
    setPriceEdits(prev => {
      const next = { ...prev };
      delete next[stockCodeId];
      return next;
    });
    // Delete from DB if exists
    await supabase.from('fms_supplier_material_prices' as any)
      .delete()
      .eq('supplier_id', pricingSupplier.id)
      .eq('stock_code_id', stockCodeId);
    await refreshPrices();
  };

  const handleSavePrices = async () => {
    if (!pricingSupplier) return;
    setSavingPrices(true);
    try {
      const rows = Object.entries(priceEdits)
        .filter(([_, v]) => v !== '' && !isNaN(parseFloat(v)))
        .map(([stock_code_id, v]) => ({
          supplier_id: pricingSupplier.id,
          stock_code_id,
          cost_price_per_kg: parseFloat(v),
        }));

      if (rows.length === 0) {
        toast.info('Nothing to save');
        setSavingPrices(false);
        return;
      }

      const { error } = await supabase
        .from('fms_supplier_material_prices' as any)
        .upsert(rows, { onConflict: 'supplier_id,stock_code_id' });
      if (error) throw error;
      toast.success('Material prices saved');
      await refreshPrices();
      setPricingSupplier(null);
    } catch (e: any) {
      toast.error('Failed to save prices: ' + (e?.message || 'Unknown error'));
    } finally {
      setSavingPrices(false);
    }
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading suppliers...</span>
      </div>
    );
  }

  const stockById = (id: string) => stockCodes.find(s => s.id === id);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">{suppliers.length} suppliers in database</p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" />Add Supplier</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingSupplier ? 'Edit' : 'Add'} Supplier</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Code *</Label><Input value={formData.code} onChange={e => setFormData(p => ({ ...p, code: e.target.value.toUpperCase() }))} disabled={!!editingSupplier} /></div>
                <div className="space-y-2"><Label>Name *</Label><Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>Contact</Label><Input value={formData.contact_name} onChange={e => setFormData(p => ({ ...p, contact_name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>Address</Label><Input value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Approved Supplier</Label>
                <Switch checked={formData.is_approved} onCheckedChange={c => setFormData(p => ({ ...p, is_approved: c }))} />
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={handleSubmit}>{editingSupplier ? 'Update' : 'Create'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 rounded-xl border bg-card p-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search suppliers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" /></div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="data-table">
          <thead><tr><th>Code</th><th>Name</th><th>Contact</th><th>Email</th><th>Materials Priced</th><th>Status</th><th className="w-[140px]">Actions</th></tr></thead>
          <tbody>
            {filtered.map(s => {
              const supPriceCount = pricesForSupplier(s.id).length;
              return (
                <tr key={s.id}>
                  <td className="font-medium">{s.code}</td><td>{s.name}</td><td>{s.contact_name}</td><td>{s.email}</td>
                  <td>
                    <span className="text-xs text-muted-foreground">{supPriceCount} material{supPriceCount === 1 ? '' : 's'}</span>
                  </td>
                  <td><span className={s.is_approved ? 'badge-active' : 'badge-inactive'}>{s.is_approved ? 'Approved' : 'Pending'}</span></td>
                  <td className="flex flex-wrap gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openPricingDialog(s)} title="Materials & Pricing">
                      <Wallet className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(s)} title="Edit"><Edit className="h-4 w-4" /></Button>
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Supplier?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete {s.name}. This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteSupplier(s.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground"><Users className="mx-auto mb-2 h-8 w-8 opacity-50" /><p>No suppliers found</p></td></tr>}
          </tbody>
        </table>
      </div>

      {/* Pricing dialog */}
      <Dialog open={!!pricingSupplier} onOpenChange={(o) => !o && setPricingSupplier(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Materials & Pricing — {pricingSupplier?.name}</DialogTitle>
            <DialogDescription>
              Manually set the cost price per kg for each raw material supplied. This price is used in BOM cost calculations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Add material row */}
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Add Material</Label>
                <SearchableSelect
                  value={addMaterialId}
                  onValueChange={setAddMaterialId}
                  placeholder="Search by code or description…"
                  options={rawMaterials
                    .filter(rm => priceEdits[rm.id] === undefined)
                    .map(rm => ({
                      value: rm.id,
                      label: rm.stock_code,
                      sublabel: rm.description,
                    }))}
                />
              </div>
              <Button onClick={handleAddMaterial} disabled={!addMaterialId}>
                <Plus className="h-4 w-4 mr-1" />Add
              </Button>
            </div>

            {/* Existing prices */}
            <div className="rounded-lg border overflow-hidden">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Stock Code</th><th>Description</th>
                    <th className="text-right w-[160px]">Cost / kg (ZAR)</th>
                    <th className="w-[60px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(priceEdits).length === 0 && (
                    <tr><td colSpan={4} className="py-6 text-center text-muted-foreground text-sm">No materials priced yet.</td></tr>
                  )}
                  {Object.keys(priceEdits).map(scId => {
                    const sc = stockById(scId);
                    return (
                      <tr key={scId}>
                        <td className="font-medium">{sc?.stock_code || '—'}</td>
                        <td className="text-sm">{sc?.description || '—'}</td>
                        <td className="text-right">
                          <Input
                            type="number"
                            step="0.0001"
                            min="0"
                            value={priceEdits[scId]}
                            onChange={(e) => setPriceEdits(prev => ({ ...prev, [scId]: e.target.value }))}
                            className="text-right h-8"
                            placeholder="0.00"
                          />
                        </td>
                        <td>
                          <Button variant="ghost" size="icon" onClick={() => handleRemovePrice(scId)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPricingSupplier(null)}>Close</Button>
            <Button onClick={handleSavePrices} disabled={savingPrices}>
              {savingPrices ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save Prices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Suppliers;
