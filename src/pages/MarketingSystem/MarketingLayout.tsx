
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link, useLocation } from 'react-router-dom';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';


import {
  LayoutDashboard,
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  ArrowLeft,
  LogOut,
  Megaphone,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';

interface MarketingLayoutProps {
  children: React.ReactNode;
}



interface SidebarContentProps {
  collapsed: boolean;
  onItemClick?: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({
  collapsed,
  onItemClick,
}) => {
  const location = useLocation();
  const { fmsUser, signOut } = useFMSAuth();

  const [workspaceExpanded, setWorkspaceExpanded] = useState(true);

const [workspaceFolders, setWorkspaceFolders] = useState<
  { id: string; name: string }[]
>([]);

const displayName =
  fmsUser?.name ||
  fmsUser?.email ||
  'Marketing User';

useEffect(() => {
  const loadWorkspaceFolders = async () => {
    const { data, error } = await supabase
      .from('fms_marketing_items')
      .select('id, name')
      .eq('item_type', 'folder')
      .is('parent_id', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading sidebar folders:', error);
      return;
    }

    setWorkspaceFolders(
      data?.map((folder) => ({
        id: folder.id,
        name: folder.name,
      })) || []
    );
  };

  loadWorkspaceFolders();

  window.addEventListener(
    'marketing-folders-updated',
    loadWorkspaceFolders
  );

  return () => {
    window.removeEventListener(
      'marketing-folders-updated',
      loadWorkspaceFolders
    );
  };
}, []);
  

 const folderLink = (folderId: string) =>
  `/marketing-system/folder/${folderId}`;

const dashboardActive =
  location.pathname === '/marketing-system/dashboard';

const workspaceActive =
  location.pathname === '/marketing-system/folders';

  return (
    <div className="flex h-full flex-col">

      {/* Logo */}
      <div
        className={cn(
          'flex items-center gap-3 border-b border-sidebar-border px-4 py-4',
          collapsed && 'justify-center px-2'
        )}
      >
        <img
          src={logo}
          alt="Maharaja's Spices"
          className="h-10 w-10 object-contain"
        />

        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold text-sidebar-foreground">
              Marketing System
            </span>
            <span className="text-xs text-sidebar-foreground/60">
              Maharaja's Spices
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 overflow-y-auto p-3">

        {!collapsed && (
          <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Marketing Workspace
          </div>
        )}

        {/* Dashboard */}
        <Link
          to="/marketing-system/dashboard"
          onClick={onItemClick}
          title={collapsed ? 'Dashboard' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            dashboardActive
              ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
              : 'text-sidebar-foreground',
            collapsed && 'justify-center px-2'
          )}
        >
          <LayoutDashboard className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Dashboard</span>}
        </Link>

        {/* Main Workspace */}
        <div>
          <div className="flex items-center gap-1">

            <Link
              to="/marketing-system/dashboard"
              onClick={onItemClick}
              title={collapsed ? "Maharaja's Workspace" : undefined}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                workspaceActive
                  ? 'bg-sidebar-primary/10 text-sidebar-primary'
                  : 'text-sidebar-foreground',
                collapsed && 'justify-center px-2'
              )}
            >
              <FolderOpen className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <span className="truncate">Maharaja's Workspace</span>
              )}
            </Link>

            {!collapsed && (
              <button
                type="button"
                onClick={() =>
                  setWorkspaceExpanded((previous) => !previous)
                }
                className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent"
                aria-label="Toggle workspace folders"
              >
                {workspaceExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          {/* Workspace Folders */}
          {!collapsed && workspaceExpanded && (
            <div className="ml-5 mt-2 space-y-1 border-l border-sidebar-border pl-3">

            {workspaceFolders.map((folder) => {
              const isActive =
                location.pathname === `/marketing-system/folder/${folder.id}`;

                return (
                  <Link
                    key={folder.id}
                    to={folderLink(folder.id)}
                    onClick={onItemClick}
                    className={cn(
                      'flex items-start gap-2 rounded-md px-3 py-2 text-xs transition-colors',
                      'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground/70'
                    )}
                  >
                    <Folder className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{folder.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Create folders */}
        <Link
          to="/marketing-system/folders"
          onClick={onItemClick}
          title={collapsed ? 'Manage folders' : undefined}
          className={cn(
            'mt-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent',
            collapsed && 'justify-center px-2'
          )}
        >
          <FolderPlus className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Manage Folders</span>}
        </Link>

      </nav>

      {/* Bottom Navigation */}
      <div className="space-y-1 border-t border-sidebar-border p-3">

        <Link
          to="/"
          onClick={onItemClick}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent',
            collapsed && 'justify-center px-2'
          )}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Back to Portal</span>}
        </Link>

        <button
          type="button"
          onClick={() => signOut()}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-destructive/20 hover:text-destructive',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>

      </div>

      {/* User Profile */}
      {!collapsed && (
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium text-sidebar-accent-foreground">
              {displayName.substring(0, 2).toUpperCase()}
            </div>

            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {displayName}
              </span>
              <span className="text-xs text-sidebar-foreground/60">
                Marketing Department
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const MarketingLayout: React.FC<MarketingLayoutProps> = ({
  children,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/30">

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:flex',
          collapsed ? 'w-[80px]' : 'w-[280px]'
        )}
      >
        <SidebarContent collapsed={collapsed} />

        <button
          type="button"
          onClick={() => setCollapsed((previous) => !previous)}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-colors hover:bg-muted"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
      </aside>

      {/* Main Content */}
      <div
        className={cn(
          'min-h-screen transition-all duration-300',
          collapsed ? 'lg:ml-[80px]' : 'lg:ml-[280px]'
        )}
      >

        {/* Desktop Header */}
        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur lg:flex">

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>

            <div>
              <h2 className="text-sm font-semibold">
                Marketing Department
              </h2>
              <p className="text-xs text-muted-foreground">
                Maharaja's Marketing Workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>ERP System</span>
            <ChevronRight size={13} />
            <span className="font-medium text-foreground">
              Marketing
            </span>
          </div>

        </header>

        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:hidden">

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open Marketing menu</span>
              </Button>
            </SheetTrigger>

            <SheetContent
              side="left"
              className="w-[280px] bg-sidebar p-0"
            >
              <SidebarContent
                collapsed={false}
                onItemClick={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Megaphone className="h-4 w-4 text-primary" />
            </div>

            <div className="flex flex-col">
              <span className="text-sm font-bold">
                MAHARAJA'S
              </span>
              <span className="text-xs text-muted-foreground">
                Marketing System
              </span>
            </div>
          </div>

        </header>

        {/* Page Content */}
        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-5 md:p-7 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
};

export default MarketingLayout;
