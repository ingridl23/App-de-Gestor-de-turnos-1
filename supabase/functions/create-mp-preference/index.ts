// Supabase Edge Function — Deno
// Crea una preferencia de MercadoPago Checkout Pro para un turno.
// POST /functions/v1/create-mp-preference
// Body: { appointment_id: string }
// Auth: Bearer <supabase_user_jwt>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const IPN_WEBHOOK_URL = Deno.env.get('IPN_WEBHOOK_URL') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'NOT_AUTHENTICATED' }, 401);
    }
    const jwt = authHeader.replace('Bearer ', '');

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Verify caller identity
    const { data: { user }, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !user) {
      return json({ error: 'INVALID_TOKEN' }, 401);
    }

    const body = await req.json() as { appointment_id?: string };
    if (!body.appointment_id) {
      return json({ error: 'MISSING_APPOINTMENT_ID' }, 400);
    }

    // Fetch appointment + business in one query
    const { data: appt, error: apptError } = await admin
      .from('appointments')
      .select('id, client_id, amount, starts_at, business_id, businesses(id, name, mp_access_token, payment_mode, seña_percent, mp_user_id), appointment_services(services(name))')
      .eq('id', body.appointment_id)
      .maybeSingle();

    if (apptError || !appt) {
      return json({ error: 'APPOINTMENT_NOT_FOUND' }, 404);
    }
    if (appt.client_id !== user.id) {
      return json({ error: 'FORBIDDEN' }, 403);
    }

    const business = appt.businesses as {
      id: string;
      name: string;
      mp_access_token: string | null;
      payment_mode: string;
      seña_percent: number;
      mp_user_id: string | null;
    } | null;

    if (!business?.mp_access_token) {
      return json({ error: 'MP_NOT_CONNECTED' }, 422);
    }

    // Calculate amount to charge based on payment_mode
    let amount: number = Number(appt.amount);
    if (business.payment_mode === 'seña') {
      amount = Math.round((amount * business.seña_percent) / 100);
    }
    if (amount <= 0) {
      return json({ error: 'INVALID_AMOUNT' }, 422);
    }

    // Build service names for the preference title
    const serviceNames = (appt.appointment_services as Array<{ services: { name: string } | null }>)
      .map((s) => s.services?.name)
      .filter(Boolean)
      .join(', ') || 'Turno';

    const title =
      business.payment_mode === 'seña'
        ? `Seña — ${serviceNames} en ${business.name}`
        : `${serviceNames} en ${business.name}`;

    // Create MercadoPago preference
    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${business.mp_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ title, unit_price: amount, quantity: 1, currency_id: 'ARS' }],
        external_reference: appt.id,
        back_urls: {
          success: 'appdegestordeturnos1://payment/success',
          failure: 'appdegestordeturnos1://payment/failure',
          pending: 'appdegestordeturnos1://payment/success',
        },
        auto_return: 'approved',
        notification_url: IPN_WEBHOOK_URL,
        statement_descriptor: business.name.slice(0, 22),
      }),
    });

    if (!mpRes.ok) {
      const err = await mpRes.json().catch(() => ({}));
      console.error('MP error:', err);
      return json({ error: 'MP_CREATE_PREFERENCE_FAILED' }, 502);
    }

    const pref = await mpRes.json() as { id: string; init_point: string };

    // Save preference reference in DB (pending payment record)
    await admin.from('payments').insert({
      appointment_id: appt.id,
      mp_preference_id: pref.id,
      amount,
      status: 'pending',
    });

    return json({ preference_id: pref.id, init_point: pref.init_point, amount });
  } catch (err) {
    console.error('Unexpected error:', err);
    return json({ error: 'INTERNAL_ERROR' }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
