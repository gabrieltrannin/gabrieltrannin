import type { Room } from 'colyseus.js';
import { MSG } from '@fuzue/shared';
import { reconnect, saveToken } from './connection';
import type { NetState } from './types';

type Handler = (msg: unknown) => void;

/**
 * Invólucro da sala: distribui mensagens e mudanças de estado para quem
 * se inscreveu, estima a hora do servidor e reconecta sozinho se a
 * internet piscar (o servidor guarda a vaga por 3 minutos).
 */
export class Net {
  private handlers = new Map<string, Set<Handler>>();
  private stateHandlers = new Set<(s: NetState) => void>();
  private offset = 0;
  private leaving = false;
  private room!: Room;

  /** Chamado quando a conexão cai e não volta, ou quando o jogador sai. */
  onClosed: (reason: string | null) => void = () => {};
  /** Chamado ao começar e ao terminar uma tentativa de reconexão. */
  onReconnecting: (on: boolean) => void = () => {};

  readonly code: string;

  constructor(room: Room) {
    this.code = room.roomId;
    this.attach(room);
  }

  get state(): NetState {
    return this.room.state as unknown as NetState;
  }

  get me(): string {
    return this.room.sessionId;
  }

  private attach(room: Room): void {
    this.room = room;
    saveToken(this.code, room.reconnectionToken);
    room.onStateChange(s => {
      for (const h of this.stateHandlers) h(s as unknown as NetState);
    });
    room.onMessage('*', (type, msg) => {
      const key = String(type);
      if (key === MSG.ping) {
        room.send(MSG.pong, msg);
        const t = (msg as { t?: number })?.t;
        if (typeof t === 'number') {
          const ping = this.state.players.get(this.me)?.ping ?? 0;
          const sample = t + ping / 2 - Date.now();
          this.offset = this.offset === 0 ? sample : this.offset * 0.7 + sample * 0.3;
        }
      }
      const set = this.handlers.get(key);
      if (set) for (const h of set) h(msg);
    });
    room.onLeave(code => {
      if (this.leaving || code === 4000) { this.onClosed(null); return; }
      void this.tryReconnect();
    });
    room.onError((code, message) => console.warn('Erro na sala', code, message));
  }

  private async tryReconnect(): Promise<void> {
    this.onReconnecting(true);
    const token = this.room.reconnectionToken;
    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise(r => setTimeout(r, Math.min(1000 + attempt * 1000, 5000)));
      if (this.leaving) return;
      try {
        const room = await reconnect(token);
        this.attach(room);
        this.onReconnecting(false);
        return;
      } catch { /* tenta de novo */ }
    }
    this.onReconnecting(false);
    this.onClosed('A conexão com a sala caiu e não consegui voltar.');
  }

  /** Hora do servidor (ms), para as contagens regressivas. */
  serverNow(): number {
    return Date.now() + this.offset;
  }

  /** Segundos que faltam até `deadline` (hora do servidor). */
  secondsLeft(deadline: number): number {
    return Math.max(0, (deadline - this.serverNow()) / 1000);
  }

  send(type: string, msg?: unknown): void {
    this.room.send(type, msg);
  }

  on<T = unknown>(type: string, fn: (msg: T) => void): () => void {
    let set = this.handlers.get(type);
    if (!set) { set = new Set(); this.handlers.set(type, set); }
    set.add(fn as Handler);
    return () => set!.delete(fn as Handler);
  }

  onState(fn: (s: NetState) => void): () => void {
    this.stateHandlers.add(fn);
    return () => this.stateHandlers.delete(fn);
  }

  leave(): void {
    this.leaving = true;
    this.room.leave(true).catch(() => this.onClosed(null));
  }
}
