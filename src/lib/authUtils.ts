/** SHA-256(salt + password). Salt should be the user's email. Returns hex digest. */
export async function hashPassword(password: string, salt = ''): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
