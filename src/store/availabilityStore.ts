import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface TimeSlot {
  start_time: string; // "HH:mm"
  end_time: string;   // "HH:mm"
}

export interface DaySchedule {
  dayOfWeek: number;
  isAvailable: boolean;
  slots: TimeSlot[];
}

export const DAY_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

// Orden de visualización (Lunes primero)
export const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0];

const BREAK_OPTIONS = [0, 5, 10, 15] as const;
export type BreakMinutes = (typeof BREAK_OPTIONS)[number];

const emptySchedule = (): DaySchedule[] =>
  [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    dayOfWeek: d,
    isAvailable: false,
    slots: [],
  }));

function trimTime(t: string): string {
  return t.length > 5 ? t.substring(0, 5) : t; // "09:00:00" → "09:00"
}

function isValidTime(t: string): boolean {
  return /^([0-1]\d|2[0-3]):([0-5]\d)$/.test(t);
}

interface AvailabilityState {
  schedule: DaySchedule[];
  breakMinutes: BreakMinutes;
  blockedDates: string[]; // "YYYY-MM-DD"
  isLoading: boolean;
  hasChanges: boolean;
  fetchSchedule: (businessId: string, currentBreakMinutes: number) => Promise<void>;
  fetchBlockedDates: (businessId: string) => Promise<void>;
  saveSchedule: (businessId: string) => Promise<string | null>;
  addBlockedDate: (businessId: string, date: string) => Promise<string | null>;
  removeBlockedDate: (businessId: string, date: string) => Promise<void>;
  setBreakMinutes: (minutes: BreakMinutes) => void;
  toggleDay: (dayOfWeek: number) => void;
  addSlot: (dayOfWeek: number) => void;
  removeSlot: (dayOfWeek: number, index: number) => void;
  updateSlot: (
    dayOfWeek: number,
    index: number,
    field: 'start_time' | 'end_time',
    value: string
  ) => void;
}

export const useAvailabilityStore = create<AvailabilityState>((set, get) => ({
  schedule: emptySchedule(),
  breakMinutes: 0,
  blockedDates: [],
  isLoading: false,
  hasChanges: false,

  fetchSchedule: async (businessId, currentBreakMinutes) => {
    set({ isLoading: true, breakMinutes: currentBreakMinutes as BreakMinutes });
    const { data } = await supabase
      .from('availability')
      .select('*')
      .eq('business_id', businessId)
      .order('start_time', { ascending: true });

    const newSchedule = emptySchedule().map((day) => {
      const daySlots = (data ?? [])
        .filter((r) => r.day_of_week === day.dayOfWeek)
        .map((r) => ({ start_time: trimTime(r.start_time), end_time: trimTime(r.end_time) }));
      return {
        ...day,
        isAvailable: daySlots.length > 0,
        slots: daySlots,
      };
    });

    set({ schedule: newSchedule, isLoading: false, hasChanges: false });
  },

  fetchBlockedDates: async (businessId) => {
    const { data } = await supabase
      .from('blocked_dates')
      .select('blocked_date')
      .eq('business_id', businessId)
      .order('blocked_date', { ascending: true });
    set({ blockedDates: (data ?? []).map((r) => r.blocked_date) });
  },

  saveSchedule: async (businessId) => {
    const { schedule, breakMinutes } = get();

    // Validación de franjas
    for (const day of schedule) {
      if (!day.isAvailable) continue;
      if (day.slots.length === 0) {
        return `${DAY_LABELS[day.dayOfWeek]}: activaste el día pero no tiene franjas horarias.`;
      }
      for (const slot of day.slots) {
        if (!isValidTime(slot.start_time) || !isValidTime(slot.end_time)) {
          return `${DAY_LABELS[day.dayOfWeek]}: formato inválido. Usá HH:MM (ej: 09:00).`;
        }
        if (slot.start_time >= slot.end_time) {
          return `${DAY_LABELS[day.dayOfWeek]}: el inicio debe ser anterior al fin.`;
        }
      }
      // Verificar superposición de franjas
      const sorted = [...day.slots].sort((a, b) =>
        a.start_time.localeCompare(b.start_time)
      );
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].end_time > sorted[i + 1].start_time) {
          return `${DAY_LABELS[day.dayOfWeek]}: las franjas se superponen.`;
        }
      }
    }

    // Borrar todas las franjas existentes del negocio
    const { error: delError } = await supabase
      .from('availability')
      .delete()
      .eq('business_id', businessId);
    if (delError) return delError.message;

    // Insertar las nuevas franjas
    const toInsert = schedule
      .filter((d) => d.isAvailable && d.slots.length > 0)
      .flatMap((d) =>
        d.slots.map((slot) => ({
          business_id: businessId,
          day_of_week: d.dayOfWeek,
          start_time: slot.start_time,
          end_time: slot.end_time,
        }))
      );

    if (toInsert.length > 0) {
      const { error: insError } = await supabase.from('availability').insert(toInsert);
      if (insError) return insError.message;
    }

    // Actualizar break_minutes en el negocio
    await supabase
      .from('businesses')
      .update({ break_minutes: breakMinutes })
      .eq('id', businessId);

    set({ hasChanges: false });
    return null;
  },

  addBlockedDate: async (businessId, date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return 'Formato inválido. Usá AAAA-MM-DD (ej: 2025-07-09).';
    }
    const { error } = await supabase
      .from('blocked_dates')
      .insert({ business_id: businessId, blocked_date: date });
    if (error) {
      if (error.code === '23505') return 'Esa fecha ya está bloqueada.';
      return error.message;
    }
    set((state) => ({
      blockedDates: [...state.blockedDates, date].sort(),
    }));
    return null;
  },

  removeBlockedDate: async (businessId, date) => {
    await supabase
      .from('blocked_dates')
      .delete()
      .eq('business_id', businessId)
      .eq('blocked_date', date);
    set((state) => ({
      blockedDates: state.blockedDates.filter((d) => d !== date),
    }));
  },

  setBreakMinutes: (minutes) => set({ breakMinutes: minutes, hasChanges: true }),

  toggleDay: (dayOfWeek) =>
    set((state) => ({
      hasChanges: true,
      schedule: state.schedule.map((d) =>
        d.dayOfWeek !== dayOfWeek
          ? d
          : {
              ...d,
              isAvailable: !d.isAvailable,
              // Al activar un día sin franjas, agrega una por defecto
              slots:
                !d.isAvailable && d.slots.length === 0
                  ? [{ start_time: '09:00', end_time: '18:00' }]
                  : d.slots,
            }
      ),
    })),

  addSlot: (dayOfWeek) =>
    set((state) => ({
      hasChanges: true,
      schedule: state.schedule.map((d) =>
        d.dayOfWeek !== dayOfWeek
          ? d
          : { ...d, slots: [...d.slots, { start_time: '09:00', end_time: '13:00' }] }
      ),
    })),

  removeSlot: (dayOfWeek, index) =>
    set((state) => ({
      hasChanges: true,
      schedule: state.schedule.map((d) =>
        d.dayOfWeek !== dayOfWeek
          ? d
          : { ...d, slots: d.slots.filter((_, i) => i !== index) }
      ),
    })),

  updateSlot: (dayOfWeek, index, field, value) =>
    set((state) => ({
      hasChanges: true,
      schedule: state.schedule.map((d) =>
        d.dayOfWeek !== dayOfWeek
          ? d
          : {
              ...d,
              slots: d.slots.map((slot, i) =>
                i === index ? { ...slot, [field]: value } : slot
              ),
            }
      ),
    })),
}));
