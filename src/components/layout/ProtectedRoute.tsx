import React from 'react';
import { Navigate } from 'react-router-dom';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { Loader2, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, fmsUser, loading, signOut } = useFMSAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in at all
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Logged in but no FMS access
  if (!fmsUser) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="text-center">
          <ShieldX className="mx-auto h-16 w-16 text-destructive" />
          <h1 className="mt-4 text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="mt-2 text-muted-foreground">
            Your account is not authorized to access this system.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact an administrator if you believe this is an error.
          </p>
          <Button onClick={signOut} variant="outline" className="mt-6">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
