/** Rastreia o primeiro bot de um minijogo: npx tsx test/trace.ts lava 20 */
import { MINIGAMES, type MinigameId } from '@fuzue/shared';
import { createMinigame } from '../src/minigames/index.js';
import { GameState, PlayerState } from '../src/rooms/schema.js';
import type { GameRoom } from '../src/rooms/GameRoom.js';

const id = (process.argv[2] ?? 'lava') as MinigameId;
const secs = Number(process.argv[3] ?? 20);
const state = new GameState();
state.botLevel = Number(process.argv[4] ?? 1);
['a', 'b', 'c', 'd'].forEach((pid, i) => {
  const p = new PlayerState();
  p.id = pid; p.name = pid; p.bot = true; p.seat = i;
  state.players.set(pid, p);
});
const fake = { state, get botLevel() { return state.botLevel; }, isBot: () => true, broadcast: () => {}, participants: () => [...state.players.values()] } as unknown as GameRoom;
state.mg.step = 'play';
const game = createMinigame(id, fake, ['a', 'b', 'c', 'd']);
game.duration = MINIGAMES[id].duration;
for (let i = 0; i < secs * 30 && !game.over; i++) {
  game.tick(1 / 30, true);
  if (i % 15 === 0) {
    const b = game.rts[0].body;
    console.log(`${(i / 30).toFixed(1)}s x=${b.x.toFixed(2)} y=${b.y.toFixed(2)} z=${b.z.toFixed(2)} g=${b.grounded} alive=${game.rts[0].alive} stun=${b.stunT.toFixed(2)} goal=${JSON.stringify(game.rts[0].ai.goal)} t=${game.rts[0].ai.target}`);
  }
}
