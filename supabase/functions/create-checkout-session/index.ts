import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const STRIPE_SECRET_KEY = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').replace(/[^\x20-\x7E]/g, '').trim();

// Keys are "accountType:plan" — validated server-side so clients cannot
// request a coach/club price by spoofing a personal account type.
const PRICE_IDS: Record<string, string> = {
  // Personal
  'personal:monthly':  'price_1TaGmJIMo5HQHzLpN9lNXRJs',
  'personal:yearly':   'price_1TaGnPIMo5HQHzLp0QqXRgIs',
  'personal:lifetime': 'price_1TaGoJIMo5HQHzLpnoV0asej',
  // Coach
  'coach:monthly':     'price_1TeMbAIMo5HQHzLp5yGZiVTF',
  'coach:yearly':      'price_1TeMcEIMo5HQHzLpg31WLIA8',
  // Club
  'club:monthly':      'price_1TeMczIMo5HQHzLp6qp1Fgiw',
  'club:yearly':       'price_1TeMdTIMo5HQHzLpFy5VAolp',
};

// Valid account types — rejects anything not in this set
const VALID_ACCOUNT_TYPES = new Set(['personal', 'coach', 'club']);

const ALLOWED_ORIGINS = new Set([
  'https://vectorfootball.co.uk',
  'capacitor://localhost',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
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
    const { plan, accountType: rawAccountType, noTrial } = await req.json();

    // Default to 'personal' for backwards compatibility with older clients
    const accountType = VALID_ACCOUNT_TYPES.has(rawAccountType) ? rawAccountType : 'personal';

    // Redirect URLs are hardcoded server-side — never trusted from the client body.
    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://vectorfootball.co.uk';
    const successUrl = `${siteUrl}/?stripe_success=1`;
    const cancelUrl  = `${siteUrl}/?stripe_cancel=1`;

    const priceKey = `${accountType}:${plan}`;
    const priceId = PRICE_IDS[priceKey];
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
    params.set('metadata[accountType]', accountType);
    if (!isLifetime) {
      if (!noTrial) {
        // 30-day pre-season trial — expires ~August 1 if users sign up from June 20
        params.set('subscription_data[trial_period_days]', '30');
      }
      params.set('subscription_data[metadata][userId]', user.id);
      params.set('subscription_data[metadata][plan]', plan);
      params.set('subscription_data[metadata][accountType]', accountType);
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
