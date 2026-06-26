-- ============================================================
-- TurnosApp — Migración 002
-- US-001: Perfil del emprendedor (categoria, slug, avatar)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Agregar columnas al tabla businesses
alter table public.businesses
  add column if not exists category   text check (category in ('peluqueria', 'barberia')),
  add column if not exists slug       text,
  add column if not exists avatar_url text;

-- Índice único para slug (para URLs públicas)
create unique index if not exists businesses_slug_idx on public.businesses (slug);

-- ============================================================
-- Storage: bucket público para avatares de negocios
-- ============================================================
insert into storage.buckets (id, name, public)
values ('business-avatars', 'business-avatars', true)
on conflict (id) do nothing;

-- Policy: cualquiera puede leer las fotos (bucket público)
create policy "business-avatars: lectura pública"
  on storage.objects for select
  using (bucket_id = 'business-avatars');

-- Policy: el dueño puede subir su propia foto (carpeta = su user id)
create policy "business-avatars: emprendedor sube"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'business-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: el dueño puede reemplazar su foto
create policy "business-avatars: emprendedor actualiza"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'business-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: el dueño puede eliminar su foto
create policy "business-avatars: emprendedor elimina"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'business-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
