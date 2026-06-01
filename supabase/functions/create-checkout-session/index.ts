import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const STRIPE_SECRET_KEY = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').replace(/[^\x20-\x7E]/g, '').trim();

const PRICE_IDS: Record<string, string> = {
  monthly:  'price_1TaGmJIMo5HQHzLpN9lNXRJs',
  yearly:   'price_1TaGnPIMo5HQHzLp0QqXRgIs',
  lifetime: 'price_1TaGoJIMo5HQHzLpnoV0asej',
};

const ALLOWED_ORIGINS = new Set([
  'https://vectorfootball.co.uk',
  'capacitor://localhost',
  'http://localhost:5173',
  'http://localhost:5174',
]);

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://vectorfootball.co.uk',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors(req) });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }
  if (!user.email) {
    return new Response(JSON.stringify({ error: 'Account email is required for billing.' }), {
      status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  try {
    const { plan, noTrial } = await req.json();

    // Redirect URLs are hardcoded server-side — never trusted from the client body.
    // SITE_URL is set in Supabase Edge Function secrets for each environment.
    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://vectorfootball.co.uk';
    const successUrl = `${siteUrl}/?stripe_success=1`;
    const cancelUrl  = `${siteUrl}/?stripe_cancel=1`;

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    const isLifetime = plan === 'lifetime';

    // Reuse an existing Stripe customer to keep payment history consolidated
    // and respect the "one trial per customer" setting in the Stripe dashboard.
    let existingCustomerId: string | null = null;
    const customerSearchRes = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email)}&limit=1`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
    );
    if (customerSearchRes.ok) {
      const customerSearchData = await customerSearchRes.json();
      existingCustomerId = customerSearchData.data?.[0]?.id ?? null;
    }

    const params = new URLSearchParams();
    params.set('mode', isLifetime ? 'payment' : 'subscription');
    params.set('line_items[0][price]', priceId);
    params.set('line_items[0][quantity]', '1');
    params.set('client_reference_id', user.id);
    if (existingCustomerId) {
      params.set('customer', existingCustomerId);
    } else {
      params.set('customer_email', user.email);
    }
    params.set('success_url', successUrl);
    params.set('cancel_url', cancelUrl);
    params.set('metadata[userId]', user.id);
    params.set('metadata[plan]', plan);
    if (!isLifetime) {
      if (!noTrial) {
        params.set('subscription_data[trial_period_days]', '14');
      }
      params.set('subscription_data[metadata][userId]', user.id);
      params.set('subscription_data[metadata][plan]', plan);
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: session.error?.message ?? 'Stripe error' }), {
        status: 500, headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }
});
