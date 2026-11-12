import http from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { PROTOCOL_VERSION, ROOM_NAME } from '@fuzue/shared';
import { GameRoom } from './rooms/GameRoom.js';

const PORT = Number(process.env.PORT ?? 2567);
/** Atraso artificial (ms) para testar o jogo com lag: SIMULATE_LATENCY=150 npm run dev */
const SIMULATE_LATENCY = Number(process.env.SIMULATE_LATENCY ?? 0);

// Servidor HTTP simples. O Colyseus adiciona as rotas de matchmaking
// (/matchmake/...) e o WebSocket em cima dele.
const httpServer = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    // o site chama esta rota para "acordar" o servidor antes de entrar
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({ ok: true, game: 'fuzue', protocol: PROTOCOL_VERSION }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const transport = new WebSocketTransport({ server: httpServer });
const gameServer = new Server({ transport });
gameServer.define(ROOM_NAME, GameRoom);

if (SIMULATE_LATENCY > 0) {
  transport.simulateLatency(SIMULATE_LATENCY);
  console.log(`Simulando ${SIMULATE_LATENCY} ms de atraso em cada mensagem.`);
}

await gameServer.listen(PORT);
console.log(`Servidor do Fuzuê ouvindo em ws://localhost:${PORT}`);
