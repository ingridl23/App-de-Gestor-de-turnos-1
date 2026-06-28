import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { useServiceStore } from '@/store/serviceStore';
import type { Service } from '@/types';

// ── Helpers ────────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function localToISO(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0).toISOString();
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Selector de servicio ──────────────────────────────────────────────────

function ServicePicker({
  services,
  selected,
  onSelect,
}: {
  services: Service[];
  selected: Service | null;
  onSelect: (s: Service) => void;
}) {
  const active = services.filter((s) => s.is_active);
  return (
    <View className="gap-2">
      {active.length === 0 ? (
        <Text className="text-sm text-gray-400">
          No tenés servicios activos aún.
        </Text>
      ) : (
        active.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => onSelect(s)}
            className={`flex-row items-center justify-between rounded-xl border px-3 py-3 ${
              selected?.id === s.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <View className="flex-1">
              <Text
                className={`text-sm font-medium ${
                  selected?.id === s.id ? 'text-blue-600' : 'text-gray-800'
                }`}
              >
                {s.name}
              </Text>
              <Text className="text-xs text-gray-400 mt-0.5">
                {s.duration_minutes} min · ${s.price.toFixed(0)}
              </Text>
            </View>
            {selected?.id === s.id && (
              <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
            )}
          </Pressable>
        ))
      )}
    </View>
  );
}

// ── Pantalla ──────────────────────────────────────────────────────────────

export default function NewAppointmentScreen() {
  const { business } = useBusinessStore();
  const { services, fetchServices } = useServiceStore();
  const { createManual, fetchAppointments, selectedDate } = useAppointmentStore();

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [date, setDate] = useState(selectedDate || todayStr());
  const [startTime, setStartTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      if (business) fetchServices(business.id);
    }, [business?.id])
  );

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!clientName.trim()) errs.clientName = 'El nombre es obligatorio.';
    if (!selectedService) errs.service = 'Seleccioná un servicio.';
    if (!DATE_RE.test(date)) errs.date = 'Formato: AAAA-MM-DD';
    if (!TIME_RE.test(startTime)) errs.time = 'Formato: HH:MM (ej: 09:30)';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!business || !validate() || !selectedService) return;
    setSaving(true);

    const startsAt = localToISO(date, startTime);
    const endsAt = addMinutes(startsAt, selectedService.duration_minutes);

    const err = await createManual({
      businessId: business.id,
      serviceIds: [selectedService.id],
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      startsAt,
      endsAt,
      amount: selectedService.price,
      notes: notes.trim() || undefined,
    });

    setSaving(false);

    if (err) {
      Alert.alert('No se pudo crear el turno', err);
    } else {
      await fetchAppointments(business.id);
      router.back();
    }
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
        <Text className="flex-1 text-lg font-bold text-gray-900">Nuevo turno</Text>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className={`px-4 py-1.5 rounded-lg ${saving ? 'bg-gray-100' : 'bg-blue-500'}`}
        >
          <Text
            className={`text-sm font-semibold ${saving ? 'text-gray-400' : 'text-white'}`}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Datos del cliente */}
        <View className="bg-white rounded-2xl p-4 gap-4">
          <Text className="text-sm font-semibold text-gray-700">Cliente</Text>

          <View className="gap-1">
            <Text className="text-xs text-gray-500">Nombre *</Text>
            <TextInput
              className={`border rounded-xl px-3 py-2.5 text-sm text-gray-900 ${
                errors.clientName ? 'border-red-400' : 'border-gray-200'
              }`}
              placeholder="Ej: María García"
              placeholderTextColor="#9ca3af"
              value={clientName}
              onChangeText={(t) => {
                setClientName(t);
                setErrors((e) => ({ ...e, clientName: '' }));
              }}
            />
            {errors.clientName ? (
              <Text className="text-xs text-red-500">{errors.clientName}</Text>
            ) : null}
          </View>

          <View className="gap-1">
            <Text className="text-xs text-gray-500">Teléfono (opcional)</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900"
              placeholder="Ej: 11 2345-6789"
              placeholderTextColor="#9ca3af"
              value={clientPhone}
              onChangeText={setClientPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Servicio */}
        <View className="bg-white rounded-2xl p-4 gap-3">
          <Text className="text-sm font-semibold text-gray-700">Servicio *</Text>
          <ServicePicker
            services={services}
            selected={selectedService}
            onSelect={(s) => {
              setSelectedService(s);
              setErrors((e) => ({ ...e, service: '' }));
            }}
          />
          {errors.service ? (
            <Text className="text-xs text-red-500">{errors.service}</Text>
          ) : null}
        </View>

        {/* Fecha y hora */}
        <View className="bg-white rounded-2xl p-4 gap-4">
          <Text className="text-sm font-semibold text-gray-700">Fecha y hora</Text>

          <View className="flex-row gap-3">
            <View className="flex-1 gap-1">
              <Text className="text-xs text-gray-500">Fecha *</Text>
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
              <Text className="text-xs text-gray-500">Hora inicio *</Text>
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

          {selectedService && TIME_RE.test(startTime) && DATE_RE.test(date) && (
            <View className="bg-blue-50 rounded-xl px-3 py-2 flex-row gap-2 items-center">
              <Ionicons name="time-outline" size={14} color="#3b82f6" />
              <Text className="text-xs text-blue-600">
                Finaliza a las{' '}
                {new Date(
                  addMinutes(localToISO(date, startTime), selectedService.duration_minutes)
                ).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
        </View>

        {/* Notas */}
        <View className="bg-white rounded-2xl p-4 gap-2">
          <Text className="text-sm font-semibold text-gray-700">Notas (opcional)</Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900"
            placeholder="Ej: cliente nuevo, pago en efectivo…"
            placeholderTextColor="#9ca3af"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
