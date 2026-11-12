/* Pixel Duel — partidas: CPU local, anfitrião online e convidado online.
 * Online usa WebRTC (PeerJS) com o anfitrião como autoridade: ele roda o motor,
 * valida as ações do convidado e envia a cada um só o que ele pode ver.
 * O modo "local" usa BroadcastChannel para testar com duas abas do mesmo navegador. */
(function () {
  const PD = (window.PD = window.PD || {});
  const PREFIX = 'pixelduel-v1-';
  const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';

  /* ---------- emissor simples ---------- */
  function emitter(obj) {
    const L = {};
    obj.on = (ev, fn) => { (L[ev] = L[ev] || []).push(fn); return obj; };
    obj.emit = (ev, ...args) => (L[ev] || []).forEach((fn) => { try { fn(...args); } catch (e) { console.error(e); } });
    return obj;
  }

  const randomSeed = () => (Math.random() * 0xffffffff) >>> 0;
  function randomCode(local) {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = local ? 'L' : '';
    while (s.length < 6) s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  }

  /* ---------- PeerJS ---------- */
  let peerPromise = null;
  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    if (peerPromise) return peerPromise;
    peerPromise = new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = PEERJS_URL;
      sc.onload = () => (window.Peer ? resolve() : reject(new Error('PeerJS não carregou.')));
      sc.onerror = () => { peerPromise = null; reject(new Error('Não foi possível carregar a biblioteca de conexão (PeerJS).')); };
      document.head.appendChild(sc);
    });
    return peerPromise;
  }

  function wrapConn(conn, peer) {
    const t = { send: (o) => { if (conn.open) conn.send(o); }, onmessage: null, onclose: null,
      close: () => { try { conn.close(); } catch (e) { /* já fechado */ } setTimeout(() => peer && peer.destroy(), 300); } };
    conn.on('data', (d) => t.onmessage && t.onmessage(d));
    conn.on('close', () => t.onclose && t.onclose());
    conn.on('error', () => t.onclose && t.onclose());
    return t;
  }

  function peerError(err) {
    const type = err && err.type;
    if (type === 'peer-unavailable') return 'Sala não encontrada. Confira o código ou peça um novo convite.';
    if (type === 'browser-incompatible') return 'Este navegador não suporta conexões WebRTC.';
    if (type === 'network' || type === 'server-error' || type === 'socket-error') return 'Sem conexão com o servidor de salas. Verifique sua internet.';
    if (type === 'unavailable-id') return 'Código de sala em uso. Tente de novo.';
    return (err && err.message) || 'Falha na conexão.';
  }

  function hostPeer(code) {
    return loadPeer().then(() => new Promise((resolve, reject) => {
      const peer = new window.Peer(PREFIX + code, { debug: 0 });
      let opened = false;
      const room = emitter({ code, transport: null, close() { try { peer.destroy(); } catch (e) { /* ok */ } } });
      peer.on('open', () => { opened = true; resolve(room); });
      peer.on('error', (err) => { if (!opened) reject(new Error(peerError(err))); else room.emit('error', peerError(err)); });
      peer.on('connection', (conn) => {
        conn.on('open', () => {
          if (room.transport) { conn.send({ type: 'busy' }); setTimeout(() => conn.close(), 300); return; }
          room.transport = wrapConn(conn, null);
          room.emit('connect', room.transport);
        });
      });
    }));
  }

  function joinPeer(code) {
    return loadPeer().then(() => new Promise((resolve, reject) => {
      const peer = new window.Peer({ debug: 0 });
      const timer = setTimeout(() => { reject(new Error('A sala não respondeu. O anfitrião ainda está com a página aberta?')); peer.destroy(); }, 20000);
      peer.on('error', (err) => { clearTimeout(timer); reject(new Error(peerError(err))); });
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true });
        conn.on('open', () => { clearTimeout(timer); resolve(wrapConn(conn, peer)); });
      });
    }));
  }

  /* ---------- BroadcastChannel (teste local em duas abas) ---------- */
  function hostLocal(code) {
    const ch = new BroadcastChannel(PREFIX + code);
    const room = emitter({ code, transport: null, close() { ch.close(); } });
    ch.onmessage = (e) => {
      const m = e.data;
      if (!m || m.from !== 'guest') return;
      if (m.kind === 'knock') {
        if (room.transport) return;
        room.transport = {
          send: (o) => ch.postMessage({ from: 'host', kind: 'data', data: o }), onmessage: null, onclose: null,
          close: () => { ch.postMessage({ from: 'host', kind: 'bye' }); },
        };
        ch.postMessage({ from: 'host', kind: 'welcome' });
        room.emit('connect', room.transport);
      } else if (m.kind === 'data') room.transport && room.transport.onmessage && room.transport.onmessage(m.data);
      else if (m.kind === 'bye') room.transport && room.transport.onclose && room.transport.onclose();
    };
    return Promise.resolve(room);
  }

  function joinLocal(code) {
    return new Promise((resolve, reject) => {
      if (!window.BroadcastChannel) { reject(new Error('Navegador sem suporte ao modo local.')); return; }
      const ch = new BroadcastChannel(PREFIX + code);
      const t = { send: (o) => ch.postMessage({ from: 'guest', kind: 'data', data: o }), onmessage: null, onclose: null,
        close: () => { ch.postMessage({ from: 'guest', kind: 'bye' }); ch.close(); } };
      const timer = setTimeout(() => reject(new Error('Sala local não encontrada. Ela precisa estar aberta em outra aba deste navegador.')), 4000);
      ch.onmessage = (e) => {
        const m = e.data;
        if (!m || m.from !== 'host') return;
        if (m.kind === 'welcome') { clearTimeout(timer); resolve(t); }
        else if (m.kind === 'data') t.onmessage && t.onmessage(m.data);
        else if (m.kind === 'bye') t.onclose && t.onclose();
      };
      ch.postMessage({ from: 'guest', kind: 'knock' });
    });
  }

  /* ---------- controladores de partida ---------- */
  const E = () => PD.Engine;

  /** Duelo contra a CPU. */
  function cpuMatch({ deck, name, cpu }) {
    const cpuDeck = PD.STARTER_DECKS[cpu.deck].cards;
    let s;
    let fails = 0;
    let busy = false;
    const m = emitter({ mode: 'cpu', me: 0, names: [name, cpu.name], cpu });
    function start() {
      s = E().createGame({ decks: [deck, cpuDeck], names: [name, cpu.name], seed: randomSeed(), first: Math.random() < 0.5 ? 0 : 1 });
      fails = 0;
      m.emit('start', E().viewFor(s, 0));
    }
    m.start = start;
    m.view = () => E().viewFor(s, 0);
    m.act = (a) => {
      a.player = 0;
      const r = E().apply(s, a);
      if (r.ok) m.emit('update', E().viewFor(s, 0), r.events);
      return r;
    };
    m.idle = () => {
      if (!s || s.winner !== null || busy) return;
      const actor = s.pending ? s.pending.player : s.current;
      if (actor !== 1) return;
      busy = true;
      setTimeout(() => {
        busy = false;
        if (s.winner !== null) return;
        let a = PD.AI.choose(s, 1);
        if (!a) return;
        let r = E().apply(s, a);
        if (!r.ok) {
          fails++;
          a = s.pending ? { type: 'respond', player: 1, uid: null } : { type: 'endTurn', player: 1 };
          if (fails > 2) r = E().apply(s, a);
        } else fails = 0;
        if (r.ok) m.emit('update', E().viewFor(s, 0), r.events);
        else m.idle();
      }, 420);
    };
    m.rematch = start;
    m.chat = () => {};
    m.leave = () => {};
    return m;
  }

  /** Anfitrião: cria a sala e roda o motor. */
  function hostMatch({ deck, name, format, local }) {
    const m = emitter({ mode: 'host', me: 0, format, code: null, names: [name, '?'] });
    let room = null;
    let t = null;
    let s = null;
    let guestDeck = null;
    let rematchAsked = false;

    function send(o) { if (t) t.send(o); }
    function startGame() {
      s = E().createGame({ decks: [deck, guestDeck], names: m.names, seed: randomSeed(), first: Math.random() < 0.5 ? 0 : 1 });
      rematchAsked = false;
      send({ type: 'start', view: E().viewFor(s, 1), names: m.names });
      m.emit('start', E().viewFor(s, 0));
    }

    m.open = function () {
      m.code = randomCode(local);
      const p = local ? hostLocal(m.code) : hostPeer(m.code);
      return p.then((r) => {
        room = r;
        room.on('error', (msg) => m.emit('status', msg));
        room.on('connect', (tr) => {
          t = tr;
          t.onclose = () => m.emit('closed', 'O oponente saiu da sala.');
          t.onmessage = onMessage;
          send({ type: 'hello', name, format, v: 1 });
          m.emit('status', 'Oponente conectado. Esperando ele escolher o deck...');
        });
        return m.code;
      });
    };

    function onMessage(msg) {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'join') {
        const deckIds = Array.isArray(msg.deck) ? msg.deck.filter((x) => typeof x === 'string').slice(0, 60) : [];
        const v = PD.validateDeck(deckIds, format);
        if (!v.ok) { send({ type: 'reject', reason: v.errors[0] }); return; }
        m.names = [name, String(msg.name || 'Convidado').slice(0, 20)];
        guestDeck = deckIds;
        startGame();
      } else if (msg.type === 'action' && s) {
        const a = Object.assign({}, msg.action, { player: 1 });
        const r = E().apply(s, a);
        if (r.ok) broadcast(r.events);
        else send({ type: 'error', error: r.error });
      } else if (msg.type === 'chat') {
        m.emit('chat', m.names[1], String(msg.text || '').slice(0, 200));
      } else if (msg.type === 'rematch') {
        rematchAsked = true;
        m.emit('rematchAsked');
      } else if (msg.type === 'leave') {
        m.emit('closed', 'O oponente saiu da sala.');
      }
    }

    function broadcast(events) {
      send({ type: 'update', view: E().viewFor(s, 1), events });
      m.emit('update', E().viewFor(s, 0), events);
    }

    m.view = () => E().viewFor(s, 0);
    m.act = (a) => {
      a.player = 0;
      const r = E().apply(s, a);
      if (r.ok) broadcast(r.events);
      return r;
    };
    m.idle = () => {};
    m.chat = (text) => { send({ type: 'chat', text }); m.emit('chat', name, text); };
    m.rematch = () => { if (guestDeck) startGame(); };
    m.rematchPending = () => rematchAsked;
    m.leave = () => { send({ type: 'leave' }); setTimeout(() => { if (t) t.close(); if (room) room.close(); }, 200); };
    return m;
  }

  /** Convidado: conecta na sala e envia ações para o anfitrião. */
  function guestMatch({ code, name }) {
    const m = emitter({ mode: 'guest', me: 1, code, names: ['?', name], format: null });
    let t = null;
    let view = null;
    m.connect = function () {
      const p = code.startsWith('L') ? joinLocal(code) : joinPeer(code);
      return p.then((tr) => {
        t = tr;
        t.onclose = () => m.emit('closed', 'A conexão com o anfitrião caiu.');
        t.onmessage = (msg) => {
          if (!msg || typeof msg !== 'object') return;
          if (msg.type === 'hello') { m.format = msg.format; m.hostName = msg.name; m.emit('hello', msg); }
          else if (msg.type === 'busy') m.emit('closed', 'Essa sala já tem dois duelistas.');
          else if (msg.type === 'reject') m.emit('rejected', msg.reason);
          else if (msg.type === 'start') { view = msg.view; m.names = msg.names; m.emit('start', view); }
          else if (msg.type === 'update') { view = msg.view; m.emit('update', view, msg.events || []); }
          else if (msg.type === 'error') m.emit('error', msg.error);
          else if (msg.type === 'chat') m.emit('chat', m.names[0], String(msg.text || '').slice(0, 200));
          else if (msg.type === 'leave') m.emit('closed', 'O anfitrião saiu da sala.');
        };
      });
    };
    m.join = (deck) => t && t.send({ type: 'join', name, deck });
    m.view = () => view;
    m.act = (a) => { a.player = 1; if (t) t.send({ type: 'action', action: a }); return { ok: true, remote: true }; };
    m.idle = () => {};
    m.chat = (text) => { if (t) t.send({ type: 'chat', text }); m.emit('chat', name, text); };
    m.rematch = () => { if (t) t.send({ type: 'rematch' }); };
    m.leave = () => { if (t) { t.send({ type: 'leave' }); setTimeout(() => t.close(), 200); } };
    return m;
  }

  PD.Net = {
    cpuMatch, hostMatch, guestMatch, randomCode,
    onlineSupported: () => !!window.RTCPeerConnection && !PD.ARTIFACT_BUILD,
  };
})();
