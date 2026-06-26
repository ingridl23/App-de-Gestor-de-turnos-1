import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Service } from '@/types';

export interface ServiceInput {
  business_id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
}

interface ServiceState {
  services: Service[];
  isLoadingServices: boolean;
  fetchServices: (businessId: string) => Promise<void>;
  createService: (data: ServiceInput) => Promise<string | null>;
  updateService: (
    id: string,
    data: Omit<ServiceInput, 'business_id'>
  ) => Promise<string | null>;
  toggleActive: (id: string, isActive: boolean) => Promise<string | null>;
  deleteService: (id: string) => Promise<string | null>;
}

export const useServiceStore = create<ServiceState>((set, get) => ({
  services: [],
  isLoadingServices: false,

  fetchServices: async (businessId) => {
    set({ isLoadingServices: true });
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true });
    set({ services: (data as Service[]) ?? [], isLoadingServices: false });
  },

  createService: async (data) => {
    const activeCount = get().services.filter((s) => s.is_active).length;
    if (activeCount >= 30) {
      return 'Alcanzaste el máximo de 30 servicios activos.';
    }
    const { data: newService, error } = await supabase
      .from('services')
      .insert(data)
      .select()
      .single();
    if (error) return error.message;
    set((state) => ({
      services: [...state.services, newService as Service],
    }));
    return null;
  },

  updateService: async (id, updates) => {
    const { data, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) return error.message;
    set((state) => ({
      services: state.services.map((s) => (s.id === id ? (data as Service) : s)),
    }));
    return null;
  },

  toggleActive: async (id, isActive) => {
    const activeCount = get().services.filter((s) => s.is_active).length;
    if (isActive && activeCount >= 30) {
      return 'Alcanzaste el máximo de 30 servicios activos.';
    }
    const { data, error } = await supabase
      .from('services')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single();
    if (error) return error.message;
    set((state) => ({
      services: state.services.map((s) => (s.id === id ? (data as Service) : s)),
    }));
    return null;
  },

  deleteService: async (id) => {
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) {
      if (error.code === '23503') {
        return 'Este servicio tiene turnos asociados. Desactivalo en lugar de eliminarlo.';
      }
      return error.message;
    }
    set((state) => ({
      services: state.services.filter((s) => s.id !== id),
    }));
    return null;
  },
}));
