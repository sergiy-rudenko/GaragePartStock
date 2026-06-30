import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies /api requests to the Express backend so the
// frontend can call relative URLs without CORS headaches in development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // Uploaded part images are served by the backend at /uploads.
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
