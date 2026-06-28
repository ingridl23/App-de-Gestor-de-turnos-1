import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import type { AppointmentStatus, AppointmentWithDetails } from '@/types';

// ── Helpers de rango de fechas (hora local → UTC ISO) ─────────────────────

function localDayRange(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const from = new Date(y, m - 1, d, 0, 0, 0, 0);
  const to = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

function localWeekRange(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const ref = new Date(y, m - 1, d);
  const dayOfWeek = ref.getDay(); // 0=dom
  const mon = new Date(ref);
  mon.setDate(ref.getDate() - ((dayOfWeek + 6) % 7));
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { from: mon.toISOString(), to: sun.toISOString() };
}

// ── Tipos ─────────────────────────────────────────────────────────────────

export interface ManualAppointmentData {
  businessId: string;
  serviceIds: string[];
  clientName: string;
  clientPhone: string;
  startsAt: string;
  endsAt: string;
  amount: number;
  notes?: string;
}

interface AppointmentStore {
  appointments: AppointmentWithDetails[];
  isLoading: boolean;
  selectedDate: string;
  viewMode: 'day' | 'week';
  filterStatus: AppointmentStatus | null;

  setSelectedDate: (date: string) => void;
  setViewMode: (mode: 'day' | 'week') => void;
  setFilterStatus: (status: AppointmentStatus | null) => void;

  fetchAppointments: (businessId: string) => Promise<void>;
  createManual: (data: ManualAppointmentData) => Promise<string | null>;
  updateStatus: (id: string, status: AppointmentStatus) => Promise<string | null>;
  reschedule: (id: string, startsAt: string, endsAt: string) => Promise<string | null>;
  subscribeRealtime: (businessId: string) => () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────

export const useAppointmentStore = create<AppointmentStore>((set, get) => ({
  appointments: [],
  isLoading: false,
  selectedDate: new Date().toISOString().split('T')[0],
  viewMode: 'day',
  filterStatus: null,

  setSelectedDate: (date) => set({ selectedDate: date }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setFilterStatus: (status) => set({ filterStatus: status }),

  fetchAppointments: async (businessId) => {
    set({ isLoading: true });
    const { selectedDate, viewMode } = get();
    const range =
      viewMode === 'day'
        ? localDayRange(selectedDate)
        : localWeekRange(selectedDate);

    const { data, error } = await supabase
      .from('appointments')
      .select(
        `*, client:users!client_id(id, full_name, avatar_url),
         appointment_services(service_id, services(id, name, duration_minutes, price))`
      )
      .eq('business_id', businessId)
      .gte('starts_at', range.from)
      .lte('starts_at', range.to)
      .order('starts_at');

    if (!error && data) {
      set({ appointments: data as unknown as AppointmentWithDetails[] });
    }
    set({ isLoading: false });
  },

  createManual: async (data) => {
    const { error } = await supabase.rpc('create_manual_appointment', {
      p_business_id: data.businessId,
      p_service_ids: data.serviceIds,
      p_client_name: data.clientName,
      p_client_phone: data.clientPhone,
      p_starts_at: data.startsAt,
      p_ends_at: data.endsAt,
      p_amount: data.amount,
      p_notes: data.notes ?? null,
    });
    if (error) {
      return error.message.includes('SLOT_TAKEN')
        ? 'El horario seleccionado ya está ocupado.'
        : error.message;
    }
    return null;
  },

  updateStatus: async (id, status) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id);
    if (error) return error.message;
    set((s) => ({
      appointments: s.appointments.map((a) =>
        a.id === id ? { ...a, status } : a
      ),
    }));
    return null;
  },

  reschedule: async (id, startsAt, endsAt) => {
    const { error } = await supabase
      .from('appointments')
      .update({ starts_at: startsAt, ends_at: endsAt })
      .eq('id', id);
    if (error) return error.message;
    set((s) => ({
      appointments: s.appointments.map((a) =>
        a.id === id ? { ...a, starts_at: startsAt, ends_at: endsAt } : a
      ),
    }));
    return null;
  },

  subscribeRealtime: (businessId) => {
    const channel = supabase
      .channel(`appointments:${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          get().fetchAppointments(businessId);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
}));
