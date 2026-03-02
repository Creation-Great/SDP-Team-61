import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/auth':        'http://localhost:8080',
      '/courses':     'http://localhost:8080',
      '/assignments': 'http://localhost:8080',
      '/me':          'http://localhost:8080',
      '/healthz':     'http://localhost:8080',
    },
  },
});
