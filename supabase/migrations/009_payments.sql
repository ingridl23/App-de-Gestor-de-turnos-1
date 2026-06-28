-- ============================================================
-- TurnosApp — Migración 009: Pagos con MercadoPago
-- US-007 + US-010
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Configuración de pagos en el negocio
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS mp_user_id      text,
  ADD COLUMN IF NOT EXISTS mp_access_token text,   -- mantenido server-side (Edge Function)
  ADD COLUMN IF NOT EXISTS payment_mode    text NOT NULL DEFAULT 'none'
    CHECK (payment_mode IN ('none', 'seña', 'full')),
  ADD COLUMN IF NOT EXISTS seña_percent    smallint NOT NULL DEFAULT 30
    CHECK (seña_percent BETWEEN 10 AND 100);

-- Tabla de pagos
CREATE TABLE IF NOT EXISTS public.payments (
  id               uuid           PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id   uuid           NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  mp_payment_id    text           UNIQUE,
  mp_preference_id text,
  amount           numeric(10,2)  NOT NULL,
  status           text           NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','refunded','cancelled')),
  payer_email      text,
  created_at       timestamptz    NOT NULL DEFAULT now(),
  updated_at       timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_appointment
  ON public.payments (appointment_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- El cliente ve los pagos de sus propios turnos
CREATE POLICY "payments: cliente lee los propios"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_id AND a.client_id = auth.uid()
    )
  );

-- El emprendedor ve los pagos de sus turnos
CREATE POLICY "payments: emprendedor lee su negocio"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.businesses b ON b.id = a.business_id
      WHERE a.id = appointment_id AND b.owner_id = auth.uid()
    )
  );

-- El emprendedor puede ver los perfiles de sus clientes
CREATE POLICY "users: emprendedor ve clientes con turnos"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.businesses b ON b.id = a.business_id
      WHERE a.client_id = users.id AND b.owner_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCIÓN: procesar notificación IPN de MercadoPago
-- Llamada por n8n cuando MP notifica un cambio de estado
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_mp_payment(
  p_mp_payment_id  text,
  p_appointment_id uuid,
  p_status         text,   -- 'approved' | 'rejected' | 'refunded' | 'charged_back'
  p_amount         numeric,
  p_payer_email    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status text;
BEGIN
  v_status := CASE p_status
    WHEN 'approved'     THEN 'approved'
    WHEN 'refunded'     THEN 'refunded'
    WHEN 'charged_back' THEN 'refunded'
    ELSE 'rejected'
  END;

  INSERT INTO public.payments (
    appointment_id, mp_payment_id, amount, status, payer_email
  ) VALUES (
    p_appointment_id, p_mp_payment_id, p_amount, v_status, p_payer_email
  )
  ON CONFLICT (mp_payment_id) DO UPDATE SET
    status     = EXCLUDED.status,
    updated_at = now();

  -- Sincronizar estado del turno
  IF p_status = 'approved' THEN
    UPDATE public.appointments SET status = 'confirmado' WHERE id = p_appointment_id;
  ELSIF p_status IN ('refunded', 'charged_back') THEN
    UPDATE public.appointments SET status = 'cancelado'  WHERE id = p_appointment_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_mp_payment(text, uuid, text, numeric, text) TO service_role;

-- ============================================================
-- FUNCIÓN: guardar tokens de OAuth (llamada por n8n)
-- ============================================================
CREATE OR REPLACE FUNCTION public.save_mp_oauth(
  p_business_id    uuid,
  p_mp_user_id     text,
  p_access_token   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.businesses
  SET mp_user_id     = p_mp_user_id,
      mp_access_token = p_access_token
  WHERE id = p_business_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_mp_oauth(uuid, text, text) TO service_role;

-- ============================================================
-- NOTAS n8n para MercadoPago
-- ============================================================
-- Variables de entorno necesarias en Supabase (Dashboard → Settings → Edge Functions):
--   IPN_WEBHOOK_URL = URL del webhook n8n para recibir notificaciones de MP
--
-- Variables de entorno en la app (.env.local):
--   EXPO_PUBLIC_MP_APP_CLIENT_ID   = client_id de la MP Marketplace app
--   EXPO_PUBLIC_N8N_OAUTH_URL      = URL del webhook n8n para intercambio OAuth
--
-- Workflow n8n 1 — OAuth exchange (GET /webhook/mp-oauth?code=xxx&state=business_id):
--   1. Webhook Trigger
--   2. HTTP Request POST https://api.mercadopago.com/oauth/token
--      body: { grant_type:"authorization_code", client_id, client_secret, code, redirect_uri }
--   3. HTTP Request POST supabase/rest/v1/rpc/save_mp_oauth
--      body: { p_business_id: state, p_mp_user_id: response.user_id, p_access_token: response.access_token }
--   4. Respond with 200 OK
--
-- Workflow n8n 2 — IPN de MercadoPago (POST /webhook/mp-ipn):
--   1. Webhook Trigger
--   2. IF body.type = "payment"
--   3. HTTP Request GET https://api.mercadopago.com/v1/payments/{body.data.id}
--      header: Authorization: Bearer {PLATFORM_ACCESS_TOKEN}
--   4. HTTP Request POST supabase/rest/v1/rpc/process_mp_payment
--      body: { p_mp_payment_id, p_appointment_id: external_reference, p_status, p_amount, p_payer_email }
--   5. Respond 200
--
-- Workflow n8n 3 — Reembolso automático (cuando emprendedor cancela):
--   Trigger: Supabase Realtime en appointments WHERE status cambió a 'cancelado'
--   1. GET payment WHERE appointment_id = X AND status = 'approved'
--   2. HTTP Request POST https://api.mercadopago.com/v1/payments/{mp_payment_id}/refunds
--   3. Actualizar payment.status = 'refunded' vía process_mp_payment
-- ============================================================
