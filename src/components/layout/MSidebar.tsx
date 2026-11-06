
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';

import {
  LayoutDashboard,
  FolderOpen,
  FolderPlus,
  Image,
  FileText,
  Megaphone,
  Palette,
  Share2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  ArrowLeft,
  LogOut,
  Upload,
  Tags,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  description?: string;
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/marketing-dashboard',
    icon: LayoutDashboard,
    description: 'Marketing overview',
  },
  {
    title: 'All Files',
    href: '/marketing/files',
    icon: FolderOpen,
    description: 'Browse marketing files',
  },
  {
    title: 'Categories',
    href: '/marketing/categories',
    icon: Tags,
    description: 'Manage file categories',
  },
  {
    title: 'Folders',
    href: '/marketing/folders',
    icon: FolderPlus,
    description: 'Organise folders',
  },
  {
    title: 'Images',
    href: '/marketing/images',
    icon: Image,
    description: 'Marketing images',
  },
  {
    title: 'Documents',
    href: '/marketing/documents',
    icon: FileText,
    description: 'PDFs and documents',
  },
  {
    title: 'Social Media',
    href: '/marketing/social-media',
    icon: Share2,
    description: 'Social media content',
  },
  {
    title: 'Campaigns',
    href: '/marketing/campaigns',
    icon: Megaphone,
    description: 'Marketing campaigns',
  },
  {
    title: 'Branding',
    href: '/marketing/branding',
    icon: Palette,
    description: 'Brand assets and designs',
  },
  {
    title: 'Upload Files',
    href: '/marketing/upload',
    icon: Upload,
    description: 'Add new files',
  },
];

const secondaryNavItems: NavItem[] = [
  {
    title: 'Settings',
    href: '/marketing/settings',
    icon: Settings,
    description: 'Marketing configuration',
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const SidebarContent: React.FC<{
  collapsed: boolean;
  onItemClick?: () => void;
}> = ({ collapsed, onItemClick }) => {
  const location = useLocation();
  const { fmsUser, signOut } = useFMSAuth();

  const isActive = (href: string) =>
    location.pathname === href ||
    (href !== '/marketing-dashboard' &&
      location.pathname.startsWith(href + '/'));

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
          alt="Maharaja's Logo"
          className="h-10 w-10 object-contain"
        />

        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold text-sidebar-foreground">
              Marketing
            </span>
            <span className="text-xs text-sidebar-foreground/60">
              Digital Library System
            </span>
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">

        <div
          className={cn(
            'mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50',
            collapsed && 'sr-only'
          )}
        >
          Main Menu
        </div>

        {navItems.map((item) => {
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onItemClick}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.title : undefined}
            >
              <item.icon
                className={cn(
                  'h-5 w-5 shrink-0',
                  active && 'text-sidebar-primary-foreground'
                )}
              />

              {!collapsed && (
                <div className="flex flex-col">
                  <span>{item.title}</span>

                  {item.description && (
                    <span
                      className={cn(
                        'text-xs',
                        active
                          ? 'text-sidebar-primary-foreground/70'
                          : 'text-sidebar-foreground/50'
                      )}
                    >
                      {item.description}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}

        {/* Secondary Navigation */}
        <div
          className={cn(
            'mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50',
            collapsed && 'sr-only'
          )}
        >
          Settings
        </div>

        {secondaryNavItems.map((item) => {
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onItemClick}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.title : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Portal and Sign Out */}
      <div className="space-y-1 border-t border-sidebar-border p-3">

        <Link
          to="/"
          onClick={onItemClick}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Back to Portal' : undefined}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Back to Portal</span>}
        </Link>

        <button
          onClick={() => {
            onItemClick?.();
            signOut();
          }}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-destructive/20 hover:text-destructive',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* User Information */}
      {!collapsed && (
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium text-sidebar-accent-foreground">
              {(fmsUser?.name || 'Marketing User')
                .substring(0, 2)
                .toUpperCase()}
            </div>

            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {fmsUser?.name || 'Marketing User'}
              </span>

              <span className="text-xs text-sidebar-foreground/60">
                {fmsUser?.role === 'system_admin'
                  ? 'System Administrator'
                  : 'Marketing Team'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const MSidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggle,
}) => {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:flex',
        collapsed ? 'w-[80px]' : 'w-[280px]'
      )}
    >
      <SidebarContent collapsed={collapsed} />

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-colors hover:bg-muted"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronLeft className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
    </aside>
  );
};

export const MMobileSidebar: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-[280px] bg-sidebar p-0"
      >
        <SidebarContent
          collapsed={false}
          onItemClick={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
};

export default MSidebar;
