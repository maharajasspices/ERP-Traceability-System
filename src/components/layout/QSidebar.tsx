
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';
import {
  LayoutDashboard,
  ClipboardCheck,
  AlertTriangle,
  ClipboardList,
  FileText,
  ShieldCheck,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Menu,
  ArrowLeft,
  LogOut,
  FolderOpen,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface QSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  {
    title: 'Dashboard',
    href: '/quality-system/dashboard',
    icon: LayoutDashboard,
    description: 'Quality overview',
  },
  {
    title: 'Inspections',
    href: '/quality-system/inspections',
    icon: ClipboardCheck,
    description: 'Quality inspections',
  },
  {
    title: 'Non-Conformances',
    href: '/quality-system/non-conformances',
    icon: AlertTriangle,
    description: 'Quality issues',
  },
  {
    title: 'Corrective Actions',
    href: '/quality-system/corrective-actions',
    icon: ClipboardList,
    description: 'Actions and resolutions',
  },
  {
    title: 'Audits',
    href: '/quality-system/audits',
    icon: ShieldCheck,
    description: 'Audit management',
  },
  {
    title: 'Quality Documents',
    href: '/quality-system/documents',
    icon: FolderOpen,
    description: 'Policies and documents',
  },
  {
    title: 'Reports',
    href: '/quality-system/reports',
    icon: BarChart3,
    description: 'Quality reporting',
  },
];

const SidebarContent: React.FC<{
  collapsed: boolean;
  onItemClick?: () => void;
}> = ({ collapsed, onItemClick }) => {
  const location = useLocation();
  const { fmsUser, signOut } = useFMSAuth();

  const displayName =
    fmsUser?.full_name ||
    fmsUser?.name ||
    fmsUser?.email ||
    'Quality User';

  return (
    <div className="flex h-full flex-col">
      <div className={cn(
        'flex items-center gap-3 border-b border-sidebar-border px-4 py-4',
        collapsed && 'justify-center px-2'
      )}>
        <img src={logo} alt="Maharaja's Spices" className="h-10 w-10 object-contain" />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold text-sidebar-foreground">
              Quality System
            </span>
            <span className="text-xs text-sidebar-foreground/60">
              Maharaja's Spices
            </span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <div className={cn(
          'mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50',
          collapsed && 'sr-only'
        )}>
          Quality Management
        </div>

        {navItems.map((item) => {
          const isActive =
            location.pathname === item.href ||
            (item.href !== '/quality-system/dashboard' &&
              location.pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onItemClick}
              title={collapsed ? item.title : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground',
                collapsed && 'justify-center px-2'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <div className="flex flex-col">
                  <span>{item.title}</span>
                  <span className={cn(
                    'text-xs',
                    isActive
                      ? 'text-sidebar-primary-foreground/70'
                      : 'text-sidebar-foreground/50'
                  )}>
                    {item.description}
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 p-3">
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
          onClick={signOut}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-destructive/20 hover:text-destructive',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

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
                Quality Department
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const QSidebar: React.FC<QSidebarProps> = ({ collapsed, onToggle }) => {
  return (
    <aside className={cn(
      'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:flex',
      collapsed ? 'w-[80px]' : 'w-[280px]'
    )}>
      <SidebarContent collapsed={collapsed} />

      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-colors hover:bg-muted"
      >
        {collapsed
          ? <ChevronRight className="h-3 w-3 text-muted-foreground" />
          : <ChevronLeft className="h-3 w-3 text-muted-foreground" />
        }
      </button>
    </aside>
  );
};

export const MobileQSidebar: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-[280px] bg-sidebar p-0">
        <SidebarContent
          collapsed={false}
          onItemClick={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
};
