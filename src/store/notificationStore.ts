import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import type { AppNotification, NotificationPrefs } from '@/types';

interface NotificationStore {
  notifications: AppNotification[];
  unreadCount: number;
  prefs: NotificationPrefs;
  isLoading: boolean;

  fetchNotifications: (userId: string) => Promise<void>;
  fetchPrefs: (userId: string) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  updatePrefs: (userId: string, patch: Partial<NotificationPrefs>) => Promise<void>;
  subscribeRealtime: (userId: string) => () => void;
  registerPushToken: (userId: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  prefs: { nueva_reserva: true, cancelacion: true, nuevo_mensaje: true },
  isLoading: false,

  fetchNotifications: async (userId) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) {
      const notifs = data as AppNotification[];
      set({
        notifications: notifs,
        unreadCount: notifs.filter((n) => !n.is_read).length,
      });
    }
    set({ isLoading: false });
  },

  fetchPrefs: async (userId) => {
    const { data } = await supabase
      .from('users')
      .select('notification_prefs')
      .eq('id', userId)
      .single();
    if (data?.notification_prefs) {
      set({ prefs: data.notification_prefs as NotificationPrefs });
    }
  },

  markAsRead: async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
  },

  markAllAsRead: async (userId) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));
  },

  updatePrefs: async (userId, patch) => {
    const newPrefs = { ...get().prefs, ...patch };
    await supabase
      .from('users')
      .update({ notification_prefs: newPrefs })
      .eq('id', userId);
    set({ prefs: newPrefs });
  },

  subscribeRealtime: (userId) => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as AppNotification;
          set((s) => ({
            notifications: [n, ...s.notifications],
            unreadCount: s.unreadCount + 1,
          }));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },

  registerPushToken: async (userId) => {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notificaciones',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as Record<string, unknown>).easConfig?.projectId;
      if (!projectId) return; // sin EAS no hay push token

      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId: projectId as string,
      });
      await supabase.from('users').update({ push_token: token }).eq('id', userId);
    } catch {
      // push token es best-effort; no interrumpir el flujo
    }
  },
}));
