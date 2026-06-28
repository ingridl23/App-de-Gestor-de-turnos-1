-- ============================================================
-- TurnosApp — Migración 008: Recordatorios (US-011)
-- Columnas de tracking, funciones para n8n
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Teléfono del cliente (necesario para WhatsApp)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone text;

-- Tracking para evitar recordatorios duplicados
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_push_sent_at      timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_whatsapp_sent_at  timestamptz;

-- Actualizar default de notification_prefs con los nuevos campos
ALTER TABLE public.users
  ALTER COLUMN notification_prefs SET DEFAULT
    '{"nueva_reserva":true,"cancelacion":true,"nuevo_mensaje":true,
      "recordatorio_push":true,"recordatorio_whatsapp":true}'::jsonb;

-- Migrar usuarios existentes: agregar nuevas prefs sin pisar las actuales
UPDATE public.users
SET notification_prefs = notification_prefs ||
  '{"recordatorio_push":true,"recordatorio_whatsapp":true}'::jsonb
WHERE NOT (notification_prefs ? 'recordatorio_push');

-- ============================================================
-- FUNCIÓN: obtener turnos que necesitan recordatorio
-- Llamada por n8n cada 15 minutos con p_hours_before = 1 o 24
-- Usa una ventana de ±30 min alrededor del tiempo objetivo
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_upcoming_reminders(
  p_hours_before numeric  -- 1 para push, 24 para WhatsApp
)
RETURNS TABLE (
  appointment_id        uuid,
  starts_at             timestamptz,
  client_name           text,
  client_phone          text,
  client_push_token     text,
  service_names         text,
  business_name         text,
  business_address      text,
  reminder_push         boolean,
  reminder_whatsapp     boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    a.id                                                         AS appointment_id,
    a.starts_at,
    u.full_name                                                  AS client_name,
    u.phone                                                      AS client_phone,
    u.push_token                                                 AS client_push_token,
    string_agg(DISTINCT s.name, ', ')                           AS service_names,
    b.name                                                       AS business_name,
    b.address                                                    AS business_address,
    COALESCE((u.notification_prefs->>'recordatorio_push')::boolean,      true) AS reminder_push,
    COALESCE((u.notification_prefs->>'recordatorio_whatsapp')::boolean,  true) AS reminder_whatsapp
  FROM public.appointments a
  JOIN public.users        u  ON u.id  = a.client_id
  JOIN public.businesses   b  ON b.id  = a.business_id
  LEFT JOIN public.appointment_services aps ON aps.appointment_id = a.id
  LEFT JOIN public.services             s   ON s.id = aps.service_id
  WHERE
    a.status     IN ('pendiente', 'confirmado')
    AND a.client_id IS NOT NULL
    AND a.starts_at  > now() + (p_hours_before - 0.5) * interval '1 hour'
    AND a.starts_at <= now() + (p_hours_before + 0.5) * interval '1 hour'
    AND CASE
          WHEN p_hours_before <= 2  THEN a.reminder_push_sent_at     IS NULL
          ELSE                           a.reminder_whatsapp_sent_at  IS NULL
        END
  GROUP BY
    a.id, a.starts_at, u.full_name, u.phone, u.push_token,
    b.name, b.address, u.notification_prefs;
$$;

GRANT EXECUTE ON FUNCTION public.get_upcoming_reminders(numeric) TO service_role;

-- ============================================================
-- FUNCIÓN: marcar recordatorio como enviado (llamada por n8n
-- tras enviar exitosamente la push o el WhatsApp)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_reminder_sent(
  p_appointment_id uuid,
  p_type           text   -- 'push' | 'whatsapp'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_type = 'push' THEN
    UPDATE public.appointments
    SET reminder_push_sent_at = now()
    WHERE id = p_appointment_id;
  ELSIF p_type = 'whatsapp' THEN
    UPDATE public.appointments
    SET reminder_whatsapp_sent_at = now()
    WHERE id = p_appointment_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_reminder_sent(uuid, text) TO service_role;

-- ============================================================
-- FUNCIÓN: procesar respuesta del cliente desde WhatsApp
-- n8n llama esto desde el webhook de Meta cuando el cliente
-- toca "Confirmar" o "Cancelar" en el mensaje de plantilla
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_whatsapp_reply(
  p_appointment_id uuid,
  p_action         text   -- 'confirmar' | 'cancelar'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_action = 'confirmar' THEN
    UPDATE public.appointments
    SET status = 'confirmado'
    WHERE id = p_appointment_id
      AND status = 'pendiente';
  ELSIF p_action = 'cancelar' THEN
    UPDATE public.appointments
    SET status = 'cancelado'
    WHERE id = p_appointment_id
      AND status IN ('pendiente', 'confirmado')
      AND starts_at > now();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_whatsapp_reply(uuid, text) TO service_role;

-- ============================================================
-- NOTAS PARA CONFIGURAR n8n
-- ============================================================
-- Credencial Supabase en n8n: usar SERVICE_ROLE key (no anon key)
-- Base URL: https://<tu-proyecto>.supabase.co
--
-- Workflow 1 — Push 1 hora antes (cron cada 15 min):
--   1. Cron Trigger: */15 * * * *
--   2. HTTP Request POST /rest/v1/rpc/get_upcoming_reminders { p_hours_before: 1 }
--   3. IF reminder_push = true AND client_push_token != null
--   4. HTTP Request POST https://exp.host/--/api/v2/push/send
--      body: { to: client_push_token, title: "Tu turno es pronto",
--              body: "Hoy a las {starts_at} — {service_names} en {business_name}" }
--   5. HTTP Request POST /rest/v1/rpc/mark_reminder_sent
--      body: { p_appointment_id: id, p_type: "push" }
--
-- Workflow 2 — WhatsApp 24 horas antes (cron cada 15 min):
--   1. Cron Trigger: */15 * * * *
--   2. HTTP Request POST /rest/v1/rpc/get_upcoming_reminders { p_hours_before: 24 }
--   3. IF reminder_whatsapp = true AND client_phone != null
--   4. HTTP Request POST https://graph.facebook.com/v21.0/{phone_number_id}/messages
--      body: template "turno_recordatorio" con params:
--            {{1}}=client_name, {{2}}=business_name, {{3}}=starts_at, {{4}}=service_names, {{5}}=business_address
--   5. HTTP Request POST /rest/v1/rpc/mark_reminder_sent
--      body: { p_appointment_id: id, p_type: "whatsapp" }
--
-- Workflow 3 — Webhook respuesta WhatsApp (Meta → n8n):
--   1. Webhook Trigger (URL configurada en Meta Developer Console)
--   2. Verificar token de Meta (campo hub.challenge)
--   3. Parsear entry[0].changes[0].value.messages[0]
--   4. Si type = "interactive" → extraer button.payload = "{appointmentId}:{action}"
--   5. HTTP Request POST /rest/v1/rpc/process_whatsapp_reply
--      body: { p_appointment_id: ..., p_action: "confirmar"|"cancelar" }
--
-- Template WhatsApp (crear en Meta Business Suite → Plantillas):
--   Nombre: turno_recordatorio
--   Categoría: UTILITY
--   Cuerpo: "Hola {{1}}, te recordamos tu turno en {{2}} mañana a las {{3}}.\nServicio: {{4}}\n📍 {{5}}"
--   Botones (call_to_action tipo QUICK_REPLY):
--     - Payload "confirmar": "✅ Confirmar asistencia"
--     - Payload "cancelar":  "❌ Cancelar turno"
-- ============================================================
