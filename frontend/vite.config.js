import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
    },
  },
});
