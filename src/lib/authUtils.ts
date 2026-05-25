/**
 * Shared authentication utilities.
 * Centralised here so the hash algorithm can be updated in one place.
 */

/** SHA-256 hash a password string. Returns a hex digest. */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
