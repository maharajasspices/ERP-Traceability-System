import React from 'react';
import { useLocation } from 'react-router-dom';
import { MobileSidebar } from './Sidebar';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NotesDropdown } from './NotesDropdown';
import { UserMenu } from './UserMenu';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/stock-codes': 'Stock Code Master',
  '/receiving': 'Receiving Log',
  '/bom': 'Bill of Materials',
  '/batch-sheet': 'Batch Sheet',
  '/dispatch': 'Dispatch',
  '/traceability': 'Traceability & Reporting',
  '/suppliers': 'Suppliers',
  '/settings': 'Settings',
};

export const Header: React.FC = () => {
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || 'Page';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <MobileSidebar />
      
      <div className="flex flex-1 items-center gap-4">
        <h1 className="text-lg font-semibold text-foreground md:text-xl">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-[200px] pl-8 lg:w-[280px]"
          />
        </div>

        {/* Notes */}
        <NotesDropdown />
        
        {/* User Menu */}
        <UserMenu />
      </div>
    </header>
  );
};
