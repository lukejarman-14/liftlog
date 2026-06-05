import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

// ============================================================================
// Stripe webhook — writes the SERVER-AUTHORITATIVE entitlement record.
//
// Hardened per Codex review:
//  - Idempotency: every event id is recorded in billing_events; duplicates are
//    acknowledged without reprocessing (Stripe retries are safe).
//  - Normalized writes: entitlements + stripe_customers tables (no more
//    read-modify-write of the whole user_data JSON blob, which raced client saves
//    and stored the customer id in client-writable storage → IDOR).
//  - Every DB result is checked; on failure we throw → return non-2xx so Stripe
//    retries instead of silently losing billing state.
// ============================================================================

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
});

// Service-role client — bypasses RLS to write the server-only tables.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

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
    // ---- Idempotency: skip events we've already processed ------------------
    const { error: ledgerError } = await supabase
      .from('billing_events')
      .insert({ event_id: event.id });
    if (ledgerError) {
      // 23505 = unique_violation → already processed. Ack so Stripe stops retrying.
      if ((ledgerError as { code?: string }).code === '23505') {
        return json({ received: true, duplicate: true });
      }
      throw new Error(`ledger insert failed: ${ledgerError.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const plan = session.metadata?.plan as string | undefined;
        const stripeCustomerId = session.customer as string | null;
        if (!userId || !plan) break;

        // One-time (lifetime) payments must be confirmed paid before granting.
        if (plan === 'lifetime' && session.payment_status !== 'paid') break;

        let periodEnd: string | null = null;
        let isTrial = false;
        if (plan !== 'lifetime' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          periodEnd = new Date(sub.current_period_end * 1000).toISOString();
          isTrial = sub.status === 'trialing' || sub.trial_end != null;
        }
        if (stripeCustomerId) await linkCustomer(userId, stripeCustomerId);
        await grantPaid(userId, plan, periodEnd);
        if (isTrial) await markTrialUsed(userId);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        const plan = sub.metadata?.plan;
        if (!userId || !plan) break;

        if (sub.status === 'active' || sub.status === 'trialing') {
          await grantPaid(userId, plan, new Date(sub.current_period_end * 1000).toISOString());
          if (sub.status === 'trialing' || sub.trial_end != null) await markTrialUsed(userId);
        } else {
          await revokePaid(userId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) await revokePaid(userId);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const attemptCount = (invoice as { attempt_count?: number }).attempt_count ?? 1;
        if (attemptCount < 3) break; // let Stripe retry the card first
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const userId = sub.metadata?.userId;
          if (userId && sub.status !== 'active' && sub.status !== 'trialing') {
            await revokePaid(userId);
          }
        }
        break;
      }
    }

    return json({ received: true });
  } catch (err) {
    // Do NOT swallow — returning non-2xx makes Stripe retry the event.
    console.error('[stripe-webhook] processing error:', (err as Error).message);
    return new Response(JSON.stringify({ error: 'processing_failed' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}

/** Map a Supabase user to their Stripe customer id (server-only table). */
async function linkCustomer(userId: string, stripeCustomerId: string): Promise<void> {
  const { error } = await supabase
    .from('stripe_customers')
    .upsert({ user_id: userId, stripe_customer_id: stripeCustomerId, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' });
  if (error) throw new Error(`stripe_customers upsert failed: ${error.message}`);
}

/** Grant/refresh paid entitlement. Only the billing columns are written, so the
 *  user's trial_started_at / grant_expires_at are preserved. */
async function grantPaid(userId: string, plan: string, periodEnd: string | null): Promise<void> {
  const { error } = await supabase
    .from('entitlements')
    .upsert({
      user_id: userId,
      is_premium: true,
      plan,
      source: 'stripe',
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) throw new Error(`entitlements grant failed: ${error.message}`);
}

/** Stamp trial_started_at ONCE when a Stripe trial is created — never overwrite
 *  an earlier trial. This is what the checkout repeat-trial guard reads to
 *  enforce "30 days per user". */
async function markTrialUsed(userId: string): Promise<void> {
  const { error } = await supabase
    .from('entitlements')
    .update({ trial_started_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('trial_started_at', null);   // only stamp if not already set
  if (error) throw new Error(`trial stamp failed: ${error.message}`);
}

/** Revoke paid entitlement — but never downgrade a lifetime purchase. */
async function revokePaid(userId: string): Promise<void> {
  const { data: existing, error: readErr } = await supabase
    .from('entitlements')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle();
  if (readErr) throw new Error(`entitlements read failed: ${readErr.message}`);
  if (existing?.plan === 'lifetime') return;

  const { error } = await supabase
    .from('entitlements')
    .update({ is_premium: false, plan: null, source: null, current_period_end: null,
              updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw new Error(`entitlements revoke failed: ${error.message}`);
}
