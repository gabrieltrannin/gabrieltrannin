import {
  BOARD, CROWN_PRICE, CROWN_SPOTS, HOP_MS, ITEMS, ITEM_IDS, MAX_ITEMS, MSG,
  pick, shuffle, stepsBetween,
  type ItemId, type TileType,
} from '@fuzue/shared';
import type { GameRoom } from '../rooms/GameRoom.js';
import type { PlayerState } from '../rooms/schema.js';

type RollAction = { type: 'roll' } | { type: 'item'; index: number };

interface TurnFlags { doubleDice: boolean; magnet: boolean; used: Set<string> }

const d6 = () => 1 + Math.floor(Math.random() * 6);

/** Regras do tabuleiro: um turno de cada vez. */
export class BoardController {
  constructor(private room: GameRoom) {}

  private get b() { return this.room.state.board; }

  private others(p: PlayerState): PlayerState[] {
    return this.room.participants().filter(o => o.id !== p.id);
  }

  /* ---------------- turno ---------------- */

  async playTurn(pid: string): Promise<void> {
    const p = this.room.state.players.get(pid);
    if (!p) return;
    const flags: TurnFlags = { doubleDice: false, magnet: false, used: new Set() };

    // 1) usar itens (quantos quiser) e rolar
    for (;;) {
      this.b.step = 'roll';
      this.b.deadline = this.room.deadlineIn(25000);
      const action = await this.room.ask<RollAction>(pid, 'roll', 25000, {
        accept: raw => this.acceptRollAction(p, raw),
        bot: () => this.botRollAction(p, flags),
        fallback: () => ({ type: 'roll' }),
      });
      if (action.type === 'roll') break;
      this.b.step = 'busy';
      await this.useItem(p, action.index, flags);
    }

    // 2) dado
    this.b.step = 'busy';
    const dice = flags.doubleDice ? [d6(), d6()] : [d6()];
    this.room.broadcast(MSG.boardRoll, { pid, dice });
    await this.room.sleep(1500);

    // 3) andar
    this.b.step = 'moving';
    const steps = dice.reduce((a, v) => a + v, 0);
    const st = this.room.stats.get(pid);
    if (st) st.steps += steps;
    await this.walk(p, steps, flags.magnet);

    // 4) efeito da casa
    this.b.step = 'busy';
    await this.land(p);
    this.b.step = 'idle';
    await this.room.sleep(700);
  }

  private acceptRollAction(p: PlayerState, raw: unknown): RollAction | undefined {
    const r = raw as { type?: string; index?: number } | null;
    if (r?.type === 'roll') return { type: 'roll' };
    if (r?.type === 'item' && Number.isInteger(r.index)) {
      const id = p.items[r.index!] as ItemId | undefined;
      if (id && ITEMS[id] && !ITEMS[id].passive) return { type: 'item', index: r.index! };
    }
    return undefined;
  }

  private async walk(p: PlayerState, steps: number, magnet: boolean): Promise<void> {
    let path: number[] = [];
    let magnetGain = 0;
    const flush = async () => {
      if (!path.length) return;
      this.room.broadcast(MSG.boardMove, { pid: p.id, path });
      await this.room.sleep(path.length * HOP_MS + 150);
      path = [];
      if (magnetGain) {
        this.gain(p, magnetGain);
        magnetGain = 0;
      }
    };

    while (steps > 0) {
      const nexts = BOARD[p.tile].next;
      let next = nexts[0];
      if (nexts.length > 1) {
        await flush();
        this.b.step = 'choose';
        this.b.choices.clear();
        nexts.forEach(n => this.b.choices.push(n));
        this.b.deadline = this.room.deadlineIn(12000);
        next = await this.room.ask<number>(p.id, 'choose', 12000, {
          accept: raw => (typeof raw === 'number' && nexts.includes(raw) ? raw : undefined),
          bot: () => this.botChoosePath(nexts),
          fallback: () => this.towardCrown(nexts),
        });
        this.b.choices.clear();
        this.b.step = 'moving';
      }
      p.tile = next;
      path.push(next);
      steps--;
      if (magnet) magnetGain++;
      if (next === this.b.crownTile) {
        await flush();
        await this.offerCrown(p);
      }
    }
    await flush();
  }

  /* ---------------- moedas ---------------- */

