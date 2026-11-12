import { Room, ServerError, type Client } from '@colyseus/core';
import {
  BOT_NAMES, CHARACTERS, CROWN_SPOTS, EMOTES, MAX_PLAYERS, MINIGAMES, MINIGAME_IDS, MSG, PROTOCOL_VERSION,
  QUICK_CHAT, ROUND_OPTIONS, START_COINS, START_TILE, TICK_RATE,
  pick, sanitizeName, shuffle,
  type BonusMsg, type ChatMsg, type InputMsg, type JoinOptions, type MinigameId, type Phase, type SettingsMsg,
} from '@fuzue/shared';
import { BoardController } from '../board/BoardController.js';
import { createMinigame, type Minigame } from '../minigames/index.js';
import { releaseCode, reserveCode } from './roomCodes.js';
import { GameState, PlayerState } from './schema.js';

/** Acelera todas as esperas (para testes automáticos): GAME_SPEED=6 */
export const GAME_SPEED = Math.max(0.1, Number(process.env.GAME_SPEED ?? 1));
/** Força a sequência de minijogos (testes): MINIGAME_ORDER=hexa,corrida */
const FORCED_MINIGAMES = (process.env.MINIGAME_ORDER ?? '').split(',').filter(id => (MINIGAME_IDS as string[]).includes(id)) as MinigameId[];
/** Quanto tempo um jogador que caiu tem para voltar (s). */
const RECONNECT_SECONDS = 180;

/** Erro usado para encerrar a partida quando a sala fecha. */
export class Cancelled extends Error {}

/** Números que viram os prêmios surpresa do final. */
export interface Stats { mgCoins: number; steps: number; itemsUsed: number; unlucky: number }

interface Pending {
  pid: string;
  accept: (raw: unknown) => unknown;
  bot: () => unknown;
  resolve: (v: unknown) => void;
}

export class GameRoom extends Room<GameState> {
  maxClients = MAX_PLAYERS;

  readonly stats = new Map<string, Stats>();
  private board!: BoardController;
  private game: Minigame | null = null;
  private lastMinigame: MinigameId | '' = '';
  private minigameCount = 0;
  private pending = new Map<string, Pending>();
  private sleepers = new Set<(e: Error) => void>();
  private lastChat = new Map<string, number>();
  private disposed = false;
  private running = false;

  /* =============== ciclo de vida =============== */

  onCreate(): void {
    this.roomId = reserveCode();
    this.setState(new GameState());
    this.state.code = this.roomId;
    this.board = new BoardController(this);

    this.onMessage(MSG.ready, (c, m: { ready?: boolean }) => this.lobbyOnly(c, p => { p.ready = m?.ready === true; }));
    this.onMessage(MSG.character, (c, m: { character?: number }) => this.lobbyOnly(c, p => {
      const ch = Math.floor(Number(m?.character));
      if (ch >= 0 && ch < CHARACTERS.length) p.character = ch;
    }));
    this.onMessage(MSG.settings, (c, m: SettingsMsg) => this.onSettings(c, m));
    this.onMessage(MSG.start, c => this.onStart(c));
    this.onMessage(MSG.chat, (c, m: ChatMsg) => this.onChat(c, m));
    this.onMessage(MSG.again, c => this.onAgain(c));
    this.onMessage(MSG.pong, (c, m: { t?: number }) => {
      const p = this.state.players.get(c.sessionId);
      if (p && typeof m?.t === 'number') p.ping = Math.max(0, Math.min(9999, Date.now() - m.t));
    });
    // decisões do tabuleiro: quem decide é o BoardController / fase de ordem
    this.onMessage(MSG.orderRoll, c => this.answer(c.sessionId, 'orderRoll', true));
    this.onMessage(MSG.roll, c => this.answer(c.sessionId, 'roll', { type: 'roll' }));
    this.onMessage(MSG.useItem, (c, m: { index?: number }) => this.answer(c.sessionId, 'roll', { type: 'item', index: m?.index }));
    this.onMessage(MSG.choose, (c, m: { tile?: number }) => this.answer(c.sessionId, 'choose', m?.tile));
    this.onMessage(MSG.shop, (c, m: { item?: string | null }) => this.answer(c.sessionId, 'shop', { item: m?.item ?? null }));
    // minijogos
    this.onMessage(MSG.input, (c, m: InputMsg) => this.game?.receiveInput(c.sessionId, m));
    this.onMessage(MSG.mgReady, c => {
      const mp = this.state.mg.players.get(c.sessionId);
      if (mp && this.state.mg.step === 'intro') mp.ready = true;
    });

    this.setPatchRate(1000 / TICK_RATE);
    this.setSimulationInterval(dt => this.tick(Math.min(dt, 100) / 1000), 1000 / TICK_RATE);
    this.clock.setInterval(() => this.broadcast(MSG.ping, { t: Date.now() }), 2000);
    console.log(`[${this.roomId}] sala criada`);
  }

