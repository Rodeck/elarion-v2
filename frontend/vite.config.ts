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
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
