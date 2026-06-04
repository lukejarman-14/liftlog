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

// Extract the real client IP — Supabase Edge Functions run behind a proxy.
function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors(req) });
  }

  // Only accept POST — reject unexpected methods early.
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
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

  // Rate limiting: 10 checkout attempts per hour per user (user-scoped).
  const { data: allowed, error: rlError } = await supabase.rpc('check_edge_rate_limit', {
    p_user_id: user.id,
    p_endpoint: 'create-checkout-session',
    p_max_requests: 10,
    p_window_minutes: 60,
  });
  if (rlError || !allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: {
        ...cors(req),
        'Content-Type': 'application/json',
        // Tells well-behaved clients to wait ~2.9 s before retrying.
        'Retry-After': '3',
      },
    });
  }

  try {
    // Reject oversized payloads before parsing — protects against memory exhaustion.
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 2048) {
      return new Response(JSON.stringify({ error: 'Request too large' }), {
        status: 413, headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.json();

    // Whitelist accepted fields — reject any unexpected keys silently by ignoring them.
    // This prevents parameter pollution and makes the API surface explicit.
    const ALLOWED_FIELDS = new Set(['plan', 'accountType', 'noTrial']);
    const body: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in rawBody) body[key] = rawBody[key];
    }

    // Explicit type guards — never trust client-supplied field types.
    const VALID_PLANS = new Set(['monthly', 'yearly', 'lifetime']);
    const rawPlan        = typeof body.plan === 'string'        ? body.plan        : '';
    const rawAccountType = typeof body.accountType === 'string' ? body.accountType : '';
    const noTrial        = body.noTrial === true; // must be exactly true, not truthy

    if (!VALID_PLANS.has(rawPlan)) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    const plan = rawPlan;

    // Default to 'personal' for backwards compatibility with older clients.
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
    console.error('[create-checkout-session] unhandled error:', (err as Error).message);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }), {
      status: 500, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }
});