  onAuth(_client: Client, options: Partial<JoinOptions>): boolean {
    if (options?.protocol !== PROTOCOL_VERSION) throw new ServerError(4010, 'versao-antiga');
    if (this.state.phase !== 'lobby') throw new ServerError(4011, 'partida-em-andamento');
    if (this.humans().length >= MAX_PLAYERS) throw new ServerError(4012, 'sala-cheia');
    return true;
  }

  onJoin(client: Client, options: Partial<JoinOptions> = {}): void {
    const p = new PlayerState();
    p.id = client.sessionId;
    p.name = sanitizeName(options.name);
    const ch = Math.floor(Number(options.character));
    p.character = ch >= 0 && ch < CHARACTERS.length ? ch : 0;
    p.seat = this.freeSeat();
    this.state.players.set(p.id, p);
    this.stats.set(p.id, newStats());
    if (!this.state.hostId) this.state.hostId = p.id;
    console.log(`[${this.roomId}] ${p.name} entrou (${this.humans().length} humanos)`);
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    const id = client.sessionId;
    const p = this.state.players.get(id);
    if (!p) return;

    if (this.state.phase === 'lobby') {
      this.state.players.delete(id);
      this.stats.delete(id);
      this.fixHost();
      console.log(`[${this.roomId}] ${p.name} saiu do lobby`);
      return;
    }

    // No meio da partida um bot assume na hora.
    p.away = true;
    this.fixHost();
    this.botTakeover(id);
    if (consented) {
      p.bot = true;
      console.log(`[${this.roomId}] ${p.name} saiu; um bot assumiu`);
      return;
    }
    console.log(`[${this.roomId}] ${p.name} caiu; esperando voltar`);
    try {
      await this.allowReconnection(client, RECONNECT_SECONDS);
      p.away = false;
      if (!this.state.hostId) this.state.hostId = id;
      console.log(`[${this.roomId}] ${p.name} voltou`);
    } catch {
      p.bot = true;
      console.log(`[${this.roomId}] ${p.name} não voltou; o bot fica`);
    }
  }

  onDispose(): void {
    this.disposed = true;
    for (const reject of this.sleepers) reject(new Cancelled('sala fechada'));
    this.sleepers.clear();
    releaseCode(this.roomId);
    console.log(`[${this.roomId}] sala fechada`);
  }

  private tick(dt: number): void {
    if (this.state.phase === 'minigame' && this.game) {
      this.game.tick(dt, this.state.mg.step === 'play');
    }
  }

  /* =============== utilidades =============== */

  /** Espera `ms` (dividido pela velocidade de teste). Cancela se a sala fechar. */
  sleep(ms: number): Promise<void> {
    if (this.disposed) return Promise.reject(new Cancelled());
    return new Promise((resolve, reject) => {
      this.sleepers.add(reject);
      this.clock.setTimeout(() => { this.sleepers.delete(reject); resolve(); }, ms / GAME_SPEED);
    });
  }

  /** Espera até `cond()` ficar verdadeira ou o tempo acabar. */
  async waitUntil(cond: () => boolean, maxMs: number): Promise<void> {
    const end = Date.now() + maxMs / GAME_SPEED;
    while (!cond() && Date.now() < end) await this.sleep(100 * GAME_SPEED);
  }

  /** Hora do servidor daqui a `ms` (para as contagens regressivas na tela). */
  deadlineIn(ms: number): number {
    return Date.now() + ms / GAME_SPEED;
  }

  /** Jogador controlado pelo computador agora (bot ou humano ausente). */
  isBot(id: string): boolean {
    const p = this.state.players.get(id);
    return !p || p.bot || p.away;
  }

