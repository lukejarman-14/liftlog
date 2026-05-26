import { supabase } from './supabase';

export async function createStripeCheckout(
  plan: 'monthly' | 'yearly' | 'lifetime',
  userId: string,
  userEmail: string,
): Promise<{ url: string } | { error: string }> {
  const origin = window.location.origin;

  if (!supabase) return { error: 'Payments not configured' };
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: {
      plan,
      userId,
      userEmail,
      successUrl: `${origin}/?stripe_success=1`,
      cancelUrl: `${origin}/?stripe_cancel=1`,
    },
  });

  if (error) return { error: error.message };
  if (!data?.url) return { error: 'No checkout URL returned' };
  return { url: data.url };
}
