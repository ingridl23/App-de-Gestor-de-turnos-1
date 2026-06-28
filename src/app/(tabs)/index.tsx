import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useBusinessStore } from '@/store/businessStore';
import { useNotificationStore } from '@/store/notificationStore';

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const { business, isLoadingBusiness, fetchBusiness } = useBusinessStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    if (user && !business) fetchBusiness(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!business) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .in('status', ['pendiente', 'confirmado'])
      .gte('starts_at', todayStart.toISOString())
      .lte('starts_at', todayEnd.toISOString())
      .then(({ count }) => setTodayCount(count ?? 0));

    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('status', 'pendiente')
      .gte('starts_at', new Date().toISOString())
      .then(({ count }) => setPendingCount(count ?? 0));
  }, [business?.id]);

  if (isLoadingBusiness) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? 'Hola';

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-5">
          <Text className="text-2xl font-bold text-gray-900">Hola, {firstName} 👋</Text>
          {business && (
            <Text className="text-sm text-gray-400 mt-0.5">{business.name}</Text>
          )}
        </View>

        {/* Stats */}
        <View className="flex-row gap-3 mb-4">
          <StatCard
            icon="calendar"
            label="Turnos hoy"
            value={todayCount}
            color="#3b82f6"
            onPress={() => router.push('/(tabs)/agenda')}
          />
          <StatCard
            icon="time"
            label="Pendientes"
            value={pendingCount}
            color="#f59e0b"
            onPress={() => router.push('/(tabs)/agenda')}
          />
          <StatCard
            icon="chatbubbles"
            label="Mensajes"
            value={unreadCount}
            color="#8b5cf6"
            onPress={() => router.push('/(tabs)/chat')}
          />
        </View>

        {/* Cobros con MercadoPago */}
        <Pressable
          onPress={() => router.push('/(tabs)/payments')}
          className="bg-white rounded-2xl p-4 mb-4 active:opacity-80"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-sky-50 items-center justify-center">
                <Ionicons name="card" size={20} color="#0ea5e9" />
              </View>
              <View>
                <Text className="text-sm font-semibold text-gray-900">Cobros</Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  {business?.mp_user_id
                    ? business.payment_mode === 'none'
                      ? 'Conectado · Sin cobro digital'
                      : business.payment_mode === 'seña'
                      ? `Conectado · Seña ${business.seña_percent}%`
                      : 'Conectado · Cobro completo'
                    : 'Conectar MercadoPago'}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-2">
              {business?.mp_user_id ? (
                <View className="w-2 h-2 rounded-full bg-green-400" />
              ) : (
                <View className="w-2 h-2 rounded-full bg-gray-300" />
              )}
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </View>
          </View>
        </Pressable>

        {/* Acciones rápidas */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Acciones rápidas
        </Text>
        <View className="gap-2">
          <QuickAction
            icon="cut-outline"
            label="Gestionar servicios"
            onPress={() => router.push('/(tabs)/services')}
          />
          <QuickAction
            icon="time-outline"
            label="Configurar horarios"
            onPress={() => router.push('/(tabs)/schedule')}
          />
          <QuickAction
            icon="calendar-outline"
            label="Ver agenda del día"
            onPress={() => router.push('/(tabs)/agenda')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: number | null;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 bg-white rounded-2xl p-3 items-center gap-1 active:opacity-80"
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text className="text-xl font-bold text-gray-900">
        {value === null ? '—' : value}
      </Text>
      <Text className="text-xs text-gray-400 text-center">{label}</Text>
    </Pressable>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-2xl px-4 py-3.5 flex-row items-center gap-3 active:opacity-80"
    >
      <Ionicons name={icon} size={18} color="#6b7280" />
      <Text className="flex-1 text-sm font-medium text-gray-700">{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
    </Pressable>
  );
}
