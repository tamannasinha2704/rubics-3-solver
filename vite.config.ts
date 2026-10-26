/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { licensesPlugin } from './licenses.plugin';

// GitHub Pages serves a project site from /<repo-name>/. The deploy workflow
// passes that path in BASE_PATH; locally the site is served from the root.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), licensesPlugin('Tamanna Sinha')],
  worker: { format: 'es' },
  // three.js alone is ~600 kB minified; it is one cached download.
  build: { chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 60000,
  },
});
