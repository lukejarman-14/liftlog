import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

// ============================================================================
// RevenueCat webhook — mirrors iOS (App Store) subscription state into the
// server-authoritative `entitlements` table (source='revenuecat'), so that the
// same get_my_entitlement() RPC serves both web (Stripe) and iOS (RevenueCat).
//
// SETUP REQUIRED before enabling (RevenueCat dashboard → Project → Webhooks):
//   1. URL: https://<project>.supabase.co/functions/v1/revenuecat-webhook
//   2. Authorization header: set a strong secret and store it as the
//      REVENUECAT_WEBHOOK_AUTH env var on this function.
//   3. Confirm the product→plan mapping in planForProduct() matches your real
//      RevenueCat product identifiers.
//   4. The client must configure RevenueCat with appUserID = the Supabase user
//      id, so event.app_user_id maps to entitlements.user_id (see rcConfigure).
//
// Hardened like the Stripe webhook: shared-secret auth, idempotency ledger,
// checked DB writes, non-2xx on failure (RevenueCat retries).
// ============================================================================

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

/** Constant-time string comparison — avoids leaking the shared secret via the
 *  early-exit timing of a normal `!==`. Length difference returns false fast
 *  (acceptable — the secret length is not sensitive). */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// Map a RevenueCat product identifier to our plan. ADJUST to your real product ids.
function planForProduct(productId: string | undefined): 'monthly' | 'yearly' | 'lifetime' | null {
  const id = (productId ?? '').toLowerCase();
  if (id.includes('lifetime')) return 'lifetime';
  if (id.includes('annual') || id.includes('year')) return 'yearly';
  if (id.includes('month')) return 'monthly';
  return null;
}

interface RCEvent {
  id?: string;
  type?: string;
  app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number | null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Shared-secret auth — RevenueCat sends the configured Authorization header.
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  const provided = req.headers.get('Authorization');
  if (!expected || !provided || !timingSafeEqual(provided, expected)) {
    return new Response('Unauthorized', { status: 401 });
  }

  let event: RCEvent;
  try {
    const body = await req.json();
    event = (body?.event ?? {}) as RCEvent;
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const userId = event.app_user_id;
  const eventId = event.id;
  if (!userId || !eventId) {
    // Anonymous RC ids (not yet logged in as a Supabase user) — nothing to map.
    return json({ received: true, skipped: true });
  }

  try {
    // Idempotency — RevenueCat retries; only process each event id once.
    const { error: ledgerError } = await supabase
      .from('billing_events')
      .insert({ event_id: `rc_${eventId}` });
    if (ledgerError) {
      if ((ledgerError as { code?: string }).code === '23505') {
        return json({ received: true, duplicate: true });
      }
      throw new Error(`ledger insert failed: ${ledgerError.message}`);
    }

    const grantTypes = ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE'];
    const revokeTypes = ['EXPIRATION'];

    if (grantTypes.includes(event.type ?? '')) {
      const plan = planForProduct(event.product_id);
      // Exact-allowlist: refuse to grant premium for an unrecognized product.
      // (Without this, an unknown product → plan=null → could read as permanent
      // premium downstream.) Ack so RevenueCat stops retrying.
      if (!plan) {
        console.error('[revenuecat-webhook] unknown product, refusing grant:', event.product_id);
        return json({ received: true, ignored: 'unknown_product' });
      }
      const periodEnd = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;
      const { error } = await supabase.from('entitlements').upsert({
        user_id: userId,
        is_premium: true,
        plan,
        source: 'revenuecat',
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) throw new Error(`entitlements grant failed: ${error.message}`);
    } else if (revokeTypes.includes(event.type ?? '')) {
      // Never downgrade a lifetime purchase.
      const { data: existing, error: readErr } = await supabase
        .from('entitlements').select('plan').eq('user_id', userId).maybeSingle();
      if (readErr) throw new Error(`entitlements read failed: ${readErr.message}`);
      if (existing?.plan !== 'lifetime') {
        const { error } = await supabase.from('entitlements').update({
          is_premium: false, plan: null, source: null, current_period_end: null,
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId);
        if (error) throw new Error(`entitlements revoke failed: ${error.message}`);
      }
    }
    // CANCELLATION (auto-renew off) is intentionally NOT a revoke — access lasts
    // until EXPIRATION. BILLING_ISSUE is handled by EXPIRATION after the grace period.

    return json({ received: true });
  } catch (err) {
    console.error('[revenuecat-webhook] processing error:', (err as Error).message);
    return new Response(JSON.stringify({ error: 'processing_failed' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}
