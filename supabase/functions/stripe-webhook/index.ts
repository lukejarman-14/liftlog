import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
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
        const stripeCustomerId = session.customer as string | null;

        if (!userId || !plan) break;

        // For one-time payments, only proceed once Stripe has confirmed the charge.
        // Subscriptions handle this via their own lifecycle events.
        if (plan === 'lifetime' && session.payment_status !== 'paid') break;

        let expiresAt: number | null = null;
        if (plan !== 'lifetime' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          expiresAt = sub.current_period_end * 1000;
        }

        await upsertPremium(userId, plan, expiresAt, stripeCustomerId);
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
        // Only revoke after Stripe has exhausted retries — don't cut off users
        // on a temporary card failure. Stripe retries 3–4 times over several days.
        const invoice = event.data.object as Stripe.Invoice;
        const attemptCount = (invoice as { attempt_count?: number }).attempt_count ?? 1;
        if (attemptCount < 3) break;

        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const userId = sub.metadata?.userId;
          if (userId && sub.status !== 'active' && sub.status !== 'trialing') {
            await revokePremium(userId);
          }
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[stripe-webhook] unhandled error:', (err as Error).message);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function upsertPremium(
  userId: string,
  plan: string,
  expiresAt: number | null,
  stripeCustomerId?: string | null,
) {
  const { data: existing } = await supabase
    .from('user_data')
    .select('app_data')
    .eq('id', userId)
    .single();

  const currentData = (existing?.app_data ?? {}) as Record<string, unknown>;
  const premiumStatus = (currentData.vf_premium ?? {}) as Record<string, unknown>;

  const updated: Record<string, unknown> = {
    ...premiumStatus,
    isPremium: true,
    plan,
    purchasedAt: premiumStatus.purchasedAt ?? Date.now(),
  };
  if (expiresAt !== null) updated.expiresAt = expiresAt;

  const newAppData: Record<string, unknown> = { ...currentData, vf_premium: updated };
  if (stripeCustomerId) newAppData.vf_stripe_customer_id = stripeCustomerId;

  await supabase
    .from('user_data')
    .upsert({
      id: userId,
      app_data: newAppData,
      updated_at: new Date().toISOString(),
    });
}

async function revokePremium(userId: string) {
  const { data: existing } = await supabase
    .from('user_data')
    .select('app_data')
    .eq('id', userId)
    .single();

  if (!existing) return;

  const currentData = (existing.app_data ?? {}) as Record<string, unknown>;
  const premiumStatus = (currentData.vf_premium ?? {}) as Record<string, unknown>;

  // Never revoke lifetime purchases via webhook
  if (premiumStatus.plan === 'lifetime') return;

  const updated: Record<string, unknown> = {
    ...premiumStatus,
    isPremium: false,
    plan: null,
    expiresAt: null,
  };

  await supabase
    .from('user_data')
    .update({
      app_data: { ...currentData, vf_premium: updated },
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}
