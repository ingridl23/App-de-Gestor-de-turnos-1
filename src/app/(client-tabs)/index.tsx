import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { AppointmentStatus } from '@/types';

// ── Tipos ──────────────────────────────────────────────────────────────────

interface ServiceRef {
  name: string;
}

interface AppointmentService {
  service_id: string;
  services: ServiceRef | null;
}

interface BusinessRef {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
}

interface ClientAppointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  amount: number;
  business: BusinessRef | null;
  appointment_services: AppointmentService[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dow = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
  const month = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()];
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${dow} ${d.getDate()} ${month} · ${h}:${m}`;
}

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pendiente:  'Pendiente',
  confirmado: 'Confirmado',
  cancelado:  'Cancelado',
  completado: 'Completado',
};

const STATUS_BG: Record<AppointmentStatus, string> = {
  pendiente:  'bg-amber-50',
  confirmado: 'bg-blue-50',
  cancelado:  'bg-gray-100',
  completado: 'bg-green-50',
};

const STATUS_TEXT: Record<AppointmentStatus, string> = {
  pendiente:  'text-amber-600',
  confirmado: 'text-blue-600',
  cancelado:  'text-gray-400',
  completado: 'text-green-600',
};

// ── Tarjeta de turno ───────────────────────────────────────────────────────

function AppointmentCard({
  appt,
  onCancel,
}: {
  appt: ClientAppointment;
  onCancel: (id: string) => void;
}) {
  const serviceNames = appt.appointment_services
    .map((s) => s.services?.name ?? 'Servicio')
    .join(' + ');

  const now = new Date().toISOString();
  const isUpcoming = appt.starts_at >= now;
  const canCancel =
    isUpcoming &&
    (appt.status === 'pendiente' || appt.status === 'confirmado');

  return (
    <View className="bg-white rounded-2xl p-4 gap-3">
      {/* Negocio + estado */}
      <View className="flex-row items-center gap-3">
        {appt.business?.avatar_url ? (
          <Image
            source={{ uri: appt.business.avatar_url }}
            className="w-10 h-10 rounded-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center">
            <Ionicons name="storefront" size={18} color="#3b82f6" />
          </View>
        )}

        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
            {appt.business?.name ?? 'Negocio'}
          </Text>
          <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>
            {serviceNames}
          </Text>
        </View>

        <View className={`px-2.5 py-1 rounded-full ${STATUS_BG[appt.status]}`}>
          <Text className={`text-xs font-medium ${STATUS_TEXT[appt.status]}`}>
            {STATUS_LABEL[appt.status]}
          </Text>
        </View>
      </View>

      {/* Fecha y precio */}
      <View className="flex-row items-center gap-1.5">
        <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
        <Text className="text-sm text-gray-600">{formatDate(appt.starts_at)}</Text>
        {appt.amount > 0 && (
          <>
            <Text className="text-gray-300 mx-0.5">·</Text>
            <Text className="text-sm text-gray-500">${appt.amount.toFixed(0)}</Text>
          </>
        )}
      </View>

      {/* Acciones */}
      {(canCancel || appt.business?.slug) && (
        <View className="flex-row gap-2">
          {canCancel && (
            <Pressable
              onPress={() => onCancel(appt.id)}
              className="flex-1 border border-red-100 rounded-xl py-2.5 items-center active:opacity-70"
            >
              <Text className="text-red-400 text-xs font-medium">Cancelar</Text>
            </Pressable>
          )}

          {appt.business?.slug && (
            <Pressable
              onPress={() => router.push(`/b/${appt.business!.slug}/book` as never)}
              className="flex-1 bg-blue-50 rounded-xl py-2.5 items-center active:opacity-70"
            >
              <Text className="text-blue-500 text-xs font-medium">Repetir reserva</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// ── Pantalla ────────────────────────────────────────────────────────────────

export default function ClientHomeScreen() {
  const { user } = useAuthStore();

  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');

  const fetchAppointments = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('appointments')
      .select(
        `*, business:businesses!business_id(id, name, slug, avatar_url),
         appointment_services(service_id, services(name))`
      )
      .eq('client_id', user.id)
      .order('starts_at', { ascending: false });

    if (!error && data) {
      setAppointments(data as unknown as ClientAppointment[]);
    }
    setIsLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  function handleCancel(id: string) {
    Alert.alert(
      'Cancelar turno',
      '¿Estás segura de que querés cancelar este turno?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('appointments')
              .update({ status: 'cancelado' })
              .eq('id', id);
            if (!error) {
              setAppointments((prev) =>
                prev.map((a) => (a.id === id ? { ...a, status: 'cancelado' as const } : a))
              );
            }
          },
        },
      ]
    );
  }

  // ── Split upcoming / history ─────────────────────────────────────────────
  const now = new Date().toISOString();

  const upcoming = appointments
    .filter(
      (a) =>
        a.starts_at >= now &&
        (a.status === 'pendiente' || a.status === 'confirmado')
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const history = appointments
    .filter(
      (a) =>
        a.starts_at < now ||
        a.status === 'cancelado' ||
        a.status === 'completado'
    );
  // history ya viene ordenado desc desde Supabase

  const displayed = tab === 'upcoming' ? upcoming : history;

  // ── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-5 pb-3">
        <Text className="text-xl font-bold text-gray-900">Mis turnos</Text>
      </View>

      {/* Selector de pestaña */}
      <View className="flex-row mx-4 mb-4 bg-gray-100 rounded-xl p-1">
        {(['upcoming', 'history'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg items-center ${
              tab === t ? 'bg-white' : ''
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                tab === t ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              {t === 'upcoming'
                ? `Próximos${upcoming.length > 0 ? ` (${upcoming.length})` : ''}`
                : 'Historial'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Lista */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchAppointments();
            }}
            colors={['#3b82f6']}
            tintColor="#3b82f6"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {displayed.length === 0 ? (
          <View className="items-center justify-center pt-16 gap-4">
            <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center">
              <Ionicons
                name={tab === 'upcoming' ? 'calendar-outline' : 'time-outline'}
                size={28}
                color="#d1d5db"
              />
            </View>
            <Text className="text-gray-400 text-sm text-center leading-relaxed">
              {tab === 'upcoming'
                ? 'No tenés turnos próximos.\nUsá el link de tu peluquero/a para reservar.'
                : 'Todavía no tenés turnos en el historial.'}
            </Text>
          </View>
        ) : (
          displayed.map((appt, i) => (
            <View key={appt.id} style={i > 0 ? { marginTop: 10 } : undefined}>
              <AppointmentCard appt={appt} onCancel={handleCancel} />
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
