import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFMSAuth } from '@/context/FMSAuthContext';

export interface FMSNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: 'info' | 'warning' | 'error' | 'success';
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export const useNotifications = () => {
  const { user } = useFMSAuth();
  const [notifications, setNotifications] = useState<FMSNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('fms_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const typedData = (data || []) as FMSNotification[];
      setNotifications(typedData);
      setUnreadCount(typedData.filter(n => !n.is_read).length);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('fms_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('fms_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, [user]);

  const createNotification = useCallback(async (
    title: string,
    message: string,
    type: 'info' | 'warning' | 'error' | 'success' = 'info',
    entityType?: string,
    entityId?: string
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('fms_notifications')
        .insert({
          user_id: user.id,
          title,
          message,
          notification_type: type,
          entity_type: entityType,
          entity_id: entityId,
        });

      if (error) throw error;
      await fetchNotifications();
    } catch (err) {
      console.error('Failed to create notification:', err);
    }
  }, [user, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    createNotification,
    refresh: fetchNotifications,
  };
};
