-- ============================================================
-- TurnosApp — Migración 007: Chat en tiempo real
-- US-013: visibilidad de perfiles para participantes del chat
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Dueños de negocios tienen perfil visible (son "personas públicas")
CREATE POLICY "users: dueños de negocios visibles"
  ON public.users FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.owner_id = users.id)
  );

-- Participantes de una conversación pueden verse mutuamente
CREATE POLICY "users: visibles en conversaciones compartidas"
  ON public.users FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE (m.sender_id = users.id OR m.receiver_id = users.id)
        AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
    )
  );
