/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Root-hosted by default. GitHub Pages project sites build with
  // VITE_BASE=/<repo>/ so assets, the service worker and the manifest resolve.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: false,
    alias: [
      {
        find: /^zustand$/,
        replacement: fileURLToPath(
          new URL('./src/test/zustand-test-shim.ts', import.meta.url),
        ),
      },
    ],
  },
});
