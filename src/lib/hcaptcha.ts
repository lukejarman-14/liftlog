/**
 * hCaptcha integration for Supabase auth.
 *
 * Supabase enforces CAPTCHA on signUp, signInWithPassword, resetPasswordForEmail
 * and resend when "Enable Captcha protection" is ON in the dashboard. The client
 * must therefore obtain a token and pass it as `options.captchaToken` on each of
 * those calls — otherwise the request is rejected and auth breaks.
 *
 * Architecture
 * ------------
 * A single INVISIBLE hCaptcha widget is mounted once at the app root (see
 * `CaptchaGate`, mounted in main.tsx). On load it registers a token executor
 * here. The auth helpers in cloudSync.ts call `getCaptchaToken()` to obtain a
 * fresh, single-use token immediately before each enforced auth request.
 *
 * Why a hardcoded fallback site key?
 * ----------------------------------
 * The site key below is a PUBLIC key — it is designed to ship in client HTML and
 * is safe to commit. It is NOT the hCaptcha *secret* (the secret lives only in
 * the Supabase dashboard). We read it from `VITE_HCAPTCHA_SITE_KEY` but fall back
 * to the literal public key so that a forgotten env var can never silently stop
 * the widget from rendering — which would re-create the exact outage this work
 * is fixing (server enforcing CAPTCHA while the client sends no token).
 */

export const HCAPTCHA_SITE_KEY: string =
  (import.meta.env.VITE_HCAPTCHA_SITE_KEY as string | undefined) ??
  '6662a818-c5f8-429c-8a2c-003051e22bea';

/** Resolves to a fresh single-use token, or rejects if the challenge fails. */
type Executor = () => Promise<string | undefined>;

let executor: Executor | null = null;

/** Called by CaptchaGate once the invisible widget has loaded. */
export function registerCaptchaExecutor(fn: Executor | null): void {
  executor = fn;
}

/**
 * Obtain a fresh single-use hCaptcha token.
 *
 * Returns `undefined` when the widget is not ready or the challenge fails.
 * Passing `undefined` to Supabase is harmless when CAPTCHA is OFF (the field is
 * ignored). When CAPTCHA is ON a real token is required, so the widget MUST be
 * verified working on web AND device BEFORE the dashboard toggle is enabled.
 */
export async function getCaptchaToken(): Promise<string | undefined> {
  if (!executor) return undefined;
  try {
    return await executor();
  } catch {
    // User dismissed the challenge, or the widget errored (e.g. hostname not yet
    // allow-listed). Returning undefined lets Supabase surface a clear captcha
    // error instead of throwing an opaque exception out of the auth helper.
    return undefined;
  }
}
