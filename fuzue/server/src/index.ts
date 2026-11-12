import http from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ROOM_NAME } from '@fuzue/shared';
import { ArenaRoom } from './rooms/ArenaRoom.js';

const PORT = Number(process.env.PORT ?? 2567);
/** Atraso artificial (ms) para testar o jogo com lag: SIMULATE_LATENCY=150 npm run dev */
const SIMULATE_LATENCY = Number(process.env.SIMULATE_LATENCY ?? 0);

// Servidor HTTP simples. O Colyseus adiciona as rotas de matchmaking
// (/matchmake/...) e o WebSocket em cima dele.
const httpServer = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Servidor do Fuzuê no ar.');
    return;
  }
  res.writeHead(404);
  res.end();
});

const transport = new WebSocketTransport({ server: httpServer });
const gameServer = new Server({ transport });
gameServer.define(ROOM_NAME, ArenaRoom);

if (SIMULATE_LATENCY > 0) {
  transport.simulateLatency(SIMULATE_LATENCY);
  console.log(`Simulando ${SIMULATE_LATENCY} ms de atraso em cada mensagem.`);
}

await gameServer.listen(PORT);
console.log(`Servidor do Fuzuê ouvindo em ws://localhost:${PORT}`);
