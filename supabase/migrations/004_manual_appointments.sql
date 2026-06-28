-- ============================================================
-- TurnosApp — Migración 004: Turnos manuales + push tokens
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Columnas adicionales en appointments para turnos manuales
alter table public.appointments
  add column if not exists client_name   text,
  add column if not exists client_phone  text,
  add column if not exists amount        numeric(10,2) not null default 0,
  add column if not exists is_manual     boolean not null default false,
  add column if not exists notes         text;

-- client_id puede ser null para turnos manuales (cliente no registrado)
alter table public.appointments alter column client_id drop not null;

-- Push token y preferencias de notificaciones en users
alter table public.users
  add column if not exists push_token         text,
  add column if not exists notification_prefs jsonb not null
    default '{"nueva_reserva":true,"cancelacion":true,"nuevo_mensaje":true}'::jsonb;

-- RLS: emprendedor puede insertar turno manual directamente
create policy "appointments: emprendedor crea turno manual"
  on public.appointments for insert
  with check (
    is_manual = true
    and exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  );

-- RLS: emprendedor puede reprogramar (update starts_at/ends_at) cualquier turno
create policy "appointments: emprendedor reprograma"
  on public.appointments for update
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCIÓN: crear turno manual sin cliente registrado
-- ============================================================
create or replace function public.create_manual_appointment(
  p_business_id  uuid,
  p_service_ids  uuid[],
  p_client_name  text,
  p_client_phone text,
  p_starts_at    timestamptz,
  p_ends_at      timestamptz,
  p_amount       numeric,
  p_notes        text default null
)
returns public.appointments
language plpgsql
security definer
as $$
declare
  v_appointment   public.appointments;
  v_service_id    uuid;
  v_overlap_count integer;
begin
  -- Lock transaccional por negocio: serializa reservas concurrentes
  perform pg_advisory_xact_lock(('x' || md5(p_business_id::text))::bit(64)::bigint);

  -- Verificar solapamiento con turnos activos
  select count(*) into v_overlap_count
  from public.appointments
  where business_id = p_business_id
    and status <> 'cancelado'
    and tstzrange(starts_at, ends_at) && tstzrange(p_starts_at, p_ends_at);

  if v_overlap_count > 0 then
    raise exception 'SLOT_TAKEN' using hint = 'El horario seleccionado ya está ocupado.';
  end if;

  -- Insertar turno manual (confirmado por defecto)
  insert into public.appointments (
    business_id, client_id, client_name, client_phone,
    starts_at, ends_at, amount, is_manual, notes, status
  )
  values (
    p_business_id, null, p_client_name, p_client_phone,
    p_starts_at, p_ends_at, p_amount, true, p_notes, 'confirmado'
  )
  returning * into v_appointment;

  -- Insertar servicios del turno
  foreach v_service_id in array p_service_ids loop
    insert into public.appointment_services (appointment_id, service_id)
    values (v_appointment.id, v_service_id);
  end loop;

  return v_appointment;
end;
$$;
