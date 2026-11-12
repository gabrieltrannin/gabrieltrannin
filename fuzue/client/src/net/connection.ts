import { Client, type Room } from 'colyseus.js';
import { ROOM_NAME, type JoinOptions } from '@fuzue/shared';

/**
 * Endereço do servidor de jogo.
 * - Em produção: defina VITE_SERVER_URL (ex.: wss://fuzue-server.onrender.com).
 * - Em desenvolvimento: usa o mesmo host da página na porta 2567, então
 *   funciona também pelo celular na mesma rede Wi-Fi (http://192.168.x.x:5173).
 */
export function serverUrl(): string {
  const fromEnv = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (fromEnv) return fromEnv;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.hostname}:2567`;
}

let client: Client | null = null;
function getClient(): Client {
  if (!client) client = new Client(serverUrl());
  return client;
}

export function createRoom(options: JoinOptions): Promise<Room> {
  return getClient().create(ROOM_NAME, options);
}

export function joinRoom(code: string, options: JoinOptions): Promise<Room> {
  return getClient().joinById(code, options);
}

/** Traduz erros do matchmaking para uma frase que o jogador entende. */
export function friendlyError(err: unknown, code?: string): string {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  if (/not found/i.test(msg)) return `Não achei a sala ${code ?? ''}. Confira o código ou peça um link novo.`.replace('  ', ' ');
  if (/locked|full|maxClients/i.test(msg)) return 'Essa sala já está cheia (4 jogadores).';
  if (/ECONNREFUSED|Failed to fetch|NetworkError|offline|connect/i.test(msg)) {
    return 'Não consegui falar com o servidor do jogo. Ele está rodando?';
  }
  return `Algo deu errado: ${msg || 'erro desconhecido'}.`;
}
