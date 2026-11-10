
import React from 'react';
import { Link } from 'react-router-dom';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import {
  FileSpreadsheet,
  FlaskConical,
  Calculator,
  PackageSearch,
  FolderOpen,
  ArrowRight,
  BriefcaseBusiness,
} from 'lucide-react';

const modules = [
  {
    title: 'Retail Pricing',
    description: 'Upload, manage and download approved retail price lists.',
    path: '/bdm-system/pricing',
    icon: FileSpreadsheet,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    title: 'Recipe Development',
    description: 'Create and manage recipes, ingredients and product formulations.',
    path: '/bdm-system/recipes',
    icon: FlaskConical,
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  {
    title: 'Product Costing',
    description: 'Calculate ingredient, packaging and production costs.',
    path: '/bdm-system/costing',
    icon: Calculator,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    title: 'New Product Development',
    description: 'Manage new product ideas, trials and development.',
    path: '/bdm-system/products',
    icon: PackageSearch,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    title: 'Development Documents',
    description: 'Access costing sheets, specifications, reports and supporting documents.',
    path: '/bdm-system/documents',
    icon: FolderOpen,
    color: 'text-pink-600',
    bg: 'bg-pink-50',
  },
];

const BDMDashboard: React.FC = () => {
  return (
    <div className="space-y-6">

      {/* Welcome */}
      <div className="rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white/20 p-3">
            <BriefcaseBusiness size={28} />
          </div>

          <div>
            <h2 className="text-2xl font-bold">
              Business Development Workspace
            </h2>

            <p className="mt-1 text-sm text-white/90">
              Manage retail pricing, product development, recipes and costing.
            </p>
          </div>
        </div>
      </div>

      {/* Section Heading */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          Your Workspace
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Select an area to get started.
        </p>
      </div>

      {/* Module Cards */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;

          return (
            <Link
              key={module.path}
              to={module.path}
              className="group"
            >
              <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className={`rounded-xl p-3 ${module.bg}`}>
                      <Icon className={`h-6 w-6 ${module.color}`} />
                    </div>

                    <ArrowRight className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </div>

                  <CardTitle className="mt-3 text-lg">
                    {module.title}
                  </CardTitle>

                  <CardDescription>
                    {module.description}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <span className="text-sm font-medium text-primary">
                    Open workspace →
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

    </div>
  );
};

export default BDMDashboard;
