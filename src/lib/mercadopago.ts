import { supabase } from '@/lib/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

export function getMPOAuthURL(businessId: string): string {
  const clientId = process.env.EXPO_PUBLIC_MP_APP_CLIENT_ID ?? '';
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    platform_id: 'mp',
    state: businessId,
    redirect_uri: 'appdegestordeturnos1://mp-oauth/callback',
  });
  return `https://auth.mercadopago.com/authorization?${params.toString()}`;
}

export async function createMPPreference(
  appointmentId: string
): Promise<{ preferenceId: string; initPoint: string; amount: number }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('NOT_AUTHENTICATED');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-mp-preference`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ appointment_id: appointmentId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'MP_ERROR');
  }

  const data = await res.json() as {
    preference_id: string;
    init_point: string;
    amount: number;
  };
  return { preferenceId: data.preference_id, initPoint: data.init_point, amount: data.amount };
}
