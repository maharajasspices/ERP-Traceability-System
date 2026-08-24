import React from 'react';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { ModuleCard } from '@/components/dashboard/ModuleCard';
import { StatCard } from '@/components/dashboard/StatCard';
import { Package, Truck, FileText, Factory, Send, Search, CheckCircle, Clock, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import { useFMSData } from '@/hooks/useFMSData';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.png';

const Dashboard: React.FC = () => {
  const { fmsUser } = useFMSAuth();
  const { stockCodes, receivingRecords, productionBatches, dispatchRecords, boms, suppliers, stockLevels, loading } = useFMSData();
  // Stats strictly from Supabase (no demo/master fallbacks)
  const totalStockCodes = stockCodes.length;
  const activeStockCodes = stockCodes.filter(sc => sc.status === 'active').length;
  const activeBOMs = boms.filter(b => b.status === 'active').length;
  const activeBatches = productionBatches.filter(pb => pb.status !== 'closed').length;
  const todayDispatches = dispatchRecords.filter(dr => {
    const today = new Date().toDateString();
    return new Date(dr.dispatch_date).toDateString() === today;
  }).length;
  const totalReceiving = receivingRecords.length;
  const approvedSuppliers = suppliers.filter(s => s.is_approved).length;

  // Low stock calculations
  const lowStockItems = stockLevels
    .map(level => {
      const sc = stockCodes.find(c => c.id === level.stock_code_id);
      if (!sc || sc.status !== 'active') return null;
      const isLow = level.quantity_on_hand < 0 || level.quantity_on_hand <= level.low_stock_threshold;
      if (!isLow) return null;
      return { stockCode: sc, level };
    })
    .filter((item): item is { stockCode: typeof stockCodes[0]; level: typeof stockLevels[0] } => item !== null)
    .sort((a, b) => a.level.quantity_on_hand - b.level.quantity_on_hand)
    .slice(0, 5);

  const negativeStockCount = stockLevels.filter(l => l.quantity_on_hand < 0).length;
  const lowStockCount = lowStockItems.length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Section */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-background to-accent/5 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <img src={logo} alt="Maharaja's Spices" className="h-16 sm:h-12 w-auto max-w-[140px] sm:max-w-[120px] object-contain shrink-0 mx-auto sm:mx-0" />
          <div className="text-center sm:text-left">
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              Welcome{fmsUser ? `, ${fmsUser.name}` : ''}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete traceability from raw materials to dispatch. Monitor your production flow in real-time.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Stock Codes" value={activeStockCodes} icon={Package} variant="primary" />
        <StatCard title="Receiving" value={totalReceiving} icon={Truck} variant="success" />
        <StatCard title="Active Batches" value={activeBatches} icon={Factory} variant="warning" />
        <StatCard title="Dispatches Today" value={todayDispatches} icon={Send} variant="default" />
      </div>

      {/* Low Stock Alerts */}
      {lowStockCount > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 animate-fade-in">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-warning">
                  {negativeStockCount > 0 
                    ? `${negativeStockCount} item(s) in NEGATIVE stock, ${lowStockCount} low stock alert(s)`
                    : `${lowStockCount} low stock alert(s)`}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {negativeStockCount > 0 
                    ? 'Some materials have been used more than received. Please reorder immediately.'
                    : 'Some materials are at or below their low stock threshold. Consider reordering.'}
                </p>
                <div className="mt-3 space-y-2">
                  {lowStockItems.map(item => (
                    <div key={item.stockCode.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{item.stockCode.stock_code}</p>
                        <p className="text-xs text-muted-foreground">{item.stockCode.description}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${item.level.quantity_on_hand < 0 ? 'text-destructive' : 'text-warning'}`}>
                          {item.level.quantity_on_hand.toFixed(2)} {item.stockCode.unit_of_measure}
                        </p>
                        <p className="text-xs text-muted-foreground">Threshold: {item.level.low_stock_threshold}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Link to="/stock-tracking" className="shrink-0">
              <Button variant="outline" size="sm" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                View Stock
              </Button>
            </Link>
          </div>
        </div>
      )}

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
            description="Batch sheets and quality control" 
            icon={Factory} 
            href="/batch-sheet" 
            stat={{ value: productionBatches.length, label: 'batches' }} 
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
            {(activeBatches > 0 || productionBatches.length > 0) && (
              <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
                <Clock className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-sm font-medium text-foreground">{activeBatches || productionBatches.length} batch(es) in progress</p>
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
    </div>
  );
};

export default Dashboard;
