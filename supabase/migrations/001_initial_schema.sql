-- ============================================================
-- TurnosApp — Schema inicial
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Extensión UUID
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLA: users (perfil público, extiende auth.users)
-- ============================================================
create table public.users (
  id         uuid        primary key references auth.users(id) on delete cascade,
  email      text        not null,
  full_name  text        not null default '',
  role       text        not null default 'cliente' check (role in ('emprendedor', 'cliente')),
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users: leer propio perfil"
  on public.users for select
  using (auth.uid() = id);

create policy "users: editar propio perfil"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- TABLA: businesses
-- ============================================================
create table public.businesses (
  id          uuid        primary key default uuid_generate_v4(),
  owner_id    uuid        not null references public.users(id) on delete cascade,
  name        text        not null,
  description text,
  address     text,
  phone       text,
  created_at  timestamptz not null default now()
);

alter table public.businesses enable row level security;

-- Cualquiera puede leer negocios
create policy "businesses: lectura pública"
  on public.businesses for select
  using (true);

-- Solo el dueño puede crear/editar/eliminar
create policy "businesses: emprendedor inserta"
  on public.businesses for insert
  with check (auth.uid() = owner_id);

create policy "businesses: emprendedor actualiza"
  on public.businesses for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "businesses: emprendedor elimina"
  on public.businesses for delete
  using (auth.uid() = owner_id);

-- ============================================================
-- TABLA: services
-- ============================================================
create table public.services (
  id               uuid           primary key default uuid_generate_v4(),
  business_id      uuid           not null references public.businesses(id) on delete cascade,
  name             text           not null,
  description      text,
  duration_minutes integer        not null check (duration_minutes > 0),
  price            numeric(10, 2) not null check (price >= 0),
  is_active        boolean        not null default true,
  created_at       timestamptz    not null default now()
);

alter table public.services enable row level security;

create policy "services: lectura de servicios activos"
  on public.services for select
  using (is_active = true);

create policy "services: emprendedor lee todos los propios"
  on public.services for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  );

create policy "services: emprendedor inserta"
  on public.services for insert
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  );

create policy "services: emprendedor actualiza"
  on public.services for update
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  );

create policy "services: emprendedor elimina"
  on public.services for delete
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  );

-- ============================================================
-- TABLA: availability (agenda semanal)
-- ============================================================
create table public.availability (
  id           uuid    primary key default uuid_generate_v4(),
  business_id  uuid    not null references public.businesses(id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  start_time   time    not null,
  end_time     time    not null,
  check (start_time < end_time),
  unique (business_id, day_of_week)
);

alter table public.availability enable row level security;

create policy "availability: lectura pública"
  on public.availability for select
  using (true);

create policy "availability: emprendedor gestiona"
  on public.availability for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  );

-- ============================================================
-- TABLA: blocked_dates (días bloqueados)
-- ============================================================
create table public.blocked_dates (
  id           uuid    primary key default uuid_generate_v4(),
  business_id  uuid    not null references public.businesses(id) on delete cascade,
  blocked_date date    not null,
  reason       text,
  unique (business_id, blocked_date)
);

alter table public.blocked_dates enable row level security;

create policy "blocked_dates: lectura pública"
  on public.blocked_dates for select
  using (true);

create policy "blocked_dates: emprendedor gestiona"
  on public.blocked_dates for all
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  );

-- ============================================================
-- TABLA: appointments (turnos)
-- ============================================================
create table public.appointments (
  id          uuid        primary key default uuid_generate_v4(),
  business_id uuid        not null references public.businesses(id) on delete cascade,
  client_id   uuid        not null references public.users(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      text        not null default 'pendiente'
                check (status in ('pendiente', 'confirmado', 'cancelado', 'completado')),
  created_at  timestamptz not null default now(),
  check (starts_at < ends_at)
);

-- Índice para búsquedas de solapamiento
create index idx_appointments_business_time
  on public.appointments (business_id, starts_at, ends_at)
  where status <> 'cancelado';

alter table public.appointments enable row level security;

create policy "appointments: cliente lee los propios"
  on public.appointments for select
  using (auth.uid() = client_id);

create policy "appointments: cliente crea"
  on public.appointments for insert
  with check (auth.uid() = client_id);

create policy "appointments: cliente cancela el propio"
  on public.appointments for update
  using (auth.uid() = client_id and status = 'pendiente')
  with check (status = 'cancelado');

create policy "appointments: emprendedor lee su negocio"
  on public.appointments for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  );

create policy "appointments: emprendedor actualiza estado"
  on public.appointments for update
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  );

-- ============================================================
-- TABLA: appointment_services (pivot turno ↔ servicio)
-- ============================================================
create table public.appointment_services (
  id             uuid primary key default uuid_generate_v4(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id     uuid not null references public.services(id) on delete restrict,
  unique (appointment_id, service_id)
);

alter table public.appointment_services enable row level security;

create policy "appointment_services: cliente gestiona los propios"
  on public.appointment_services for all
  using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.client_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.client_id = auth.uid()
    )
  );

create policy "appointment_services: emprendedor lee su negocio"
  on public.appointment_services for select
  using (
    exists (
      select 1 from public.appointments a
      join public.businesses b on b.id = a.business_id
      where a.id = appointment_id and b.owner_id = auth.uid()
    )
  );

-- ============================================================
-- TABLA: messages (chat en tiempo real)
-- ============================================================
create table public.messages (
  id          uuid        primary key default uuid_generate_v4(),
  business_id uuid        not null references public.businesses(id) on delete cascade,
  sender_id   uuid        not null references public.users(id) on delete cascade,
  receiver_id uuid        not null references public.users(id) on delete cascade,
  content     text        not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

create index idx_messages_conversation
  on public.messages (business_id, sender_id, receiver_id, created_at desc);

alter table public.messages enable row level security;

create policy "messages: participantes pueden leer"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "messages: solo el remitente puede enviar"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "messages: receptor marca como leído"
  on public.messages for update
  using (auth.uid() = receiver_id);

-- ============================================================
-- TABLA: notifications
-- ============================================================
create table public.notifications (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    uuid        not null references public.users(id) on delete cascade,
  title      text        not null,
  body       text        not null,
  type       text        not null
               check (type in ('recordatorio', 'confirmacion', 'cancelacion', 'mensaje', 'pago')),
  is_read    boolean     not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notifications: usuario lee las propias"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "notifications: usuario marca como leída"
  on public.notifications for update
  using (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: crear perfil al registrarse
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'cliente')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- FUNCIÓN ACID: reservar turno sin solapamientos
-- Usa advisory lock a nivel de negocio para serializar
-- reservas concurrentes sobre el mismo horario.
-- ============================================================
create or replace function public.create_appointment(
  p_business_id  uuid,
  p_client_id    uuid,
  p_service_ids  uuid[],
  p_starts_at    timestamptz,
  p_ends_at      timestamptz
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

  -- Insertar turno
  insert into public.appointments (business_id, client_id, starts_at, ends_at)
  values (p_business_id, p_client_id, p_starts_at, p_ends_at)
  returning * into v_appointment;

  -- Insertar servicios del turno
  foreach v_service_id in array p_service_ids loop
    insert into public.appointment_services (appointment_id, service_id)
    values (v_appointment.id, v_service_id);
  end loop;

  return v_appointment;
end;
$$;
