// Squad linking — coaches/clubs register a squad with an invite code; players
// join with that code. When the coach is on a paid (Pro) plan, joined players
// inherit Premium. Backed by Supabase tables `coach_squads` + `squad_members`.

import { supabase } from './supabase';

/** Deterministic invite code from a user id — must match CoachDashboard display. */
export function deriveTeamCode(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '', n = hash;
  for (let i = 0; i < 5; i++) { code += alphabet[n % alphabet.length]; n = Math.floor(n / alphabet.length); }
  return `VF-${code}`;
}

/** Coach/Club: ensure this user's squad row exists. Idempotent.
 *  The squad TIER is decided SERVER-SIDE by the register_squad RPC from the
 *  coach's genuine paid entitlement — the client can no longer claim 'pro'
 *  (which previously let a user with spoofed local premium publish a Pro squad
 *  and grant other players premium for free). team_code stays deterministic.
 *  Returns an error message on failure, or null on success. */
export async function registerSquad(userId: string): Promise<string | null> {
  if (!supabase) return 'not_configured';
  try {
    const team_code = deriveTeamCode(userId);
    const { error } = await supabase.rpc('register_squad', { p_team_code: team_code });
    if (error) {
      if (import.meta.env.DEV) console.warn('[teams] registerSquad failed:', error.message, error);
      return error.message;
    }
    if (import.meta.env.DEV) console.log('[teams] registerSquad OK', { team_code });
    return null;
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[teams] registerSquad threw:', e);
    return 'exception';
  }
}

export type JoinResult =
  | { success: true; coachId: string; tier: 'free' | 'pro' }
  | { success: false; reason: 'invalid' | 'self' | 'error' };

/** Player: join a squad by code (via the join_squad RPC). */
export async function joinSquad(code: string): Promise<JoinResult> {
  if (!supabase) return { success: false, reason: 'error' };
  try {
    const { data, error } = await supabase.rpc('join_squad', { p_code: code.trim().toUpperCase() });
    if (error) {
      const m = error.message || '';
      if (import.meta.env.DEV) console.warn('[teams] joinSquad error:', m, error);
      if (m.includes('invalid_code')) return { success: false, reason: 'invalid' };
      if (m.includes('self_join')) return { success: false, reason: 'self' };
      return { success: false, reason: 'error' };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { success: false, reason: 'invalid' };
    return { success: true, coachId: row.coach_id, tier: (row.tier === 'pro' ? 'pro' : 'free') };
  } catch {
    return { success: false, reason: 'error' };
  }
}
