// Activity logging has been removed from the system.
// This stub preserves the hook signature so existing call sites do not break.
import { useCallback } from 'react';

export type ActivityActionType = 'login' | 'logout' | 'create' | 'update' | 'delete' | 'view' | 'export' | 'approve';

export interface ActivityLogEntry {
  action_type: ActivityActionType;
  entity_type?: string;
  entity_id?: string;
  entity_name?: string;
  details?: Record<string, any>;
}

export const useActivityLog = () => {
  const logActivity = useCallback(async (_entry: ActivityLogEntry) => {
    // no-op
  }, []);
  return { logActivity };
};
