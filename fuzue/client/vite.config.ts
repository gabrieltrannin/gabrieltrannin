import { defineConfig, type Plugin } from 'vite';

/** Identificador desta publicação: muda a cada build. */
const version = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

/** Gera /version.json para o jogo avisar quando sai uma atualização. */
function versionFile(): Plugin {
  return {
    name: 'fuzue-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) });
    },
  };
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [versionFile()],
  server: { port: 5173 },
  preview: { port: 4173 },
  // o Three.js sozinho tem ~600 kB; o aviso padrão de 500 kB não ajuda aqui
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
