
import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { cn } from '@/lib/utils';

import {
  LayoutDashboard,
  FileSpreadsheet,
  FlaskConical,
  Calculator,
  PackageSearch,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Menu,
  ArrowLeft,
  LogOut,
  BriefcaseBusiness,
  BookOpen,
} from 'lucide-react';

import logo from '@/assets/logo.png';

const navigation = [
  {
    title: 'Dashboard',
    path: '/bdm/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Retail Pricing',
    path: '/bdm/pricing',
    icon: FileSpreadsheet,
  },
  {
    title: 'Product Development ',
    path: '/bdm/product-development',
    icon: PackageSearch,
  },
  {
    title: 'Recipe Management',
    path: 'bdm/recipe-management',
    icon: BookOpen
  },
  {
    title: 'Development Documents',
    path: '/bdm-system/documents',
    icon: FolderOpen,
  },
];

const BDMLayout: React.FC = () => {
  const location = useLocation();
  const { fmsUser } = useFMSAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isRetailUser = fmsUser?.role === 'retail_user';

  const visibleNavigation = isRetailUser
    ? navigation.filter((item) =>
        ['Retail Pricing', 'Product Catalogue'].includes(item.title)
      )
    : navigation;

  const displayName = fmsUser?.name || 'Business Development User';

  const currentPage = navigation.find(
    (item) =>
      location.pathname === item.path ||
      (item.path !== '/bdm-system/dashboard' &&
        location.pathname.startsWith(item.path))
  );

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar">

      {/* Logo and Module Name */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
        <Link
          to={isRetailUser ? '/bdm-system/pricing' : '/bdm-system/dashboard'}
          className="flex items-center gap-3 overflow-hidden"
        >
          <img
            src={logo}
            alt="Maharaja's Spices"
            className="h-10 w-auto object-contain"
          />

          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-sidebar-foreground">
                Business Development
              </p>
              <p className="text-xs text-sidebar-foreground/60">
                Management System
              </p>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden rounded-md p-1 text-sidebar-foreground hover:bg-sidebar-accent lg:block"
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? (
            <ChevronRight size={18} />
          ) : (
            <ChevronLeft size={18} />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 overflow-y-auto p-3">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Workspace
        </p>

        {visibleNavigation.map((item) => {
          const Icon = item.icon;

          const isActive =
            location.pathname === item.path ||
            (item.path !== '/bdm-system/dashboard' &&
              location.pathname.startsWith(item.path));

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              title={sidebarCollapsed ? item.title : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground',
                sidebarCollapsed && 'justify-center px-2'
              )}
            >
              <Icon size={19} className="shrink-0" />

              {!sidebarCollapsed && (
                <span className="truncate">{item.title}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
      <div className="space-y-1 border-t border-sidebar-border p-3">
        <Link
          to="/"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent',
            sidebarCollapsed && 'justify-center px-2'
          )}
        >
          <ArrowLeft size={19} />
          {!sidebarCollapsed && <span>Back to ERP</span>}
        </Link>

        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent',
            sidebarCollapsed && 'justify-center px-2'
          )}
        >
          <LogOut size={19} />
          {!sidebarCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30">

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:flex',
          sidebarCollapsed ? 'w-20' : 'w-64'
        )}
      >
        <SidebarContent />

        <button
          type="button"
          onClick={() => setSidebarCollapsed((previous) => !previous)}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-colors hover:bg-muted"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight size={13} />
          ) : (
            <ChevronLeft size={13} />
          )}
        </button>
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />

          <aside className="absolute left-0 top-0 h-full w-72 bg-sidebar shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div
        className={cn(
          'min-h-screen transition-all duration-300',
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        )}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6">

          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
            >
              <Menu size={22} />
            </button>

            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {currentPage?.title || 'Business Development'}
              </h1>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Maharaja's Spices | Business Development
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-foreground">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmsUser?.role || 'BDM User'}
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BriefcaseBusiness size={18} />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="min-h-[calc(100vh-4rem)] overflow-x-hidden p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default BDMLayout;
