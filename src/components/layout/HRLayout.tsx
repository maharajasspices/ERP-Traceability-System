import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { HRSidebar, MobileHRSidebar } from './HRSidebar';
import { cn } from '@/lib/utils';

const pageTitles: Record<string, string> = {
  '/hr-dashboard': 'HR Dashboard',
  '/hr/employees': 'Employees',
  '/hr/attendance': 'Attendance',
  '/hr/leave': 'Leave Management',
  '/hr/documents': 'Documents',
  '/hr/warnings': 'Warnings',
};

export const HRLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || 'HR Department';

  return (
    <div className="min-h-screen bg-background">
      <HRSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={cn(
        "flex min-h-screen flex-col transition-all duration-300",
        sidebarCollapsed ? "lg:ml-[80px]" : "lg:ml-[280px]"
      )}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
          <MobileHRSidebar />
          <div className="flex flex-1 items-center gap-4">
            <h1 className="text-lg font-semibold text-foreground md:text-xl">
              {pageTitle}
            </h1>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};