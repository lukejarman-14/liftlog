import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const STRIPE_SECRET_KEY = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').replace(/[^\x20-\x7E]/g, '').trim();

// Service-role client for reading user_data after JWT has been verified.
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

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
  if (authError || !user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  // Rate limiting: 20 portal session attempts per hour per user
  const { data: allowed, error: rlError } = await supabase.rpc('check_edge_rate_limit', {
    p_user_id: user.id,
    p_endpoint: 'create-portal-session',
    p_max_requests: 20,
    p_window_minutes: 60,
  });
  if (rlError || !allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: { ...cors(req), 'Content-Type': 'application/json', 'Retry-After': '3' },
    });
  }

  try {
    // returnUrl is hardcoded server-side — never trusted from the client body
    // to prevent open-redirect attacks.
    const returnUrl = Deno.env.get('SITE_URL') ?? 'https://vectorfootball.co.uk';
    void await req.json().catch(() => ({})); // consume body to avoid parse errors

    // Look up the Stripe customer id from the SERVER-ONLY stripe_customers table,
    // keyed by the authenticated user's id. (Previously this read a client-writable
    // value from user_data.app_data — an IDOR: a user could overwrite their blob
    // with another customer's id and open that customer's billing portal.)
    let customerId: string | null = null;

    const { data: mapping } = await supabaseAdmin
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (mapping?.stripe_customer_id) {
      customerId = mapping.stripe_customer_id;
    } else {
      // Legacy fallback — search Stripe by the JWT-verified email (NOT client input).
      // Legacy fallback — take the most recently created customer for this email.
      const searchRes = await fetch(
        `https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email!)}&limit=1`,
        { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
      );
      const searchData = await searchRes.json();

      if (!searchRes.ok) {
        return new Response(JSON.stringify({ error: searchData.error?.message ?? 'Stripe error' }), {
          status: 500, headers: { ...cors(req), 'Content-Type': 'application/json' },
        });
      }

      customerId = searchData.data?.[0]?.id ?? null;
    }

    if (!customerId) {
      return new Response(JSON.stringify({ error: 'No subscription found for this account.' }), {
        status: 404, headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    const params = new URLSearchParams();
    params.set('customer', customerId);
    params.set('return_url', returnUrl);

    const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const portalData = await portalRes.json();

    if (!portalRes.ok) {
      return new Response(JSON.stringify({ error: portalData.error?.message ?? 'Stripe error' }), {
        status: 500, headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ url: portalData.url }), {
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[create-portal-session] unhandled error:', (err as Error).message);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }), {
      status: 500, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }
});
