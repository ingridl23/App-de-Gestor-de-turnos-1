import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppointmentStore } from '@/store/appointmentStore';
import { useBusinessStore } from '@/store/businessStore';
import type { AppointmentStatus, AppointmentWithDetails } from '@/types';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatLocalDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function toLocalDateStr(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftDate(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

function weekDays(selectedDate: string): string[] {
  const [y, m, d] = selectedDate.split('-').map(Number);
  const ref = new Date(y, m - 1, d);
  const dow = ref.getDay();
  const mon = new Date(ref);
  mon.setDate(ref.getDate() - ((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(mon);
    dt.setDate(mon.getDate() + i);
    const dy = dt.getFullYear();
    const dm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${dy}-${dm}-${dd}`;
  });
}

const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  confirmado: 'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-500',
  completado: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  completado: 'Completado',
};

const FILTER_OPTIONS: Array<{ label: string; value: AppointmentStatus | null }> = [
  { label: 'Todos', value: null },
  { label: 'Pendiente', value: 'pendiente' },
  { label: 'Confirmado', value: 'confirmado' },
  { label: 'Cancelado', value: 'cancelado' },
];

// ── Componentes ────────────────────────────────────────────────────────────

function AppointmentCard({
  apt,
  onUpdateStatus,
}: {
  apt: AppointmentWithDetails;
  onUpdateStatus: (id: string, status: AppointmentStatus) => void;
}) {
  const clientName =
    apt.client?.full_name ?? apt.client_name ?? 'Cliente sin nombre';
  const serviceNames = apt.appointment_services
    .map((as) => as.services?.name)
    .filter(Boolean)
    .join(', ');

  const handlePress = () => {
    const actions: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] =
      [];

    if (apt.status === 'pendiente') {
      actions.push({
        text: 'Confirmar',
        onPress: () => onUpdateStatus(apt.id, 'confirmado'),
      });
    }
    if (apt.status !== 'cancelado' && apt.status !== 'completado') {
      actions.push({
        text: 'Reprogramar',
        onPress: () => router.push(`/(tabs)/agenda/${apt.id}`),
      });
      actions.push({
        text: 'Cancelar turno',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            '¿Cancelar turno?',
            `${clientName} — ${formatTime(apt.starts_at)}`,
            [
              { text: 'No', style: 'cancel' },
              {
                text: 'Cancelar turno',
                style: 'destructive',
                onPress: () => onUpdateStatus(apt.id, 'cancelado'),
              },
            ]
          ),
      });
    }
    if (apt.status === 'confirmado') {
      actions.push({
        text: 'Marcar completado',
        onPress: () => onUpdateStatus(apt.id, 'completado'),
      });
    }
    actions.push({ text: 'Cerrar', style: 'cancel' });

    Alert.alert(clientName, serviceNames || 'Sin servicio', actions);
  };

  const colorClass = STATUS_COLORS[apt.status];
  const [bgClass, textClass] = colorClass.split(' ');

  return (
    <Pressable
      onPress={handlePress}
      className="bg-white rounded-2xl p-4 mb-3 active:opacity-80"
      style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 }}
    >
      <View className="flex-row items-start justify-between">
        {/* Hora */}
        <View className="items-center mr-3 min-w-[50px]">
          <Text className="text-base font-bold text-blue-500">
            {formatTime(apt.starts_at)}
          </Text>
          <Text className="text-xs text-gray-400">{formatTime(apt.ends_at)}</Text>
        </View>

        {/* Info */}
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-900">{clientName}</Text>
          {serviceNames ? (
            <Text className="text-xs text-gray-500 mt-0.5">{serviceNames}</Text>
          ) : null}
          {apt.is_manual && (
            <Text className="text-xs text-purple-500 mt-0.5">Turno manual</Text>
          )}
        </View>

        {/* Derecha: monto + estado */}
        <View className="items-end gap-1">
          <Text className="text-sm font-semibold text-gray-800">
            ${apt.amount.toFixed(0)}
          </Text>
          <View className={`px-2 py-0.5 rounded-full ${bgClass}`}>
            <Text className={`text-xs font-medium ${textClass}`}>
              {STATUS_LABELS[apt.status]}
            </Text>
          </View>
        </View>
      </View>

      {apt.notes ? (
        <Text className="text-xs text-gray-400 mt-2 italic">{apt.notes}</Text>
      ) : null}
    </Pressable>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────

export default function AgendaScreen() {
  const { business } = useBusinessStore();
  const {
    appointments,
    isLoading,
    selectedDate,
    viewMode,
    filterStatus,
    setSelectedDate,
    setViewMode,
    setFilterStatus,
    fetchAppointments,
    updateStatus,
    subscribeRealtime,
  } = useAppointmentStore();

  useFocusEffect(
    useCallback(() => {
      if (!business) return;
      fetchAppointments(business.id);
      const unsubscribe = subscribeRealtime(business.id);
      return unsubscribe;
    }, [business?.id, selectedDate, viewMode])
  );

  // Re-fetch al cambiar filtros de navegación
  useEffect(() => {
    if (business) fetchAppointments(business.id);
  }, [selectedDate, viewMode]);

  const handleUpdateStatus = async (id: string, status: AppointmentStatus) => {
    const err = await updateStatus(id, status);
    if (err) Alert.alert('Error', err);
  };

  const visibleAppointments = filterStatus
    ? appointments.filter((a) => a.status === filterStatus)
    : appointments;

  const days = weekDays(selectedDate);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white border-b border-gray-100 px-4 pt-3 pb-2 gap-3">
        <Text className="text-lg font-bold text-gray-900">Turnos</Text>

        {/* Toggle día / semana */}
        <View className="flex-row bg-gray-100 rounded-xl p-1 self-start">
          {(['day', 'week'] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setViewMode(mode)}
              className={`px-4 py-1.5 rounded-lg ${viewMode === mode ? 'bg-white' : ''}`}
            >
              <Text
                className={`text-sm font-medium ${
                  viewMode === mode ? 'text-blue-500' : 'text-gray-500'
                }`}
              >
                {mode === 'day' ? 'Día' : 'Semana'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Navegación de fecha */}
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() =>
              setSelectedDate(shiftDate(selectedDate, viewMode === 'day' ? -1 : -7))
            }
            hitSlop={8}
            className="p-1 active:opacity-60"
          >
            <Ionicons name="chevron-back" size={20} color="#6b7280" />
          </Pressable>

          <Pressable
            onPress={() => setSelectedDate(new Date().toISOString().split('T')[0])}
          >
            <Text className="text-sm font-semibold text-gray-700 capitalize">
              {viewMode === 'day'
                ? formatLocalDate(selectedDate)
                : `Semana del ${formatLocalDate(days[0])}`}
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              setSelectedDate(shiftDate(selectedDate, viewMode === 'day' ? 1 : 7))
            }
            hitSlop={8}
            className="p-1 active:opacity-60"
          >
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </Pressable>
        </View>

        {/* Filtro de estado */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2 pb-1">
            {FILTER_OPTIONS.map((opt) => (
              <Pressable
                key={String(opt.value)}
                onPress={() => setFilterStatus(opt.value)}
                className={`px-3 py-1 rounded-full border ${
                  filterStatus === opt.value
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    filterStatus === opt.value ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Contenido */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400">Cargando turnos…</Text>
        </View>
      ) : viewMode === 'week' ? (
        // ── Vista semanal ──────────────────────────────────────
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10 }}
          showsVerticalScrollIndicator={false}
        >
          {days.map((day) => {
            const [y, m, d] = day.split('-').map(Number);
            const dt = new Date(y, m - 1, d);
            const dayName = DAY_SHORT[dt.getDay()];
            const dayCount = appointments.filter(
              (a) => toLocalDateStr(a.starts_at) === day && a.status !== 'cancelado'
            ).length;
            const isToday = day === new Date().toISOString().split('T')[0];
            const isSel = day === selectedDate;

            return (
              <Pressable
                key={day}
                onPress={() => {
                  setSelectedDate(day);
                  setViewMode('day');
                }}
                className={`flex-row items-center justify-between rounded-2xl px-4 py-3 ${
                  isSel ? 'bg-blue-500' : isToday ? 'bg-blue-50' : 'bg-white'
                }`}
                style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 }}
              >
                <View className="flex-row items-center gap-3">
                  <Text
                    className={`text-sm font-semibold w-8 ${
                      isSel ? 'text-white' : 'text-gray-500'
                    }`}
                  >
                    {dayName}
                  </Text>
                  <Text
                    className={`text-base font-bold ${
                      isSel ? 'text-white' : isToday ? 'text-blue-500' : 'text-gray-900'
                    }`}
                  >
                    {d}
                  </Text>
                </View>

                <View className="flex-row items-center gap-2">
                  {dayCount > 0 ? (
                    <View
                      className={`px-2.5 py-0.5 rounded-full ${
                        isSel ? 'bg-white/20' : 'bg-blue-100'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          isSel ? 'text-white' : 'text-blue-600'
                        }`}
                      >
                        {dayCount} {dayCount === 1 ? 'turno' : 'turnos'}
                      </Text>
                    </View>
                  ) : (
                    <Text
                      className={`text-xs ${isSel ? 'text-white/60' : 'text-gray-300'}`}
                    >
                      Sin turnos
                    </Text>
                  )}
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={isSel ? 'rgba(255,255,255,0.8)' : '#d1d5db'}
                  />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        // ── Vista diaria ───────────────────────────────────────
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
        >
          {visibleAppointments.length === 0 ? (
            <View className="flex-1 items-center justify-center py-20 gap-3">
              <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
              <Text className="text-gray-400 text-sm text-center">
                {filterStatus
                  ? `No hay turnos ${STATUS_LABELS[filterStatus].toLowerCase()}s para este día.`
                  : 'No hay turnos para este día.'}
              </Text>
            </View>
          ) : (
            visibleAppointments.map((apt) => (
              <AppointmentCard
                key={apt.id}
                apt={apt}
                onUpdateStatus={handleUpdateStatus}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* FAB: nuevo turno manual */}
      <Pressable
        onPress={() => router.push('/(tabs)/agenda/new')}
        className="absolute bottom-6 right-6 w-14 h-14 bg-blue-500 rounded-full items-center justify-center active:opacity-80"
        style={{ elevation: 4, shadowColor: '#3b82f6', shadowOpacity: 0.4, shadowRadius: 8 }}
      >
        <Ionicons name="add" size={28} color="white" />
      </Pressable>
    </SafeAreaView>
  );
}
