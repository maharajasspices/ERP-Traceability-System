
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  AlertTriangle,
  ClipboardList,
  ShieldCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  FileText,
  ArrowUpRight,
  FolderOpen,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const stats = [
  {
    title: 'Total Inspections',
    value: '0',
    description: 'Inspections recorded',
    icon: ClipboardCheck,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
  },
  {
    title: 'Open Non-Conformances',
    value: '0',
    description: 'Issues requiring attention',
    icon: AlertTriangle,
    color: 'text-red-600',
    bg: 'bg-red-100',
  },
  {
    title: 'Pending Actions',
    value: '0',
    description: 'Corrective actions outstanding',
    icon: ClipboardList,
    color: 'text-orange-600',
    bg: 'bg-orange-100',
  },
  {
    title: 'Completed Audits',
    value: '0',
    description: 'Audits completed',
    icon: ShieldCheck,
    color: 'text-green-600',
    bg: 'bg-green-100',
  },
];

const ncrDocuments = [
  {
    title: 'Control of Non-Conformance Procedure',
    documentNumber: 'MSNQ2-SOP-1',
    description:
      'Procedure for identifying, reporting, investigating and controlling non-conforming products and materials.',
    type: 'Procedure',
  },
  {
    title: 'Non-Conformance Record Form',
    documentNumber: 'MSRQ2-FRM-1',
    description:
      'Capture non-conformance details, investigation findings, criticality and corrective measures.',
    type: 'Form',
  },
  {
    title: 'Quarantine Tag',
    documentNumber: 'MSRQ2-FRM-2',
    description:
      'Identify and label non-conforming products or materials placed in quarantine.',
    type: 'Form',
  },
  {
    title: 'Concession Record',
    documentNumber: 'MSRQ2-FRM-3',
    description:
      'Record and authorise the use or sale of non-conforming products under an approved concession.',
    type: 'Form',
  },
  {
    title: 'Non-Conformance Report Logbook',
    documentNumber: 'MSRQ2-LOG-1',
    description:
      'View and track reported non-conformances and their progress towards closure.',
    type: 'Register',
  },
  {
    title: 'Quarantine Register',
    documentNumber: 'MSRQ2-LOG-2',
    description:
      'Track quarantined products and materials, including their identification and final disposition.',
    type: 'Register',
  },
];

const QualityDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">

      {/* Welcome Section */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Quality Management Overview
          </h2>
          <p className="text-muted-foreground">
            Monitor inspections, quality issues, corrective actions and audits.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            View Reports
          </Button>
          <Button>
            <ClipboardCheck className="mr-2 h-4 w-4" />
            New Inspection
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="flex items-center justify-between p-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </p>
                <div className="text-3xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </div>

              <div className={`rounded-xl p-3 ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* NCR Forms and Registers */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <FolderOpen className="h-6 w-6 text-amber-600" />
              </div>

              <div>
                <CardTitle>NCR Forms & Registers</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Non-conformance procedures, forms and registers.
                </p>
              </div>
            </div>

            <Badge variant="secondary">
              {ncrDocuments.length} Documents
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ncrDocuments.map((document) => (
              <div
                key={document.documentNumber}
                className="flex flex-col justify-between rounded-lg border p-4 transition-colors hover:border-primary/50 hover:bg-muted/30"
              >
                <div>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <FileText className="h-6 w-6 shrink-0 text-primary" />
                    <Badge variant="outline">{document.type}</Badge>
                  </div>

                  <h3 className="font-semibold leading-snug">
                    {document.title}
                  </h3>

                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {document.documentNumber}
                  </p>

                  <p className="mt-3 text-sm text-muted-foreground">
                    {document.description}
                  </p>
                </div>

                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() =>
                    navigate(
                      `/quality-system/documents/${encodeURIComponent(
                        document.documentNumber
                      )}`
                    )
                  }
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Open Document
                  <ArrowUpRight className="ml-auto h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Dashboard Sections */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Quality Performance */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Quality Performance</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Overview of quality activities
              </p>
            </div>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  Inspection Pass Rate
                </p>
                <p className="mt-2 text-2xl font-bold">0%</p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  Issues Resolved
                </p>
                <p className="mt-2 text-2xl font-bold">0</p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  Audit Compliance
                </p>
                <p className="mt-2 text-2xl font-bold">0%</p>
              </div>
            </div>

            <div className="mt-6 flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
              <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium">
                Quality performance data will appear here
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Records will populate this section as quality activities are captured.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Quality Overview</CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm">Completed</span>
              </div>
              <span className="font-semibold">0</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-orange-500" />
                <span className="text-sm">Pending</span>
              </div>
              <span className="font-semibold">0</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="text-sm">Requires Attention</span>
              </div>
              <span className="font-semibold">0</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Quality Activity</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Latest inspections, issues and corrective actions
            </p>
          </div>
          <Badge variant="outline">Live Activity</Badge>
        </CardHeader>

        <CardContent>
          <div className="flex min-h-[140px] flex-col items-center justify-center text-center">
            <FileText className="mb-3 h-9 w-9 text-muted-foreground/50" />
            <p className="font-medium">No quality activity recorded yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              New records will appear here.
            </p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default QualityDashboard;
