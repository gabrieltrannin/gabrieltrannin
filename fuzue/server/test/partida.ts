/**
 * Teste de partida completa: sobe o servidor neste processo com o tempo
 * acelerado, entra com um jogador "robô de teste" + 3 bots e joga do lobby
 * até o pódio, passando pelos 6 minijogos.
 *
 *   npm test -w @fuzue/server
 *
 * Variáveis: GAME_SPEED (padrão 8), MINIGAME_ORDER, ROUNDS (5, 10, 15 ou 20; padrão 10).
 */
export {};
process.env.GAME_SPEED ??= '8';
process.env.MINIGAME_ORDER ??= 'ringue,hexa,corrida,chuva,bomba,futebol';

const http = await import('node:http');
const { Server } = await import('@colyseus/core');
const { WebSocketTransport } = await import('@colyseus/ws-transport');
const { Client } = await import('colyseus.js');
const shared = await import('@fuzue/shared');
const { GameRoom } = await import('../src/rooms/GameRoom.js');

const { MSG, PROTOCOL_VERSION, ROOM_NAME } = shared;
const ROUNDS = Number(process.env.ROUNDS ?? 10);
const port = 2700 + Math.floor(Math.random() * 500);

const httpServer = http.createServer();
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
gameServer.define(ROOM_NAME, GameRoom);
await gameServer.listen(port);

const client = new Client(`ws://localhost:${port}`);
const room = await client.create(ROOM_NAME, { name: 'Testador', character: 2, protocol: PROTOCOL_VERSION });
const me = room.sessionId;

const phases: string[] = [];
const report: string[] = [];
let playStart = 0;
const minigames: string[] = [];
const counts: Record<string, number> = {};
const problems: string[] = [];
let lastAction = '';
let seq = 0;
let results = 0;

room.onMessage('*', (type, msg) => {
  counts[String(type)] = (counts[String(type)] ?? 0) + 1;
  if (type === MSG.ping) room.send(MSG.pong, msg);
  if (type === MSG.mgResult) {
    results++;
    const m = msg as { ranking: string[][]; rewards: Record<string, number>; teamScores?: number[] };
    const flat = m.ranking.flat();
    if (flat.length !== 4) problems.push(`ranking com ${flat.length} jogadores`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s: any = room.state;
    const name = (id: string) => s.players.get(id)?.name ?? id;
    const secs = ((Date.now() - playStart) / 1000) * Number(process.env.GAME_SPEED);
    const extra = m.teamScores ? ` placar ${m.teamScores.join('x')}` : '';
    const scores = [...s.mg.players.entries()].map(([id, p]: [string, { score: number; alive: boolean; finished: boolean }]) => `${name(id)}:${p.score}${p.alive ? '' : '✗'}${p.finished ? '🏁' : ''}`).join(' ');
    report.push(`${s.mg.id.padEnd(8)} ~${secs.toFixed(0)}s de jogo${extra} | ${m.ranking.map(g => g.map(name).join('=')).join(' > ')} | ${scores}`);
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
room.onStateChange((s: any) => {
  if (phases[phases.length - 1] !== s.phase) phases.push(s.phase);
  const b = s.board;
  const key = `${s.phase}|${b.step}|${b.turn}|${s.mg.step}|${s.mg.id}`;
  if (key === lastAction) return;
  lastAction = key;
  if (s.phase === 'order' && !b.orderRolls.has(me)) room.send(MSG.orderRoll);
  if (s.phase === 'board' && b.order[b.turn] === me) {
    const p = s.players.get(me);
    if (b.step === 'roll') {
      const usable = [...p.items].findIndex((i: string) => i !== 'escudo');
      if (usable >= 0 && Math.random() < 0.5) room.send(MSG.useItem, { index: usable });
      else room.send(MSG.roll);
    }
    if (b.step === 'choose') room.send(MSG.choose, { tile: b.choices[b.choices.length - 1] });
    if (b.step === 'shop') room.send(MSG.shop, { item: p.coins >= 8 ? b.shopOffer[0] : null });
  }
  if (s.phase === 'minigame' && s.mg.step === 'play' && !playStart) playStart = Date.now();
  if (s.phase === 'minigame' && s.mg.step === 'result') playStart = 0;
  if (s.phase === 'minigame' && s.mg.step === 'intro') {
    if (minigames[minigames.length - 1] !== s.mg.id) minigames.push(s.mg.id);
    room.send(MSG.mgReady);
  }
});

// durante os minijogos, anda em círculos e empurra/pula de vez em quando
const inputTimer = setInterval(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s: any = room.state;
  if (s.phase !== 'minigame' || s.mg.step !== 'play') return;
  const a = Date.now() / 700;
  room.send(MSG.input, { seq: ++seq, x: Math.cos(a), z: Math.sin(a), push: seq % 20 === 0, jump: seq % 25 === 0 });
}, 1000 / 30);

room.send(MSG.settings, { rounds: ROUNDS, fillBots: true, botLevel: 2 });
await sleep(200);
room.send(MSG.start);

const started = Date.now();
const limitMs = 15 * 60 * 1000;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
while ((room.state as any).phase !== 'podium' && Date.now() - started < limitMs) await sleep(250);
clearInterval(inputTimer);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const st: any = room.state;
const finalPhase = st.phase;
const table = [...st.players.values()].sort((a: { place: number }, b: { place: number }) => a.place - b.place)
  .map((p: { place: number; name: string; crowns: number; coins: number; bot: boolean }) => `${p.place}º ${p.name}${p.bot ? ' (bot)' : ''}: ${p.crowns} coroas, ${p.coins} moedas`);

room.send(MSG.again);
await sleep(600);
const backInLobby = st.phase === 'lobby' && [...st.players.values()].every((p: { bot: boolean }) => !p.bot);

console.log('\n=== Partida de teste ===');
console.log(`Tempo: ${((Date.now() - started) / 1000).toFixed(0)} s (velocidade x${process.env.GAME_SPEED})`);
console.log(`Fases: ${phases.join(' → ')}`);
console.log(`Minijogos: ${minigames.join(', ')} (${results} resultados)`);
console.log('Mensagens:', JSON.stringify(counts));
console.log('Resultados (✗ = eliminado, 🏁 = chegou):\n  ' + report.join('\n  '));
console.log('Classificação final:\n  ' + table.join('\n  '));
console.log(`Voltou ao lobby sem bots: ${backInLobby}`);

if (finalPhase !== 'podium') problems.push(`terminou na fase "${finalPhase}"`);
if (minigames.length < Math.min(ROUNDS, 6)) problems.push(`só ${minigames.length} minijogos`);
if (results !== ROUNDS) problems.push(`${results} resultados de minijogo para ${ROUNDS} rodadas`);
if (!backInLobby) problems.push('não voltou ao lobby');
if (!counts[MSG.boardMove]) problems.push('ninguém andou no tabuleiro');

await room.leave();
await gameServer.gracefullyShutdown(false);
if (problems.length) {
  console.log('\nPROBLEMAS:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('\nTudo certo.');
process.exit(0);

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
