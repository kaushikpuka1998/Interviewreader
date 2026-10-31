import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: [
      // Optional jspdf plugins (SVG / DOMPurify) that the resume PDF doesn't use.
      { find: /^canvg$/, replacement: path.resolve(__dirname, 'src/lib/unusedPdfPlugin.js') },   // dompurify is NOT stubbed: Mermaid needs the real one
    ],
  },
  plugins: [
    react(),
    // Precaches the built app shell so the site itself still loads when offline. Question data offline-availability is handled separately
    // (see src/lib/offlineStore.js) since it's paginated/filtered API data, not
    // a static asset Workbox can glob.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        // Precache only the app shell. A glob over every .js pulled in ~80 lazy Mermaid
        // diagram chunks (~3.7 MB) on the first visit, though they only load when a
        // question has a diagram. Those chunks now fetch on demand and use normal HTTP caching.
        globPatterns: ['**/*.{css,html,svg,png,ico}', 'assets/index-*.js', 'assets/vendor-*.js'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Question detail lookups (fetchQuestion) are simple GET-by-id calls;
            // safe to serve stale-while-revalidate so a repeat visit is instant
            // and still works if the network request fails.
            urlPattern: ({ url, request }) => request.method === 'GET' && url.pathname.includes('/api/questions/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'ir-question-api' },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
