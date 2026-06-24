/* PostHog analytics for static marketing pages — consent-first (GDPR).
 * Opted-out by default; only captures after the visitor clicks Accept.
 * Uses the same `vf_cookie_consent` localStorage key as the main app. */
(function () {
  var PRIVACY_HREF = '/privacy.html';
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  posthog.init('phc_qMyPH4JfxzxC85zoL6rqW7SCxjf2J3ZA9ZtTTmq4jBGU', {
    api_host: 'https://eu.i.posthog.com',
    autocapture: false,
    disable_session_recording: true,
    opt_out_capturing_by_default: true
  });

  var CONSENT_KEY = 'vf_cookie_consent';
  function enable() { posthog.opt_in_capturing(); posthog.capture('$pageview'); }
  function showBar() {
    if (document.getElementById('vf-consent')) return;
    var bar = document.createElement('div');
    bar.id = 'vf-consent';
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#1a1a1a;color:#e5e5e5;font:14px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;padding:14px 18px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center;border-top:1px solid #333';
    bar.innerHTML = '<span style="max-width:560px">We use cookies for anonymous analytics to improve the app. <a href="' + PRIVACY_HREF + '" style="color:#f97316">Privacy</a>.</span>' +
      '<button id="vf-c-yes" style="background:#f97316;color:#000;border:0;border-radius:8px;padding:9px 18px;font-weight:600;cursor:pointer">Accept</button>' +
      '<button id="vf-c-no" style="background:transparent;color:#aaa;border:1px solid #444;border-radius:8px;padding:9px 18px;cursor:pointer">Decline</button>';
    document.body.appendChild(bar);
    document.getElementById('vf-c-yes').onclick = function () { localStorage.setItem(CONSENT_KEY, 'granted'); enable(); bar.remove(); };
    document.getElementById('vf-c-no').onclick = function () { localStorage.setItem(CONSENT_KEY, 'denied'); bar.remove(); };
  }
  try {
    var c = localStorage.getItem(CONSENT_KEY);
    if (c === 'granted') enable();
    else if (c !== 'denied') {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBar);
      else showBar();
    }
  } catch (e) {}
})();