  get botLevel(): number {
    return this.state.botLevel;
  }

  player(id: string): PlayerState {
    const p = this.state.players.get(id);
    if (!p) throw new Error(`jogador ${id} não existe`);
    return p;
  }

  participants(): PlayerState[] {
    return [...this.state.players.values()].sort((a, b) => a.seat - b.seat);
  }

  private humans(): PlayerState[] {
    return [...this.state.players.values()].filter(p => !p.bot);
  }

  private freeSeat(): number {
    const used = new Set([...this.state.players.values()].map(p => p.seat));
    let s = 0;
    while (used.has(s)) s++;
    return s;
  }

  /** O anfitrião precisa ser um humano conectado. */
  private fixHost(): void {
    const host = this.state.players.get(this.state.hostId);
    if (host && !host.bot && !host.away) return;
    const next = this.participants().find(p => !p.bot && !p.away);
    this.state.hostId = next?.id ?? '';
  }

  note(text: string, tone: 'good' | 'bad' | 'info' = 'info', pid?: string): void {
    this.broadcast(MSG.boardNote, { text, tone, pid });
  }

  /* =============== decisões (com tempo limite e bot) =============== */

  /**
   * Pede uma decisão a um jogador. Bots (e ausentes) decidem sozinhos
   * depois de uma pausa curta; humanos têm `timeoutMs`, e se o tempo acabar
   * vale `fallback`. `accept` valida o que chegou (undefined = ignorar).
   */
  ask<T>(pid: string, kind: string, timeoutMs: number, opts: { accept: (raw: unknown) => T | undefined; bot: () => T; fallback: () => T }): Promise<T> {
    const key = `${pid}:${kind}`;
    return new Promise<T>((resolve, reject) => {
      let done = false;
      const finish = (v: unknown) => {
        if (done) return;
        done = true;
        this.pending.delete(key);
        this.sleepers.delete(reject);
        resolve(v as T);
      };
      this.sleepers.add(reject);
      this.pending.set(key, { pid, accept: opts.accept, bot: opts.bot, resolve: finish });
      if (this.isBot(pid)) {
        const delay = 700 + Math.random() * 700;
        this.clock.setTimeout(() => finish(opts.bot()), delay / GAME_SPEED);
      } else {
        this.clock.setTimeout(() => finish(opts.fallback()), timeoutMs / GAME_SPEED);
      }
    });
  }

  private answer(pid: string, kind: string, raw: unknown): void {
    const p = this.pending.get(`${pid}:${kind}`);
    if (!p || this.isBot(pid)) return;
    const v = p.accept(raw);
    if (v !== undefined) p.resolve(v);
  }

  /** Quando alguém cai no meio de uma decisão, o bot decide por ele. */
  private botTakeover(pid: string): void {
    for (const p of [...this.pending.values()]) {
      if (p.pid === pid) this.clock.setTimeout(() => p.resolve(p.bot()), 600 / GAME_SPEED);
    }
  }

  /* =============== lobby =============== */

  private lobbyOnly(c: Client, fn: (p: PlayerState) => void): void {
    const p = this.state.players.get(c.sessionId);
    if (p && this.state.phase === 'lobby') fn(p);
  }

  private onSettings(c: Client, m: SettingsMsg): void {
    if (c.sessionId !== this.state.hostId || this.state.phase !== 'lobby' || !m) return;
    if (typeof m.rounds === 'number' && (ROUND_OPTIONS as readonly number[]).includes(m.rounds)) this.state.rounds = m.rounds;
    if (typeof m.fillBots === 'boolean') this.state.fillBots = m.fillBots;
    if (typeof m.botLevel === 'number' && m.botLevel >= 0 && m.botLevel <= 2) this.state.botLevel = Math.floor(m.botLevel);
  }

  private onStart(c: Client): void {
    if (c.sessionId !== this.state.hostId || this.state.phase !== 'lobby' || this.running) return;
    const humans = this.humans();
    const notReady = humans.filter(p => !p.ready && p.id !== this.state.hostId);
    if (notReady.length) {
      this.note(`Falta ${notReady.map(p => p.name).join(' e ')} apertar Pronto.`, 'info');
      return;
    }
    const total = this.state.fillBots ? MAX_PLAYERS : humans.length;
    if (total < 2) {
      this.note('Precisa de pelo menos 2 jogadores. Chame alguém ou ligue os bots.', 'info');
      return;
    }
    this.startGame();
  }

