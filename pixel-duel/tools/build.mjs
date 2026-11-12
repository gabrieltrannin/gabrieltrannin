// Gera uma versão de arquivo único do jogo (HTML com CSS e JS embutidos).
//   node tools/build.mjs                    -> dist/pixel-duel.html
//   node tools/build.mjs saida.html --artifact
// O modo --artifact gera só o conteúdo da página (sem <html>/<head>/<body>),
// no formato usado pelas prévias do Claude, e desliga o duelo online.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const artifact = args.includes('--artifact');
const out = args.find((a) => !a.startsWith('--')) || path.join(root, 'dist', 'pixel-duel.html');

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
html = html.replace('<link rel="stylesheet" href="css/style.css">', `<style>\n${css}\n</style>`);

const block = html.match(/<!-- build:js -->([\s\S]*?)<!-- endbuild -->/)[1];
const sources = [...block.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
const flag = artifact ? 'window.PD = window.PD || {}; window.PD.ARTIFACT_BUILD = true;\n' : '';
const js = sources.map((s) => `/* ${s} */\n` + fs.readFileSync(path.join(root, s), 'utf8')).join('\n');
html = html.replace(/<!-- build:js -->[\s\S]*?<!-- endbuild -->/, `<script>\n${flag}${js.replace(/<\/script/gi, '<\\/script')}\n</script>`);

if (artifact) {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace(/\s*<meta charset[^>]*>/, '')
    .replace(/\s*<meta name="viewport"[^>]*>/, '');
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1];
  html = head.trim() + '\n' + body.trim() + '\n';
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`ok: ${out} (${(html.length / 1024).toFixed(0)} KB, ${sources.length} scripts)`);
