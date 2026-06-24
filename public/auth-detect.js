// Snapshot Supabase auth redirect params before any module script runs.
// Supabase clears ?code= from the URL during createClient() init (replaceState),
// so this must run synchronously before module scripts load.
// PKCE links arrive as ?code=XXXX with no type in the URL, so an email-confirmation
// link and a password-reset link look identical on their own. We disambiguate using
// explicit markers added to each redirect: ?vf_confirm=1 (signup / resend) and
// ?vf_reset=1 (password reset). A bare ?code= carrying NEITHER marker (e.g. an older
// email sent before these markers existed, or an OAuth sign-in) is deliberately left
// unflagged so the SIGNED_IN vs PASSWORD_RECOVERY auth event can disambiguate it — that
// way an old confirmation link is never mistaken for a password reset. Confirmation first.
(function () {
  var s = window.location.search;
  var h = window.location.hash;
  try {
    if (s.indexOf('vf_confirm=1') !== -1 || h.indexOf('type=signup') !== -1) {
      sessionStorage.setItem('vf_email_confirm', '1');
    } else if (s.indexOf('vf_reset=1') !== -1 || h.indexOf('type=recovery') !== -1 || s.indexOf('type=recovery') !== -1) {
      sessionStorage.setItem('vf_auth_redirect', '1');
    }
  } catch (e) { /* sessionStorage unavailable — detection falls back to URL parsing */ }
})();
