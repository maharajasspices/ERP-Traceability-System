import React, { useState } from 'react';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, AlertTriangle, CheckCircle2, Clock, Download, Target } from 'lucide-react';

interface QualityCheck {
  id: string;
  check_name: string;
  status: 'pass' | 'fail' | 'pending' | 'skipped';
  checked_by: string | null;
  checked_at: string | null;
  notes?: string;
  created_at: string;
}

interface QualityTrend {
  date: string;
  total: number;
  passed: number;
  failed: number;
}

const QualityDashboard: React.FC = () => {
  const { fmsUser, hasRole, loading } = useFMSAuth();
  const [stats, setStats] = useState({ totalChecks: 0, passed: 0, failed: 0, pending: 0, thisWeek: 0 });
  const [recentChecks, setRecentChecks] = useState<QualityCheck[]>([]);
  const [trend, setTrend] = useState<QualityTrend[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  React.useEffect(() => {
    const fetchQualityData = async () => {
      try {
        const { data: checksData, error: checksError } = await supabase
          .from('fms_quality_checks')
          .select('*')
          .order('checked_at', { ascending: false })
          .limit(10);

        if (!checksError && checksData) {
          setRecentChecks(checksData as QualityCheck[]);
          const pending = checksData.filter((c: any) => c.status === 'pending').length;
          const failed = checksData.filter((c: any) => c.status === 'fail').length;
          const thisWeek = checksData.filter((c: any) => {
            const date = new Date(c.checked_at || c.created_at);
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return date >= weekAgo;
          }).length;

          setStats({ totalChecks: checksData.length, passed: checksData.filter((c: any) => c.status === 'pass').length, failed, pending, thisWeek });
        }

        const { data: trendData, error: trendError } = await supabase
          .from('fms_quality_checks')
          .select('checked_at, status')
          .gte('checked_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('checked_at');

        if (!trendError && trendData) {
          const trendMap = new Map<string, { total: number; passed: number; failed: number }>();
          (trendData as any[]).forEach((row: any) => {
            const date = row.checked_at ? new Date(row.checked_at).toLocaleDateString('en-GB', { weekday: 'short' }) : 'Unknown';
            if (!trendMap.has(date)) trendMap.set(date, { total: 0, passed: 0, failed: 0 });
            const entry = trendMap.get(date)!;
            entry.total++;
            if (row.status === 'pass') entry.passed++;
            if (row.status === 'fail') entry.failed++;
          });
          setTrend(Array.from(trendMap.entries()).map(([date, values]) => ({ date, ...values })));
        }
      } catch (err) {
        console.error('Error fetching quality data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    fetchQualityData();
  }, []);

  if (loading || loadingData) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading quality dashboard...</p>
        </div>
      </div>
    );
  }

  const statsCards = [
    { title: 'Total Checks', value: stats.totalChecks, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Passed', value: stats.passed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Failed', value: stats.failed, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { title: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { title: 'This Week', value: stats.thisWeek, icon: Clock, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  const recentChecksTable = recentChecks.map((check) => (
    <tr key={check.id}>
      <td className="text-sm font-medium">{check.check_name}</td>
      <td className="text-sm">
        <Badge variant={check.status === 'pass' ? 'default' : check.status === 'fail' ? 'destructive' : 'outline'}>
          {check.status}
        </Badge>
      </td>
      <td className="text-sm text-muted-foreground">{check.checked_by ?? 'Not assigned'}</td>
      <td className="text-sm text-muted-foreground">{check.checked_at ? new Date(check.checked_at).toLocaleDateString() : '—'}</td>
    </tr>
  ));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quality System</h1>
        <p className="text-muted-foreground">Track quality checks, monitor inspection results, and review product quality trends</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {statsCards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-bold">{card.value}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quality Trend (Last 7 Days)</CardTitle>
            <CardDescription>Daily check completion and pass/fail ratio</CardDescription>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No quality trend data yet</p>
            ) : (
              <div className="space-y-2">
                {trend.map((t) => (
                  <div key={t.date} className="flex items-center gap-4">
                    <span className="w-20 text-xs text-muted-foreground">{t.date}</span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 h-6">
                        <div className="flex-1 h-2 rounded-full bg-primary/20">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${t.total > 0 ? Math.round((t.passed / t.total) * 100) : 0}%` }} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Passed: {t.passed}/{t.total} ({t.total > 0 ? Math.round((t.passed / t.total) * 100) : 0}%)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Quality Checks</CardTitle>
            <CardDescription>Latest quality inspection results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Check Name</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Checked By</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentChecksTable}
                  {recentChecks.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-muted-foreground">
                        No quality checks recorded yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Export Quality Report
            </Button>
            <Button variant="outline">
              <Target className="mr-2 h-4 w-4" />
              Schedule New Check
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QualityDashboard;