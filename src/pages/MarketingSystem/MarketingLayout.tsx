
import React, { useState } from 'react';
import {
  MSidebar,
  MMobileSidebar,
} from '@/components/layout/MSidebar';

interface MarketingLayoutProps {
  children: React.ReactNode;
}

const MarketingLayout: React.FC<MarketingLayoutProps> = ({
  children,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <MSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />

      <div
        className={`min-h-screen transition-all duration-300 ${
          collapsed ? 'lg:ml-[80px]' : 'lg:ml-[280px]'
        }`}
      >
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4 lg:hidden">
          <MMobileSidebar />

          <div className="flex flex-col">
            <span className="text-sm font-bold">
              MAHARAJA'S
            </span>

            <span className="text-xs text-muted-foreground">
              Marketing System
            </span>
          </div>
        </header>

        <main className="min-h-screen p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MarketingLayout;
