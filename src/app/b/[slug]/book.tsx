import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createMPPreference } from '@/lib/mercadopago';
import { supabase } from '@/lib/supabase';
import type { Business, Service } from '@/types';

// ── Tipos ──────────────────────────────────────────────────────────────────

interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface BusinessWithData extends Business {
  services: Service[];
  availability: AvailabilitySlot[];
}

// ── Helpers de tiempo ──────────────────────────────────────────────────────

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToStr(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

function isoToLocalMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function localToISO(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}

function buildDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getTodayStr(): string {
  const d = new Date();
  return buildDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

// ── Generación de slots disponibles ────────────────────────────────────────

function generateSlots(
  totalDuration: number,
  avail: { start_time: string; end_time: string }[],
  booked: { starts_at: string; ends_at: string }[],
  breakMinutes: number
): string[] {
  const slots: string[] = [];
  const bookedRanges = booked.map((b) => ({
    start: isoToLocalMinutes(b.starts_at),
    end: isoToLocalMinutes(b.ends_at),
  }));

  for (const w of avail) {
    const wStart = parseTime(w.start_time);
    const wEnd = parseTime(w.end_time);
    let t = wStart;
    while (t + totalDuration <= wEnd) {
      const slotEnd = t + totalDuration;
      const conflict = bookedRanges.some(
        (b) => slotEnd > b.start - breakMinutes && t < b.end + breakMinutes
      );
      if (!conflict) slots.push(minutesToStr(t));
      t += 15;
    }
  }
  return slots;
}

// ── Calendario ─────────────────────────────────────────────────────────────

function buildCalendarRows(year: number, month: number): Array<Array<number | null>> {
  const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Dom
  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = (firstDow + 6) % 7; // Lun=0 … Dom=6
  const cells: Array<number | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: Array<Array<number | null>> = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DOW_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const DOW_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ── Pantalla ────────────────────────────────────────────────────────────────

export default function BookScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  // Business data
  const [business, setBusiness] = useState<BusinessWithData | null>(null);
  const [loadingBusiness, setLoadingBusiness] = useState(true);

  // Flujo por pasos
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Paso 1 — servicios
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());

  // Paso 2 — calendario
  const nowDate = new Date();
  const [calYear, setCalYear] = useState(nowDate.getFullYear());
  const [calMonth, setCalMonth] = useState(nowDate.getMonth() + 1);
  const [blockedSet, setBlockedSet] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Paso 2 — slots
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Paso 3 — confirmación
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Éxito
  const [bookedStartsAt, setBookedStartsAt] = useState<string | null>(null);
  const [bookedEndsAt, setBookedEndsAt] = useState<string | null>(null);

  // ── Valores derivados ──────────────────────────────────────────────────

  const activeServices = useMemo(
    () => (business?.services ?? []).filter((s) => s.is_active !== false),
    [business]
  );

  const selectedServices = useMemo(
    () => activeServices.filter((s) => selectedServiceIds.has(s.id)),
    [activeServices, selectedServiceIds]
  );

  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0),
    [selectedServices]
  );

  const totalPrice = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.price, 0),
    [selectedServices]
  );

  const availDows = useMemo(() => {
    const s = new Set<number>();
    (business?.availability ?? []).forEach((a) => s.add(a.day_of_week));
    return s;
  }, [business]);

  const calRows = useMemo(() => buildCalendarRows(calYear, calMonth), [calYear, calMonth]);

  const todayStr = useMemo(getTodayStr, []);

  const isCurrentMonth =
    calYear === nowDate.getFullYear() && calMonth === nowDate.getMonth() + 1;

  // ── Carga del negocio ─────────────────────────────────────────────────

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('businesses')
      .select(
        `*, services(id, name, description, duration_minutes, price, is_active),
         availability(day_of_week, start_time, end_time)`
      )
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        setBusiness(data as BusinessWithData | null);
        setLoadingBusiness(false);
      });
  }, [slug]);

  // ── Días bloqueados del mes visible ──────────────────────────────────

  useEffect(() => {
    if (!business) return;
    const lastDay = new Date(calYear, calMonth, 0).getDate();
    supabase
      .from('blocked_dates')
      .select('blocked_date')
      .eq('business_id', business.id)
      .gte('blocked_date', buildDateStr(calYear, calMonth, 1))
      .lte('blocked_date', buildDateStr(calYear, calMonth, lastDay))
      .then(({ data }) => {
        setBlockedSet(new Set((data ?? []).map((r) => r.blocked_date as string)));
      });
  }, [business?.id, calYear, calMonth]);

  // ── Slots al seleccionar fecha ────────────────────────────────────────

  useEffect(() => {
    if (!selectedDate || !business || selectedServices.length === 0) {
      setSlots([]);
      return;
    }
    setSlotsLoading(true);
    setSelectedTime(null);

    // Rango UTC que cubre la jornada local completa
    const [y, m, d] = selectedDate.split('-').map(Number);
    const from = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
    const to = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();

    supabase
      .rpc('get_day_appointments', {
        p_business_id: business.id,
        p_from: from,
        p_to: to,
      })
      .then(({ data }) => {
        const booked = (data ?? []) as { starts_at: string; ends_at: string }[];
        const dow = new Date(`${selectedDate}T00:00:00`).getDay();
        const dayAvail = business.availability.filter((a) => a.day_of_week === dow);
        const generated = generateSlots(
          totalDuration,
          dayAvail,
          booked,
          business.break_minutes
        );
        setSlots(generated);
        setSlotsLoading(false);
      });
  }, [selectedDate, totalDuration, business?.id]);

  // ── Helpers ───────────────────────────────────────────────────────────

  function isDayAvailable(day: number): boolean {
    const ds = buildDateStr(calYear, calMonth, day);
    if (ds < todayStr) return false;
    if (blockedSet.has(ds)) return false;
    const dow = new Date(`${ds}T00:00:00`).getDay();
    return availDows.has(dow);
  }

  function prevMonth() {
    if (isCurrentMonth) return;
    if (calMonth === 1) { setCalYear((y) => y - 1); setCalMonth(12); }
    else setCalMonth((m) => m - 1);
  }

  function nextMonth() {
    if (calMonth === 12) { setCalYear((y) => y + 1); setCalMonth(1); }
    else setCalMonth((m) => m + 1);
  }

  function toggleService(id: string) {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function goBack() {
    if (step === 1) router.back();
    else if (step === 2) setStep(1);
    else setStep(2);
  }

  function formatDisplayDate(ds: string): string {
    const [y, m, d] = ds.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    return `${DOW_FULL[dow]}, ${d} de ${MONTH_NAMES[m - 1]} de ${y}`;
  }

  function formatLocalTime(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  async function handleConfirm() {
    if (!business || !selectedDate || !selectedTime) return;
    setSubmitting(true);
    setSubmitError(null);

    const startsAt = localToISO(selectedDate, selectedTime);
    const endsAt = localToISO(
      selectedDate,
      minutesToStr(parseTime(selectedTime) + totalDuration)
    );

    const { data: appointmentId, error } = await supabase.rpc('create_appointment', {
      p_business_id: business.id,
      p_service_ids: [...selectedServiceIds],
      p_starts_at: startsAt,
      p_ends_at: endsAt,
      p_amount: totalPrice,
    });

    if (error) {
      setSubmitting(false);
      setSubmitError(
        error.message.includes('SLOT_TAKEN')
          ? 'El horario ya fue reservado. Por favor elegí otro horario.'
          : 'Ocurrió un error al confirmar el turno. Intentá de nuevo.'
      );
      return;
    }

    // Si el negocio tiene cobro digital activo, abrir Checkout Pro
    if (business.payment_mode !== 'none' && business.mp_user_id && appointmentId) {
      try {
        const { initPoint } = await createMPPreference(appointmentId as string);
        await WebBrowser.openAuthSessionAsync(initPoint, 'appdegestordeturnos1://payment');
      } catch {
        // Si falla el pago, el turno igual quedó guardado (status: pendiente)
      }
    }

    setSubmitting(false);
    setBookedStartsAt(startsAt);
    setBookedEndsAt(endsAt);
  }

  // ── Loading ───────────────────────────────────────────────────────────

  if (loadingBusiness) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  if (!business) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6 gap-4">
        <Text className="text-gray-500 text-center">No se pudo cargar el negocio.</Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-blue-500 font-medium">Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── Pantalla de éxito ─────────────────────────────────────────────────

  if (bookedStartsAt && bookedEndsAt) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6 gap-6">
        <View className="w-20 h-20 rounded-full bg-green-100 items-center justify-center">
          <Ionicons name="checkmark" size={44} color="#22c55e" />
        </View>

        <View className="items-center gap-2">
          <Text className="text-2xl font-bold text-gray-900">¡Turno confirmado!</Text>
          {selectedDate && (
            <Text className="text-gray-500 text-center text-sm leading-relaxed">
              {formatDisplayDate(selectedDate)}{'\n'}
              {formatLocalTime(bookedStartsAt)} – {formatLocalTime(bookedEndsAt)}
            </Text>
          )}
        </View>

        <View className="w-full gap-3 mt-2">
          <Pressable
            onPress={() => router.replace('/(client-tabs)')}
            className="bg-blue-500 rounded-2xl py-4 items-center active:opacity-80"
          >
            <Text className="text-white font-semibold text-base">Ver mis turnos</Text>
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            className="border border-gray-200 rounded-2xl py-4 items-center active:opacity-80"
          >
            <Text className="text-gray-700 font-medium">Volver al perfil</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Flujo de reserva ──────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-gray-50">

      {/* ── Header con pasos ──────────────────────────────────────────── */}
      <View className="bg-white px-4 pt-4 pb-3 flex-row items-center gap-3 border-b border-gray-100">
        <Pressable onPress={goBack} className="p-1 active:opacity-70">
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </Pressable>

        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">Reservar turno</Text>
          <Text className="text-xs text-gray-400">
            {step === 1
              ? 'Paso 1 de 3 — Servicios'
              : step === 2
              ? 'Paso 2 de 3 — Fecha y hora'
              : 'Paso 3 de 3 — Confirmación'}
          </Text>
        </View>

        {/* Indicador de progreso */}
        <View className="flex-row gap-1.5 items-center">
          {([1, 2, 3] as const).map((s) => (
            <View
              key={s}
              className={`h-1.5 rounded-full ${
                s <= step ? 'bg-blue-500 w-5' : 'bg-gray-200 w-1.5'
              }`}
            />
          ))}
        </View>
      </View>

      {/* ══════════════════ PASO 1: SERVICIOS ══════════════════ */}
      {step === 1 && (
        <>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          >
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              ¿Qué servicio querés reservar?
            </Text>

            {activeServices.length === 0 ? (
              <View className="bg-white rounded-2xl p-6 items-center gap-2">
                <Ionicons name="cut-outline" size={32} color="#d1d5db" />
                <Text className="text-gray-400 text-sm text-center">
                  Este negocio no tiene servicios disponibles.
                </Text>
              </View>
            ) : (
              <View className="bg-white rounded-2xl overflow-hidden">
                {activeServices.map((service, i) => {
                  const checked = selectedServiceIds.has(service.id);
                  return (
                    <View key={service.id}>
                      {i > 0 && <View className="h-px bg-gray-100 mx-4" />}
                      <Pressable
                        onPress={() => toggleService(service.id)}
                        className="flex-row items-center px-4 py-4 gap-3 active:opacity-80"
                      >
                        <View
                          className={`w-5 h-5 rounded border-2 items-center justify-center ${
                            checked
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-300'
                          }`}
                        >
                          {checked && (
                            <Ionicons name="checkmark" size={13} color="white" />
                          )}
                        </View>

                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-gray-900">
                            {service.name}
                          </Text>
                          {service.description ? (
                            <Text className="text-xs text-gray-400 mt-0.5">
                              {service.description}
                            </Text>
                          ) : null}
                          <View className="flex-row items-center gap-1 mt-1">
                            <Ionicons name="time-outline" size={12} color="#9ca3af" />
                            <Text className="text-xs text-gray-400">
                              {service.duration_minutes} min
                            </Text>
                          </View>
                        </View>

                        <Text className="text-base font-bold text-blue-500">
                          ${service.price.toFixed(0)}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          <View className="bg-white border-t border-gray-100 px-4 pt-3 pb-6">
            {selectedServices.length > 0 && (
              <View className="flex-row justify-between mb-3 px-1">
                <Text className="text-sm text-gray-500">
                  {totalDuration} min ·{' '}
                  {selectedServices.length} servicio
                  {selectedServices.length > 1 ? 's' : ''}
                </Text>
                <Text className="text-sm font-bold text-gray-900">
                  ${totalPrice.toFixed(0)}
                </Text>
              </View>
            )}
            <Pressable
              onPress={() => setStep(2)}
              disabled={selectedServices.length === 0}
              className={`rounded-2xl py-4 items-center ${
                selectedServices.length === 0
                  ? 'bg-gray-100'
                  : 'bg-blue-500 active:opacity-80'
              }`}
            >
              <Text
                className={`font-semibold text-base ${
                  selectedServices.length === 0 ? 'text-gray-400' : 'text-white'
                }`}
              >
                Elegir fecha y hora
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* ══════════════════ PASO 2: FECHA Y HORA ══════════════════ */}
      {step === 2 && (
        <>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          >
            {/* Navegación de mes */}
            <View className="flex-row items-center justify-between mb-4">
              <Pressable
                onPress={prevMonth}
                disabled={isCurrentMonth}
                className="p-2 active:opacity-70"
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={isCurrentMonth ? '#d1d5db' : '#374151'}
                />
              </Pressable>

              <Text className="text-sm font-semibold text-gray-900">
                {MONTH_NAMES[calMonth - 1]} {calYear}
              </Text>

              <Pressable onPress={nextMonth} className="p-2 active:opacity-70">
                <Ionicons name="chevron-forward" size={20} color="#374151" />
              </Pressable>
            </View>

            {/* Cabecera de días */}
            <View className="flex-row mb-1">
              {DOW_LABELS.map((l) => (
                <View key={l} className="flex-1 items-center">
                  <Text className="text-xs font-semibold text-gray-400">{l}</Text>
                </View>
              ))}
            </View>

            {/* Grilla de días */}
            {calRows.map((row, ri) => (
              <View key={ri} className="flex-row mb-1">
                {row.map((day, ci) => {
                  if (!day) return <View key={ci} className="flex-1" />;
                  const ds = buildDateStr(calYear, calMonth, day);
                  const available = isDayAvailable(day);
                  const isSelected = ds === selectedDate;
                  const isPast = ds < todayStr;
                  return (
                    <Pressable
                      key={ci}
                      disabled={!available}
                      onPress={() => setSelectedDate(ds)}
                      className="flex-1 items-center py-0.5"
                    >
                      <View
                        className={`w-9 h-9 rounded-full items-center justify-center ${
                          isSelected ? 'bg-blue-500' : ''
                        }`}
                      >
                        <Text
                          className={`text-sm font-medium ${
                            isSelected
                              ? 'text-white'
                              : isPast || !available
                              ? 'text-gray-300'
                              : 'text-gray-900'
                          }`}
                        >
                          {day}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}

            {/* Slots de hora */}
            {selectedDate && (
              <View className="mt-5">
                <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Horarios disponibles — {totalDuration} min
                </Text>

                {slotsLoading ? (
                  <ActivityIndicator color="#3b82f6" />
                ) : slots.length === 0 ? (
                  <View className="bg-white rounded-2xl p-5 items-center gap-2">
                    <Ionicons name="time-outline" size={28} color="#d1d5db" />
                    <Text className="text-gray-400 text-sm text-center">
                      No hay horarios disponibles para este día.
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {slots.map((slot) => (
                      <Pressable
                        key={slot}
                        onPress={() => setSelectedTime(slot)}
                        className={`px-4 py-2.5 rounded-xl border ${
                          selectedTime === slot
                            ? 'bg-blue-500 border-blue-500'
                            : 'bg-white border-gray-200 active:opacity-70'
                        }`}
                      >
                        <Text
                          className={`text-sm font-medium ${
                            selectedTime === slot ? 'text-white' : 'text-gray-700'
                          }`}
                        >
                          {slot}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <View className="bg-white border-t border-gray-100 px-4 pt-3 pb-6">
            <Pressable
              onPress={() => setStep(3)}
              disabled={!selectedDate || !selectedTime}
              className={`rounded-2xl py-4 items-center ${
                !selectedDate || !selectedTime
                  ? 'bg-gray-100'
                  : 'bg-blue-500 active:opacity-80'
              }`}
            >
              <Text
                className={`font-semibold text-base ${
                  !selectedDate || !selectedTime ? 'text-gray-400' : 'text-white'
                }`}
              >
                Ver resumen
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* ══════════════════ PASO 3: CONFIRMACIÓN ══════════════════ */}
      {step === 3 && selectedDate && selectedTime && (
        <>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          >
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Resumen de tu turno
            </Text>

            <View className="bg-white rounded-2xl p-5 gap-4">
              <Text className="text-base font-bold text-gray-900">{business.name}</Text>

              {/* Servicios */}
              <View className="gap-1.5">
                <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Servicios
                </Text>
                {selectedServices.map((s) => (
                  <View key={s.id} className="flex-row justify-between">
                    <Text className="text-sm text-gray-700">{s.name}</Text>
                    <Text className="text-sm text-gray-500">${s.price.toFixed(0)}</Text>
                  </View>
                ))}
              </View>

              <View className="h-px bg-gray-100" />

              {/* Fecha y hora */}
              <View className="gap-2">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                  <Text className="text-sm text-gray-700">
                    {formatDisplayDate(selectedDate)}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="time-outline" size={16} color="#6b7280" />
                  <Text className="text-sm text-gray-700">
                    {selectedTime} –{' '}
                    {minutesToStr(parseTime(selectedTime) + totalDuration)}{' '}
                    ({totalDuration} min)
                  </Text>
                </View>
              </View>

              <View className="h-px bg-gray-100" />

              {/* Total */}
              <View className="flex-row justify-between items-center">
                <Text className="text-sm font-semibold text-gray-900">Total</Text>
                <Text className="text-lg font-bold text-blue-500">
                  ${totalPrice.toFixed(0)}
                </Text>
              </View>
            </View>

            {submitError && (
              <View className="mt-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <Text className="text-red-600 text-sm text-center">{submitError}</Text>
              </View>
            )}
          </ScrollView>

          <View className="bg-white border-t border-gray-100 px-4 pt-3 pb-6">
            <Pressable
              onPress={handleConfirm}
              disabled={submitting}
              className={`rounded-2xl py-4 items-center ${
                submitting ? 'bg-blue-300' : 'bg-blue-500 active:opacity-80'
              }`}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  Confirmar reserva
                </Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
