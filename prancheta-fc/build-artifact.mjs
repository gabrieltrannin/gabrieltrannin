// Gera uma versão de arquivo único (CSS e JS embutidos) para publicar como página.
// Uso: node build-artifact.mjs <saida.html>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || join(dir, 'dist', 'prancheta-fc.html');
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const head = html.slice(html.indexOf('<title>'), html.indexOf('</head>'))
  .replace(/<link rel="stylesheet" href="style.css">/, `<style>\n${readFileSync(join(dir, 'style.css'), 'utf8')}\n</style>`);
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => readFileSync(join(dir, m[1]), 'utf8'));
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script src="[^"]+"><\/script>\n?/g, '');
const page = `${head}${body}<script>\ndocument.documentElement.setAttribute('data-visual', 'pixel');\n${scripts.join('\n')}\n</script>\n`;
writeFileSync(out, page);
console.log('ok', out, (page.length / 1024).toFixed(0) + ' KB');
