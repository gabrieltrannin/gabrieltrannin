import { Client, type Room } from 'colyseus.js';
import { PROTOCOL_VERSION, ROOM_NAME, type JoinOptions } from '@fuzue/shared';

/**
 * Endereço do servidor de jogo.
 * - Em produção: VITE_SERVER_URL (ex.: wss://fuzue-server.onrender.com).
 * - Em desenvolvimento: o mesmo host da página na porta 2567, então funciona
 *   também pelo celular na mesma rede Wi-Fi.
 */
export function serverUrl(): string {
  const fromEnv = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.hostname}:2567`;
}

function httpUrl(): string {
  return serverUrl().replace(/^ws/, 'http');
}

let client: Client | null = null;
function getClient(): Client {
  if (!client) client = new Client(serverUrl());
  return client;
}

/**
 * O servidor gratuito "dorme" quando ninguém joga. Antes de entrar, batemos
 * na porta dele até responder (pode levar até ~1 minuto).
 */
export async function wakeServer(onSlow: (seconds: number) => void, maxSeconds = 100): Promise<boolean> {
  const started = Date.now();
  let warned = false;
  while ((Date.now() - started) / 1000 < maxSeconds) {
    try {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${httpUrl()}/health`, { signal: ctrl.signal, cache: 'no-store' });
      window.clearTimeout(timer);
      if (res.ok) return true;
    } catch { /* ainda acordando */ }
    const elapsed = Math.round((Date.now() - started) / 1000);
    if (elapsed >= 2 || warned) { warned = true; onSlow(elapsed); }
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

function options(name: string, character: number): JoinOptions {
  return { name, character, protocol: PROTOCOL_VERSION };
}

export function createRoom(name: string, character: number): Promise<Room> {
  return getClient().create(ROOM_NAME, options(name, character));
}

export function joinRoom(code: string, name: string, character: number): Promise<Room> {
  return getClient().joinById(code, options(name, character));
}

export function reconnect(token: string): Promise<Room> {
  return getClient().reconnect(token);
}

/* ---------- token de reconexão (por sala) ---------- */

const TOKEN_KEY = 'fuzue:volta';

export function saveToken(code: string, token: string): void {
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify({ code, token, at: Date.now() })); } catch { /* ignora */ }
}

export function loadToken(code: string): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as { code: string; token: string; at: number };
    if (t.code !== code || Date.now() - t.at > 3 * 60 * 60 * 1000) return null;
    return t.token;
  } catch {
    return null;
  }
}

export function clearToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignora */ }
}

/** Traduz erros do servidor para uma frase que o jogador entende. */
export function friendlyError(err: unknown, code?: string): string {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  if (/versao-antiga/.test(msg)) return 'Saiu uma versão nova do jogo. Recarregue a página (se continuar, espere um minuto: ela ainda está sendo publicada).';
  if (/partida-em-andamento/.test(msg)) return 'Essa partida já começou. Espere ela acabar ou peça para alguém criar outra sala.';
  if (/sala-cheia|locked|full/i.test(msg)) return 'Essa sala já está cheia (4 jogadores).';
  if (/not found/i.test(msg)) return `Não achei a sala ${code ?? ''}. Confira o código ou peça um link novo.`.replace('  ', ' ');
  if (/ECONNREFUSED|Failed to fetch|NetworkError|offline|connect|timeout|abort/i.test(msg)) {
    return 'Não consegui falar com o servidor do jogo. Confira sua internet e tente de novo.';
  }
  return `Algo deu errado: ${msg || 'erro desconhecido'}.`;
}

export function isVersionError(err: unknown): boolean {
  return /versao-antiga/.test(String((err as { message?: string })?.message ?? err ?? ''));
}
