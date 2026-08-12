import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';
import {
  Package,
  Truck,
  FileText,
  Factory,
  Send,
  Search,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Users,
  Settings,
  Menu,
  X,
  KeyRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  description?: string;
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    description: 'Overview & statistics',
  },
  {
    title: 'Stock Code Master',
    href: '/stock-codes',
    icon: Package,
    description: 'Manage items & materials',
  },
  {
    title: 'Receiving Log',
    href: '/receiving',
    icon: Truck,
    description: 'Inbound traceability',
  },
  {
    title: 'Bill of Materials',
    href: '/bom',
    icon: FileText,
    description: 'Product formulations',
  },
  {
    title: 'Batch Sheet',
    href: '/batch-sheet',
    icon: Factory,
    description: 'Batch manufacturing',
  },
  {
    title: 'Dispatch',
    href: '/dispatch',
    icon: Send,
    description: 'Outbound tracking',
  },
  {
    title: 'Traceability',
    href: '/traceability',
    icon: Search,
    description: 'Reports & recalls',
  },
];

const secondaryNavItems: NavItem[] = [
  {
    title: 'Suppliers',
    href: '/suppliers',
    icon: Users,
    description: 'Manage suppliers',
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'System configuration',
  },
];

const adminNavItems: NavItem[] = [
  {
    title: 'User Management',
    href: '/admin-passwords',
    icon: KeyRound,
    description: 'Add, edit & reset users',
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const SidebarContent: React.FC<{ collapsed: boolean; onItemClick?: () => void }> = ({ collapsed, onItemClick }) => {
  const location = useLocation();
  const { fmsUser } = useFMSAuth();
  const isQaViewer = fmsUser?.role === 'qa_viewer';
  const isAdmin = fmsUser?.role === 'system_admin';

  const allowedForViewer = new Set(['/', '/receiving', '/bom', '/batch-sheet', '/traceability', '/suppliers']);
  const visibleMain = isQaViewer ? navItems.filter((i) => allowedForViewer.has(i.href)) : navItems;
  const visibleSecondary = isQaViewer ? secondaryNavItems.filter((i) => allowedForViewer.has(i.href)) : secondaryNavItems;

  // Admin-only navigation items (only visible to system_admin)
  const allSecondary = [...visibleSecondary, ...(isAdmin ? adminNavItems : [])];

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 border-b border-sidebar-border px-4 py-4",
        collapsed && "justify-center px-2"
      )}>
        <img src={logo} alt="Logo" className="h-10 w-10 object-contain" />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold text-sidebar-foreground">Traceability</span>
            <span className="text-xs text-sidebar-foreground/60">System</span>
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <div className={cn("mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50", collapsed && "sr-only")}>
          Main Menu
        </div>
        {visibleMain.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/' && location.pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onItemClick}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" 
                  : "text-sidebar-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.title : undefined}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-sidebar-primary-foreground")} />
              {!collapsed && (
                <div className="flex flex-col">
                  <span>{item.title}</span>
                  {item.description && (
                    <span className={cn(
                      "text-xs",
                      isActive ? "text-sidebar-primary-foreground/70" : "text-sidebar-foreground/50"
                    )}>
                      {item.description}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}

        {/* Secondary Navigation */}
        {visibleSecondary.length > 0 && (
          <div className={cn("mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50", collapsed && "sr-only")}>
            Settings
          </div>
        )}
        {allSecondary.map((item) => {
          const isActive = location.pathname === item.href;
          
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onItemClick}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" 
                  : "text-sidebar-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.title : undefined}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-sidebar-primary-foreground")} />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      {!collapsed && (
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium text-sidebar-accent-foreground">
              FO
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-sidebar-foreground">Factory Operator</span>
              <span className="text-xs text-sidebar-foreground/60">Production</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:flex",
        collapsed ? "w-[80px]" : "w-[280px]"
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

export const MobileSidebar: React.FC = () => {
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
        <SidebarContent collapsed={false} onItemClick={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
};