  gain(p: PlayerState, n: number): void {
    if (n <= 0) return;
    p.coins += n;
    this.room.broadcast(MSG.boardCoins, { pid: p.id, delta: n });
  }

  /** Perde moedas (o escudo bloqueia). Retorna quanto perdeu de fato. */
  lose(p: PlayerState, n: number, unlucky = false): number {
    if (n <= 0) return 0;
    if (p.shield) {
      p.shield = false;
      this.room.note(`O escudo de ${p.name} bloqueou a perda!`, 'good', p.id);
      return 0;
    }
    const d = Math.min(n, p.coins);
    p.coins -= d;
    if (d > 0) this.room.broadcast(MSG.boardCoins, { pid: p.id, delta: -d });
    if (unlucky) {
      const st = this.room.stats.get(p.id);
      if (st) st.unlucky += d;
    }
    return d;
  }

  /* ---------------- coroa ---------------- */

  private async offerCrown(p: PlayerState): Promise<void> {
    if (p.coins < CROWN_PRICE) {
      this.room.note(`${p.name} passou pela coroa, mas faltam ${CROWN_PRICE - p.coins} moedas.`, 'info', p.id);
      await this.room.sleep(900);
      return;
    }
    p.coins -= CROWN_PRICE;
    p.crowns += 1;
    this.room.broadcast(MSG.boardCoins, { pid: p.id, delta: -CROWN_PRICE });
    this.room.broadcast(MSG.boardCrown, { pid: p.id });
    this.room.note(`${p.name} comprou uma coroa!`, 'good', p.id);
    await this.room.sleep(2200);
    await this.moveCrown();
  }

  async moveCrown(): Promise<void> {
    const occupied = this.room.participants().map(o => o.tile);
    const far = CROWN_SPOTS.filter(t => t !== this.b.crownTile && occupied.every(o => stepsBetween(o, t) >= 5 && o !== t));
    const options = far.length ? far : CROWN_SPOTS.filter(t => t !== this.b.crownTile);
    this.b.crownTile = pick(options);
    await this.room.sleep(1200);
  }

  /* ---------------- efeito da casa ---------------- */

  private async land(p: PlayerState): Promise<void> {
    const tileKey = String(p.tile);
    const bombOwner = this.b.bombs.get(tileKey);
    if (bombOwner && bombOwner !== p.id) {
      this.b.bombs.delete(tileKey);
      const owner = this.room.state.players.get(bombOwner);
      this.room.note(`BUM! ${p.name} pisou na pólvora${owner ? ` de ${owner.name}` : ''}!`, 'bad', p.id);
      this.lose(p, 8, true);
      await this.room.sleep(1600);
    }

    const type: TileType = BOARD[p.tile].type;
    switch (type) {
      case 'azul':
        this.gain(p, 3);
        await this.room.sleep(700);
        break;
      case 'vermelha':
        this.lose(p, 3, true);
        await this.room.sleep(700);
        break;
      case 'armadilha':
        this.room.note(`${p.name} caiu numa armadilha de caçador e perdeu moedas!`, 'bad', p.id);
        this.lose(p, 5, true);
        await this.room.sleep(1200);
        break;
      case 'evento':
        await this.event(p);
        break;
      case 'loja':
        await this.shop(p);
        break;
      case 'duelo':
        await this.duel(p);
        break;
    }
  }

  private async event(p: PlayerState): Promise<void> {
    const roll = Math.random();
    if (roll < 0.25) {
      this.room.note(`Os aldeões pagaram tributo! ${p.name} ganhou 6 moedas.`, 'good', p.id);
      this.gain(p, 6);
    } else if (roll < 0.43) {
      this.room.note(`Ladrões da floresta levaram moedas de ${p.name}!`, 'bad', p.id);
      this.lose(p, 5, true);
    } else if (roll < 0.6) {
      const free = ITEM_IDS.filter(i => !ITEMS[i].passive);
      if (p.items.length < MAX_ITEMS) {
        const item = pick(free);
        p.items.push(item);
        this.room.note(`Presente do rei: ${p.name} ganhou ${ITEMS[item].icon} ${ITEMS[item].name}!`, 'good', p.id);
      } else {
        this.room.note(`Presente do rei: ${p.name} ganhou 4 moedas!`, 'good', p.id);
        this.gain(p, 4);
      }
    } else if (roll < 0.72) {
      this.room.note('A coroa foi levada para outro canto do reino!', 'info', p.id);
      await this.room.sleep(800);
      await this.moveCrown();
    } else if (roll < 0.86) {
      const dest = pick(BOARD.filter(t => t.id !== p.tile).map(t => t.id));
      p.tile = dest;
      this.room.note(`Um feitiço mandou ${p.name} para outra casa!`, 'info', p.id);
      this.room.broadcast(MSG.boardTeleport, { pid: p.id, tile: dest });
    } else {
      this.room.note('Banquete no castelo: todo mundo ganha 3 moedas!', 'good');
      for (const o of this.room.participants()) this.gain(o, 3);
    }
    await this.room.sleep(1800);
  }

