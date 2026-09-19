import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Proxy target is server-side (PC loopback), so LAN phones work: the phone
// talks same-origin /api to vite, vite forwards locally. Default matches
// `wrangler dev` in server/ (:8787, real Workers runtime). Point at
// http://127.0.0.1:3000 only when running the tsx server instead.
const apiBase = process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8787'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: apiBase,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
    proxy: {
      '/api': {
        target: apiBase,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          // Heavy deps, single-page usage: keep out of the main route chunks.
          'vendor-charts': ['recharts'],
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
        },
      },
    },
  },
})
