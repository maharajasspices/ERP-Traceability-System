import React, { useState, useMemo } from 'react';
import { useFMSData, formatDateTime } from '@/hooks/useFMSData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import {
  Loader2,
  Package,
  AlertTriangle,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Mail,
  CheckCircle,
  XCircle,
  Truck,
  ShoppingCart,
} from 'lucide-react';

import { exportToExcel } from '@/lib/exportUtils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const StockTracking: React.FC = () => {
  const {
    stockCodes,
    stockLevels,
    stockMovements,
    loading,
    refreshData,
    getStockCodeById,
    suppliers,
  } = useFMSData();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<
    'all' | 'receipt' | 'batch_usage' | 'adjustment'
  >('all');
  const [stockCodeFilter, setStockCodeFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('levels');

  // ------------------------------------------------------------
  // Single-item order dialog
  // ------------------------------------------------------------

  const [orderDialogOpen, setOrderDialogOpen] = useState(false);

  const [orderItem, setOrderItem] = useState<{
    stockCode: typeof stockCodes[0];
    quantity: number;
    threshold: number;
  } | null>(null);

  const [orderSupplierId, setOrderSupplierId] = useState('');
  const [orderQuantity, setOrderQuantity] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [sendingOrder, setSendingOrder] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  // ------------------------------------------------------------
  // Supplier Orders tab
  // ------------------------------------------------------------

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(
    {}
  );

  const [suggestedQty, setSuggestedQty] = useState<Record<string, string>>(
    {}
  );

  const [reviewSupplierId, setReviewSupplierId] = useState<string | null>(
    null
  );

  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [sendingSupplierOrder, setSendingSupplierOrder] = useState(false);
  const [supplierOrderSent, setSupplierOrderSent] = useState(false);
  const [supplierOrderError, setSupplierOrderError] = useState('');

  // ------------------------------------------------------------
  // Stock level map
  // ------------------------------------------------------------

  const levelMap = useMemo(() => {
    const map = new Map<string, typeof stockLevels[0]>();

    stockLevels.forEach((level) => {
      map.set(level.stock_code_id, level);
    });

    return map;
  }, [stockLevels]);

  // ------------------------------------------------------------
  // Stock level rows
  // ------------------------------------------------------------

  const stockLevelRows = useMemo(() => {
    return stockCodes
      .filter((sc) => sc.status === 'active')
      .map((sc) => {
        const level = levelMap.get(sc.id);

        const qty = level?.quantity_on_hand ?? 0;
        const threshold = level?.low_stock_threshold ?? 0;

        const isLow = qty < 0 || qty <= threshold;

        return {
          stockCode: sc,
          quantity: qty,
          threshold,
          isLow,
        };
      })
      .filter((row) => {
        if (!searchQuery) return true;

        const q = searchQuery.toLowerCase();

        return (
          row.stockCode.stock_code.toLowerCase().includes(q) ||
          row.stockCode.description.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.isLow !== b.isLow) {
          return a.isLow ? -1 : 1;
        }

        return a.stockCode.stock_code.localeCompare(
          b.stockCode.stock_code
        );
      });
  }, [stockCodes, levelMap, searchQuery]);

  // ------------------------------------------------------------
  // Supplier groups
  // ------------------------------------------------------------

  const supplierGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        supplier: typeof suppliers[0];
        items: {
          stockCode: typeof stockCodes[0];
          quantity: number;
          threshold: number;
          isLow: boolean;
          suggested: number;
        }[];
      }
    >();

    suppliers
      .filter((supplier) => supplier.is_approved)
      .forEach((supplier) => {
        groups.set(supplier.id, {
          supplier,
          items: [],
        });
      });

    stockCodes
      .filter(
        (sc) =>
          sc.status === 'active' &&
          (sc.approved_supplier_ids?.length || 0) > 0
      )
      .forEach((sc) => {
        const level = levelMap.get(sc.id);

        const qty = level?.quantity_on_hand ?? 0;
        const threshold = level?.low_stock_threshold ?? 0;

        const isLow = qty < 0 || qty <= threshold;

        const suggested = Math.max(
          threshold * 2 - qty,
          threshold + 10,
          10
        );

        sc.approved_supplier_ids.forEach((supplierId) => {
          const group = groups.get(supplierId);

          if (group) {
            group.items.push({
              stockCode: sc,
              quantity: qty,
              threshold,
              isLow,
              suggested,
            });
          }
        });
      });

    return Array.from(groups.values())
      .filter((group) => group.items.length > 0)
      .map((group) => ({
        ...group,

        items: group.items.sort((a, b) => {
          if (a.isLow !== b.isLow) {
            return a.isLow ? -1 : 1;
          }

          return a.stockCode.stock_code.localeCompare(
            b.stockCode.stock_code
          );
        }),
      }))
      .sort((a, b) => {
        const aLow = a.items.some((item) => item.isLow);
        const bLow = b.items.some((item) => item.isLow);

        if (aLow !== bLow) {
          return aLow ? -1 : 1;
        }

        return a.supplier.name.localeCompare(b.supplier.name);
      });
  }, [suppliers, stockCodes, levelMap]);

  const supplierOrdersLowCount = supplierGroups.filter((group) =>
    group.items.some((item) => item.isLow)
  ).length;

  // ------------------------------------------------------------
  // Movement history
  // ------------------------------------------------------------

  const filteredMovements = useMemo(() => {
    return stockMovements
      .filter((movement) => {
        if (
          typeFilter !== 'all' &&
          movement.movement_type !== typeFilter
        ) {
          return false;
        }

        if (
          stockCodeFilter !== 'all' &&
          movement.stock_code_id !== stockCodeFilter
        ) {
          return false;
        }

        if (searchQuery) {
          const q = searchQuery.toLowerCase();

          const sc = getStockCodeById(movement.stock_code_id);

          const matchesCode =
            sc?.stock_code.toLowerCase().includes(q) ||
            sc?.description.toLowerCase().includes(q);

          const matchesRef = (
            movement.reference_id || ''
          )
            .toLowerCase()
            .includes(q);

          const matchesBatch = (
            movement.batch_number || ''
          )
            .toLowerCase()
            .includes(q);

          const matchesNotes = (
            movement.notes || ''
          )
            .toLowerCase()
            .includes(q);

          if (
            !matchesCode &&
            !matchesRef &&
            !matchesBatch &&
            !matchesNotes
          ) {
            return false;
          }
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );
  }, [
    stockMovements,
    typeFilter,
    stockCodeFilter,
    searchQuery,
    getStockCodeById,
  ]);

  const lowStockCount = stockLevelRows.filter(
    (row) => row.isLow
  ).length;

  const negativeStockCount = stockLevelRows.filter(
    (row) => row.quantity < 0
  ).length;

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'receipt':
        return 'Receipt';

      case 'batch_usage':
        return 'Batch Usage';

      case 'adjustment':
        return 'Adjustment';

      default:
        return type;
    }
  };

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'receipt':
        return 'badge-active';

      case 'batch_usage':
        return 'badge-warning';

      case 'adjustment':
        return 'badge-inactive';

      default:
        return 'badge-inactive';
    }
  };

  // ------------------------------------------------------------
  // Export
  // ------------------------------------------------------------

  const handleExportStockLevels = () => {
    const data = stockLevelRows.map((row) => ({
      'Stock Code': row.stockCode.stock_code,
      Description: row.stockCode.description,
      'Item Type': row.stockCode.item_type.replace('_', ' '),
      UOM: row.stockCode.unit_of_measure,
      'Quantity On Hand': row.quantity,
      'Low Stock Threshold': row.threshold,
      Status: row.isLow
        ? row.quantity < 0
          ? 'NEGATIVE'
          : 'LOW'
        : 'OK',
    }));

    exportToExcel(data, 'Stock_Levels');

    toast.success('Stock levels exported to Excel');
  };

  const handleExportMovements = () => {
    const data = filteredMovements.map((movement) => {
      const sc = getStockCodeById(movement.stock_code_id);

      return {
        Date: formatDateTime(movement.created_at),
        'Stock Code': sc?.stock_code || '',
        Description: sc?.description || '',
        'Movement Type': getMovementTypeLabel(
          movement.movement_type
        ),
        'Quantity Change': movement.quantity_change,
        Reference: movement.reference_id || '',
        'Batch Number': movement.batch_number || '',
        Notes: movement.notes || '',
      };
    });

    exportToExcel(data, 'Stock_Movements');

    toast.success('Stock movements exported to Excel');
  };

  // ------------------------------------------------------------
  // Single item supplier order
  // ------------------------------------------------------------

  const handleEmailSupplier = (item: {
    stockCode: typeof stockCodes[0];
    quantity: number;
    threshold: number;
  }) => {
    setOrderItem(item);
    setOrderSupplierId('');

    setOrderQuantity(
      String(
        Math.max(
          item.threshold * 2,
          item.threshold + 10
        )
      )
    );

    setOrderNotes('');
    setEmailSent(false);
    setEmailError('');
    setOrderDialogOpen(true);
  };

  const handleSendOrder = async () => {
    if (!orderItem || !orderSupplierId || !orderQuantity) {
      toast.error(
        'Please select a supplier and enter a quantity'
      );
      return;
    }

    setSendingOrder(true);
    setEmailError('');

    try {
      const { data, error } =
        await supabase.functions.invoke(
          'fms-stock-order',
          {
            body: {
              operation: 'send_stock_order',
              supplier_id: orderSupplierId,
              stock_code_id: orderItem.stockCode.id,
              quantity: parseFloat(orderQuantity),
              notes: orderNotes || undefined,
            },
          }
        );

      if (error) {
        console.error(
          '[StockTracking] Order email error:',
          error
        );

        setEmailError(
          error.message || 'Failed to send email'
        );

        return;
      }

      if (data?.sent) {
        setEmailSent(true);

        toast.success(
          'Order email sent to supplier'
        );
      } else {
        const reason =
          data?.reason ||
          'Email could not be sent';

        setEmailError(reason);
        toast.error(reason);
      }
    } catch (error: any) {
      console.error(
        '[StockTracking] Unexpected order error:',
        error
      );

      setEmailError(
        error?.message ||
          'Failed to send email'
      );
    } finally {
      setSendingOrder(false);
    }
  };

  // ------------------------------------------------------------
  // Supplier order selection
  // ------------------------------------------------------------

  const itemKey = (
    supplierId: string,
    stockCodeId: string
  ) => {
    return `${supplierId}:${stockCodeId}`;
  };

  const isItemChecked = (
    supplierId: string,
    stockCodeId: string,
    defaultChecked: boolean
  ) => {
    const key = itemKey(
      supplierId,
      stockCodeId
    );

    return key in checkedItems
      ? checkedItems[key]
      : defaultChecked;
  };

  const getItemQty = (
    supplierId: string,
    stockCodeId: string,
    defaultQty: number
  ) => {
    const key = itemKey(
      supplierId,
      stockCodeId
    );

    return key in suggestedQty
      ? suggestedQty[key]
      : String(defaultQty);
  };

  const toggleItemChecked = (
    supplierId: string,
    stockCodeId: string,
    defaultChecked: boolean
  ) => {
    const key = itemKey(
      supplierId,
      stockCodeId
    );

    const current = isItemChecked(
      supplierId,
      stockCodeId,
      defaultChecked
    );

    setCheckedItems((previous) => ({
      ...previous,
      [key]: !current,
    }));
  };

  const setItemQty = (
    supplierId: string,
    stockCodeId: string,
    value: string
  ) => {
    const key = itemKey(
      supplierId,
      stockCodeId
    );

    setSuggestedQty((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  // ------------------------------------------------------------
  // Supplier review
  // ------------------------------------------------------------

  const handleReviewSupplierOrder = (
    supplierId: string
  ) => {
    setReviewSupplierId(supplierId);
    setReviewNotes('');
    setSupplierOrderSent(false);
    setSupplierOrderError('');
    setReviewDialogOpen(true);
  };

  const reviewGroup = useMemo(() => {
    if (!reviewSupplierId) {
      return null;
    }

    return (
      supplierGroups.find(
        (group) =>
          group.supplier.id ===
          reviewSupplierId
      ) || null
    );
  }, [reviewSupplierId, supplierGroups]);

  const reviewSelectedItems = useMemo(() => {
    if (!reviewGroup) {
      return [];
    }

    return reviewGroup.items
      .filter((item) =>
        isItemChecked(
          reviewGroup.supplier.id,
          item.stockCode.id,
          item.isLow
        )
      )
      .map((item) => ({
        stockCode: item.stockCode,
        quantity:
          parseFloat(
            getItemQty(
              reviewGroup.supplier.id,
              item.stockCode.id,
              item.suggested
            )
          ) || 0,
      }))
      .filter((item) => item.quantity > 0);
  }, [
    reviewGroup,
    checkedItems,
    suggestedQty,
  ]);

  const handleSendSupplierOrder =
    async () => {
      if (
        !reviewGroup ||
        reviewSelectedItems.length === 0
      ) {
        toast.error(
          'Please tick at least one item to order'
        );

        return;
      }

      if (!reviewGroup.supplier.email) {
        toast.error(
          'This supplier has no email address'
        );

        return;
      }

      setSendingSupplierOrder(true);
      setSupplierOrderError('');

      try {
        const { data, error } =
          await supabase.functions.invoke(
            'fms-stock-order',
            {
              body: {
                operation:
                  'send_supplier_order',

                supplier_id:
                  reviewGroup.supplier.id,

                items:
                  reviewSelectedItems.map(
                    (item) => ({
                      stock_code_id:
                        item.stockCode.id,
                      quantity:
                        item.quantity,
                    })
                  ),

                notes:
                  reviewNotes || undefined,
              },
            }
          );

        if (error) {
          console.error(
            '[StockTracking] Supplier order error:',
            error
          );

          setSupplierOrderError(
            error.message ||
              'Failed to send email'
          );

          return;
        }

        if (data?.sent) {
          setSupplierOrderSent(true);

          toast.success(
            'Order email sent to supplier'
          );
        } else {
          const reason =
            data?.reason ||
            'Email could not be sent';

          setSupplierOrderError(reason);

          toast.error(reason);
        }
      } catch (error: any) {
        console.error(
          '[StockTracking] Supplier order unexpected error:',
          error
        );

        setSupplierOrderError(
          error?.message ||
            'Failed to send email'
        );
      } finally {
        setSendingSupplierOrder(false);
      }
    };

  // ------------------------------------------------------------
  // Loading
  // ------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in px-2 sm:px-0">

      {/* Header */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            Stock Tracking
          </h2>

          <p className="text-muted-foreground text-sm sm:text-base">
            Monitor current stock levels and movement history
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshData()}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />

            <span className="hidden sm:inline">
              Refresh
            </span>
          </Button>

          {activeTab === 'levels' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportStockLevels}
              className="gap-2"
            >
              <TrendingDown className="h-4 w-4" />

              <span className="hidden sm:inline">
                Export Levels
              </span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportMovements}
              className="gap-2"
            >
              <TrendingUp className="h-4 w-4" />

              <span className="hidden sm:inline">
                Export Movements
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Alerts */}

      {negativeStockCount > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />

            <div>
              <p className="font-semibold text-destructive">
                {negativeStockCount} item
                {negativeStockCount > 1 ? 's' : ''}{' '}
                in NEGATIVE stock
              </p>

              <p className="text-sm text-destructive/80 mt-1">
                These items have been used more than what
                was received. Please order more stock
                immediately.
              </p>
            </div>
          </div>
        </div>
      )}

      {lowStockCount > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />

            <div>
              <p className="font-semibold text-warning">
                {lowStockCount} item
                {lowStockCount > 1 ? 's' : ''}{' '}
                at or below low stock threshold
              </p>

              <p className="text-sm text-warning/80 mt-1">
                Consider reordering these items to avoid
                production delays.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList>
          <TabsTrigger
            value="levels"
            className="gap-2"
          >
            <Package className="h-4 w-4" />

            Stock Levels

            {lowStockCount > 0 && (
              <span className="ml-1 rounded-full bg-warning/20 px-2 py-0.5 text-xs font-semibold text-warning">
                {lowStockCount}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="supplier-orders"
            className="gap-2"
          >
            <Truck className="h-4 w-4" />

            Supplier Orders

            {supplierOrdersLowCount > 0 && (
              <span className="ml-1 rounded-full bg-warning/20 px-2 py-0.5 text-xs font-semibold text-warning">
                {supplierOrdersLowCount}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="movements"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />

            Movement History
          </TabsTrigger>
        </TabsList>

        {/* =====================================================
            STOCK LEVELS
        ===================================================== */}

        <TabsContent
          value="levels"
          className="space-y-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                placeholder="Search stock code or description..."
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(e.target.value)
                }
                className="pl-9"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
<div className="overflow-x-auto max-h-[600px] overflow-y-auto">
  <table className="data-table">
    <thead className="sticky top-0 bg-card z-20">

                  <tr>
                    <th>Stock Code</th>
                    <th>Description</th>
                    <th className="hidden md:table-cell">
                      Type
                    </th>
                    <th className="text-right">
                      On Hand
                    </th>
                    <th className="hidden sm:table-cell text-right">
                      Min. Reorder Point
                    </th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {stockLevelRows.map((row) => (
                    <tr
                      key={row.stockCode.id}
                      className={
                        row.isLow
                          ? 'bg-warning/5'
                          : ''
                      }
                    >
                      <td className="font-medium text-xs sm:text-sm">
                        {row.stockCode.stock_code}
                      </td>

                      <td className="text-xs sm:text-sm max-w-[200px] truncate">
                        {row.stockCode.description}
                      </td>

                      <td className="hidden md:table-cell text-xs">
                        <span className="badge-inactive">
                          {row.stockCode.item_type.replace(
                            '_',
                            ' '
                          )}
                        </span>
                      </td>

                      <td
                        className={`text-right font-semibold text-xs sm:text-sm ${
                          row.quantity < 0
                            ? 'text-destructive'
                            : row.isLow
                            ? 'text-warning'
                            : 'text-success'
                        }`}
                      >
                        {row.quantity.toFixed(2)}{' '}
                        {row.stockCode.unit_of_measure}
                      </td>

                      <td className="hidden sm:table-cell text-right text-xs sm:text-sm text-muted-foreground">
                        {row.threshold.toFixed(2)}{' '}
                        {row.stockCode.unit_of_measure}
                      </td>

                      <td>
                        {row.quantity < 0 ? (
                          <span className="badge-danger text-xs">
                            NEGATIVE
                          </span>
                        ) : row.isLow ? (
                          <span className="badge-warning text-xs">
                            LOW STOCK
                          </span>
                        ) : (
                          <span className="badge-active text-xs">
                            OK
                          </span>
                        )}
                      </td>

                      <td>
                        {row.isLow && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() =>
                              handleEmailSupplier(
                                row
                              )
                            }
                          >
                            <Mail className="h-3 w-3" />

                            Email Supplier
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {stockLevelRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />

                        <p>
                          No stock levels found
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* =====================================================
            SUPPLIER ORDERS
        ===================================================== */}

        <TabsContent
          value="supplier-orders"
          className="space-y-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                placeholder="Search suppliers or stock codes..."
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(e.target.value)
                }
                className="pl-9"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCheckedItems({});
                setSuggestedQty({});

                toast.success(
                  'Order selections cleared'
                );
              }}
              className="gap-2"
            >
              <ShoppingCart className="h-4 w-4" />

              Clear Selections
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Below are the approved suppliers and the stock
            items they supply. Tick the checkboxes for items
            you need to order, adjust the suggested quantities,
            then click{' '}
            <strong>
              Review &amp; Send Email
            </strong>{' '}
            for each supplier.
          </p>

          {supplierGroups.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              <Truck className="mx-auto mb-2 h-8 w-8 opacity-50" />

              <p>
                No suppliers with stock items found
              </p>
            </div>
          ) : (
            <Accordion
              type="multiple"
              className="space-y-3"
            >
              {supplierGroups
                .filter((group) => {
                  if (!searchQuery) {
                    return true;
                  }

                  const q =
                    searchQuery.toLowerCase();

                  const supplierMatch =
                    group.supplier.name
                      .toLowerCase()
                      .includes(q);

                  const itemMatch =
                    group.items.some(
                      (item) =>
                        item.stockCode.stock_code
                          .toLowerCase()
                          .includes(q) ||
                        item.stockCode.description
                          .toLowerCase()
                          .includes(q)
                    );

                  return (
                    supplierMatch ||
                    itemMatch
                  );
                })
                .map((group) => {
                  const checkedCount =
                    group.items.filter(
                      (item) =>
                        isItemChecked(
                          group.supplier.id,
                          item.stockCode.id,
                          item.isLow
                        )
                    ).length;

                  const lowCount =
                    group.items.filter(
                      (item) => item.isLow
                    ).length;

                  return (
                    <AccordionItem
                      key={group.supplier.id}
                      value={group.supplier.id}
                      className="border border-border rounded-xl bg-card"
                    >
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex w-full items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Truck
                              className={`h-4 w-4 shrink-0 ${
                                lowCount > 0
                                  ? 'text-warning'
                                  : 'text-muted-foreground'
                              }`}
                            />

                            <span className="font-semibold truncate">
                              {group.supplier.name}
                            </span>

                            {lowCount > 0 && (
                              <Badge
                                variant="outline"
                                className="badge-warning text-xs shrink-0"
                              >
                                {lowCount} low stock
                                item
                                {lowCount !== 1
                                  ? 's'
                                  : ''}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {!group.supplier.email && (
                              <Badge
                                variant="secondary"
                                className="badge-danger text-xs"
                              >
                                No email
                              </Badge>
                            )}

                            {checkedCount > 0 && (
                              <Badge
                                variant="outline"
                                className="badge-active text-xs"
                              >
                                {checkedCount}{' '}
                                selected
                              </Badge>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="px-4 pb-3">
                        {/* Supplier contact */}

                        <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {group.supplier.email && (
                            <>
                              <span className="font-medium text-foreground">
                                Email:
                              </span>

                              <span>
                                {
                                  group
                                    .supplier
                                    .email
                                }
                              </span>
                            </>
                          )}

                          {group.supplier.phone && (
                            <>
                              <span className="font-medium text-foreground">
                                Phone:
                              </span>

                              <span>
                                {
                                  group
                                    .supplier
                                    .phone
                                }
                              </span>
                            </>
                          )}

                          {group.supplier
                            .contact_name && (
                            <>
                              <span className="font-medium text-foreground">
                                Contact:
                              </span>

                              <span>
                                {
                                  group
                                    .supplier
                                    .contact_name
                                }
                              </span>
                            </>
                          )}
                        </div>

                        {/* Items table */}

                      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                      <table className="data-table">
                           <thead className="sticky top-0 bg-card z-20">

                              <tr>
                                <th className="w-10">
                                  Sel
                                </th>

                                <th>
                                  Stock Code
                                </th>

                                <th className="hidden md:table-cell">
                                  Description
                                </th>

                                <th className="hidden sm:table-cell text-right">
                                  On Hand
                                </th>

                                <th className="hidden sm:table-cell text-right">
                                  Min. Reorder
                                </th>

                                <th>
                                  Suggested Qty
                                </th>

                                <th className="hidden md:table-cell">
                                  Status
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {group.items.map(
                                (item) => {
                                  const checked =
                                    isItemChecked(
                                      group
                                        .supplier
                                        .id,
                                      item
                                        .stockCode
                                        .id,
                                      item.isLow
                                    );

                                  return (
                                    <tr
                                      key={
                                        item
                                          .stockCode
                                          .id
                                      }
                                      className={
                                        item.isLow
                                          ? 'bg-warning/5'
                                          : ''
                                      }
                                    >
                                      <td>
                                        <Checkbox
                                          checked={
                                            checked
                                          }
                                          onCheckedChange={() =>
                                            toggleItemChecked(
                                              group
                                                .supplier
                                                .id,
                                              item
                                                .stockCode
                                                .id,
                                              item.isLow
                                            )
                                          }
                                        />
                                      </td>

                                      <td className="font-medium text-xs sm:text-sm">
                                        {
                                          item
                                            .stockCode
                                            .stock_code
                                        }
                                      </td>

                                      <td className="hidden md:table-cell text-xs sm:text-sm max-w-[200px] truncate">
                                        {
                                          item
                                            .stockCode
                                            .description
                                        }
                                      </td>

                                      <td className="hidden sm:table-cell text-right text-xs sm:text-sm">
                                        <span
                                          className={
                                            item.quantity <
                                            0
                                              ? 'text-destructive'
                                              : item.isLow
                                              ? 'text-warning'
                                              : ''
                                          }
                                        >
                                          {item.quantity.toFixed(
                                            2
                                          )}{' '}
                                          {
                                            item
                                              .stockCode
                                              .unit_of_measure
                                          }
                                        </span>
                                      </td>

                                      <td className="hidden sm:table-cell text-right text-xs sm:text-sm text-muted-foreground">
                                        {item.threshold.toFixed(
                                          2
                                        )}{' '}
                                        {
                                          item
                                            .stockCode
                                            .unit_of_measure
                                        }
                                      </td>

                                      <td>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={getItemQty(
                                            group
                                              .supplier
                                              .id,
                                            item
                                              .stockCode
                                              .id,
                                            item.suggested
                                          )}
                                          onChange={(
                                            event
                                          ) =>
                                            setItemQty(
                                              group
                                                .supplier
                                                .id,
                                              item
                                                .stockCode
                                                .id,
                                              event
                                                .target
                                                .value
                                            )
                                          }
                                          className={`w-24 text-xs ${
                                            checked
                                              ? ''
                                              : 'opacity-50'
                                          }`}
                                          disabled={
                                            !checked
                                          }
                                        />
                                      </td>

                                      <td className="hidden md:table-cell">
                                        {item.quantity <
                                        0 ? (
                                          <span className="badge-danger text-xs">
                                            NEGATIVE
                                          </span>
                                        ) : item.isLow ? (
                                          <span className="badge-warning text-xs">
                                            LOW STOCK
                                          </span>
                                        ) : (
                                          <span className="badge-active text-xs">
                                            OK
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                }
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Supplier actions */}

                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setCheckedItems(
                                (previous) => {
                                  const next = {
                                    ...previous,
                                  };

                                  group.items.forEach(
                                    (item) => {
                                      next[
                                        itemKey(
                                          group
                                            .supplier
                                            .id,
                                          item
                                            .stockCode
                                            .id
                                        )
                                      ] = false;
                                    }
                                  );

                                  return next;
                                }
                              );
                            }}
                          >
                            Clear Selection
                          </Button>

                          <Button
                            size="sm"
                            className="gap-1"
                            disabled={
                              checkedCount === 0 ||
                              !group.supplier.email
                            }
                            onClick={() =>
                              handleReviewSupplierOrder(
                                group
                                  .supplier
                                  .id
                              )
                            }
                          >
                            <Mail className="h-4 w-4" />

                            Review &amp; Send Email
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
            </Accordion>
          )}
        </TabsContent>

        {/* =====================================================
            MOVEMENT HISTORY
        ===================================================== */}

        <TabsContent
          value="movements"
          className="space-y-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                placeholder="Search by stock code, reference, batch, or notes..."
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(e.target.value)
                }
                className="pl-9"
              />
            </div>

            <Select
              value={typeFilter}
              onValueChange={(value) =>
                setTypeFilter(
                  value as
                    | 'all'
                    | 'receipt'
                    | 'batch_usage'
                    | 'adjustment'
                )
              }
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  All Types
                </SelectItem>

                <SelectItem value="receipt">
                  Receipt
                </SelectItem>

                <SelectItem value="batch_usage">
                  Batch Usage
                </SelectItem>

                <SelectItem value="adjustment">
                  Adjustment
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={stockCodeFilter}
              onValueChange={setStockCodeFilter}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Stock Code" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  All Stock Codes
                </SelectItem>

                {stockCodes.map((sc) => (
                  <SelectItem
                    key={sc.id}
                    value={sc.id}
                  >
                    {sc.stock_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="data-table">
                <thead className="sticky top-0 bg-card z-10">
                  <tr>
                    <th>Date</th>
                    <th>Stock Code</th>
                    <th className="hidden md:table-cell">
                      Description
                    </th>
                    <th>Type</th>
                    <th className="text-right">
                      Qty Change
                    </th>
                    <th className="hidden sm:table-cell">
                      Reference
                    </th>
                    <th className="hidden lg:table-cell">
                      Notes
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredMovements.map(
                    (movement) => {
                      const sc =
                        getStockCodeById(
                          movement.stock_code_id
                        );

                      const isPositive =
                        movement.quantity_change >
                        0;

                      return (
                        <tr
                          key={movement.id}
                        >
                          <td className="text-xs sm:text-sm whitespace-nowrap">
                            {formatDateTime(
                              movement.created_at
                            )}
                          </td>

                          <td className="font-medium text-xs sm:text-sm">
                            {sc?.stock_code ||
                              'Unknown'}
                          </td>

                          <td className="hidden md:table-cell text-xs sm:text-sm max-w-[150px] truncate">
                            {sc?.description}
                          </td>

                          <td>
                            <span
                              className={`${getMovementTypeColor(
                                movement.movement_type
                              )} text-xs`}
                            >
                              {getMovementTypeLabel(
                                movement.movement_type
                              )}
                            </span>
                          </td>

                          <td
                            className={`text-right font-semibold text-xs sm:text-sm ${
                              isPositive
                                ? 'text-success'
                                : 'text-destructive'
                            }`}
                          >
                            {isPositive
                              ? '+'
                              : ''}
                            {movement.quantity_change.toFixed(
                              2
                            )}{' '}
                            {sc?.unit_of_measure}
                          </td>

                          <td className="hidden sm:table-cell text-xs sm:text-sm">
                            {movement.batch_number ||
                              movement.reference_id ||
                              '—'}
                          </td>

                          <td className="hidden lg:table-cell text-xs sm:text-sm text-muted-foreground max-w-[200px] truncate">
                            {movement.notes ||
                              '—'}
                          </td>
                        </tr>
                      );
                    }
                  )}

                  {filteredMovements.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        <RefreshCw className="mx-auto mb-2 h-8 w-8 opacity-50" />

                        <p>
                          No stock movements found
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* =====================================================
          SINGLE ITEM EMAIL DIALOG
      ===================================================== */}

      <Dialog
        open={orderDialogOpen}
        onOpenChange={(open) => {
          if (!sendingOrder) {
            setOrderDialogOpen(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Email Supplier - Purchase Order
            </DialogTitle>

            <DialogDescription>
              {orderItem
                ? `Order ${orderItem.stockCode.stock_code} (${orderItem.stockCode.description})`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {emailSent ? (
            <div className="py-6 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-success mb-3" />

              <h3 className="text-lg font-semibold text-success">
                Email Sent Successfully
              </h3>

              <p className="text-sm text-muted-foreground mt-1">
                The purchase order has been sent to
                the supplier.
              </p>

              <Button
                className="mt-4"
                onClick={() =>
                  setOrderDialogOpen(false)
                }
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {orderItem && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Current Stock:
                    </span>

                    <span
                      className={`font-semibold ${
                        orderItem.quantity < 0
                          ? 'text-destructive'
                          : 'text-warning'
                      }`}
                    >
                      {orderItem.quantity.toFixed(
                        2
                      )}{' '}
                      {
                        orderItem.stockCode
                          .unit_of_measure
                      }
                    </span>
                  </div>

                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">
                      Low Stock Threshold:
                    </span>

                    <span className="font-semibold">
                      {orderItem.threshold}{' '}
                      {
                        orderItem.stockCode
                          .unit_of_measure
                      }
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  Supplier *
                </Label>

                <Select
                  value={orderSupplierId}
                  onValueChange={
                    setOrderSupplierId
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier..." />
                  </SelectTrigger>

                  <SelectContent>
                    {suppliers
                      .filter(
                        (supplier) =>
                          supplier.is_approved
                      )
                      .map((supplier) => (
                        <SelectItem
                          key={supplier.id}
                          value={supplier.id}
                        >
                          {supplier.name}{' '}
                          {supplier.email
                            ? `(${supplier.email})`
                            : '(no email)'}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                {orderSupplierId &&
                  !suppliers.find(
                    (supplier) =>
                      supplier.id ===
                      orderSupplierId
                  )?.email && (
                    <p className="text-xs text-destructive">
                      This supplier has no email
                      address on file.
                    </p>
                  )}
              </div>

              <div className="space-y-2">
                <Label>
                  Quantity to Order *
                </Label>

                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={orderQuantity}
                    onChange={(e) =>
                      setOrderQuantity(
                        e.target.value
                      )
                    }
                    placeholder="e.g., 50"
                    className="flex-1"
                  />

                  <span className="text-sm text-muted-foreground">
                    {
                      orderItem?.stockCode
                        .unit_of_measure
                    }
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  Notes (Optional)
                </Label>

                <Textarea
                  value={orderNotes}
                  onChange={(e) =>
                    setOrderNotes(
                      e.target.value
                    )
                  }
                  placeholder="Delivery instructions, urgency, etc..."
                  rows={3}
                />
              </div>

              {emailError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />

                    <p className="text-sm text-destructive">
                      {emailError}
                    </p>
                  </div>
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    setOrderDialogOpen(false)
                  }
                  disabled={sendingOrder}
                >
                  Cancel
                </Button>

                <Button
                  onClick={handleSendOrder}
                  disabled={
                    sendingOrder ||
                    !orderSupplierId ||
                    !orderQuantity ||
                    !suppliers.find(
                      (supplier) =>
                        supplier.id ===
                        orderSupplierId
                    )?.email
                  }
                  className="gap-2"
                >
                  {sendingOrder ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />

                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />

                      Approve &amp; Send Email
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* =====================================================
          REVIEW SUPPLIER ORDER DIALOG
      ===================================================== */}

      <Dialog
        open={reviewDialogOpen}
        onOpenChange={(open) => {
          if (!sendingSupplierOrder) {
            setReviewDialogOpen(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>
              {supplierOrderSent
                ? 'Order Sent Successfully'
                : 'Review & Send Order'}
            </DialogTitle>

            <DialogDescription>
              {!supplierOrderSent &&
              reviewGroup
                ? `Send order to ${reviewGroup.supplier.name}`
                : 'The purchase order has been sent to the supplier.'}
            </DialogDescription>
          </DialogHeader>

          {supplierOrderSent ? (
            <div className="py-6 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-success mb-3" />

              <h3 className="text-lg font-semibold text-success">
                Email Sent Successfully
              </h3>

              <p className="text-sm text-muted-foreground mt-1">
                The purchase order has been sent to{' '}
                {reviewGroup?.supplier.name}.
              </p>

              <Button
                className="mt-4"
                onClick={() =>
                  setReviewDialogOpen(false)
                }
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {reviewGroup && (
                <>
                  {/* Supplier information */}

                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Supplier:
                      </span>

                      <span className="font-semibold">
                        {
                          reviewGroup
                            .supplier
                            .name
                        }
                      </span>
                    </div>

                    {reviewGroup.supplier
                      .email && (
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-muted-foreground">
                          Email:
                        </span>

                        <span>
                          {
                            reviewGroup
                              .supplier
                              .email
                          }
                        </span>
                      </div>
                    )}

                    {!reviewGroup.supplier
                      .email && (
                      <p className="text-xs text-destructive mt-2">
                        This supplier has no
                        email address on file.
                      </p>
                    )}
                  </div>

                  {/* Selected items */}

                  <div>
                    <h4 className="font-semibold text-sm mb-2">
                      Items to Order
                    </h4>

                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-3">
                                Stock Code
                              </th>

                              <th className="text-left p-3">
                                Description
                              </th>

                              <th className="text-right p-3">
                                Quantity
                              </th>

                              <th className="text-left p-3">
                                UOM
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {reviewSelectedItems.map(
                              (item) => (
                                <tr
                                  key={
                                    item
                                      .stockCode
                                      .id
                                  }
                                  className="border-t border-border"
                                >
                                  <td className="p-3 font-medium">
                                    {
                                      item
                                        .stockCode
                                        .stock_code
                                    }
                                  </td>

                                  <td className="p-3 max-w-[250px] truncate">
                                    {
                                      item
                                        .stockCode
                                        .description
                                    }
                                  </td>

                                  <td className="p-3 text-right font-semibold">
                                    {item.quantity.toFixed(
                                      2
                                    )}
                                  </td>

                                  <td className="p-3">
                                    {
                                      item
                                        .stockCode
                                        .unit_of_measure
                                    }
                                  </td>
                                </tr>
                              )
                            )}

                            {reviewSelectedItems.length ===
                              0 && (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="p-6 text-center text-muted-foreground"
                                >
                                  No items selected.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}

                  <div className="space-y-2">
                    <Label>
                      Order Notes (Optional)
                    </Label>

                    <Textarea
                      value={reviewNotes}
                      onChange={(e) =>
                        setReviewNotes(
                          e.target.value
                        )
                      }
                      placeholder="Delivery instructions, urgency, special requirements, etc..."
                      rows={4}
                    />
                  </div>

                  {/* Error */}

                  {supplierOrderError && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                      <div className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />

                        <p className="text-sm text-destructive">
                          {
                            supplierOrderError
                          }
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Footer */}

                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setReviewDialogOpen(
                          false
                        )
                      }
                      disabled={
                        sendingSupplierOrder
                      }
                    >
                      Cancel
                    </Button>

                    <Button
                      onClick={
                        handleSendSupplierOrder
                      }
                      disabled={
                        sendingSupplierOrder ||
                        reviewSelectedItems.length ===
                          0 ||
                        !reviewGroup
                          .supplier
                          .email
                      }
                      className="gap-2"
                    >
                      {sendingSupplierOrder ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />

                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4" />

                          Approve &amp; Send Order
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockTracking;
