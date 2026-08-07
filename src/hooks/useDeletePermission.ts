import { useFMSAuth } from '@/context/FMSAuthContext';

export function useDeletePermission() {
  const { fmsUser, loading } = useFMSAuth();
  
  // Delete permission is based on system_admin role (enforced server-side via fms_is_delete_admin RLS)
  // This is UI-only; actual enforcement happens via RLS policies
  const canDelete = !loading && !!fmsUser && fmsUser.role === 'system_admin';
  
  return {
    canDelete,
    isLoading: loading,
  };
}
