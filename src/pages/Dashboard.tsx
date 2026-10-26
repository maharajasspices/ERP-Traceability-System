// import React from 'react';
import React, { useEffect, useState } from 'react'
import { useFMSAuth } from '@/context/FMSAuthContext';
import { ModuleCard } from '@/components/dashboard/ModuleCard';
import { StatCard } from '@/components/dashboard/StatCard';
import { useFMSData } from '@/hooks/useFMSData';
import { useHRData } from '@/hooks/useHRData';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import logo from '@/assets/logo.png';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts'
import {
  Package,
  Truck,
  FileText,
  Factory,
  Send,
  Search,
  CheckCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Timer
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client'
const Dashboard: React.FC = () => {
 const [dashboardView, setDashboardView] = useState<'overview' | 'analytics'>('overview');
   const [pickleSoakingStages, setPickleSoakingStages] = useState<any[]>([]);
  const [soakingNow, setSoakingNow] = useState(() => new Date());

  const loadPickleSoakingStages = async () => {
  const { data, error } = await (supabase
    .from('fms_pickle_stages' as any)
    .select(`
      id,
      run_id,
      stock_code_id,
      status,
      is_soaking,
      soaking_start_at,
      min_ready_at,
      max_ready_at,
      min_ready_date,
      max_ready_date,
      container_id
    `)
    .eq('is_soaking', true)
    .in('status', ['SOAKING', 'READY_FOR_NEXT_STAGE'])
    .order('soaking_start_at', { ascending: true }) as any);

  if (error) {
    console.error('[Dashboard] pickle soaking stages:', error);
    return;
  }

  setPickleSoakingStages(data || []);
};
const loadBatchSheetsToday = async () => {
  const now = new Date();

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfDay);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const { count, error } = await supabase
    .from('fms_production_batches')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfDay.toISOString())
    .lt('created_at', startOfTomorrow.toISOString());

  if (error) {
    console.error('[Dashboard] Failed to load batch sheets today:', error);
    return;
  }

  setBatchSheetsToday(count ?? 0);
};


  const {fmsUser}  = useFMSAuth();

  const {
    stockCodes,
    receivingRecords,
    productionBatches,
    dispatchRecords,
    boms,
    suppliers,
    stockLevels,
    stockMovements,
    supplierOrderEmails,
    stockOrders,
    refreshData,
    loading
  } = useFMSData();

   
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const refreshDashboard = async () => {
      if (document.visibilityState !== 'visible') return;

      try {
        await refreshData();
        await loadPickleSoakingStages();
        await loadBatchSheetsToday();
      } catch (error) {
        console.error('[Dashboard] refresh failed:', error);
      }
    };

    const startPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
      }

      // Don't force a fresh fetch on mount: the shared cache (via
      // useFMSData) already serves the initial data. Only start the
      // polling timer so the first forced refresh and downstream queries
      // (pickle soaking stages, batch sheets) run 60s after the page is
      // visible, avoiding a redundant extra round trip on page load.
      intervalId = setInterval(() => {
        refreshDashboard();
      }, 60000);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    return () => {
      stopPolling();
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
    };
 }, []);

  const formatSoakingStatus = (stage: any) => {
    const minValue = stage.min_ready_at || stage.min_ready_date;
    const maxValue = stage.max_ready_at || stage.max_ready_date;
    if (!minValue || !maxValue) {
      return {
        label: 'Soaking',
        className: 'text-muted-foreground',
        readyToMove: false,
      };
    }

    const nowMs = soakingNow.getTime();
    const minMs = new Date(minValue).getTime();
    const maxMs = new Date(maxValue).getTime();

    if (nowMs >= maxMs) {
      const overdueHours = Math.floor(
        (nowMs - maxMs) / 3600000
      );

      return {
        label: `OVERDUE by ${overdueHours}h`,
        className: 'text-destructive',
        readyToMove: false,
      };
    }

    if (nowMs >= minMs) {
      // Soaking has reached minimum ready time — caregiver can move to next stage
      const remainingHours = Math.ceil(
        (maxMs - nowMs) / 3600000
      );

      return {
        label: `READY to move on to next stage`,
        className: 'text-success',
        readyToMove: true,
        subtext: `max ${Math.floor(remainingHours / 24)}d ${remainingHours % 24}h before max`,
      };
    }

    

    // Still soaking — show live countdown with seconds precision
    const remainingMs = minMs - nowMs;
    const totalSec = Math.ceil(remainingMs / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    let countdownLabel: string;
    if (days > 0) {
      countdownLabel = `${days}d ${hours}h ${minutes}m ${seconds}s remaining`;
    } else if (hours > 0) {
      countdownLabel = `${hours}h ${minutes}m ${seconds}s remaining`;
    } else {
      countdownLabel = `${minutes}m ${seconds}s remaining`;
    }
    
    return {
      label: countdownLabel,
      className: 'text-warning',
      readyToMove: false,
    };
  };

  const getSoakingStockCode = (stage: any) =>
    stockCodes.find(sc => sc.id === stage.stock_code_id);

  const [batchSheetsToday, setBatchSheetsToday] = useState(0);

  
  const stockMovementData = [
    {
      name:'Receipts',
      quantity: stockMovements
      .filter(m => m.movement_type === 'receipt')
      .reduce((total, m)=> total + Number (m.quantity_change || 0), 0),
    },
    {
    name: 'Batch Usage',
    quantity: stockMovements
      .filter(m => m.movement_type === 'batch_usage')
      .reduce((total, m) => total + Math.abs(Number(m.quantity_change || 0)), 0),
  },
  {
    name: 'Adjustments',
    quantity: stockMovements
    .filter(m => m.movement_type === 'adjustment')
    .reduce((total, m) => total + Math.abs(Number(m.quantity_change || 0)),0)
  },
 {
    name: 'Reservations',
    quantity: stockMovements
      .filter(m => m.movement_type === 'reservation')
      .reduce((total, m) => total + Math.abs(Number(m.quantity_change || 0)), 0),
  },
  {
    name: 'Released',
    quantity: stockMovements
      .filter(m => m.movement_type === 'reservation_release')
      .reduce((total, m) => total + Math.abs(Number(m.quantity_change || 0)), 0),
  },
];

//Stats strictly from supabase
const totalStockCodes = stockCodes.length
const activeStockCodes = stockCodes.filter( sc => sc.status === 'active').length;

const activeBOMs = boms.filter(b => b.status === 'active').length;

const activeBatches = productionBatches.filter(
  pb => pb.status === 'pre_weighing' || pb.status === 'manufacturing'
).length;

const todayDispatches = dispatchRecords.filter(dr => {
  const today = new Date().toDateString();
  return new Date(dr.dispatch_date).toDateString() === today;
}).length;

const totalReceiving = receivingRecords.length;

const approvedSuppliers = suppliers.filter(
  s => s.is_approved
).length;

//Expected receivings: pending supplier email orders + incomplete invoice orders
const pendingEmailOrders = supplierOrderEmails.filter(
  order => order.status === 'pending'
);

const openStockOrders = stockOrders.filter(
  order => order.status !== 'CHECKED'
);

const expectedReceivingsCount = pendingEmailOrders.length + openStockOrders.length;

// Live receiving stats (today / this month)
const today = new Date().toDateString();
const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

const receivedToday = receivingRecords.filter(
  r => r.status === 'accepted' && new Date(r.received_at).toDateString() === today
).length;

const receivedThisMonth = receivingRecords.filter(
  r => r.status === 'accepted' && new Date(r.received_at) >= startOfMonth
).length;

const declinedReceipts = receivingRecords.filter(r => r.status === 'declined').length;

//Low Stock calulations
// Low Stock Items
// Uses the same logic as Stock Tracking.

const lowStockItems = stockCodes
  .filter(sc => sc.status === 'active')
  .map(sc => {
    const level = stockLevels.find(
      item => item.stock_code_id === sc.id
    );

    const quantityOnHand = Number(level?.quantity_on_hand ?? 0);
    const reserved = Number(level?.reserved_quantity ?? 0);
    const threshold = Number(level?.low_stock_threshold ?? 0);
    const net = quantityOnHand - reserved;

    if (net > threshold) return null;

    return {
      stockCode: sc,
      quantity: quantityOnHand,
      reserved,
      threshold,
      net,
    };
  })
  .filter(item => item !== null)
  .sort((a, b) => a!.net - b!.net)
  .slice(0, 5);

//Active stock levels 
//keep the logic consisten wiht the stock tracking page 

// Active stock levels
// Keep this logic consistent with the Stock Tracking page.
// Every active stock code is included, even if it does not yet
// have a row in fms_stock_levels. Missing stock levels are treated as 0.

const activeStockLevels = stockCodes
  .filter(sc => sc.status === 'active')
  .map(sc => {
    const level = stockLevels.find(
      level => level.stock_code_id === sc.id
    );

    const quantityOnHand = Number(
      level?.quantity_on_hand ?? 0
    );

    const reservedQuantity = Number(
      level?.reserved_quantity ?? 0
    );

    const netStock =
      quantityOnHand - reservedQuantity;

    const lowStockThreshold = Number(
      level?.low_stock_threshold ?? 0
    );

    return {
      stockCode: sc,
      quantityOnHand,
      reservedQuantity,
      netStock,
      lowStockThreshold,
    };
  });

//Stock Health counts
const negativeStockTotalCount = activeStockLevels.filter(
  level => level.netStock < 0
).length;

const lowStockTotalCount = activeStockLevels.filter(
  level =>
    level.netStock >= 0 &&
    level.netStock <= level.lowStockThreshold
).length;

const healthyStockCount = activeStockLevels.filter(
  level =>
    level.netStock > level.lowStockThreshold
).length;

const stockHealthData = [
  {
    name:'Healthy',
    count: healthyStockCount
  },
  {
    name: 'Low Stock',
    count: lowStockTotalCount
  },
  {
    name: 'Negative',
    count: negativeStockTotalCount

  }
]



const receivingActivityData = [
  {
    name: 'Accepted',
    quantity: receivingRecords.filter(
      record => record.status === 'accepted'
    ).length,
  },
  {
    name: 'Pending',
    quantity: receivingRecords.filter(
      record => record.status === 'pending'
    ).length,
  },
  {
    name: 'Partial',
    quantity: receivingRecords.filter(
      record => record.status === 'partial'
    ).length,
  },
  {
    name: 'Declined',
    quantity: receivingRecords.filter(
      record => record.status === 'declined'
    ).length,
  },
  {
    // Orders awaiting receipt — not yet fms_receiving records, but expected
    // deliveries (pending email orders + incomplete invoice orders)
    name: 'Orders Awaiting',
    quantity: expectedReceivingsCount,
  },
];

// Production batches by current status (live from fms_production_batches)
const productionActivityData = [
  {
    name: 'Draft',
    count: productionBatches.filter(
      b => b.status === 'draft' || b.status === 'pre_weighing'
    ).length,
  },
  {
    name: 'In Progress',
    count: productionBatches.filter(
      b => b.status === 'manufacturing' || b.status === 'in_progress'
    ).length,
  },
  {
    name: 'Completed',
    count: productionBatches.filter(b => b.status === 'closed').length,
  },
  {
    name: 'Cancelled',
    count: productionBatches.filter(b => b.status === 'cancelled').length,
  },
];

//Display Counts
const lowStockCount = lowStockTotalCount

return (
  <div className="space-y-6 animate-fade-in">
      {/*Welcone Section*/}
      <div className="rounded-xl border border-[primary/20 bg-gradient-to-r from-primary/5 via background to -accent/5 p-4 md:p-6">
      
      <div className="flec flex-col sm:flex-rose sm:itmes-center gap-4">
        <img
        src={logo}
        alt="Maharaja's Spices"
        className="h-16 sm:h-12 w-auto max-w[140px]sm:max-w-[120px] object-contain shrink-0 mx-auto sm:mx-0"
        />

        <div className="text-center sm:text-left">
          <h2 className="text-2xl md:test-2xl font-bildfd text forground">
            Welcome {fmsUser ? `${fmsUser.name}` : ''}
          </h2>
          <p className=" mt-1 text-sm text=muted-forground">
            Complete traceability from raw materials to dispatch. Monitor your production flow in real time.
          </p>
        </div>

      </div>
      </div>
    {/*Dashboard View Switcher*/}

    <div className='flex justify-end'>
      <div className=' flex items-center rounded-lg border border-border bg-muted/30 p-1'>
      <Button type='button' variant={dashboardView === 'overview' ? 'default' : 'ghost'}
      size='sm'
      onClick={() => setDashboardView('overview')}
      className='gap-2'
      >
        <BarChart3 className='h-4 w-4'/>
        Overview
      </Button>
      <Button
      variant={dashboardView === 'analytics' ? 'default' : 'ghost'}
      size='sm'
      onClick={() => setDashboardView('analytics')}
      className='gap-2'
      >
        <TrendingUp className='h-4 w-4'/>
        Analytics
      </Button>
      </div>
    </div>
    {dashboardView === 'overview' && (
      <> 
    <div>
      <div className='mb-4'>
          <h3 className="text-lg font-semibold text-foreground">Key Performance Indicators</h3>
         <p className="text-sm text-muted-foreground mt-1">
          Real-time overview of your manufacturing operations
        </p>
      </div>
          
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Stock Codes"
          value={activeStockCodes}
          icon={Package}
          variant="primary"
        />

        <StatCard
          title="Receiving"
          value={totalReceiving}
          icon={Truck}
          variant="success"
        />

       <StatCard
          title='Batch Sheets Today'
          value={batchSheetsToday}
          icon={Factory}
          variant='warning'
       />

        <StatCard
          title="Dispatches Today"
          value={todayDispatches}
          icon={Send}
          variant="default"
        />

        <StatCard
          title="Pending Deliveries"
          value={expectedReceivingsCount}
          icon={Clock}
          variant="warning"
        />
      </div>

    </div>

       {/* Pickle Production — Active Soaking */}
    <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Pickle Production — Active Soaking
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Live soaking stages and expected ready times
          </p>
        </div>

        <Badge
          variant="outline"
          className={
            pickleSoakingStages.length > 0
              ? 'border-warning/40 text-warning'
              : 'border-success/40 text-success'
          }
        >
          {pickleSoakingStages.length > 0
            ? `${pickleSoakingStages.length} soaking`
            : 'No active soaking'}
        </Badge>
      </div>

      <Timer className="h-5 w-5 text-muted-foreground" />

      {pickleSoakingStages.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-4">
          <Timer className="h-5 w-5 text-muted-foreground" />
            <p>
              No pickle stages are currently soaking 
            </p>
            <p className="text-xs text-muted-foreground">
              Active soaking stages will appear here automatically.
            </p>
          </div>
      ) : (
        <div className="space-y-3">
          {pickleSoakingStages.map(stage => {
            const stockCode = getSoakingStockCode(stage);
            const soakingStatus = formatSoakingStatus(stage);

            return (
              <div
                key={stage.id}
                className="rounded-lg border border-border bg-muted/10 p-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">
                        {stockCode?.stock_code || 'Unknown stage'}
                      </p>

                      <Badge variant="outline" className={soakingStatus.readyToMove ? 'border-success text-success bg-success/10' : ''}>
                        {soakingStatus.readyToMove ? 'READY' : 'SOAKING'}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground mt-1">
                      {stockCode?.description || 'Pickle production stage'}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 mt-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">
                          Container:
                        </span>{' '}
                        <span className="font-medium text-foreground">
                          {stage.container_id || 'Not recorded'}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground">
                          Started:
                        </span>{' '}
                        <span className="font-medium text-foreground">
                          {stage.soaking_start_at
                            ? new Date(stage.soaking_start_at).toLocaleString('en-ZA')
                            : '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground">
                          Minimum ready:
                        </span>{' '}
                        <span className="font-medium text-foreground">
                          {stage.min_ready_at
                            ? new Date(stage.min_ready_at).toLocaleString('en-ZA')
                            : '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground">
                          Maximum ready:
                        </span>{' '}
                        <span className="font-medium text-foreground">
                          {stage.max_ready_at
                            ? new Date(stage.max_ready_at).toLocaleString('en-ZA')
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 lg:text-right">
                    <p className="text-xs text-muted-foreground mb-1">
                      Soaking status
                    </p>

                    <p className={`text-lg font-bold ${soakingStatus.className}`}>
                      {soakingStatus.label}
                    </p>

                    {soakingStatus.readyToMove && soakingStatus.subtext && (
                      <p className="text-xs text-success mt-1 font-medium">
                        {soakingStatus.subtext}
                      </p>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    {/* Expected Receivings / Pending Deliveries */}
    <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Stock Orders & Order Status</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Trach stock already ordered and monitor outstanding deliveries to prevent duplicate orders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {expectedReceivingsCount > 0 ? (
            <Badge className="bg-amber-500 text-white">{expectedReceivingsCount} pending</Badge>
          ) : (
            <Badge className="bg-green-600 text-white">All caught up</Badge>
          )}
          <Link to="/receiving">
            <Button variant="outline" size="sm" className="gap-2">
              <Truck className="h-4 w-4" />
              Go to Receiving
            </Button>
          </Link>
        </div>
      </div>

      {expectedReceivingsCount === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-3">
          <CheckCircle className="h-5 w-5 text-success" />
          <div>
            <p className="text-sm font-medium text-foreground">No pending deliveries</p>
            <p className="text-xs text-muted-foreground">All orders have been received and confirmed</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Invoice orders awaiting confirmation */}
          {openStockOrders.map(order => {
            const supplier = suppliers.find(s => s.id === order.supplier_id);
            const outstanding = order.items.filter(it => Number(it.quantity_received ?? 0) < Number(it.quantity_ordered));
            return (
              <div key={order.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <Clock className="h-5 w-5 text-warning shrink-0" />
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-medium text-foreground">
                    Invoice Order · {order.po_number}
                    {order.invoice_number ? ` · ${order.invoice_number}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {supplier?.name || 'Unknown supplier'} · {outstanding.length} of {order.items.length} line item(s) outstanding · Ordered {new Date(order.order_date).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <Badge variant="outline" className="text-warning border-warning/40">Awaiting receipt</Badge>
              </div>
            );
          })}

          {/* Supplier email orders still pending */}
          {pendingEmailOrders.map(emailOrder => {
            const supplier = suppliers.find(s => s.id === emailOrder.supplier_id);
            const stockCode = stockCodes.find(sc => sc.id === emailOrder.stock_code_id);
            return (
              <div key={emailOrder.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <Clock className="h-5 w-5 text-warning shrink-0" />
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-medium text-foreground">
                    {stockCode ? `${stockCode.stock_code} - ${stockCode.description}` : 'Material order'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {supplier?.name || 'Unknown supplier'} · {emailOrder.quantity} expected · Emailed {new Date(emailOrder.emailed_at).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <Badge variant="outline" className="text-warning border-warning/40">Expected</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>

  {/* Stock Summary */}
  <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-card">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
    <div>
      <h3 className="text-lg font-semibold text-foreground">
        Stock Summary
      </h3>
      <p className="text-sm text-muted-foreground mt-1">
        Current inventory health across active stock items
      </p>
    </div>

    <Link to="/stock-tracking">
      <Button variant="outline" size="sm" className="gap-2">
        <BarChart3 className="h-4 w-4" />
        View Stock
      </Button>
    </Link>
  </div>
  <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">

    {/* Healthy Stock */}
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Healthy Stock
          </p>
          <p className="text-2xl font-bold text-success mt-1">
            {healthyStockCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Above threshold
          </p>
        </div>

        <div className="rounded-lg bg-success/10 p-2.5">
          <CheckCircle className="h-5 w-5 text-success" />
        </div>
      </div>
    </div>

    {/* Low Stock */}
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Low Stock
          </p>
          <p className="text-2xl font-bold text-warning mt-1">
            {lowStockTotalCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            At or below threshold
          </p>
        </div>

        <div className="rounded-lg bg-warning/10 p-2.5">
          <AlertTriangle className="h-5 w-5 text-warning" />
        </div>
      </div>
    </div>

    {/* Negative Stock */}
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Negative Stock
          </p>
          <p className="text-2xl font-bold text-destructive mt-1">
            {negativeStockTotalCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Requires attention
          </p>
        </div>

        <div className="rounded-lg bg-destructive/10 p-2.5">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
      </div>
    </div>

    </div>
  </div>


      {/* Low Stock Preview */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-card animate-fade-in">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h3 className="text-lg font-semibold text-foreground">Low Stock</h3>
          </div>
          {lowStockTotalCount + negativeStockTotalCount > 0 ? (
            <Badge className="bg-amber-500 text-white">
              {lowStockTotalCount + negativeStockTotalCount} alert{lowStockTotalCount + negativeStockTotalCount > 1 ? 's' : ''}
            </Badge>
          ) : (
            <Badge className="bg-emerald-500 text-white">All healthy</Badge>
          )}
        </div>

        {lowStockItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No items are at or below their low stock threshold — stock levels look healthy.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {lowStockItems.map(item => {
                const isNegative = item.net < 0;
                return (
                  <div key={item.stockCode.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.stockCode.stock_code}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.stockCode.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${isNegative ? 'text-destructive' : 'text-warning'}`}>
                        {item.quantity.toFixed(2)} {item.stockCode.unit_of_measure}
                        {item.reserved > 0 && <span className="text-xs font-normal text-muted-foreground"> ({item.reserved.toFixed(2)} reserved)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isNegative ? 'NEGATIVE stock' : `Threshold: ${item.threshold.toFixed(2)}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <Link to="/stock-tracking" className="mt-4 inline-block">
              <Button variant="outline" size="sm" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Show More
              </Button>
            </Link>
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-foreground">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard 
            title="Stock Code Master" 
            description="Manage items, materials, and finished goods" 
            icon={Package} 
            href="/stock-codes" 
            stat={{ value: totalStockCodes, label: 'items' }} 
            accent="primary" 
          /> 
          <ModuleCard 
            title="Receiving Log" 
            description="Record inbound materials with quality checks" 
            icon={Truck} 
            href="/receiving" 
            stat={{ value: totalReceiving, label: 'records' }} 
            accent="success" 
          />
          <ModuleCard 
            title="Bill of Materials" 
            description="Product formulations and recipes" 
            icon={FileText} 
            href="/bom" 
            stat={{ value: activeBOMs, label: 'active' }}
            accent="accent" 
          />
          <ModuleCard 
            title="Batch Sheet" 
            description={`Batch sheets and quality control — ${batchSheetsToday} today of ${productionBatches.length} total`} 
            icon={Factory} 
            href="/batch-sheet" 
            stat={{ value: batchSheetsToday, label: 'today' }} 
            accent="warning" 
          />
          <ModuleCard 
            title="Stock Tracking" 
            description="Monitor stock levels and movements" 
            icon={BarChart3} 
            href="/stock-tracking" 
            stat={{ value: lowStockCount, label: 'low alerts' }} 
            accent="info" 
          />
          <ModuleCard 
            title="Dispatch" 
            description="Track outbound shipments" 
            icon={Send} 
            href="/dispatch" 
            stat={{ value: dispatchRecords.length, label: 'shipments' }} 
            accent="info" 
          />
          <ModuleCard 
            title="Traceability" 
            description="Forward and backward trace" 
            icon={Search} 
            href="/traceability" 
            accent="primary" 
          />
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h3 className="font-semibold text-foreground mb-4">System Status</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-3">
              <CheckCircle className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium text-foreground">Database Connected</p>
                <p className="text-xs text-muted-foreground">All systems operational</p>
              </div>
            </div>
             {activeBatches > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
                <Clock className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-sm font-medium text-foreground">{activeBatches} batch(es) in progress</p>
                  <p className="text-xs text-muted-foreground">Awaiting completion</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h3 className="font-semibold text-foreground mb-4">Your Role</h3>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground capitalize">{fmsUser?.role?.replace('_', ' ') || 'Production Operator'}</p>
              <p className="text-xs text-muted-foreground">Food Manufacturing Traceability System</p>
            </div>
          </div>
        </div>
      </div>
     </>
    )}
      
   
    {dashboardView === 'analytics' && (
  <div className="space-y-6">

    <div>
      <h2 className="text-xl font-semibold text-foreground">
        Manufacturing Analytics
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        Analyse stock, production, receiving and dispatch activity
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Live data from Supabase · updates automatically as records change
      </p>
    </div>

    {/* Live Stats */}
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Received Today</p>
            <p className="text-2xl font-bold text-primary mt-1">{receivedToday}</p>
            <p className="text-xs text-muted-foreground mt-1">{receivedThisMonth} this month</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Truck className="h-5 w-5 text-primary" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Stock Orders & Status </p>
            <p className="text-2xl font-bold text-warning mt-1">{expectedReceivingsCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Pending deliveries</p>
          </div>
          <div className="rounded-lg bg-warning/10 p-2.5">
            <Clock className="h-5 w-5 text-warning" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Batches in Progress</p>
            <p className="text-2xl font-bold text-primary mt-1">{activeBatches}</p>
            <p className="text-xs text-muted-foreground mt-1">{productionBatches.length} total</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Factory className="h-5 w-5 text-primary" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Dispatches Today</p>
            <p className="text-2xl font-bold text-primary mt-1">{todayDispatches}</p>
            <p className="text-xs text-muted-foreground mt-1">{dispatchRecords.length} total</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Send className="h-5 w-5 text-primary" />
          </div>
        </div>
      </div>
    </div>
 
    {/* Stock Health */}
    <div className="rounded-xl border border-border bg-card p-6 shadow-card">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-foreground">
          Stock Health
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Current health of active stock items
        </p>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={stockHealthData}
            margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />

            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
            />

            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12 }}
            />

            <Tooltip />

            <Bar
              dataKey="count"
              name="Stock Health"
              radius={[6, 6, 0, 0]} >
              {stockHealthData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.name === 'Healthy'
                      ? '#22c55e'
                      : entry.name === 'Low Stock'
                      ? '#f59e0b'
                      : entry.name === 'Negative'
                      ? '#ef4444'
                      : '#3b82f6'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* Stock Movement */}
    <div className="rounded-xl border border-border bg-card p-6 shadow-card">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-foreground">
          Stock Movement
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Stock activity recorded across the system
        </p>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={stockMovementData}
            margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />

            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
            />

            <YAxis
              tick={{ fontSize: 12 }}
            />

            <Tooltip />

          <Bar
            dataKey="quantity"
            name="Quantity"
            radius={[6, 6, 0, 0]}
            >
              {stockMovementData.map((entry, index) =>(
                <Cell
                key={`cell-${index}`}
                fill={
                  entry.name === 'Receipts'
                  ? '#3b82f6'
                  : entry.name === 'Batch Usage'
                  ? '#8b5cf6'
                  : entry.name === 'Adjustments'
                  ? '#f59e0b'
                  : entry.name === 'Reservations'
                  ? '#ef4444'
                  : '#22c55e'
                }
                />
              ))}

            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-foreground">
              Production Activity
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Production batches by current status
            </p>
          </div>

          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={productionActivityData}
                margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />

                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                />

                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />

                <Tooltip />

                <Bar
                  dataKey="count"
                  name="Production Activity"
                  radius={[6, 6, 0, 0]}>
                  {productionActivityData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.name === 'Draft'
                          ? '#f59e0b'
                          : entry.name === 'In Progress'
                          ? '#3b82f6'
                          : entry.name === 'Completed'
                          ? '#22c55e'
                          : entry.name === 'Cancelled'
                          ? '#ef4444'
                          : '#64748b'
                      }
                    />
                  ))}

                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

       {/* Receiving Activity */}
<div className="rounded-xl border border-border bg-card p-6 shadow-card">
  <div className="mb-5">
    <h3 className="text-lg font-semibold text-foreground">
      Receiving Activity
    </h3>
    <p className="text-sm text-muted-foreground mt-1">
      Receiving records by status, plus orders awaiting receipt
    </p>
  </div>

  <div className="h-[320px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={receivingActivityData}
        margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          opacity={0.3}
        />

        <XAxis
          dataKey="name"
          tick={{ fontSize: 12 }}
        />

        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12 }}
        />

        <Tooltip />

        <Bar
          dataKey="quantity"
          name="Receiving Activity"
          radius={[6, 6, 0, 0]}
        >
          {receivingActivityData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.name === 'Accepted'
                  ? '#3b82f6'
                  : entry.name === 'Pending'
                  ? '#f59e0b'
                  : entry.name === 'Partial'
                  ? '#8b5cf6'
                  : entry.name === 'Declined'
                  ? '#ef4444'
                  : entry.name === 'Orders Awaiting'
                  ? '#10b981'
                  : '#64748b'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
          </div>
      </div>
    </div>
  )}

  </div>

  );
};

export default Dashboard;
