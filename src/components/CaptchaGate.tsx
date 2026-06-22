import { useEffect, useRef, useState } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { HCAPTCHA_SITE_KEY, registerCaptchaExecutor } from '../lib/hcaptcha';

/**
 * Mounts a single INVISIBLE hCaptcha widget and registers a token executor with
 * the hcaptcha lib. Rendered once at the app root (main.tsx) so a token can be
 * produced on every screen that can trigger an enforced auth request — signup,
 * login, forgot-password, and the dashboard "resend confirmation" path.
 *
 * Invisible mode renders no visible UI until a challenge is actually required,
 * so this adds nothing to the layout. We use the imperative `execute({ async })`
 * API rather than the onVerify callback so the auth helpers can simply
 * `await getCaptchaToken()` inline.
 */
export function CaptchaGate() {
  const ref = useRef<HCaptcha>(null);
  const [mountKey, setMountKey] = useState(0);

  useEffect(() => {
    const remountAfterReconnect = () => {
      registerCaptchaExecutor(null);
      setMountKey(key => key + 1);
    };
    window.addEventListener('online', remountAfterReconnect);
    return () => window.removeEventListener('online', remountAfterReconnect);
  }, []);

  return (
    <HCaptcha
      key={mountKey}
      ref={ref}
      sitekey={HCAPTCHA_SITE_KEY}
      size="invisible"
      onLoad={() => {
        registerCaptchaExecutor(async () => {
          // execute() resolves with a fresh single-use token.
          const result = await ref.current?.execute({ async: true });
          // Reset so the next auth attempt starts from a clean widget state and
          // gets a brand-new token (tokens are single-use + short-lived).
          ref.current?.resetCaptcha();
          return result?.response;
        });
      }}
      onError={() => {
        registerCaptchaExecutor(null);
      }}
    />
  );
}
