import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';
import { LayoutDashboard, Users, CalendarCheck, CalendarDays, FileText, AlertTriangle, ChevronLeft, ChevronRight, Menu, LogOut, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface HRNavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  description?: string;
}

const hrNavItems: HRNavItem[] = [
  { title: 'Dashboard', href: '/hr-dashboard', icon: LayoutDashboard, description: 'Overview & statistics' },
  { title: 'Employees', href: '/hr/employees', icon: Users, description: 'Staff records & details' },
  { title: 'Attendance', href: '/hr/attendance', icon: CalendarCheck, description: 'Daily attendance tracking' },
  { title: 'Leave', href: '/hr/leave', icon: CalendarDays, description: 'Leave requests & approvals' },
  { title: 'Documents', href: '/hr/documents', icon: FileText, description: 'Contracts & staff records' },
  { title: 'Warnings', href: '/hr/warnings', icon: AlertTriangle, description: 'Disciplinary records' },
];

interface HRSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const HRSidebarContent: React.FC<{ collapsed: boolean; onItemClick?: () => void }> = ({ collapsed, onItemClick }) => {
  const location = useLocation();
  const { fmsUser, signOut } = useFMSAuth();

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex items-center gap-3 border-b border-sidebar-border px-4 py-4", collapsed && "justify-center px-2")}>
        <img src={logo} alt="Logo" className="h-10 w-10 object-contain" />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold text-sidebar-foreground">HR Department</span>
            <span className="text-xs text-sidebar-foreground/60">Human Resources</span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <div className={cn("mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50", collapsed && "sr-only")}>
          HR Menu
        </div>
        {hrNavItems.map((item) => {
          const isActive = location.pathname === item.href || (item.href !== '/hr-dashboard' && location.pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onItemClick}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive ? "bg-emerald-600 text-white shadow-sm" : "text-sidebar-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.title : undefined}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-white")} />
              {!collapsed && (
                <div className="flex flex-col">
                  <span>{item.title}</span>
                  {item.description && (
                    <span className={cn("text-xs", isActive ? "text-white/70" : "text-sidebar-foreground/50")}>
                      {item.description}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        {!collapsed && (
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-medium text-white">
              {fmsUser?.name?.charAt(0)?.toUpperCase() || 'H'}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-sidebar-foreground">{fmsUser?.name || 'HR User'}</span>
              <span className="text-xs text-sidebar-foreground/60 capitalize">
                {fmsUser?.role === 'hr_user' ? 'HR User' : fmsUser?.role?.replace('_', ' ')}
              </span>
            </div>
          </div>
        )}
        <div className="space-y-1">
          <Link
            to="/"
            onClick={onItemClick}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", collapsed && "justify-center px-2")}
            title={collapsed ? "Back to Portal" : undefined}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Back to Portal</span>}
          </Link>
          <button
            onClick={signOut}
            className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-destructive/20 hover:text-destructive", collapsed && "justify-center px-2")}
            title={collapsed ? "Sign Out" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export const HRSidebar: React.FC<HRSidebarProps> = ({ collapsed, onToggle }) => {
  return (
    <aside className={cn("fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:flex", collapsed ? "w-[80px]" : "w-[280px]")}>
      <HRSidebarContent collapsed={collapsed} />
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-colors hover:bg-muted"
      >
        {collapsed ? <ChevronRight className="h-3 w-3 text-muted-foreground" /> : <ChevronLeft className="h-3 w-3 text-muted-foreground" />}
      </button>
    </aside>
  );
};

export const MobileHRSidebar: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle HR menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] bg-sidebar p-0">
        <HRSidebarContent collapsed={false} onItemClick={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
};