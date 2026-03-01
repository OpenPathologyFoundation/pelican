import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

// When served behind the nginx reverse proxy at /viewer/, set VITE_BASE=/viewer/
// so that Vite serves assets under /viewer/ and rewrites injected paths (e.g.
// /@vite/client → /viewer/@vite/client). In standalone mode, omit the variable.
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [svelte()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      // Proxy tile server requests to avoid CORS issues in development
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        orchestrated: resolve(__dirname, 'orchestrated.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@pathology/fdp-lib': new URL('./packages/fdp-lib/src/index.ts', import.meta.url).pathname,
      '@pathology/viewer-core': new URL('./packages/viewer-core/src/index.ts', import.meta.url).pathname,
      '@pathology/annotations': new URL('./packages/annotations/src/index.ts', import.meta.url).pathname,
      '@pathology/review-state': new URL('./packages/review-state/src/index.ts', import.meta.url).pathname,
      '@pathology/telemetry': new URL('./packages/telemetry/src/index.ts', import.meta.url).pathname,
      '@pathology/voice': new URL('./packages/voice/src/index.ts', import.meta.url).pathname,
    },
  },
  optimizeDeps: {
    exclude: ['@pathology/fdp-lib', '@pathology/viewer-core', '@pathology/annotations', '@pathology/review-state', '@pathology/telemetry', '@pathology/voice'],
  },
});
