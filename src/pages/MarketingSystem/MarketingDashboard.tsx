
import React, { useEffect, useState } from 'react';
import {
  FolderOpen,
  FolderPlus,
  FileText,
  Upload,
  Search,
  Plus,
  LayoutDashboard,
  Palette,
  Megaphone,
  Package,
  Clock,
  HardDrive,
  Loader2,
} from 'lucide-react';

import MarketingLayout from './MarketingLayout';
import { supabase } from '@/integrations/supabase/client';

const formatStorage = (bytes: number) => {
  if (bytes === 0) return '0 MB';

  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));

  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(2)} ${units[index]}`;
};

const MarketingDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  const [totalFiles, setTotalFiles] = useState(0);
  const [totalFolders, setTotalFolders] = useState(0);
  const [totalStorage, setTotalStorage] = useState(0);
  const [recentItems, setRecentItems] = useState<any[]>([]);

  const loadDashboard = async () => {
    setLoading(true);
    setDashboardError('');

    try {
      let allItems: any[] = [];
      let start = 0;
      const pageSize = 1000;

      // Fetch all records in batches so the dashboard
      // does not stop counting after Supabase's row limit.
      while (true) {
        const { data, error } = await (supabase as any)
          .from('fms_marketing_items')
          .select('id, name, item_type, file_size, mime_type, created_at')
          .order('created_at', { ascending: false })
          .range(start, start + pageSize - 1);

        if (error) throw error;

        const batch = data || [];
        allItems = [...allItems, ...batch];

        if (batch.length < pageSize) break;

        start += pageSize;
      }

      const files = allItems.filter(
        (item) => item.item_type === 'file'
      );

      const folders = allItems.filter(
        (item) => item.item_type === 'folder'
      );

      const storage = files.reduce(
        (total, file) => total + Number(file.file_size || 0),
        0
      );

      setTotalFiles(files.length);
      setTotalFolders(folders.length);
      setTotalStorage(storage);

      setRecentItems(allItems.slice(0, 5));

    } catch (error: any) {
      console.error('Marketing dashboard error:', error);
      setDashboardError(
        error.message || 'Could not load dashboard statistics.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const stats = [
    {
      title: 'Total Files',
      value: totalFiles.toLocaleString(),
      description: 'Uploaded marketing documents and media',
      icon: FileText,
    },
    {
      title: 'Folders',
      value: totalFolders.toLocaleString(),
      description: 'Organised marketing folders',
      icon: FolderOpen,
    },
    {
      title: 'Total Items',
      value: (totalFiles + totalFolders).toLocaleString(),
      description: 'All files and folders',
      icon: LayoutDashboard,
    },
    {
      title: 'Storage Used',
      value: formatStorage(totalStorage),
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
              onClick={loadDashboard}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Clock size={17} />
              )}
              Refresh Statistics
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
                  {loading ? '...' : stat.value}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </div>
            );
          })}
        </section>

        {dashboardError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {dashboardError}
          </div>
        )}

        {/* Marketing Categories */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">
              Marketing Categories
            </h2>

            <p className="text-sm text-muted-foreground">
              Suggested ways to organise your marketing materials.
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
              File Library Overview
            </h2>

            <p className="text-sm text-muted-foreground">
              Current contents of your Marketing library.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-muted/50 p-4">
              <FileText className="mb-2 h-5 w-5 text-primary" />
              <p className="text-2xl font-bold">
                {loading ? '...' : totalFiles}
              </p>
              <p className="text-sm text-muted-foreground">
                Uploaded Files
              </p>
            </div>

            <div className="rounded-lg bg-muted/50 p-4">
              <FolderOpen className="mb-2 h-5 w-5 text-primary" />
              <p className="text-2xl font-bold">
                {loading ? '...' : totalFolders}
              </p>
              <p className="text-sm text-muted-foreground">
                Total Folders
              </p>
            </div>

            <div className="rounded-lg bg-muted/50 p-4">
              <HardDrive className="mb-2 h-5 w-5 text-primary" />
              <p className="text-2xl font-bold">
                {loading ? '...' : formatStorage(totalStorage)}
              </p>
              <p className="text-sm text-muted-foreground">
                Storage Occupied
              </p>
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />

            <h2 className="font-semibold">
              Recently Added
            </h2>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Loading recent activity...
            </p>
          ) : recentItems.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No files or folders have been added yet.
            </p>
          ) : (
            <div className="mt-4 divide-y">
              {recentItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {item.item_type === 'folder' ? (
                      <FolderOpen className="h-5 w-5 shrink-0 text-amber-600" />
                    ) : (
                      <FileText className="h-5 w-5 shrink-0 text-blue-600" />
                    )}

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.name}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {item.item_type === 'folder'
                          ? 'Folder'
                          : item.mime_type || 'Document'}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString()
                        : ''}
                    </p>

                    {item.item_type === 'file' && (
                      <p className="text-xs text-muted-foreground">
                        {formatStorage(Number(item.file_size || 0))}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </MarketingLayout>
  );
};

export default MarketingDashboard;
