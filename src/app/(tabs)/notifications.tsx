import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
import type { AppNotification, NotificationType } from '@/types';

// ── Iconos y colores por tipo ─────────────────────────────────────────────

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: string; bg: string; iconColor: string }
> = {
  confirmacion: { icon: 'checkmark-circle', bg: 'bg-green-100', iconColor: '#16a34a' },
  cancelacion:  { icon: 'close-circle',     bg: 'bg-red-100',   iconColor: '#dc2626' },
  mensaje:      { icon: 'chatbubble',        bg: 'bg-blue-100',  iconColor: '#2563eb' },
  recordatorio: { icon: 'alarm',             bg: 'bg-yellow-100',iconColor: '#d97706' },
  pago:         { icon: 'card',              bg: 'bg-purple-100',iconColor: '#7c3aed' },
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} día${days > 1 ? 's' : ''}`;
}

// ── Tarjeta de notificación ───────────────────────────────────────────────

function NotificationCard({
  notif,
  onPress,
}: {
  notif: AppNotification;
  onPress: () => void;
}) {
  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.recordatorio;

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-start gap-3 rounded-2xl px-4 py-3 mb-2 ${
        notif.is_read ? 'bg-white' : 'bg-blue-50'
      } active:opacity-80`}
      style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 }}
    >
      {/* Ícono */}
      <View
        className={`w-10 h-10 rounded-full items-center justify-center flex-shrink-0 ${cfg.bg}`}
      >
        <Ionicons name={cfg.icon as never} size={20} color={cfg.iconColor} />
      </View>

      {/* Contenido */}
      <View className="flex-1">
        <View className="flex-row items-start justify-between">
          <Text
            className={`text-sm flex-1 mr-2 ${
              notif.is_read ? 'font-medium text-gray-700' : 'font-semibold text-gray-900'
            }`}
          >
            {notif.title}
          </Text>
          {!notif.is_read && (
            <View className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
          )}
        </View>
        <Text className="text-xs text-gray-500 mt-0.5">{notif.body}</Text>
        <Text className="text-xs text-gray-400 mt-1">
          {formatRelativeTime(notif.created_at)}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Sección de preferencias ───────────────────────────────────────────────

function PreferencesSection() {
  const { session } = useAuthStore();
  const { prefs, fetchPrefs, updatePrefs } = useNotificationStore();

  useFocusEffect(
    useCallback(() => {
      if (session?.user.id) fetchPrefs(session.user.id);
    }, [session?.user.id])
  );

  const toggle = async (key: keyof typeof prefs) => {
    if (!session?.user.id) return;
    await updatePrefs(session.user.id, { [key]: !prefs[key] });
  };

  const prefRows: Array<{ key: keyof typeof prefs; label: string; description: string }> = [
    {
      key: 'nueva_reserva',
      label: 'Nuevas reservas',
      description: 'Cuando un cliente reserva un turno',
    },
    {
      key: 'cancelacion',
      label: 'Cancelaciones',
      description: 'Cuando un cliente cancela un turno',
    },
    {
      key: 'nuevo_mensaje',
      label: 'Mensajes',
      description: 'Cuando llega un mensaje de un cliente',
    },
  ];

  return (
    <View className="bg-white rounded-2xl p-4 gap-4">
      <Text className="text-sm font-semibold text-gray-700">Preferencias</Text>
      {prefRows.map((row, i) => (
        <View key={row.key}>
          {i > 0 && <View className="border-t border-gray-100 mb-4" />}
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-sm font-medium text-gray-800">{row.label}</Text>
              <Text className="text-xs text-gray-400 mt-0.5">{row.description}</Text>
            </View>
            <Switch
              value={prefs[row.key]}
              onValueChange={() => toggle(row.key)}
              trackColor={{ false: '#e5e7eb', true: '#93c5fd' }}
              thumbColor={prefs[row.key] ? '#3b82f6' : '#d1d5db'}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { session } = useAuthStore();
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    subscribeRealtime,
  } = useNotificationStore();

  useFocusEffect(
    useCallback(() => {
      if (!session?.user.id) return;
      fetchNotifications(session.user.id);
      const unsub = subscribeRealtime(session.user.id);
      return unsub;
    }, [session?.user.id])
  );

  const handleMarkAll = () => {
    if (!session?.user.id || unreadCount === 0) return;
    Alert.alert('Marcar todas como leídas', '¿Marcar todas las notificaciones como leídas?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Marcar leídas',
        onPress: () => markAllAsRead(session.user.id),
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <View className="flex-row items-center gap-2">
          <Text className="text-lg font-bold text-gray-900">Notificaciones</Text>
          {unreadCount > 0 && (
            <View className="bg-blue-500 rounded-full min-w-[20px] h-5 items-center justify-center px-1.5">
              <Text className="text-white text-xs font-bold">{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <Pressable onPress={handleMarkAll} className="active:opacity-60">
            <Text className="text-sm text-blue-500 font-medium">Marcar leídas</Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400">Cargando notificaciones…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Lista de notificaciones */}
          {notifications.length === 0 ? (
            <View className="items-center py-16 gap-3">
              <Ionicons name="notifications-outline" size={48} color="#d1d5db" />
              <Text className="text-gray-400 text-sm text-center">
                No tenés notificaciones todavía.
              </Text>
            </View>
          ) : (
            <View>
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-1">
                Recientes
              </Text>
              {notifications.map((n) => (
                <NotificationCard
                  key={n.id}
                  notif={n}
                  onPress={() => {
                    if (!n.is_read) markAsRead(n.id);
                  }}
                />
              ))}
            </View>
          )}

          {/* Preferencias */}
          <View className="mt-2">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-1">
              Configuración
            </Text>
            <PreferencesSection />
          </View>

          {/* Nota informativa */}
          <View className="bg-gray-100 rounded-xl p-3 flex-row gap-2 items-start">
            <Ionicons name="information-circle-outline" size={16} color="#9ca3af" />
            <Text className="text-xs text-gray-400 flex-1">
              Las notificaciones push se envían cuando hay actividad nueva. Requieren un
              build de producción para funcionar en dispositivos físicos.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
