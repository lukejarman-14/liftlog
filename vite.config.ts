/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Dev-only plugin: mirrors the Netlify redirects for static HTML pages
// so /landing, /waitlist etc. work locally without a .html extension.
function staticPageRedirects() {
  return {
    name: 'static-page-redirects',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const routes: Record<string, string> = {
          '/landing': '/landing.html',
          '/privacy': '/privacy/index.html',
          '/terms': '/terms/index.html',
          '/waitlist': '/waitlist/index.html',
          '/waitlist/terms': '/waitlist/terms.html',
          '/waitlist/privacy': '/waitlist/privacy.html',
          '/waitlist/cookies': '/waitlist/cookies.html',
        }
        const target = routes[req.url?.split('?')[0]]
        if (target) {
          const filePath = path.join(__dirname, 'public', target)
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'text/html')
            res.end(fs.readFileSync(filePath))
            return
          }
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), staticPageRedirects()],
  test: {
    environment: 'node',
    globals: true,
  },
  build: {
    // Raise warning threshold — 500 KB is too low for a full SPA
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-charts': ['recharts'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-capacitor': ['@capacitor/core', '@capacitor/local-notifications', '@revenuecat/purchases-capacitor'],
        },
      },
    },
  },
})
