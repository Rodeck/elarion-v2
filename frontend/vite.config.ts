import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@elarion/protocol': resolve(__dirname, '../shared/protocol/index.ts'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/images': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/boss-icons': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/boss-sprites': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/assets/bosses/icons': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        rewrite: (p: string) => p.replace('/assets/bosses/icons', '/boss-icons'),
      },
      '/assets/bosses/sprites': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        rewrite: (p: string) => p.replace('/assets/bosses/sprites', '/boss-sprites'),
      },
      '/fatigue-icons': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
