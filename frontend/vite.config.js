import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SDP Peer Review System',
        short_name: 'PeerReview',
        description: 'AI-enhanced peer review platform',
        theme_color: '#000E2F',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/(auth|submissions|reviews|notifications)/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 300 } },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react', 'framer-motion'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
    exclude: ['node_modules', 'dist', 'e2e/**'],
  },
  server: {
    host: true,
    proxy: {
      '/auth': 'http://localhost:8080',
      '/submissions': 'http://localhost:8080',
      '/reviews': 'http://localhost:8080',
      '/instructor': 'http://localhost:8080',
      '/peer-review': 'http://localhost:8080',
      '/uploads': 'http://localhost:8080',
      '/healthz': 'http://localhost:8080',
      '/checkins': 'http://localhost:8080',
      '/enrollments': 'http://localhost:8080',
      '/api/ai': 'http://localhost:8080',
      '/notifications': 'http://localhost:8080',
      '/semesters': { target: 'http://localhost:8080', changeOrigin: true },
      '/revisions': { target: 'http://localhost:8080', changeOrigin: true },
      '/grades': { target: 'http://localhost:8080', changeOrigin: true },
      '/lms': { target: 'http://localhost:8080', changeOrigin: true },
      '/deadlines': { target: 'http://localhost:8080', changeOrigin: true },
      '/preferences': { target: 'http://localhost:8080', changeOrigin: true },
      '/compliance': { target: 'http://localhost:8080', changeOrigin: true },
      '/similarity': { target: 'http://localhost:8080', changeOrigin: true },
      '/anonymity': { target: 'http://localhost:8080', changeOrigin: true },
      '/assignment-strategy': { target: 'http://localhost:8080', changeOrigin: true },
      '/quality': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
});
