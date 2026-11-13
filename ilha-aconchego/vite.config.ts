import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5173 },
  // Three.js alone is about 600 kB minified (160 kB gzip); the glTF loader is already split out.
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
