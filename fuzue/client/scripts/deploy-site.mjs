/**
 * Publica o site (pasta dist) na Vercel, no projeto "fuzue".
 *   npm run deploy:site -w @fuzue/client
 * Precisa estar logado no Vercel CLI (npx vercel login) ou ter VERCEL_TOKEN.
 * Copia os arquivos para uma pasta temporária para a CLI não confundir o
 * site com o resto do repositório.
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ids = JSON.parse(readFileSync(new URL('../vercel-project.json', import.meta.url), 'utf8'));
const out = join(tmpdir(), 'fuzue-site');
rmSync(out, { recursive: true, force: true });
cpSync(new URL('../dist', import.meta.url), out, { recursive: true });
cpSync(new URL('../vercel.json', import.meta.url), join(out, 'vercel.json'));
mkdirSync(join(out, '.vercel'), { recursive: true });
writeFileSync(join(out, '.vercel', 'project.json'), JSON.stringify(ids));
const token = process.env.VERCEL_TOKEN ? ` --token ${process.env.VERCEL_TOKEN}` : '';
execSync(`npx --yes vercel@65.2.0 deploy --prod --yes${token}`, { cwd: out, stdio: 'inherit', env: { ...process.env, VERCEL_TELEMETRY_DISABLED: '1' } });
console.log('\nSite publicado: https://fuzue-delta.vercel.app');
