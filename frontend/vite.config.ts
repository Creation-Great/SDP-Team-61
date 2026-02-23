import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/auth': 'http://localhost:8080',
      '/submissions': 'http://localhost:8080',
      '/reviews': 'http://localhost:8080',
      '/checkins': 'http://localhost:8080',
      '/instructor': 'http://localhost:8080',
      '/uploads': 'http://localhost:8080',
      '/healthz': 'http://localhost:8080',
    },
  },
});
