import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
});

const PRICE_IDS: Record<string, string> = {
  monthly:  'price_1TYUTAI9XBJqJRUMzkmDFFzG',
  yearly:   'price_1TYWukI9XBJqJRUMF2LvtbB5',
  lifetime: 'price_1TYWxFI9XBJqJRUMpC48p9qo',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { plan, userId, userEmail, successUrl, cancelUrl } = await req.json();

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isLifetime = plan === 'lifetime';

    const session = await stripe.checkout.sessions.create({
      mode: isLifetime ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      customer_email: userEmail,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId, plan },
      ...(isLifetime ? {} : {
        subscription_data: {
          trial_period_days: 14,
          metadata: { userId, plan },
        },
      }),
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