  private async shop(p: PlayerState): Promise<void> {
    const sellable = ITEM_IDS.filter(i => !(i === 'escudo' && p.shield));
    const offer = shuffle([...sellable]).slice(0, 3);
    const cheapest = Math.min(...offer.map(i => ITEMS[i].price));
    const full = p.items.length >= MAX_ITEMS;
    if (p.coins < cheapest) {
      this.room.note(`${p.name} visitou o mercador, mas está sem moedas.`, 'info', p.id);
      await this.room.sleep(1200);
      return;
    }
    if (full && !offer.includes('escudo')) {
      this.room.note(`${p.name} visitou o mercador, mas a bolsa está cheia.`, 'info', p.id);
      await this.room.sleep(1200);
      return;
    }
    this.b.shopOffer.clear();
    offer.forEach(i => this.b.shopOffer.push(i));
    this.b.step = 'shop';
    this.b.deadline = this.room.deadlineIn(15000);
    const choice = await this.room.ask<{ item: ItemId | null }>(p.id, 'shop', 15000, {
      accept: raw => {
        const item = (raw as { item?: string | null })?.item ?? null;
        if (item === null) return { item: null };
        if (!offer.includes(item as ItemId)) return undefined;
        const def = ITEMS[item as ItemId];
        if (p.coins < def.price) return undefined;
        if (!def.passive && p.items.length >= MAX_ITEMS) return undefined;
        return { item: item as ItemId };
      },
      bot: () => ({ item: this.botShop(p, offer) }),
      fallback: () => ({ item: null }),
    });
    this.b.shopOffer.clear();
    this.b.step = 'busy';
    if (!choice.item) {
      this.room.note(`${p.name} saiu do mercador sem comprar.`, 'info', p.id);
      await this.room.sleep(700);
      return;
    }
    const def = ITEMS[choice.item];
    p.coins -= def.price;
    this.room.broadcast(MSG.boardCoins, { pid: p.id, delta: -def.price });
    if (choice.item === 'escudo') p.shield = true;
    else p.items.push(choice.item);
    this.room.note(`${p.name} comprou ${def.icon} ${def.name}.`, 'info', p.id);
    await this.room.sleep(1200);
  }

  private async duel(p: PlayerState): Promise<void> {
    const rivals = this.others(p);
    if (!rivals.length) return;
    const rival = rivals.slice().sort((a, c) => c.coins - a.coins)[Math.random() < 0.5 ? 0 : Math.floor(Math.random() * rivals.length)];
    const ra = d6();
    const rb = d6();
    const winner = ra === rb ? null : ra > rb ? p : rival;
    const loser = winner === p ? rival : winner ? p : null;
    const amount = loser ? Math.min(5, loser.coins) : 0;
    this.room.broadcast(MSG.boardDuel, { a: p.id, b: rival.id, ra, rb, winner: winner?.id ?? null, amount });
    await this.room.sleep(3000);
    if (winner && loser) {
      const lost = this.lose(loser, amount);
      this.gain(winner, lost);
    } else {
      this.room.note('Empate no duelo! Ninguém perde nada.', 'info');
    }
    await this.room.sleep(1000);
  }

  /* ---------------- itens ---------------- */

