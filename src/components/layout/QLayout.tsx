
import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { QSidebar, MobileQSidebar } from './QSidebar';
import { NotificationsDropdown } from './NotificationsDropdown';
import { cn } from '@/lib/utils';

const pageTitles: Record<string, string> = {
  '/quality-system/dashboard': 'Quality Dashboard',
  '/quality-system/inspections': 'Quality Inspections',
  '/quality-system/non-conformances': 'Non-Conformances',
  '/quality-system/corrective-actions': 'Corrective Actions',
  '/quality-system/audits': 'Quality Audits',
  '/quality-system/documents': 'Quality Documents',
  '/quality-system/reports': 'Quality Reports',
};

export const QLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  const pageTitle =
    pageTitles[location.pathname] || 'Quality Management';

  return (
    <div className="min-h-screen bg-background">
      <QSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className={cn(
        'flex min-h-screen flex-col transition-all duration-300',
        sidebarCollapsed ? 'lg:ml-[80px]' : 'lg:ml-[280px]'
      )}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
          <MobileQSidebar />

          <div className="flex flex-1 items-center gap-4">
            <h1 className="text-lg font-semibold text-foreground md:text-xl">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <NotificationsDropdown />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
