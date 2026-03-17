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
      '/item-icons': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/monster-icons': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/npc-icons': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/ability-icons': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
});
