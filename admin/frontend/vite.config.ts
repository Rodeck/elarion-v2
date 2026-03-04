import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 4002,
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/login': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
});
