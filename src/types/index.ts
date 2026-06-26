export type UserRole = 'emprendedor' | 'cliente';

export type BusinessCategory = 'peluqueria' | 'barberia';

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  category: BusinessCategory;
  slug: string;
  description?: string;
  address?: string;
  phone?: string;
  avatar_url?: string;
  break_minutes: number;
  created_at: string;
}

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  business_id: string;
  client_id: string;
  starts_at: string;
  ends_at: string;
  status: 'pendiente' | 'confirmado' | 'cancelado' | 'completado';
  created_at: string;
}
