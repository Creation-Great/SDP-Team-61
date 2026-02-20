import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
    },
  },
});
