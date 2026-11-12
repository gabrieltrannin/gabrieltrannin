/**
 * Simula minijogos só com bots, sem rede, o mais rápido possível.
 * Serve para equilibrar a jogabilidade:  npx tsx test/simular.ts corrida 20
 */
import { MINIGAMES, type MinigameId } from '@fuzue/shared';
import { createMinigame } from '../src/minigames/index.js';
import { GameState, PlayerState } from '../src/rooms/schema.js';
import type { GameRoom } from '../src/rooms/GameRoom.js';

const id = (process.argv[2] ?? 'corrida') as MinigameId;
const runs = Number(process.argv[3] ?? 10);
const level = Number(process.argv[4] ?? 1);

const summary: string[] = [];
for (let r = 0; r < runs; r++) {
  const state = new GameState();
  state.botLevel = level;
  ['a', 'b', 'c', 'd'].forEach((pid, i) => {
    const p = new PlayerState();
    p.id = pid; p.name = pid.toUpperCase(); p.bot = true; p.seat = i; p.coins = 10 + i;
    state.players.set(pid, p);
  });
  const events: Record<string, number> = {};
  const fake = {
    state,
    get botLevel() { return state.botLevel; },
    isBot: () => true,
    broadcast: (type: string, msg: { kind?: string }) => { const k = msg?.kind ? `${type}:${msg.kind}` : type; events[k] = (events[k] ?? 0) + 1; },
    participants: () => [...state.players.values()],
  } as unknown as GameRoom;
  state.mg.step = 'play';
  const game = createMinigame(id, fake, ['a', 'b', 'c', 'd']);
  game.duration = MINIGAMES[id].duration;
  let ticks = 0;
  while (!game.over && ticks < 30 * (MINIGAMES[id].duration + 5)) { game.tick(1 / 30, true); ticks++; }
  const res = game.result();
  const scores = game.rts.map(rt => `${rt.id}:${rt.score}${rt.alive ? '' : '✗'}${rt.finished ? '🏁' : ''}`).join(' ');
  summary.push(`${(ticks / 30).toFixed(1).padStart(5)}s | ${res.ranking.map(g => g.join('=')).join(' > ')} | ${scores}${res.teamScores ? ` | placar ${res.teamScores.join('x')}` : ''} | ${JSON.stringify(events)}`);
}
console.log(`${MINIGAMES[id].name} (bots nível ${level}), ${runs} partidas:\n` + summary.join('\n'));
