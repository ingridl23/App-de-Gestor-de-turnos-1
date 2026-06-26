import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import TimeInput from '@/components/TimeInput';
import { useBusinessStore } from '@/store/businessStore';
import {
  DAYS_ORDER,
  DAY_LABELS,
  type BreakMinutes,
  type DaySchedule,
  useAvailabilityStore,
} from '@/store/availabilityStore';

// ────────────────────────────────────────────────────────
// Sub-componentes
// ────────────────────────────────────────────────────────

function BreakTimeSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: BreakMinutes) => void;
}) {
  const options: BreakMinutes[] = [0, 5, 10, 15];
  return (
    <View className="bg-white rounded-2xl p-4 gap-3">
      <View>
        <Text className="text-base font-semibold text-gray-900">
          Descanso entre turnos
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          Tiempo libre entre cada reserva
        </Text>
      </View>
      <View className="flex-row gap-2">
        {options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            className={`flex-1 py-2 rounded-xl border items-center ${
              value === opt ? 'bg-blue-500 border-blue-500' : 'border-gray-200 bg-white'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                value === opt ? 'text-white' : 'text-gray-700'
              }`}
            >
              {opt === 0 ? 'Sin descanso' : `${opt} min`}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SlotRow({
  slot,
  onChangeStart,
  onChangeEnd,
  onRemove,
}: {
  slot: { start_time: string; end_time: string };
  onChangeStart: (v: string) => void;
  onChangeEnd: (v: string) => void;
  onRemove: () => void;
}) {
  const isValidTime = (t: string) => /^([0-1]\d|2[0-3]):([0-5]\d)$/.test(t);

  return (
    <View className="flex-row items-center gap-2 pl-2">
      <View className="w-1 h-6 bg-blue-200 rounded-full" />
      <TimeInput
        value={slot.start_time}
        onChange={onChangeStart}
        isInvalid={slot.start_time.length === 5 && !isValidTime(slot.start_time)}
      />
      <Text className="text-gray-400 text-sm">—</Text>
      <TimeInput
        value={slot.end_time}
        onChange={onChangeEnd}
        isInvalid={slot.end_time.length === 5 && !isValidTime(slot.end_time)}
      />
      <Pressable onPress={onRemove} hitSlop={8} className="ml-1 active:opacity-60">
        <Ionicons name="close-circle" size={18} color="#d1d5db" />
      </Pressable>
    </View>
  );
}

function DayCard({
  day,
  onToggle,
  onAddSlot,
  onRemoveSlot,
  onUpdateSlot,
}: {
  day: DaySchedule;
  onToggle: () => void;
  onAddSlot: () => void;
  onRemoveSlot: (index: number) => void;
  onUpdateSlot: (index: number, field: 'start_time' | 'end_time', value: string) => void;
}) {
  return (
    <View className="bg-white rounded-2xl p-4 gap-3">
      {/* Nombre del día + toggle */}
      <View className="flex-row items-center justify-between">
        <Text
          className={`text-base font-semibold ${
            day.isAvailable ? 'text-gray-900' : 'text-gray-400'
          }`}
        >
          {DAY_LABELS[day.dayOfWeek]}
        </Text>
        <Switch
          value={day.isAvailable}
          onValueChange={onToggle}
          trackColor={{ false: '#e5e7eb', true: '#93c5fd' }}
          thumbColor={day.isAvailable ? '#3b82f6' : '#d1d5db'}
        />
      </View>

      {/* Franjas horarias */}
      {day.isAvailable && (
        <View className="gap-2">
          {day.slots.map((slot, i) => (
            <SlotRow
              key={i}
              slot={slot}
              onChangeStart={(v) => onUpdateSlot(i, 'start_time', v)}
              onChangeEnd={(v) => onUpdateSlot(i, 'end_time', v)}
              onRemove={() => onRemoveSlot(i)}
            />
          ))}

          <Pressable
            onPress={onAddSlot}
            className="flex-row items-center gap-1 mt-1 active:opacity-60"
          >
            <Ionicons name="add-circle-outline" size={16} color="#3b82f6" />
            <Text className="text-blue-500 text-sm">Agregar franja</Text>
          </Pressable>
        </View>
      )}

      {/* Estado vacío para días activos sin franjas */}
      {day.isAvailable && day.slots.length === 0 && (
        <Text className="text-xs text-amber-500">
          Agregá al menos una franja horaria.
        </Text>
      )}
    </View>
  );
}

// ────────────────────────────────────────────────────────
// Sección: Fechas bloqueadas
// ────────────────────────────────────────────────────────

function BlockedDatesSection({ businessId }: { businessId: string }) {
  const { blockedDates, addBlockedDate, removeBlockedDate, fetchBlockedDates } =
    useAvailabilityStore();
  const [newDate, setNewDate] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchBlockedDates(businessId);
    }, [businessId])
  );

  const handleAdd = async () => {
    setAddError(null);
    const err = await addBlockedDate(businessId, newDate.trim());
    if (err) {
      setAddError(err);
    } else {
      setNewDate('');
    }
  };

  const handleRemove = (date: string) => {
    Alert.alert('Desbloquear fecha', `¿Quitás el bloqueo del ${date}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar bloqueo',
        onPress: () => removeBlockedDate(businessId, date),
      },
    ]);
  };

  return (
    <View className="bg-white rounded-2xl p-4 gap-3">
      <View>
        <Text className="text-base font-semibold text-gray-900">
          Fechas bloqueadas
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          Días puntuales en que no atendés (feriados, vacaciones)
        </Text>
      </View>

      {/* Lista de fechas bloqueadas */}
      {blockedDates.length === 0 ? (
        <Text className="text-sm text-gray-400">Sin fechas bloqueadas.</Text>
      ) : (
        <View className="gap-2">
          {blockedDates.map((date) => (
            <View
              key={date}
              className="flex-row items-center justify-between bg-gray-50 rounded-xl px-3 py-2"
            >
              <Text className="text-sm text-gray-700">{date}</Text>
              <Pressable onPress={() => handleRemove(date)} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#d1d5db" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Agregar fecha */}
      <View className="flex-row gap-2 items-center">
        <TextInput
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900"
          placeholder="AAAA-MM-DD  (ej: 2025-07-09)"
          placeholderTextColor="#9ca3af"
          value={newDate}
          onChangeText={setNewDate}
          keyboardType="numeric"
          maxLength={10}
        />
        <Pressable
          onPress={handleAdd}
          className="bg-blue-500 rounded-xl px-3 py-2 active:opacity-80"
        >
          <Ionicons name="add" size={20} color="white" />
        </Pressable>
      </View>
      {addError && <Text className="text-red-500 text-xs">{addError}</Text>}
    </View>
  );
}

// ────────────────────────────────────────────────────────
// Pantalla principal
// ────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const { business } = useBusinessStore();
  const {
    schedule,
    breakMinutes,
    isLoading,
    hasChanges,
    fetchSchedule,
    saveSchedule,
    setBreakMinutes,
    toggleDay,
    addSlot,
    removeSlot,
    updateSlot,
  } = useAvailabilityStore();

  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (business) {
        fetchSchedule(business.id, business.break_minutes ?? 0);
      }
    }, [business?.id])
  );

  const handleSave = async () => {
    if (!business) return;
    setSaving(true);
    const err = await saveSchedule(business.id);
    setSaving(false);
    if (err) {
      Alert.alert('Error al guardar', err);
    } else {
      Alert.alert('¡Listo!', 'Tu disponibilidad fue guardada.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <Text className="text-lg font-bold text-gray-900">Mi Agenda</Text>
        <Pressable
          onPress={handleSave}
          disabled={saving || !hasChanges}
          className={`px-4 py-1.5 rounded-lg ${
            hasChanges ? 'bg-blue-500' : 'bg-gray-100'
          }`}
        >
          <Text
            className={`text-sm font-semibold ${
              hasChanges ? 'text-white' : 'text-gray-400'
            }`}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400">Cargando agenda…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Descanso entre turnos */}
          <BreakTimeSelector
            value={breakMinutes}
            onChange={setBreakMinutes}
          />

          {/* Días de la semana */}
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
            Horarios semanales
          </Text>

          {DAYS_ORDER.map((dayOfWeek) => {
            const day = schedule.find((d) => d.dayOfWeek === dayOfWeek)!;
            return (
              <DayCard
                key={dayOfWeek}
                day={day}
                onToggle={() => toggleDay(dayOfWeek)}
                onAddSlot={() => addSlot(dayOfWeek)}
                onRemoveSlot={(i) => removeSlot(dayOfWeek, i)}
                onUpdateSlot={(i, field, value) => updateSlot(dayOfWeek, i, field, value)}
              />
            );
          })}

          {/* Fechas bloqueadas */}
          {business && (
            <>
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mt-2">
                Días especiales
              </Text>
              <BlockedDatesSection businessId={business.id} />
            </>
          )}

          {/* Nota CA-4 */}
          <View className="bg-blue-50 rounded-xl p-3 flex-row gap-2">
            <Ionicons name="information-circle-outline" size={16} color="#3b82f6" />
            <Text className="text-xs text-blue-600 flex-1">
              Los turnos ya confirmados no se ven afectados por cambios en la
              disponibilidad.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
