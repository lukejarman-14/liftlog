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

/** Coach/Club: ensure this user's squad row exists with the current tier. Idempotent. */
export async function registerSquad(userId: string, tier: 'free' | 'pro'): Promise<void> {
  if (!supabase) return;
  const team_code = deriveTeamCode(userId);
  try {
    await supabase.from('coach_squads').upsert(
      { coach_id: userId, team_code, tier, updated_at: new Date().toISOString() },
      { onConflict: 'coach_id' },
    );
  } catch { /* non-fatal — squad will register on next boot */ }
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