  private onChat(c: Client, m: ChatMsg): void {
    const p = this.state.players.get(c.sessionId);
    if (!p || !m) return;
    const now = Date.now();
    if (now - (this.lastChat.get(p.id) ?? 0) < 900) return;
    const list = m.kind === 'emote' ? EMOTES : QUICK_CHAT;
    const text = list[Math.floor(Number(m.index))];
    if (!text) return;
    this.lastChat.set(p.id, now);
    this.broadcast(MSG.said, { from: p.id, text, emote: m.kind === 'emote' });
  }

  private onAgain(c: Client): void {
    if (c.sessionId !== this.state.hostId || this.state.phase !== 'podium') return;
    this.backToLobby();
  }

  /* =============== partida =============== */

  private startGame(): void {
    // bots completam a mesa
    if (this.state.fillBots) {
      const usedNames = new Set([...this.state.players.values()].map(p => p.name));
      const usedChars = new Set([...this.state.players.values()].map(p => p.character));
      let n = 1;
      while (this.state.players.size < MAX_PLAYERS) {
        const bot = new PlayerState();
        bot.id = `bot-${n++}`;
        bot.name = pick(BOT_NAMES.filter(b => !usedNames.has(b))) ?? 'Bot';
        usedNames.add(bot.name);
        const free = CHARACTERS.map((_, i) => i).filter(i => !usedChars.has(i));
        bot.character = free.length ? pick(free) : Math.floor(Math.random() * CHARACTERS.length);
        usedChars.add(bot.character);
        bot.bot = true;
        bot.ready = true;
        bot.seat = this.freeSeat();
        this.state.players.set(bot.id, bot);
      }
    }
    for (const p of this.state.players.values()) {
      p.tile = START_TILE;
      p.coins = START_COINS;
      p.crowns = 0;
      p.items.clear();
      p.shield = false;
      p.place = 0;
      this.stats.set(p.id, newStats());
    }
    const b = this.state.board;
    b.round = 1;
    b.turn = 0;
    b.order.clear();
    b.bombs.clear();
    b.orderRolls.clear();
    b.crownTile = pick(CROWN_SPOTS.filter(t => t > 6 && t < 20));
    this.lastMinigame = '';
    this.minigameCount = 0;
    void this.lock();
    void this.runGame();
  }

  private async runGame(): Promise<void> {
    this.running = true;
    try {
      await this.orderPhase();
      const total = this.state.rounds;
      for (let round = 1; round <= total; round++) {
        this.state.board.round = round;
        this.setPhase('board');
        if (round === total) this.note('Última rodada! Tudo pode mudar agora.', 'info');
        await this.sleep(1200);
        for (let i = 0; i < this.state.board.order.length; i++) {
          this.state.board.turn = i;
          await this.board.playTurn(this.state.board.order[i]);
        }
        await this.minigamePhase();
      }
      await this.finalPhase();
    } catch (e) {
      if (!(e instanceof Cancelled)) console.error(`[${this.roomId}] erro na partida`, e);
    } finally {
      this.running = false;
    }
  }

  setPhase(phase: Phase): void {
    this.state.phase = phase;
  }

  /** Cada um "rola" para sortear quem começa. */
  private async orderPhase(): Promise<void> {
    this.setPhase('order');
    const b = this.state.board;
    const ids = this.participants().map(p => p.id);
    const pool = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    b.deadline = this.deadlineIn(12000);
    await Promise.all(ids.map(pid => this.ask(pid, 'orderRoll', 12000, { accept: () => true, bot: () => true, fallback: () => true })
      .then(() => {
        const value = pool.pop()!;
        b.orderRolls.set(pid, value);
        this.broadcast(MSG.orderResult, { pid, value });
      })));
    await this.sleep(2200);
    const order = [...ids].sort((a, c) => (b.orderRolls.get(c) ?? 0) - (b.orderRolls.get(a) ?? 0));
    order.forEach(id => b.order.push(id));
    this.note(`${this.player(order[0]).name} começa!`, 'good', order[0]);
    await this.sleep(1600);
  }