  private async useItem(p: PlayerState, index: number, flags: TurnFlags): Promise<void> {
    const id = p.items[index] as ItemId | undefined;
    if (!id) return;
    p.items.splice(index, 1);
    flags.used.add(id);
    const st = this.room.stats.get(p.id);
    if (st) st.itemsUsed++;
    const def = ITEMS[id];
    switch (id) {
      case 'dado2':
        flags.doubleDice = true;
        this.room.note(`${p.name} usou ${def.icon} ${def.name}: dois dados neste turno!`, 'info', p.id);
        break;
      case 'ima':
        flags.magnet = true;
        this.room.note(`${p.name} abriu a ${def.icon} ${def.name}: cada casa andada vale 1 moeda!`, 'info', p.id);
        break;
      case 'luva': {
        const victim = this.others(p).filter(o => o.coins > 0).sort((a, c) => c.coins - a.coins)[0];
        if (!victim) {
          this.room.note(`${p.name} golpeou o ar: ninguém tinha moedas.`, 'info', p.id);
          break;
        }
        this.room.note(`${p.name} acertou ${victim.name} com a Manopla!`, 'bad', victim.id);
        const taken = this.lose(victim, 5);
        this.gain(p, taken);
        break;
      }
      case 'bomba':
        this.b.bombs.set(String(p.tile), p.id);
        this.room.note(`${p.name} escondeu pólvora nesta casa...`, 'info', p.id);
        break;
      case 'troca': {
        const target = this.others(p).sort((a, c) => stepsBetween(a.tile, this.b.crownTile) - stepsBetween(c.tile, this.b.crownTile))[0];
        if (!target) break;
        const mine = p.tile;
        p.tile = target.tile;
        target.tile = mine;
        this.room.note(`${p.name} leu o pergaminho e trocou de lugar com ${target.name}!`, 'info', p.id);
        this.room.broadcast(MSG.boardTeleport, { pid: p.id, tile: p.tile });
        this.room.broadcast(MSG.boardTeleport, { pid: target.id, tile: target.tile });
        break;
      }
      case 'escudo':
        p.shield = true;
        break;
    }
    await this.room.sleep(1500);
  }

  /* ---------------- bots ---------------- */

  private towardCrown(nexts: number[]): number {
    return nexts.slice().sort((a, c) => stepsBetween(a, this.b.crownTile) - stepsBetween(c, this.b.crownTile))[0];
  }

  private botChoosePath(nexts: number[]): number {
    const smart = [0.55, 0.8, 0.95][this.room.botLevel] ?? 0.8;
    return Math.random() < smart ? this.towardCrown(nexts) : pick(nexts);
  }

  private botRollAction(p: PlayerState, flags: TurnFlags): RollAction {
    const level = this.room.botLevel;
    const has = (id: ItemId) => {
      const i = [...p.items].indexOf(id);
      return i >= 0 && !flags.used.has(id) ? i : -1;
    };
    const chance = [0.35, 0.7, 1][level] ?? 0.7;
    if (Math.random() > chance) return { type: 'roll' };
    const crownDist = stepsBetween(p.tile, this.b.crownTile);

    let i = has('troca');
    if (i >= 0) {
      const best = this.others(p).map(o => stepsBetween(o.tile, this.b.crownTile)).sort((a, c) => a - c)[0];
      if (best !== undefined && best + 4 < crownDist) return { type: 'item', index: i };
    }
    i = has('luva');
    if (i >= 0 && this.others(p).some(o => o.coins >= 6)) return { type: 'item', index: i };
    i = has('dado2');
    if (i >= 0 && crownDist > 6 && !flags.doubleDice) return { type: 'item', index: i };
    i = has('ima');
    if (i >= 0 && !flags.magnet && p.coins < CROWN_PRICE) return { type: 'item', index: i };
    i = has('bomba');
    if (i >= 0 && Math.random() < 0.4 && !this.b.bombs.has(String(p.tile))) return { type: 'item', index: i };
    return { type: 'roll' };
  }

  private botShop(p: PlayerState, offer: ItemId[]): ItemId | null {
    const prefer: ItemId[] = ['troca', 'dado2', 'luva', 'escudo', 'ima', 'bomba'];
    const reserve = p.coins >= CROWN_PRICE + 4 ? 0 : 6;
    for (const id of prefer) {
      if (!offer.includes(id)) continue;
      const def = ITEMS[id];
      if (p.coins - def.price < reserve) continue;
      if (!def.passive && p.items.length >= MAX_ITEMS) continue;
      return id;
    }
    return null;
  }
}
