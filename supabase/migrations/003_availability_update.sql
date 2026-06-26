-- ============================================================
-- TurnosApp — Migración 003
-- US-003: Disponibilidad horaria con múltiples franjas por día
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Eliminar el constraint unique (business_id, day_of_week)
-- para permitir múltiples franjas por día
alter table public.availability
  drop constraint if exists availability_business_id_day_of_week_key;

-- Índice para consultas rápidas por negocio + día
create index if not exists idx_availability_business_day
  on public.availability (business_id, day_of_week, start_time);

-- Tiempo de descanso entre turnos (en minutos)
alter table public.businesses
  add column if not exists break_minutes smallint not null default 0
  check (break_minutes in (0, 5, 10, 15));
