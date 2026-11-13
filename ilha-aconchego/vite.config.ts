import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5173 },
  // Three.js alone is about 600 kB minified (160 kB gzip) and the game about 250 kB; the glTF loader is already split out.
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1000 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