  private async minigamePhase(): Promise<void> {
    const players = this.participants();
    let options = MINIGAME_IDS.filter(id => id !== this.lastMinigame);
    if (players.length !== 4) options = options.filter(id => MINIGAMES[id].mode !== 'team');
    const id = FORCED_MINIGAMES.length ? FORCED_MINIGAMES[this.minigameCount % FORCED_MINIGAMES.length] : pick(options);
    this.minigameCount++;
    this.lastMinigame = id;

    const mg = this.state.mg;
    mg.step = 'intro';
    this.game = createMinigame(id, this, players.map(p => p.id));
    this.setPhase('minigame');

    // instruções: segue quando todos os humanos apertarem Pronto (ou 15 s)
    mg.stepEnds = this.deadlineIn(15000);
    await this.waitUntil(() => [...mg.players.entries()].every(([pid, mp]) => mp.ready || this.isBot(pid)), 15000);
    mg.step = 'countdown';
    mg.stepEnds = this.deadlineIn(3000);
    await this.sleep(3000);

    mg.step = 'play';
    const game = this.game;
    game.duration = MINIGAMES[id].duration / GAME_SPEED;
    mg.stepEnds = Date.now() + game.duration * 1000;
    await this.waitUntil(() => game.over, MINIGAMES[id].duration * 1000 + 2000);

    const result = game.result();
    for (const [pid, coins] of Object.entries(result.rewards)) {
      const p = this.state.players.get(pid);
      if (!p) continue;
      p.coins += coins;
      const st = this.stats.get(pid);
      if (st) st.mgCoins += coins;
    }
    mg.step = 'result';
    mg.stepEnds = this.deadlineIn(6000);
    this.broadcast(MSG.mgResult, result);
    await this.sleep(6000);
    this.game = null;
    mg.players.clear();
    mg.entities.clear();
    mg.tiles.clear();
    this.setPhase('board');
  }

  private async finalPhase(): Promise<void> {
    this.setPhase('final');
    this.state.board.step = 'idle';
    await this.sleep(1500);
    const ids = this.participants().map(p => p.id);
    const categories = [
      { title: 'Rei dos minijogos', desc: 'ganhou mais moedas nos minijogos', key: 'mgCoins' as const },
      { title: 'Maratonista', desc: 'andou mais casas no tabuleiro', key: 'steps' as const },
      { title: 'Colecionador', desc: 'usou mais itens', key: 'itemsUsed' as const },
      { title: 'Azarado do dia', desc: 'mais perdeu moedas em casas ruins', key: 'unlucky' as const },
    ];
    const chosen = shuffle(categories).slice(0, 2);
    const bonuses: BonusMsg['bonuses'] = [];
    for (const c of chosen) {
      const best = Math.max(...ids.map(id => this.stats.get(id)?.[c.key] ?? 0));
      if (best <= 0) continue;
      const winners = ids.filter(id => (this.stats.get(id)?.[c.key] ?? 0) === best);
      winners.forEach(id => { this.player(id).crowns += 1; });
      bonuses.push({ title: c.title, desc: c.desc, pids: winners });
    }
    this.broadcast(MSG.bonus, { bonuses });
    await this.sleep(2500 + bonuses.length * 3200);

    const ranked = [...this.participants()].sort((a, b) => b.crowns - a.crowns || b.coins - a.coins);
    let place = 0;
    ranked.forEach((p, i) => {
      const prev = ranked[i - 1];
      if (!prev || prev.crowns !== p.crowns || prev.coins !== p.coins) place = i + 1;
      p.place = place;
    });
    this.setPhase('podium');
  }

  private backToLobby(): void {
    for (const p of [...this.state.players.values()]) {
      if (p.bot) {
        this.state.players.delete(p.id);
        this.stats.delete(p.id);
      } else {
        p.ready = false;
        p.place = 0;
      }
    }
    this.state.board.order.clear();
    this.state.board.bombs.clear();
    this.state.board.orderRolls.clear();
    this.state.board.step = 'idle';
    this.fixHost();
    this.setPhase('lobby');
    void this.unlock();
  }
}

function newStats(): Stats {
  return { mgCoins: 0, steps: 0, itemsUsed: 0, unlucky: 0 };
}
