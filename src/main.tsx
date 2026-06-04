import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
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

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed — app still works online
    });
  });
}
