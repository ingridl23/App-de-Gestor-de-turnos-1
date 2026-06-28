export type UserRole = 'emprendedor' | 'cliente';

export type BusinessCategory = 'peluqueria' | 'barberia';

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  avatar_url?: string;
  push_token?: string;
  notification_prefs?: NotificationPrefs;
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

export type AppointmentStatus = 'pendiente' | 'confirmado' | 'cancelado' | 'completado';

export interface Appointment {
  id: string;
  business_id: string;
  client_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  amount: number;
  is_manual: boolean;
  notes: string | null;
  created_at: string;
}

export interface AppointmentWithDetails extends Appointment {
  client: Pick<AppUser, 'id' | 'full_name' | 'avatar_url'> | null;
  appointment_services: Array<{
    service_id: string;
    services: Service;
  }>;
}

export type NotificationType =
  | 'recordatorio'
  | 'confirmacion'
  | 'cancelacion'
  | 'mensaje'
  | 'pago';

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPrefs {
  nueva_reserva: boolean;
  cancelacion: boolean;
  nuevo_mensaje: boolean;
  recordatorio_push: boolean;
  recordatorio_whatsapp: boolean;
}
