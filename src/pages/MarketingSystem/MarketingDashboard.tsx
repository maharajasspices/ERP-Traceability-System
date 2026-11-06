
import React from 'react';
import {
  FolderOpen,
  FolderPlus,
  FileText,
  Image,
  Upload,
  Search,
  Plus,
  LayoutDashboard,
  Palette,
  Megaphone,
  Package,
  Clock,
  HardDrive,
} from 'lucide-react';

import MarketingLayout from './MarketingLayout';

const MarketingDashboard: React.FC = () => {
  const stats = [
    {
      title: 'Total Files',
      value: '0',
      description: 'Marketing documents and media',
      icon: FileText,
    },
    {
      title: 'Folders',
      value: '0',
      description: 'Organised marketing folders',
      icon: FolderOpen,
    },
    {
      title: 'Categories',
      value: '0',
      description: 'Marketing content categories',
      icon: LayoutDashboard,
    },
    {
      title: 'Storage Used',
      value: '0 MB',
      description: 'Total uploaded file size',
      icon: HardDrive,
    },
  ];

  const categories = [
    {
      name: 'Product Images',
      description: 'Product photographs and product artwork',
      icon: Package,
    },
    {
      name: 'Social Media',
      description: 'Posts, stories, reels and campaigns',
      icon: Megaphone,
    },
    {
      name: 'Branding',
      description: 'Logos, brand guidelines and designs',
      icon: Palette,
    },
    {
      name: 'Marketing Documents',
      description: 'PDFs, presentations and reports',
      icon: FileText,
    },
  ];

  return (
    <MarketingLayout>
      <div className="mx-auto max-w-7xl space-y-8">

        {/* Dashboard Heading */}
        <section className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <LayoutDashboard size={16} />
              <span>Marketing System / Dashboard</span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight">
              Marketing Dashboard
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Your central marketing document and media library.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              disabled
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm opacity-50"
              title="Available after database integration"
            >
              <FolderPlus size={17} />
              New Folder
            </button>

            <button
              disabled
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground opacity-50"
              title="Available after database integration"
            >
              <Upload size={17} />
              Upload Files
            </button>
          </div>
        </section>

        {/* Statistics */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.title}
                className="rounded-xl border bg-card p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {stat.title}
                  </p>

                  <Icon className="h-5 w-5 text-primary" />
                </div>

                <p className="mt-3 text-3xl font-bold">
                  {stat.value}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </div>
            );
          })}
        </section>

        {/* Marketing Categories */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">
              Marketing Categories
            </h2>

            <p className="text-sm text-muted-foreground">
              Organise your marketing materials by category.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => {
              const Icon = category.icon;

              return (
                <div
                  key={category.name}
                  className="rounded-xl border bg-card p-5 transition-colors hover:border-primary/40"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>

                  <h3 className="font-semibold">
                    {category.name}
                  </h3>

                  <p className="mt-2 text-sm text-muted-foreground">
                    {category.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* File Library */}
        <section className="rounded-xl border bg-card p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">
              File Library
            </h2>

            <p className="text-sm text-muted-foreground">
              Browse and manage your marketing files and folders.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-lg border px-3">
              <Search className="h-4 w-4 text-muted-foreground" />

              <input
                type="search"
                placeholder="Search files and folders..."
                disabled
                className="w-full bg-transparent py-3 text-sm outline-none"
              />
            </div>

            <button
              disabled
              className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm opacity-50"
            >
              <Plus size={17} />
              Add Category
            </button>
          </div>

          <div className="flex min-h-52 flex-col items-center justify-center text-center">
            <FolderOpen className="mb-3 h-12 w-12 text-muted-foreground" />

            <h3 className="font-medium">
              Your Marketing Library is Ready
            </h3>

            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Your folders, categories and uploaded files will appear here
              once database and storage integration is complete.
            </p>
          </div>
        </section>

        {/* Recent Activity */}
        <section className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />

            <h2 className="font-semibold">
              Recent Activity
            </h2>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            No marketing activity recorded yet.
          </p>
        </section>

      </div>
    </MarketingLayout>
  );
};

export default MarketingDashboard;
