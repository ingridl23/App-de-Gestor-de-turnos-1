import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppointmentStore } from '@/store/appointmentStore';
import { useBusinessStore } from '@/store/businessStore';

// ── Helpers ────────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function localToISO(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0).toISOString();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toLocalDateStr(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Pantalla ──────────────────────────────────────────────────────────────

export default function RescheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { business } = useBusinessStore();
  const { appointments, reschedule, updateStatus, fetchAppointments } =
    useAppointmentStore();

  const apt = appointments.find((a) => a.id === id);

  const [date, setDate] = useState(apt ? toLocalDateStr(apt.starts_at) : '');
  const [startTime, setStartTime] = useState(apt ? formatTime(apt.starts_at) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!apt) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-400">Turno no encontrado.</Text>
      </SafeAreaView>
    );
  }

  const clientName = apt.client?.full_name ?? apt.client_name ?? 'Cliente sin nombre';
  const serviceNames = apt.appointment_services
    .map((as) => as.services?.name)
    .filter(Boolean)
    .join(', ');

  const durationMs = new Date(apt.ends_at).getTime() - new Date(apt.starts_at).getTime();

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!DATE_RE.test(date)) errs.date = 'Formato: AAAA-MM-DD';
    if (!TIME_RE.test(startTime)) errs.time = 'Formato: HH:MM';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleReschedule = async () => {
    if (!business || !validate()) return;
    setSaving(true);
    const startsAt = localToISO(date, startTime);
    const endsAt = new Date(new Date(startsAt).getTime() + durationMs).toISOString();
    const err = await reschedule(apt.id, startsAt, endsAt);
    setSaving(false);
    if (err) {
      Alert.alert('Error al reprogramar', err);
    } else {
      await fetchAppointments(business.id);
      router.back();
    }
  };

  const handleCancel = () => {
    Alert.alert(
      '¿Cancelar turno?',
      `${clientName} — ${formatTime(apt.starts_at)}`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancelar turno',
          style: 'destructive',
          onPress: async () => {
            const err = await updateStatus(apt.id, 'cancelado');
            if (err) {
              Alert.alert('Error', err);
            } else {
              if (business) await fetchAppointments(business.id);
              router.back();
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="mr-3 active:opacity-60"
        >
          <Ionicons name="close" size={24} color="#374151" />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-gray-900">Reprogramar turno</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Resumen del turno */}
        <View className="bg-blue-50 rounded-2xl p-4 gap-1">
          <Text className="text-sm font-semibold text-blue-900">{clientName}</Text>
          {serviceNames ? (
            <Text className="text-xs text-blue-600">{serviceNames}</Text>
          ) : null}
          <Text className="text-xs text-blue-500 mt-1">
            Actual: {toLocalDateStr(apt.starts_at)} · {formatTime(apt.starts_at)} –{' '}
            {formatTime(apt.ends_at)}
          </Text>
        </View>

        {/* Nueva fecha y hora */}
        <View className="bg-white rounded-2xl p-4 gap-4">
          <Text className="text-sm font-semibold text-gray-700">Nueva fecha y hora</Text>

          <View className="flex-row gap-3">
            <View className="flex-1 gap-1">
              <Text className="text-xs text-gray-500">Fecha</Text>
              <TextInput
                className={`border rounded-xl px-3 py-2.5 text-sm text-gray-900 ${
                  errors.date ? 'border-red-400' : 'border-gray-200'
                }`}
                placeholder="AAAA-MM-DD"
                placeholderTextColor="#9ca3af"
                value={date}
                onChangeText={(t) => {
                  setDate(t);
                  setErrors((e) => ({ ...e, date: '' }));
                }}
                keyboardType="numeric"
                maxLength={10}
              />
              {errors.date ? (
                <Text className="text-xs text-red-500">{errors.date}</Text>
              ) : null}
            </View>

            <View className="flex-1 gap-1">
              <Text className="text-xs text-gray-500">Hora inicio</Text>
              <TextInput
                className={`border rounded-xl px-3 py-2.5 text-sm text-gray-900 ${
                  errors.time ? 'border-red-400' : 'border-gray-200'
                }`}
                placeholder="HH:MM"
                placeholderTextColor="#9ca3af"
                value={startTime}
                onChangeText={(t) => {
                  setStartTime(t);
                  setErrors((e) => ({ ...e, time: '' }));
                }}
                keyboardType="numeric"
                maxLength={5}
              />
              {errors.time ? (
                <Text className="text-xs text-red-500">{errors.time}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Acciones */}
        <View className="gap-3">
          <Pressable
            onPress={handleReschedule}
            disabled={saving}
            className={`rounded-2xl py-4 items-center ${
              saving ? 'bg-gray-100' : 'bg-blue-500'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${saving ? 'text-gray-400' : 'text-white'}`}
            >
              {saving ? 'Reprogramando…' : 'Confirmar reprogramación'}
            </Text>
          </Pressable>

          {apt.status !== 'cancelado' && apt.status !== 'completado' && (
            <Pressable
              onPress={handleCancel}
              className="rounded-2xl py-4 items-center border border-red-200 bg-red-50"
            >
              <Text className="text-sm font-semibold text-red-500">
                Cancelar este turno
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
