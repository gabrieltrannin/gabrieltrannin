import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173 },
  preview: { port: 4173 },
  // o Three.js sozinho tem ~600 kB; o aviso padrão de 500 kB não ajuda aqui
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
