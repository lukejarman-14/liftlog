import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { CaptchaGate } from './components/CaptchaGate.tsx'
import { initialiseSentry } from './lib/sentry.ts'
import './index.css'

// Initialise Sentry before anything else so it catches all errors from boot
initialiseSentry();

// Apply dark mode class before first render to avoid flash
if (localStorage.getItem('vf_dark_mode') === 'true') {
  document.documentElement.classList.add('dark');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      {/* Always-mounted invisible hCaptcha widget — supplies tokens to the
          Supabase auth helpers on every screen (see CaptchaGate / hcaptcha.ts). */}
      <CaptchaGate />
    </ErrorBoundary>
  </StrictMode>,
)

// Service worker is a web/PWA-only feature. Inside the native app the web assets
// are already bundled and served locally, so a SW adds nothing — and in WKWebView
// it can serve stale cached content after an update, which appears as a BLANK PAGE
// on launch (the cause of the App Store 2.1a rejection). On native we never
// register it, and we actively unregister any SW (and wipe its caches) that an
// earlier build left behind, so devices updating from that build self-heal.
if ('serviceWorker' in navigator) {
  if (Capacitor.isNativePlatform()) {
    navigator.serviceWorker.getRegistrations()
      .then(regs => regs.forEach(reg => reg.unregister()))
      .catch(() => {});
    if ('caches' in window) {
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .catch(() => {});
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed — app still works online
      });
    });
  }
}
