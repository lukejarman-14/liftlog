/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
