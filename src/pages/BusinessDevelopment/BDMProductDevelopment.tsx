
import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Calculator,
  Package,
  Beaker,
  RefreshCw,
  Search,
  ArrowLeft,
  FileSpreadsheet,
  Layers,
  Loader2,
  Edit,
  PlusCircle,
  CalenderDays,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

type Ingredient = {
  id: string;
  stock_code_id: string | null;
  ingredient_name: string;
  unit: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  source: 'stock' | 'manual';
};

type StockItem = {
  id: string;
  stock_code: string;
  description: string;
  unit_of_measure: string;
  latest_cost: number;
};

type Development = {
  id: string;
  product_name: string;
  product_code: string | null;
  product_category: string | null;
  description: string | null;
  recipe_data: Ingredient[];
  costing_data: Record<string, any>;
  status: string;
  version: number;
  is_current: boolean;
};

const CURRENCY = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
});

const createIngredient = (): Ingredient => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  stock_code_id: null,
  ingredient_name: '',
  unit: 'kg',
  quantity: 0,
  unit_cost: 0,
  total_cost: 0,
  source: 'manual',
});

const BDMProductDevelopment = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stockSearch, setStockSearch] = useState('');

  const [productName, setProductName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [description, setDescription] = useState('');

  const [productionMode, setProductionMode] = useState<'batch' | 'packets'>('batch');
  const [batchSize, setBatchSize] = useState(100);
  const [packetSize, setPacketSize] = useState(200);
  const [packetQuantity, setPacketQuantity] = useState(500);

  const [ingredients, setIngredients] = useState<Ingredient[]>([
    createIngredient(),
  ]);

  const [packagingCost, setPackagingCost] = useState(0);
  const [labourCost, setLabourCost] = useState(0);
  const [overheadCost, setOverheadCost] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);

  const [status, setStatus] = useState('draft');

  const isAdmin = true; // Actual permission is enforced by Supabase RLS.

  const productionKg = useMemo(() => {
    if (productionMode === 'batch') {
      return Math.max(0, batchSize);
    }

    return Math.max(0, (packetSize * packetQuantity) / 1000);
  }, [productionMode, batchSize, packetSize, packetQuantity]);

  const ingredientTotal = useMemo(
    () =>
      ingredients.reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_cost || 0),
        0
      ),
    [ingredients]
  );

  const totalCost = ingredientTotal + packagingCost + labourCost + overheadCost;

  const costPerKg = productionKg > 0 ? totalCost / productionKg : 0;

  const costPerPacket =
    productionMode === 'packets' && packetQuantity > 0
      ? totalCost / packetQuantity
      : productionMode === 'batch' && packetSize > 0
        ? (totalCost / productionKg) * (packetSize / 1000)
        : 0;

  const profit = sellingPrice > 0 ? sellingPrice - costPerPacket : 0;

  const profitMargin =
    sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

  useEffect(() => {
    loadStockItems();
    loadDevelopments();
  }, []);

  const loadStockItems = async () => {
    try {
      const { data: codes, error } = await supabase
        .from('fms_stock_codes')
        .select('id, stock_code, description, unit_of_measure')
        .eq('status', 'active')
        .order('description');

      if (error) throw error;

      const { data: receiving, error: receivingError } = await supabase
        .from('fms_receiving')
        .select('stock_code_id, cost_price_per_kg, status, received_at')
        .not('cost_price_per_kg', 'is', null)
        .order('received_at', { ascending: false });

      if (receivingError) throw receivingError;

      const latestCosts = new Map<string, number>();

      (receiving || []).forEach((record: any) => {
        if (
          record.stock_code_id &&
          record.cost_price_per_kg !== null &&
          !latestCosts.has(record.stock_code_id)
        ) {
          latestCosts.set(
            record.stock_code_id,
            Number(record.cost_price_per_kg)
          );
        }
      });

      setStockItems(
        (codes || []).map((item: any) => ({
          id: item.id,
          stock_code: item.stock_code,
          description: item.description,
          unit_of_measure: item.unit_of_measure || 'kg',
          latest_cost: latestCosts.get(item.id) || 0,
        }))
      );
    } catch (error: any) {
      console.error('Stock loading error:', error);
      toast.error('Could not load ERP ingredients.');
    }
  };

  const loadDevelopments = async () => {
    try {
      const { data, error } = await supabase
        .from('fms_bdm_developments')
        .select('*')
        .eq('record_type', 'master')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setDevelopments((data || []) as Development[]);
    } catch (error: any) {
      console.error(error);
      toast.error('Could not load saved developments.');
    }
  };

  const updateIngredient = (
    id: string,
    field: keyof Ingredient,
    value: string | number | null
  ) => {
    setIngredients((previous) =>
      previous.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        updated.total_cost =
          Number(updated.quantity || 0) * Number(updated.unit_cost || 0);

        return updated;
      })
    );
  };

  const addIngredient = () => {
    setIngredients((previous) => [...previous, createIngredient()]);
  };

  const removeIngredient = (id: string) => {
    setIngredients((previous) =>
      previous.filter((item) => item.id !== id)
    );
  };

  const selectStockIngredient = (
    ingredientId: string,
    stockId: string
  ) => {
    const stock = stockItems.find((item) => item.id === stockId);
    if (!stock) return;

    setIngredients((previous) =>
      previous.map((item) => {
        if (item.id !== ingredientId) return item;

        return {
          ...item,
          stock_code_id: stock.id,
          ingredient_name: stock.description,
          unit: stock.unit_of_measure,
          unit_cost: stock.latest_cost,
          source: 'stock',
          total_cost: Number(item.quantity || 0) * stock.latest_cost,
        };
      })
    );
  };

  const resetForm = () => {
    setSelectedId(null);
    setProductName('');
    setProductCode('');
    setProductCategory('');
    setDescription('');
    setIngredients([createIngredient()]);
    setBatchSize(100);
    setPacketSize(200);
    setPacketQuantity(500);
    setPackagingCost(0);
    setLabourCost(0);
    setOverheadCost(0);
    setSellingPrice(0);
    setProductionMode('batch');
    setStatus('draft');
  };

  const saveDevelopment = async () => {
    if (!productName.trim()) {
      toast.error('Please enter a product name.');
      return;
    }

    if (ingredients.some((item) => !item.ingredient_name.trim())) {
      toast.error('Please complete or remove empty ingredient rows.');
      return;
    }

    if (productionKg <= 0) {
      toast.error('Please enter a valid production quantity.');
      return;
    }

    try {
      setSaving(true);

      const recipe = ingredients.map((item) => ({
        ...item,
        quantity: Number(item.quantity || 0),
        unit_cost: Number(item.unit_cost || 0),
        total_cost:
          Number(item.quantity || 0) * Number(item.unit_cost || 0),
      }));

      const costing = {
        production_mode: productionMode,
        batch_size_kg: productionMode === 'batch' ? batchSize : productionKg,
        packet_size_g: packetSize,
        packet_quantity: packetQuantity,
        production_quantity_kg: productionKg,
        ingredient_total: ingredientTotal,
        packaging_cost: packagingCost,
        labour_cost: labourCost,
        overhead_cost: overheadCost,
        total_cost: totalCost,
        cost_per_kg: costPerKg,
        cost_per_packet: costPerPacket,
        selling_price: sellingPrice,
        profit_per_packet: profit,
        profit_margin: profitMargin,
      };

      const payload = {
        product_name: productName.trim(),
        product_code: productCode.trim() || null,
        product_category: productCategory.trim() || null,
        description: description.trim() || null,
        recipe_data: recipe,
        costing_data: costing,
        status,
        updated_at: new Date().toISOString(),
      };

      if (selectedId) {
        const { error } = await supabase
          .from('fms_bdm_developments')
          .update(payload)
          .eq('id', selectedId);

        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();

        const { data, error } = await supabase
          .from('fms_bdm_developments')
          .insert({
            ...payload,
            record_type: 'master',
            version: 1,
            is_current: true,
            created_by: userData.user?.id || null,
          })
          .select()
          .single();

        if (error) throw error;
        setSelectedId(data.id);
      }

      toast.success('Product development saved successfully!');
      await loadDevelopments();
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(error.message || 'Could not save development.');
    } finally {
      setSaving(false);
    }
  };

  const openDevelopment = (development: Development) => {
    setSelectedId(development.id);
    setProductName(development.product_name || '');
    setProductCode(development.product_code || '');
    setProductCategory(development.product_category || '');
    setDescription(development.description || '');
    setIngredients(
      development.recipe_data?.length
        ? development.recipe_data
        : [createIngredient()]
    );

    const costing = development.costing_data || {};

    setProductionMode(costing.production_mode || 'batch');
    setBatchSize(Number(costing.batch_size_kg || 100));
    setPacketSize(Number(costing.packet_size_g || 200));
    setPacketQuantity(Number(costing.packet_quantity || 500));
    setPackagingCost(Number(costing.packaging_cost || 0));
    setLabourCost(Number(costing.labour_cost || 0));
    setOverheadCost(Number(costing.overhead_cost || 0));
    setSellingPrice(Number(costing.selling_price || 0));
    setStatus(development.status || 'draft');
  };

  const filteredStock = stockItems.filter((item) =>
    `${item.stock_code} ${item.description}`
      .toLowerCase()
      .includes(stockSearch.toLowerCase())
  );

  return (
    <section>
      <div className="space-y-6 p-4 md:p-6">

        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-orange-600 font-medium">
              <Beaker size={18} />
              Business Development
            </div>

            <h1 className="text-2xl font-bold text-gray-900">
              Product Development & Costing
            </h1>

            <p className="text-sm text-gray-500">
              Develop recipes, calculate production costs and manage product versions.
            </p>
          </div>

          <Button
            onClick={resetForm}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Plus size={16} className="mr-2" />
            New Development
          </Button>
        </div>

        {/* Saved Developments */}
        

<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2 text-base">
      <Layers size={18} className="text-orange-500" />
      Saved Product Developments
    </CardTitle>
  </CardHeader>

  <CardContent>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-orange-50 text-left">
            <th className="p-3">Product Name</th>
            <th className="p-3">Product Code</th>
            <th className="p-3">Category</th>
            <th className="p-3">Status</th>
            <th className="p-3">Last Updated</th>
            <th className="p-3 text-right">Action</th>
          </tr>
        </thead>

        <tbody>
          {developments.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-6 text-center text-gray-500">
                No product developments saved yet.
              </td>
            </tr>
          ) : (
            developments.map((item) => (
              <tr key={item.id} className="border-b hover:bg-orange-50/40">
                <td className="p-3 font-medium">
                  {item.product_name}
                </td>
                <td className="p-3">
                  {item.product_code || '—'}
                </td>
                <td className="p-3">
                  {item.product_category || '—'}
                </td>
                <td className="p-3">
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                    {(item.status || 'draft').replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                <td className="p-3">
                  {item.updated_at
                    ? new Date(item.updated_at).toLocaleDateString('en-ZA')
                    : '—'}
                </td>
                <td className="p-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openDevelopment(item)}
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </CardContent>
</Card>

        {/* Product Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Product Details</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Enter product name"
              />
            </div>

            <div className="space-y-2">
              <Label>Product Code</Label>
              <Input
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                placeholder="Enter product code"
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                placeholder="e.g. Spice Blend"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this product development..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Production Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package size={18} className="text-orange-500" />
              Production Setup
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Costing Method</Label>
              <Select
                value={productionMode}
                onValueChange={(value: 'batch' | 'packets') =>
                  setProductionMode(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="batch">Batch Size (kg)</SelectItem>
                  <SelectItem value="packets">Finished Packets</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {productionMode === 'batch' ? (
              <div className="max-w-sm space-y-2">
                <Label>Batch Size (kg)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Packet Size (grams)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={packetSize}
                    onChange={(e) => setPacketSize(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Number of Packets</Label>
                  <Input
                    type="number"
                    min="1"
                    value={packetQuantity}
                    onChange={(e) => setPacketQuantity(Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            <div className="rounded-lg bg-orange-50 p-4">
              <p className="text-sm text-gray-600">Total production quantity</p>
              <p className="text-2xl font-bold text-orange-600">
                {productionKg.toLocaleString('en-ZA', {
                  maximumFractionDigits: 3,
                })} kg
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recipe Spreadsheet */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet size={18} className="text-orange-500" />
                Recipe & Ingredient Costing
              </CardTitle>

              <Button
                size="sm"
                onClick={addIngredient}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Plus size={15} className="mr-2" />
                Add Ingredient
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-3">Ingredient</th>
                    <th className="p-3">Source</th>
                    <th className="p-3">Unit</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3">Unit Cost (R)</th>
                    <th className="p-3">Total Cost (R)</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>

                <tbody>
                  {ingredients.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-2">
                        {item.source === 'stock' ? (
                          <div className="font-medium">
                            {item.ingredient_name}
                            <div className="text-xs text-gray-400">
                              ERP ingredient
                            </div>
                          </div>
                        ) : (
                          <Input
                            value={item.ingredient_name}
                            onChange={(e) =>
                              updateIngredient(
                                item.id,
                                'ingredient_name',
                                e.target.value
                              )
                            }
                            placeholder="Enter ingredient"
                          />
                        )}
                      </td>

                      <td className="p-2">
                        <Select
                          value={item.source}
                          onValueChange={(value: 'stock' | 'manual') => {
                            setIngredients((previous) =>
                              previous.map((ingredient) =>
                                ingredient.id === item.id
                                  ? {
                                      ...ingredient,
                                      source: value,
                                      stock_code_id: null,
                                      ingredient_name: '',
                                      unit_cost: 0,
                                      total_cost: 0,
                                    }
                                  : ingredient
                              )
                            );
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="stock">ERP Stock</SelectItem>
                            <SelectItem value="manual">New Ingredient</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      <td className="p-2">
                        <Select
                          value={item.unit}
                          onValueChange={(value) =>
                            updateIngredient(item.id, 'unit', value)
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {['kg', 'g', 'litre', 'ml', 'unit'].map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      <td className="p-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={item.quantity}
                          onChange={(e) =>
                            updateIngredient(
                              item.id,
                              'quantity',
                              Number(e.target.value)
                            )
                          }
                          className="w-24"
                        />
                      </td>

                      <td className="p-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) =>
                            updateIngredient(
                              item.id,
                              'unit_cost',
                              Number(e.target.value)
                            )
                          }
                          className="w-28"
                        />
                      </td>

                      <td className="p-2 font-semibold">
                        {CURRENCY.format(
                          Number(item.quantity || 0) *
                          Number(item.unit_cost || 0)
                        )}
                      </td>

                      <td className="p-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeIngredient(item.id)}
                        >
                          <Trash2 size={16} className="text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex-1 space-y-2">
                  <Label>Search Existing ERP Ingredient</Label>
                  <Input
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    placeholder="Search stock code or ingredient..."
                  />
                </div>
              </div>

              {stockSearch && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredStock.slice(0, 10).map((stock) => (
                    <div
                      key={stock.id}
                      className="flex flex-col gap-2 rounded border bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">{stock.description}</p>
                        <p className="text-xs text-gray-500">
                          {stock.stock_code} · {stock.unit_of_measure} ·{' '}
                          {CURRENCY.format(stock.latest_cost)}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const emptyRow = ingredients.find(
                            (item) =>
                              item.source === 'stock' &&
                              !item.ingredient_name
                          );

                          const target = emptyRow || ingredients[0];

                          selectStockIngredient(target.id, stock.id);
                          setStockSearch('');
                        }}
                      >
                        Select Ingredient
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-sm text-gray-500">Ingredient Total</p>
                <p className="text-xl font-bold">
                  {CURRENCY.format(ingredientTotal)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Costs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Additional Production Costs</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Packaging Cost (R)</Label>
              <Input
                type="number"
                min="0"
                value={packagingCost}
                onChange={(e) => setPackagingCost(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Labour Cost (R)</Label>
              <Input
                type="number"
                min="0"
                value={labourCost}
                onChange={(e) => setLabourCost(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Overhead Cost (R)</Label>
              <Input
                type="number"
                min="0"
                value={overheadCost}
                onChange={(e) => setOverheadCost(Number(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Cost Summary */}
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator size={18} className="text-orange-500" />
              Cost Summary
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Ingredients</p>
                <p className="text-xl font-bold">
                  {CURRENCY.format(ingredientTotal)}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Additional Costs</p>
                <p className="text-xl font-bold">
                  {CURRENCY.format(
                    packagingCost + labourCost + overheadCost
                  )}
                </p>
              </div>

              <div className="rounded-lg bg-orange-50 p-4">
                <p className="text-sm text-orange-600">Total Production Cost</p>
                <p className="text-xl font-bold text-orange-700">
                  {CURRENCY.format(totalCost)}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Cost per kg</p>
                <p className="text-xl font-bold">
                  {CURRENCY.format(costPerKg)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Selling Price per Packet (R)</Label>
                <Input
                  type="number"
                  min="0"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(Number(e.target.value))}
                />
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Cost per Packet</p>
                <p className="text-xl font-bold">
                  {CURRENCY.format(costPerPacket)}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Profit per Packet</p>
                <p className={`text-xl font-bold ${
                  profit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {CURRENCY.format(profit)}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Profit Margin</p>
                <p className="text-xl font-bold">
                  {profitMargin.toFixed(2)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={resetForm}
          >
            Clear Form
          </Button>

          <Button
            onClick={saveDevelopment}
            disabled={saving}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Development
              </>
            )}
          </Button>
        </div>
      </div>
    </section>
  );
};


export default BDMProductDevelopment;