export const PASSWORD_ACTION_COOLDOWN_MS = 5 * 60 * 1000;

export type ActionCooldownScope = 'password-reset' | 'password-change' | 'email-confirm';

function normaliseIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase() || 'default';
}

function cooldownKey(scope: ActionCooldownScope, identifier: string): string {
  return `vf_cooldown_${scope}_${normaliseIdentifier(identifier)}`;
}

export function getActionCooldownRemaining(
  scope: ActionCooldownScope,
  identifier: string,
  now = Date.now(),
): number {
  try {
    const until = Number(localStorage.getItem(cooldownKey(scope, identifier)) ?? 0);
    return Math.max(0, until - now);
  } catch {
    return 0;
  }
}

export function startActionCooldown(
  scope: ActionCooldownScope,
  identifier: string,
  durationMs = PASSWORD_ACTION_COOLDOWN_MS,
): void {
  try {
    localStorage.setItem(cooldownKey(scope, identifier), String(Date.now() + durationMs));
  } catch {
    // Ignore storage failures; the server-side auth rate limit still protects Supabase.
  }
}

export function formatCooldown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

