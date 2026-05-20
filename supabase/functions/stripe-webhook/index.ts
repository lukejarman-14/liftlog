import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!signature || !webhookSecret) {
    return new Response('Missing signature or webhook secret', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    return new Response(`Webhook error: ${(err as Error).message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const plan = session.metadata?.plan as string | undefined;

        if (!userId || !plan) break;

        let expiresAt: number | null = null;

        if (plan !== 'lifetime' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          expiresAt = sub.current_period_end * 1000;
        }

        await upsertPremium(userId, plan, expiresAt);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        const plan = sub.metadata?.plan;

        if (!userId || !plan) break;

        if (sub.status === 'active' || sub.status === 'trialing') {
          await upsertPremium(userId, plan, sub.current_period_end * 1000);
        } else {
          await revokePremium(userId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        await revokePremium(userId);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const userId = sub.metadata?.userId;
          if (userId) await revokePremium(userId);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function upsertPremium(userId: string, plan: string, expiresAt: number | null) {
  const { data: existing } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', userId)
    .single();

  const currentData = existing?.data ?? {};
  const premiumStatus = currentData.vf_premium ? JSON.parse(currentData.vf_premium) : {};

  const updated = {
    ...premiumStatus,
    isPremium: true,
    plan,
    purchasedAt: premiumStatus.purchasedAt ?? Date.now(),
    ...(expiresAt ? { expiresAt } : {}),
  };

  await supabase
    .from('user_data')
    .upsert({
      user_id: userId,
      data: { ...currentData, vf_premium: JSON.stringify(updated) },
      updated_at: new Date().toISOString(),
    });
}

async function revokePremium(userId: string) {
  const { data: existing } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', userId)
    .single();

  if (!existing) return;

  const currentData = existing.data ?? {};
  const premiumStatus = currentData.vf_premium ? JSON.parse(currentData.vf_premium) : {};

  const updated = {
    ...premiumStatus,
    isPremium: false,
    plan: undefined,
    expiresAt: undefined,
  };

  await supabase
    .from('user_data')
    .update({
      data: { ...currentData, vf_premium: JSON.stringify(updated) },
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
}
