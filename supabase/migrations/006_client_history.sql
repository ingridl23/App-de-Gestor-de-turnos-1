-- ============================================================
-- TurnosApp — Migración 006: Historial de turnos del cliente
-- US-012: el cliente puede ver y cancelar sus turnos
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Permitir al cliente cancelar turnos confirmados además de pendientes
-- (la policy anterior solo permitía cancelar 'pendiente')
DROP POLICY IF EXISTS "appointments: cliente cancela el propio" ON public.appointments;

CREATE POLICY "appointments: cliente cancela el propio"
  ON public.appointments FOR UPDATE
  USING (
    auth.uid() = client_id
    AND status IN ('pendiente', 'confirmado')
    AND starts_at > now()
  )
  WITH CHECK (status = 'cancelado');

-- Permitir al cliente leer servicios vinculados a sus turnos
-- (incluso si el servicio fue desactivado después de la reserva)
CREATE POLICY IF NOT EXISTS "services: cliente lee servicios de sus turnos"
  ON public.services FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.appointment_services aps
      JOIN public.appointments a ON a.id = aps.appointment_id
      WHERE aps.service_id = services.id
        AND a.client_id = auth.uid()
    )
  );
