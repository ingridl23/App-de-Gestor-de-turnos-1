import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Business } from '@/types';

interface BusinessState {
  business: Business | null;
  isLoadingBusiness: boolean;
  fetchBusiness: (ownerId: string) => Promise<void>;
  setBusiness: (business: Business | null) => void;
  setBusinessLoading: (loading: boolean) => void;
}

export const useBusinessStore = create<BusinessState>((set) => ({
  business: null,
  isLoadingBusiness: true,

  fetchBusiness: async (ownerId) => {
    set({ isLoadingBusiness: true });
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', ownerId)
      .maybeSingle();
    set({ business: data ?? null, isLoadingBusiness: false });
  },

  setBusiness: (business) => set({ business }),
  setBusinessLoading: (loading) => set({ isLoadingBusiness: loading }),
}));
