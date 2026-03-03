import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 4002,
    proxy: {
      '/api': {
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
