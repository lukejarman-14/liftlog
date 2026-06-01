// Snapshot Supabase auth redirect params before any module script runs.
// Supabase clears ?code= from the URL during createClient() init (replaceState),
// so this must run synchronously before module scripts load.
// PKCE reset links arrive as ?code=XXXX with no type=recovery in the URL.
(function () {
  var s = window.location.search;
  var h = window.location.hash;
  if (s.includes('code=') || h.includes('type=recovery') || s.includes('type=recovery')) {
    sessionStorage.setItem('vf_auth_redirect', '1');
  }
})();
