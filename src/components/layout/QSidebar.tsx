
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';

import {
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  ArrowLeft,
  LogOut,
  FolderOpen,
  BookOpen,
  Users,
  ShieldCheck,
  Map,
  Workflow,
  Package,
  FlaskConical,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Building2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface QSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}


const documentGroups = [
  {
    title: 'Controlled Documents',
    icon: BookOpen,
    children: [
      {
        label: 'Standard Operating Procedures – Rockwood',
        path: '/quality-system/rockwood',
      },
      {
        label: 'Standard Operating Procedures – Nguni',
        path: '/quality-system/nguni',
      },
      {
        label: 'Working Instructions',
        category: 'Working Instructions',
      },
      {
        label: 'Policies',
        category: 'Policies',
      },
    ],
  },
  {
    title: 'Specifications & Technical Documents',
    icon: Package,
    children: [
      { label: 'Raw materials', category: 'Raw materials' },
      { label: 'Packaging materials', category: 'Packaging materials' },
      { label: 'Finished goods', category: 'Finished goods' },
      { label: 'Cleaning Chemicals', category: 'Cleaning Chemicals' },
      { label: 'Process Flow Diagrams', category: 'Process Flow Diagrams' },
      { label: 'Floor Plan', category: 'Floor Plan' },
    ],
  },
  {
    title: 'Compliance & Certifications',
    icon: ShieldCheck,
    children: [
      { label: 'Lab results', category: 'Lab results' },
      { label: 'Calibration certificates', category: 'Calibration certificates' },
      { label: 'Halaal Certification', category: 'Halaal Certification' },
      { label: 'R638 Certificate', category: 'R638 Certificate' },
      {
        label: 'Food Quality & Safety Certificate',
        category: 'Food Quality & Safety Certificate',
      },
    ],
  },
  {
    title: 'HR & Training Documents',
    icon: Users,
    children: [
      { label: 'Appointment letters', category: 'Appointment letters' },
      {
        label: 'Job Descriptions & Organograms',
        category: 'Job Descriptions & Organograms',
      },
      {
        label: 'Training Presentations',
        category: 'Training Presentations',
      },
    ],
  },
];


const SidebarContent: React.FC<{
  collapsed: boolean;
  onItemClick?: () => void;
}> = ({ collapsed, onItemClick }) => {
  const location = useLocation();
  const { fmsUser, signOut } = useFMSAuth();

  const [expandedCategories, setExpandedCategories] = useState<string[]>([
    'Controlled Documents',
  ]);

  const displayName =
    fmsUser?.name ||
    fmsUser?.email ||
    'Quality User';

  const selectedCategory = new URLSearchParams(location.search).get('category');

const isRockwoodPage = location.pathname === '/quality-system/rockwood';
const isNguniPage = location.pathname === '/quality-system/nguni';

  const toggleCategory = (title: string) => {
    setExpandedCategories((previous) =>
      previous.includes(title)
        ? previous.filter((item) => item !== title)
        : [...previous, title]
    );
  };

  const categoryLink = (category: string) =>
    `/quality-system/documents?category=${encodeURIComponent(category)}`;

  return (
    <div className="flex h-full flex-col">
      {/* Logo and Heading */}
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
              Quality System
            </span>
            <span className="text-xs text-sidebar-foreground/60">
              Maharaja's Spices
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <div
          className={cn(
            'mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50',
            collapsed && 'sr-only'
          )}
        >
          Quality Management
        </div>

        {/* Dashboard */}
        <Link
          to="/quality-system/dashboard"
          onClick={onItemClick}
          title={collapsed ? 'Dashboard' : undefined}
          className={cn(
            'mb-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            location.pathname === '/quality-system/dashboard'
              ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
              : 'text-sidebar-foreground',
            collapsed && 'justify-center px-2'
          )}
        >
          <LayoutDashboard className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Dashboard</span>}
        </Link>

        {!collapsed && (
          <div className="mb-2 flex items-center gap-2 px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            <FolderOpen className="h-3.5 w-3.5" />
            Document Library
          </div>
        )}

        {/* Four Document Groups */}
        {documentGroups.map((group) => {
          const Icon = group.icon;
          const isExpanded = expandedCategories.includes(group.title);

          const isActive = group.children.some((child) => {
  if (child.path === '/quality-system/rockwood') return isRockwoodPage;
  if (child.path === '/quality-system/nguni') return isNguniPage;
  return child.category === selectedCategory;
});

          return (
            <div key={group.title}>
              <button
                type="button"
                onClick={() => {
                  if (!collapsed) {
                    toggleCategory(group.title);
                  }
                }}
                title={collapsed ? group.title : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isActive
                    ? 'bg-sidebar-primary/10 text-sidebar-primary'
                    : 'text-sidebar-foreground',
                  collapsed && 'justify-center px-2'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />

                {!collapsed && (
                  <>
                    <span className="flex-1">{group.title}</span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </>
                )}
              </button>

              {!collapsed && isExpanded && (
                <div className="ml-5 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                  
{group.children.map((child) => {
  const childActive = child.path
    ? location.pathname === child.path
    : selectedCategory === child.category;

  const childLink = child.path || categoryLink(child.category!);

  return (
    <Link
      key={child.label}
      to={childLink}
      onClick={onItemClick}
      className={cn(
        'block rounded-md px-3 py-2 text-xs transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        childActive
          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
          : 'text-sidebar-foreground/70'
      )}
    >
      {child.label}
    </Link>
  );
})}

                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
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
                Quality Department
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const QSidebar: React.FC<QSidebarProps> = ({
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
