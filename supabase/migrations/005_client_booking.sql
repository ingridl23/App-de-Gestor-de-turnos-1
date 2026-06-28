-- ============================================================
-- TurnosApp — Migración 005: Reserva de turno (cliente)
-- US-009: flujo de reserva desde el perfil público
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Reemplazar create_appointment para usar auth.uid() + incluir amount
-- (la versión anterior requería p_client_id explícito y no incluía amount)
DROP FUNCTION IF EXISTS public.create_appointment(uuid, uuid, uuid[], timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.create_appointment(
  p_business_id uuid,
  p_service_ids uuid[],
  p_starts_at   timestamptz,
  p_ends_at     timestamptz,
  p_amount      numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_appt_id       uuid;
  v_overlap_count integer;
BEGIN
  -- Solo usuarios autenticados
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- Lock transaccional por negocio: serializa reservas concurrentes
  PERFORM pg_advisory_xact_lock(('x' || md5(p_business_id::text))::bit(64)::bigint);

  -- Verificar solapamiento con turnos activos
  SELECT count(*) INTO v_overlap_count
  FROM public.appointments
  WHERE business_id = p_business_id
    AND status <> 'cancelado'
    AND tstzrange(starts_at, ends_at) && tstzrange(p_starts_at, p_ends_at);

  IF v_overlap_count > 0 THEN
    RAISE EXCEPTION 'SLOT_TAKEN' USING HINT = 'El horario seleccionado ya está ocupado.';
  END IF;

  -- Insertar turno
  INSERT INTO public.appointments (
    business_id, client_id, starts_at, ends_at, amount, is_manual, status
  ) VALUES (
    p_business_id, auth.uid(), p_starts_at, p_ends_at, p_amount, false, 'pendiente'
  ) RETURNING id INTO v_appt_id;

  -- Insertar servicios del turno
  INSERT INTO public.appointment_services (appointment_id, service_id)
  SELECT v_appt_id, unnest(p_service_ids);

  RETURN v_appt_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_appointment(uuid, uuid[], timestamptz, timestamptz, numeric)
  TO authenticated;

-- Función que devuelve franjas ocupadas de un día (sin datos del cliente)
-- para que el cliente pueda calcular horarios disponibles
CREATE OR REPLACE FUNCTION public.get_day_appointments(
  p_business_id uuid,
  p_from        timestamptz,
  p_to          timestamptz
)
RETURNS TABLE(starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT a.starts_at, a.ends_at
  FROM public.appointments a
  WHERE a.business_id = p_business_id
    AND a.status <> 'cancelado'
    AND a.starts_at >= p_from
    AND a.starts_at < p_to;
$$;

GRANT EXECUTE ON FUNCTION public.get_day_appointments(uuid, timestamptz, timestamptz)
  TO anon, authenticated;
