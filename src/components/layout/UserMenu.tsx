import React from 'react';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const UserMenu: React.FC = () => {
  const { user, fmsUser, signOut } = useFMSAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (role: string) => {
    const roleLabels: Record<string, string> = {
      system_admin: 'Admin',
      production_supervisor: 'Supervisor',
      production_operator: 'Operator',
      stores_operator: 'Stores',
      dispatch_user: 'Dispatch',
      qa_viewer: 'QA Viewer',
      hr_user: 'HR',
    };
    return roleLabels[role] || role;
  };

  if (!user || !fmsUser) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(fmsUser.name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{fmsUser.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <span className="mt-1 inline-flex w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {getRoleBadge(fmsUser.role)}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />


        
        <DropdownMenuItem onClick={() => navigate('/settings')}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
