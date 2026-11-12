/* Pixel Duel — tela de duelo. Funciona igual para CPU, anfitrião e convidado:
 * recebe "visões" do estado + eventos, anima os eventos e redesenha a mesa. */
(function () {
  const PD = (window.PD = window.PD || {});
  const E = () => PD.Engine;
  const U = () => PD.UI;
  let B = null;

  const FIELD_TINT = { maquina: 'terra', dragao: 'fogo' };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const isMain = (v) => v.phase === 'main1' || v.phase === 'main2';
  const myTurnFree = () => B && B.view.current === B.me && !B.view.pending && B.view.winner === null;

  function hashStr(str) { let x = 7; for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) >>> 0; return x; }
  function avatarFor(p) {
    if (B.m.mode === 'cpu' && p === 1) return PD.Sprites.portraitArt(B.m.cpu);
    const name = B.view.players[p].name;
    const x = hashStr(name + p);
    return PD.Sprites.portraitArt({ id: 'pl-' + name + p, seed: name + p, hair: x % 360, cloth: (x >> 9) % 360, skin: 18 + (x % 14) });
  }

  /* ---------- ciclo de vida ---------- */
  function attach(m, onStart) {
    m.on('start', (view) => { if (onStart) onStart(); begin(m, view); });
    m.on('update', (view, events) => { if (B && B.m === m) { B.queue.push({ view, events }); pump(); } });
    m.on('chat', (who, text) => { if (B && B.m === m) { B.chat.push({ after: B.view.logSeq, who, text }); renderLog(); } });
    m.on('error', (msg) => { if (B && B.m === m) { PD.Audio.play('error'); U().toast(msg); } });
    m.on('closed', (msg) => {
      if (!B || B.m !== m) return;
      B.closed = true;
      if (B.view.winner === null) {
        U().modal({ title: 'Duelo interrompido', body: msg, dismissable: false,
          actions: [{ label: 'Voltar ao lobby', cls: 'gold', onClick: (c) => { c(); killScene(); B = null; PD.App.show('lobby'); } }] });
      } else U().toast(msg);
    });
    m.on('rematchAsked', () => { if (B && B.m === m) U().toast('O oponente pediu revanche! Use o botão Revanche.'); });
  }

  function killScene() { if (B && B.scene) { B.scene.dispose(); B.scene = null; B.stageEl = null; } }
  const use3d = () => !!(PD.Scene3D && PD.Scene3D.supported());

  function begin(m, view) {
    killScene();
    U().closeMenu();
    document.querySelectorAll('.backdrop').forEach((b) => b.remove());
    B = {
      m, me: m.me, view, queue: [], processing: false, mode: null, chat: [], promptKey: null, endShown: false, closed: false,
      displayLP: [view.players[0].lp, view.players[1].lp], seenHand: new Set(), detail: null,
    };
    B.view.players[B.me].hand.forEach((c) => B.seenHand.add(c.uid));
    PD.App.screen = 'duel';
    document.body.classList.add('in-duel');
    document.querySelectorAll('.nav button').forEach((b) => b.setAttribute('aria-current', 'false'));
    const root = U().$('#screen');
    root.className = 'screen duel';
    window.scrollTo(0, 0);
    render();
    (async () => {
      B.processing = true;
      await banner('DUELO!');
      await banner(view.current === B.me ? 'VOCÊ COMEÇA' : `${view.players[view.current].name.toUpperCase()} COMEÇA`, view.current !== B.me);
      B.processing = false;
      if (B.queue.length) pump(); else afterIdle();
    })();
  }

  const active = () => !!(B && !B.closed && B.view && B.view.winner === null);

  function confirmLeave(cb) {
    U().modal({
      title: 'Sair do duelo?',
      body: 'Sair agora conta como desistência.',
      actions: [
        { label: 'Continuar duelando', cls: 'ghost' },
        { label: 'Desistir e sair', cls: 'red', onClick: (c) => { c(); leave(); cb(); } },
      ],
    });
  }

  function leave() {
    if (!B) return;
    const m = B.m;
    if (active()) m.act({ type: 'surrender' });
    m.leave();
    killScene();
    B = null;
  }

  /* ---------- fila de animação ---------- */
  async function pump() {
    if (!B || B.processing) return;
    const myB = B;
    myB.processing = true;
    while (myB.queue.length) {
      const { view, events } = myB.queue.shift();
      await playEvents(events);
      if (B !== myB) return;
      myB.view = view;
      render();
      postRender(events);
      await sleep(60);
    }
    myB.processing = false;
    afterIdle();
  }

  function afterIdle() {
    if (!B) return;
    const v = B.view;
    if (v.winner !== null) { showEnd(); return; }
    if (v.pending && v.pending.player === B.me) showResponse();
    B.m.idle();
  }

  /* ---------- efeitos visuais ---------- */
  function banner(text, rival) {
    const el = U().h('div', { class: 'banner' + (rival ? ' rival' : '') }, text);
    document.body.append(el);
    return sleep(900).then(() => el.remove());
  }

  async function showActivation(id, label, trap) {
    const { h, cardEl } = U();
    PD.Audio.play(trap ? 'trap' : 'activate');
    const el = h('div', { class: 'activation' }, h('div', { class: 'act-inner' }, cardEl(id), h('div', { class: 'act-label' }, label)));
    document.body.append(el);
    await sleep(1000);
    el.remove();
  }

  const zoneCard = (uid) => document.querySelector(`.zone [data-uid="${uid}"]`);

  async function animAttack(e) {
    const a = zoneCard(e.uid);
    const t = e.target != null ? zoneCard(e.target) : document.querySelector(`.pbar[data-p="${1 - e.p}"] .avatar`);
    PD.Audio.play('attack');
    if (!a || !t) { await sleep(300); return; }
    const cell = a.parentElement;
    const ra = a.getBoundingClientRect();
    const rt = t.getBoundingClientRect();
    const dx = rt.left + rt.width / 2 - (ra.left + ra.width / 2);
    const dy = rt.top + rt.height / 2 - (ra.top + ra.height / 2);
    cell.style.zIndex = 20;
    const anim = cell.animate([
      { transform: 'translate(0,0)' },
      { transform: `translate(${-dx * 0.08}px, ${-dy * 0.08}px)`, offset: 0.25 },
      { transform: `translate(${dx * 0.82}px, ${dy * 0.82}px)`, offset: 0.62 },
      { transform: 'translate(0,0)' },
    ], { duration: 620, easing: 'ease-in-out' });
    setTimeout(() => {
      PD.Audio.play('hit');
      t.classList.add('flash');
      const tz = t.closest('.zone') || t.closest('.pbar');
      if (tz) tz.classList.add('shake');
    }, 390);
    await anim.finished.catch(() => {});
    cell.style.zIndex = '';
  }

  async function animDestroy(uid) {
    const el = zoneCard(uid);
    PD.Audio.play('destroy');
    if (!el) { await sleep(200); return; }
    const anim = el.animate([
      { opacity: 1, filter: 'brightness(1)' },
      { opacity: 1, filter: 'brightness(3) saturate(0)', offset: 0.3 },
      { opacity: 0, filter: 'brightness(2) blur(2px)' },
    ], { duration: 480, fill: 'forwards' });
    await anim.finished.catch(() => {});
  }

  function revealInDom(uid, id) {
    const el = zoneCard(uid);
    if (!el) return;
    const n = U().cardEl(id, { uid });
    if (el.classList.contains('def')) n.classList.add('def');
    el.replaceWith(n);
  }

  function floatNum(p, n, heal) {
    const t = document.querySelector(`[data-lp="${p}"]`);
    if (!t) return;
    const r = t.getBoundingClientRect();
    const el = U().h('div', { class: 'float-num' + (heal ? ' heal' : '') }, (heal ? '+' : '-') + n);
    el.style.left = r.left + 'px';
    el.style.top = r.top - 6 + 'px';
    document.body.append(el);
    setTimeout(() => el.remove(), 1150);
    if (!heal) {
      const bar = document.querySelector(`.pbar[data-p="${p}"]`);
      if (bar) { bar.classList.remove('shake'); void bar.offsetWidth; bar.classList.add('shake'); }
      if (n >= 1500) { const tb = document.querySelector('.table'); if (tb) { tb.classList.remove('shake'); void tb.offsetWidth; tb.classList.add('shake'); } }
    }
  }

  function tickLP(p, to) {
    const from = B.displayLP[p];
    const t0 = performance.now();
    const dur = 700;
    const myB = B;
    const step = (now) => {
      if (B !== myB) return;
      const k = Math.min(1, (now - t0) / dur);
      B.displayLP[p] = Math.round(from + (to - from) * k);
      const num = document.querySelector(`[data-lp="${p}"]`);
      if (num) num.textContent = B.displayLP[p];
      const bar = document.querySelector(`[data-lpbar="${p}"]`);
      if (bar) { bar.style.width = Math.min(100, (B.displayLP[p] / PD.RULES.startLP) * 100) + '%'; bar.classList.toggle('low', B.displayLP[p] <= 2000); }
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  async function playEvents(events) {
    for (const e of events) {
      if (!B) return;
      const S = B.scene;
      switch (e.t) {
        case 'turn':
          PD.Audio.play('turn');
          await banner(e.p === B.me ? 'SEU TURNO' : `TURNO DE ${B.view.players[e.p].name.toUpperCase()}`, e.p !== B.me);
          break;
        case 'activate': {
          const c = PD.card(e.id);
          if (S) { PD.Audio.play(c.kind === 'trap' ? 'trap' : 'activate'); await S.animActivate(e.id, c.kind); }
          else await showActivation(e.id, c.kind === 'trap' ? 'ARMADILHA!' : 'MAGIA!', c.kind === 'trap');
          break;
        }
        case 'fx':
          if (S) { PD.Audio.play('activate'); await S.animActivate(e.id, 'fx'); }
          else await showActivation(e.id, 'EFEITO!', false);
          break;
        case 'attack':
          if (S) { PD.Audio.play('attack'); setTimeout(() => PD.Audio.play('hit'), 380); await S.animAttack(e.uid, e.target, e.p, B.me); }
          else await animAttack(e);
          break;
        case 'flip': PD.Audio.play('set'); if (S) await S.animReveal(e.uid, e.id, B.me); else { revealInDom(e.uid, e.id); await sleep(250); } break;
        case 'destroy': if (S) { PD.Audio.play('destroy'); await S.animDestroy(e.uid); } else await animDestroy(e.uid); break;
        case 'tribute': PD.Audio.play('destroy'); await Promise.all(e.uids.map((u) => (S ? S.animDestroy(u) : animDestroy(u)))); break;
        case 'buff': if (S) await S.animBuff(e.uid, e.atk >= 0); break;
        case 'damage': floatNum(e.p, e.n, false); tickLP(e.p, e.lp); if (S && e.n >= 1000) S.shake(0.32, 380); await sleep(350); break;
        case 'heal': PD.Audio.play('heal'); floatNum(e.p, e.n, true); tickLP(e.p, e.lp); await sleep(250); break;
        case 'summon': if (e.how !== 'flip') PD.Audio.play('summon'); break;
        case 'set': PD.Audio.play('set'); break;
        case 'draw': if (e.p === B.me) PD.Audio.play('draw'); break;
        case 'negate': await banner('ATAQUE NEGADO!'); break;
        case 'phase': PD.Audio.play('select'); break;
        case 'win': PD.Audio.play(e.winner === B.me ? 'win' : 'lose'); break;
      }
    }
  }

  function postRender(events) {
    for (const e of events) {
      if (e.t === 'summon' || e.t === 'set' || e.t === 'buff') {
        const el = zoneCard(e.uid);
        if (el) el.parentElement.classList.add(e.t === 'buff' ? 'flash' : 'summon-in');
      }
    }
  }

  /* ---------- desenho ---------- */
  function render() {
    if (!B) return;
    const { h } = U();
    const v = B.view;
    const me = B.me;
    const op = 1 - me;
    const root = U().$('#screen');
    root.innerHTML = '';
    let tint = '';
    const three = use3d();
    if (v.field && !three) {
      const fc = PD.card(v.field.inst.id);
      if (fc && fc.field) tint = ' field-' + (fc.field.attr || FIELD_TINT[fc.field.race] || 'luz');
    }
    const table = h('div', { class: 'table' + tint },
      pbar(op), hand(op), three ? stage() : board(), three ? midline() : null, pbar(me), hand(me), promptBar());
    const side = h('aside', { class: 'side' },
      h('section', { class: 'win detail', id: 'detail' }),
      logPanel());
    root.append(h('div', { class: 'duel-wrap' + (three ? ' gfx3d' : '') }, table, side));
    setDetail(B.detail);
    fitHands();
    renderLog();
    if (three && B.scene) {
      B.scene.resize();
      B.scene.sync(v, me);
      B.scene.setHighlights(highlights());
    }
  }

  /* ---------- palco 3D ---------- */
  function stage() {
    if (!B.stageEl) {
      B.stageEl = U().h('div', { class: 'stage' });
      B.scene = PD.Scene3D.create(B.stageEl, { onPick: onScenePick, onHover: onSceneHover });
    }
    return B.stageEl;
  }

  function highlights() {
    const v = B.view;
    const md = B.mode;
    const out = { targets: [], chosen: [], canAct: [], used: [] };
    if (md) {
      if (md.kind === 'target' || md.kind === 'attack') out.targets = md.targets.slice();
      if (md.kind === 'tribute') {
        out.chosen = md.chosen.slice();
        out.targets = v.players[B.me].monsters.filter(Boolean).map((m) => m.uid).filter((u) => !md.chosen.includes(u));
      }
      return out;
    }
    ['monsters', 'spells'].forEach((zone) => v.players[B.me][zone].forEach((inst) => {
      if (!inst) return;
      if (fieldHasAction(inst, zone)) out.canAct.push(inst.uid);
      if (zone === 'monsters' && v.phase === 'battle' && v.current === B.me && inst.faceUp && inst.pos === 'atk' && !E().canAttackWith(v, B.me, inst)) out.used.push(inst.uid);
    }));
    return out;
  }

  function findLoc(uid) {
    const v = B.view;
    for (let p = 0; p < 2; p++) for (const zone of ['monsters', 'spells']) {
      const inst = v.players[p][zone].find((x) => x && x.uid === uid);
      if (inst) return { p, zone, inst };
    }
    if (v.field && v.field.inst.uid === uid) return { p: v.field.owner, zone: 'field', inst: v.field.inst };
    return null;
  }

  function anchorAt(x, y) {
    let a = document.getElementById('pick-anchor');
    if (!a) { a = U().h('div', { id: 'pick-anchor', style: { position: 'fixed', width: '1px', height: '1px', pointerEvents: 'none' } }); document.body.append(a); }
    a.style.left = x + 'px';
    a.style.top = y + 'px';
    return a;
  }

  function onScenePick(pk, x, y) {
    if (!B) return;
    U().closeMenu();
    if (!pk) return;
    if (pk.pile) {
      if (pk.pile === 'grave') showGrave(pk.p);
      else U().toast(`${B.view.players[pk.p].deckCount} carta(s) no deck.`);
      return;
    }
    const loc = findLoc(pk.uid);
    if (!loc) return;
    const anchor = anchorAt(x, y);
    if (loc.zone === 'field') { infoMenu(loc.inst, anchor); return; }
    onZoneClick(loc.p, loc.zone, loc.inst, anchor);
  }

  function onSceneHover(pk) {
    if (!B || !pk) return;
    if (pk.pile === 'grave') {
      const g = B.view.players[pk.p].grave;
      if (g.length) setDetail({ id: g[g.length - 1].id });
      return;
    }
    const loc = pk.uid != null ? findLoc(pk.uid) : null;
    if (!loc || !loc.inst.id || loc.inst.hidden) return;
    const stats = loc.zone === 'monsters' && loc.inst.faceUp ? { atk: E().getAtk(B.view, loc.inst), def: E().getDef(B.view, loc.inst) } : null;
    setDetail({ id: loc.inst.id, stats });
  }

  function pbar(p) {
    const { h } = U();
    const v = B.view;
    const P = v.players[p];
    const lp = B.displayLP[p];
    return h('div', { class: 'pbar' + (v.current === p && v.winner === null ? ' turn' : ''), 'data-p': p },
      h('img', { class: 'avatar px', src: avatarFor(p), alt: '' }),
      h('div', { class: 'who' },
        h('div', { class: 'pname' }, P.name + (p === B.me ? ' (você)' : '')),
        h('div', { class: 'lp' },
          h('span', { class: 'lp-num', 'data-lp': p }, lp),
          h('div', { class: 'lp-bar' }, h('i', { 'data-lpbar': p, class: lp <= 2000 ? 'low' : '', style: { width: Math.min(100, (lp / PD.RULES.startLP) * 100) + '%' } })))),
      h('div', { class: 'counts' },
        h('span', null, 'MÃO ', h('b', null, P.hand.length)),
        h('span', null, 'DECK ', h('b', null, P.deckCount)),
        h('span', null, 'CEM. ', h('b', null, P.grave.length))));
  }

  function hand(p) {
    const { h, cardEl } = U();
    const v = B.view;
    const P = v.players[p];
    if (p !== B.me) return h('div', { class: 'hand opp' }, P.hand.map((c) => cardEl(null, { uid: c.uid })));
    const box = h('div', { class: 'hand mine' });
    P.hand.forEach((inst) => {
      const el = cardEl(inst.id, { uid: inst.uid });
      if (!B.seenHand.has(inst.uid)) { el.classList.add('draw-in'); B.seenHand.add(inst.uid); }
      if (myTurnFree() && isMain(v) && !handHasAction(inst)) el.classList.add('dim');
      el.tabIndex = 0;
      el.addEventListener('mouseenter', () => setDetail({ id: inst.id }));
      el.addEventListener('focus', () => setDetail({ id: inst.id }));
      el.addEventListener('click', (e) => { e.stopPropagation(); onHandClick(inst, el); });
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onHandClick(inst, el); } });
      box.append(el);
    });
    return box;
  }

  function fitHands() {
    document.querySelectorAll('.hand').forEach((hd) => {
      const cards = hd.querySelectorAll('.card');
      if (cards.length < 2) return;
      const cw = cards[0].offsetWidth;
      const avail = hd.clientWidth - 10;
      const need = cards.length * (cw + 4);
      hd.style.setProperty('--overlap', need > avail ? Math.min(cw * 0.7, (need - avail) / (cards.length - 1)) + 'px' : '-4px');
    });
  }

  function board() {
    const { h } = U();
    const v = B.view;
    const me = B.me;
    const op = 1 - me;
    const cells = [];
    const empty = () => h('div', { class: 'zone empty-slot' });
    const pile = (p, kind) => {
      const P = v.players[p];
      const n = kind === 'deck' ? P.deckCount : P.grave.length;
      const top = kind === 'grave' && P.grave.length ? P.grave[P.grave.length - 1] : null;
      const cell = h('div', { class: 'zone pile', title: kind === 'deck' ? 'Deck' : 'Cemitério' },
        kind === 'deck' ? (n ? U().cardEl(null) : null) : top ? U().cardEl(top.id) : null,
        h('span', { class: 'pile-n' }, n),
        h('span', { class: 'zlabel' }, kind === 'deck' ? 'DECK' : 'CEMIT.'));
      cell.addEventListener('click', (e) => { e.stopPropagation(); if (kind === 'grave') showGrave(p); else U().toast(`${n} carta(s) no deck.`); });
      return cell;
    };
    const fieldCell = () => {
      const cell = h('div', { class: 'zone' }, v.field ? U().cardEl(v.field.inst.id, { uid: v.field.inst.uid }) : null, h('span', { class: 'zlabel' }, 'CAMPO'));
      if (v.field) {
        cell.firstChild.addEventListener('mouseenter', () => setDetail({ id: v.field.inst.id }));
        cell.addEventListener('click', (e) => { e.stopPropagation(); infoMenu(v.field.inst, cell.firstChild); });
      }
      return cell;
    };
    const order = [0, 1, 2, 3, 4];
    const oppOrder = [4, 3, 2, 1, 0];
    // linha 1: Magias/Armadilhas do oponente
    cells.push(pile(op, 'deck'), ...oppOrder.map((i) => zoneCell(op, 'spells', i)), empty());
    // linha 2: monstros do oponente
    cells.push(pile(op, 'grave'), ...oppOrder.map((i) => zoneCell(op, 'monsters', i)), empty());
    // linha do meio
    cells.push(midline());
    // linha 4: meus monstros
    cells.push(fieldCell(), ...order.map((i) => zoneCell(me, 'monsters', i)), pile(me, 'grave'));
    // linha 5: minhas Magias/Armadilhas
    cells.push(empty(), ...order.map((i) => zoneCell(me, 'spells', i)), pile(me, 'deck'));
    return h('div', { class: 'board' }, cells);
  }

  function zoneCell(p, zone, i) {
    const { h, cardEl } = U();
    const v = B.view;
    const inst = v.players[p][zone][i];
    const cell = h('div', { class: 'zone', 'data-p': p, 'data-zone': zone });
    if (inst) {
      let el;
      const hidden = inst.hidden || (!inst.faceUp && p !== B.me);
      if (hidden) el = cardEl(null, { uid: inst.uid });
      else if (zone === 'monsters') el = cardEl(inst.id, { uid: inst.uid, atk: E().getAtk(v, inst), def: E().getDef(v, inst) });
      else el = cardEl(inst.id, { uid: inst.uid });
      if (!hidden && !inst.faceUp) el.classList.add('set-own');
      if (zone === 'monsters' && inst.pos === 'def') el.classList.add('def');
      if (p === B.me && fieldHasAction(inst, zone)) el.classList.add('can-act');
      if (zone === 'monsters' && p === B.me && v.phase === 'battle' && v.current === B.me && inst.faceUp && inst.pos === 'atk' && !E().canAttackWith(v, B.me, inst)) el.classList.add('used');
      if (!hidden) {
        const stats = zone === 'monsters' && inst.faceUp ? { atk: E().getAtk(v, inst), def: E().getDef(v, inst) } : null;
        el.addEventListener('mouseenter', () => setDetail({ id: inst.id, stats }));
      }
      el.tabIndex = 0;
      cell.append(el);
      if (B.mode) {
        const md = B.mode;
        if ((md.kind === 'target' || md.kind === 'attack') && md.targets.includes(inst.uid)) cell.classList.add('target');
        if (md.kind === 'tribute' && p === B.me && zone === 'monsters') cell.classList.add(md.chosen.includes(inst.uid) ? 'chosen' : 'target');
      }
      const go = (e) => { e.stopPropagation(); onZoneClick(p, zone, inst, el); };
      el.addEventListener('click', go);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } });
    }
    return cell;
  }

  function midline() {
    const { h } = U();
    const v = B.view;
    const phases = [['main1', 'PRINCIPAL 1'], ['battle', 'BATALHA'], ['main2', 'PRINCIPAL 2']];
    const ctrls = [];
    if (myTurnFree()) {
      if (v.phase === 'main1') ctrls.push(h('button', { class: 'btn gold', disabled: v.turn === 1 ? true : null, title: v.turn === 1 ? 'Quem começa não ataca no primeiro turno' : null,
        onclick: () => act({ type: 'phase', to: 'battle' }) }, 'Batalha'));
      if (v.phase === 'battle') ctrls.push(h('button', { class: 'btn', onclick: () => act({ type: 'phase', to: 'main2' }) }, 'Principal 2'));
      ctrls.push(h('button', { class: 'btn red', onclick: () => act({ type: 'endTurn' }) }, 'Encerrar turno'));
    } else if (v.winner === null) {
      ctrls.push(h('span', { class: 'field-chip' }, v.pending ? (v.pending.player === B.me ? 'SUA RESPOSTA...' : 'O OPONENTE ESTÁ DECIDINDO...') : 'TURNO DO OPONENTE...'));
    } else {
      ctrls.push(h('button', { class: 'btn gold', onclick: () => { B.endShown = false; showEnd(); } }, 'Fim do duelo'));
    }
    return h('div', { class: 'midline' },
      h('div', { class: 'phases' }, phases.map(([k, l]) => h('span', { class: v.phase === k ? 'on' : '' }, l))),
      ctrls);
  }

  function promptBar() {
    const { h } = U();
    const md = B.mode;
    if (!md) return null;
    let text = '';
    const extra = [];
    if (md.kind === 'tribute') text = `Escolha ${md.need} monstro(s) para sacrificar (${md.chosen.length}/${md.need})`;
    else if (md.kind === 'target') text = `Escolha o alvo de ${PD.card(md.cardId).name}`;
    else if (md.kind === 'attack') {
      text = md.targets.length ? 'Escolha o monstro que vai receber o ataque' : 'Ataque direto';
      if (md.direct) extra.push(h('button', { class: 'btn sm gold', onclick: (e) => { e.stopPropagation(); act({ type: 'attack', uid: md.uid, target: null }); } }, 'Ataque direto'));
    }
    return h('div', { class: 'prompt win' }, h('span', null, text), extra,
      h('button', { class: 'btn sm ghost', onclick: (e) => { e.stopPropagation(); B.mode = null; PD.Audio.play('back'); render(); } }, 'Cancelar'));
  }

  function setDetail(d) {
    if (!B) return;
    B.detail = d;
    const box = document.getElementById('detail');
    if (!box) return;
    box.innerHTML = '';
    box.classList.toggle('empty', !d);
    box.append(U().detailBlock(d && d.id, d && d.stats));
  }

  function logPanel() {
    const { h } = U();
    const list = h('div', { class: 'log-list', id: 'log-list', 'aria-live': 'polite' });
    const panel = h('section', { class: 'win log' },
      h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' } },
        h('h3', { style: { margin: 0 } }, 'Registro do duelo'),
        B.view.winner === null ? h('button', { class: 'btn sm ghost', onclick: () => confirmSurrender() }, 'Desistir') : null),
      list);
    if (B.m.mode !== 'cpu') {
      const inp = h('input', { class: 'inp', id: 'chat-input', maxlength: '160', placeholder: 'Mensagem para o oponente' });
      panel.append(h('form', { class: 'chat-form', onsubmit: (e) => {
        e.preventDefault();
        const t = inp.value.trim();
        if (!t) return;
        B.m.chat(t);
        inp.value = '';
      } }, inp, h('button', { class: 'btn sm', type: 'submit' }, 'Enviar')));
    }
    return panel;
  }

  function renderLog() {
    const list = document.getElementById('log-list');
    if (!list || !B) return;
    const { h } = U();
    list.innerHTML = '';
    const chats = B.chat.slice();
    const pushChats = (upTo) => { while (chats.length && chats[0].after <= upTo) { const c = chats.shift(); list.append(h('div', { class: 'chat' }, h('b', null, c.who + ': '), c.text)); } };
    for (const l of B.view.log) {
      pushChats(l.n - 1);
      list.append(h('div', { class: l.kind || '' }, l.kind === 'turn' ? '— ' + l.text + ' —' : l.text));
    }
    pushChats(Infinity);
    list.scrollTop = list.scrollHeight;
  }

  /* ---------- regras de interface ---------- */
  function handHasAction(inst) {
    const v = B.view;
    const c = PD.card(inst.id);
    if (c.kind === 'monster') return E().summonCheck(v, B.me, inst).ok;
    if (c.kind === 'spell' && E().activateCheck(v, B.me, inst, false).ok) return true;
    return c.sub !== 'field' && E().freeZone(v.players[B.me].spells) >= 0;
  }

  function fieldHasAction(inst, zone) {
    const v = B.view;
    if (!myTurnFree()) return false;
    if (zone === 'monsters') {
      if (v.phase === 'battle') return E().canAttackWith(v, B.me, inst);
      return false;
    }
    if (zone === 'spells' && !inst.faceUp && isMain(v)) {
      const c = PD.card(inst.id);
      if (c.kind === 'trap' && c.trigger !== 'manual') return false;
      return E().activateCheck(v, B.me, inst, true).ok;
    }
    return false;
  }

  function act(a) {
    if (!B) return;
    B.mode = null;
    U().closeMenu();
    const r = B.m.act(a);
    if (r && !r.ok) { PD.Audio.play('error'); U().toast(r.error); render(); }
  }

  function onHandClick(inst, el) {
    const v = B.view;
    const c = PD.card(inst.id);
    setDetail({ id: inst.id });
    if (B.mode) { U().toast('Termine a escolha atual ou cancele.'); return; }
    PD.Audio.play('select');
    const opts = [];
    const turnOk = myTurnFree() && isMain(v);
    const notTurn = !myTurnFree() ? 'Espere o seu turno.' : !isMain(v) ? 'Só na Fase Principal.' : null;
    if (c.kind === 'monster') {
      const chk = E().summonCheck(v, B.me, inst);
      const need = chk.need || PD.tributesFor(c.level);
      opts.push({ label: need ? `Invocar (${need} sacrifício${need > 1 ? 's' : ''})` : 'Invocar em Ataque', disabled: !chk.ok, why: chk.why, onClick: () => startSummon(inst, 'atk', need) });
      opts.push({ label: 'Baixar em Defesa', disabled: !chk.ok, why: chk.ok ? null : chk.why, onClick: () => startSummon(inst, 'set', need) });
    } else {
      if (c.kind === 'spell') {
        const chk = E().activateCheck(v, B.me, inst, false);
        opts.push({ label: 'Ativar', disabled: !chk.ok, why: chk.why, onClick: () => startActivate(inst, chk) });
      }
      if (c.sub !== 'field') {
        const full = E().freeZone(v.players[B.me].spells) < 0;
        opts.push({ label: 'Baixar', disabled: !turnOk || full, why: notTurn || (full ? 'Zona de Magias/Armadilhas cheia.' : null), onClick: () => act({ type: 'setST', uid: inst.uid }) });
      }
    }
    U().menu(el, { title: c.name, text: menuText(c), options: opts });
  }

  function menuText(c) {
    const t = PD.cardText(c);
    const head = c.kind === 'monster' ? `${PD.ATTRS[c.attr].name} · ${PD.RACES[c.race]} · Nv ${c.level} · ${c.atk}/${c.def}` : PD.kindLabel(c);
    return head + '\n' + (t || c.flavor || '');
  }

  function onZoneClick(p, zone, inst, el) {
    const v = B.view;
    const md = B.mode;
    if (md) {
      if (md.kind === 'tribute') {
        if (p !== B.me || zone !== 'monsters') return;
        const i = md.chosen.indexOf(inst.uid);
        if (i >= 0) md.chosen.splice(i, 1); else md.chosen.push(inst.uid);
        PD.Audio.play('select');
        if (md.chosen.length === md.need) act({ type: 'summon', uid: md.uid, mode: md.summonMode, tributes: md.chosen.slice() });
        else render();
        return;
      }
      if (md.kind === 'target' && md.targets.includes(inst.uid)) { act({ type: 'activate', uid: md.uid, target: inst.uid }); return; }
      if (md.kind === 'attack' && md.targets.includes(inst.uid)) { act({ type: 'attack', uid: md.uid, target: inst.uid }); return; }
      PD.Audio.play('error');
      return;
    }
    if (p !== B.me || inst.hidden) { infoMenu(inst, el); return; }
    PD.Audio.play('select');
    const c = PD.card(inst.id);
    const opts = [];
    const free = myTurnFree();
    if (zone === 'monsters') {
      if (v.phase === 'battle' && free) {
        const can = E().canAttackWith(v, B.me, inst);
        let why = null;
        if (!can) {
          if (v.players[B.me].stunTurn === v.turn) why = 'Seus monstros não podem atacar neste turno.';
          else if (!inst.faceUp || inst.pos !== 'atk') why = 'Só monstros em Posição de Ataque atacam.';
          else why = 'Este monstro já atacou neste turno.';
        }
        opts.push({ label: 'Atacar', disabled: !can, why, onClick: () => startAttack(inst) });
      }
      if (isMain(v) && free) {
        if (!inst.faceUp) {
          const ok = inst.setTurn !== v.turn;
          opts.push({ label: 'Virar para cima (Ataque)', disabled: !ok, why: ok ? null : 'Não pode virar no turno em que foi baixado.', onClick: () => act({ type: 'flipSummon', uid: inst.uid }) });
        } else {
          let why = null;
          if (inst.summonedTurn === v.turn) why = 'Invocado neste turno.';
          else if (inst.posTurn === v.turn) why = 'Já mudou de posição neste turno.';
          else if (inst.atkTurn === v.turn) why = 'Já atacou neste turno.';
          opts.push({ label: inst.pos === 'atk' ? 'Mudar para Defesa' : 'Mudar para Ataque', disabled: !!why, why, onClick: () => act({ type: 'changePos', uid: inst.uid }) });
        }
      }
    } else if (zone === 'spells' && !inst.faceUp) {
      if (c.kind === 'trap' && c.trigger !== 'manual') {
        opts.push({ label: 'Ativar', disabled: true, why: c.trigger === 'attack' ? 'Dispara quando o oponente atacar.' : 'Dispara quando o oponente invocar.', onClick: () => {} });
      } else {
        const chk = E().activateCheck(v, B.me, inst, true);
        opts.push({ label: 'Ativar', disabled: !chk.ok, why: chk.why, onClick: () => startActivate(inst, chk) });
      }
    }
    if (!opts.length) { infoMenu(inst, el); return; }
    U().menu(el, { title: c.name, text: menuText(c), options: opts });
  }

  function infoMenu(inst, el) {
    if (!inst || inst.hidden || !inst.id || (!inst.faceUp && inst.owner !== B.me && !(B.view.field && B.view.field.inst.uid === inst.uid))) {
      U().menu(el, { title: 'Carta baixada', text: 'Você não sabe que carta é esta.', options: [{ label: 'Fechar', onClick: () => {} }] });
      return;
    }
    const c = PD.card(inst.id);
    setDetail({ id: c.id });
    U().menu(el, { title: c.name, text: menuText(c), options: [{ label: 'Fechar', onClick: () => {} }] });
  }

  function startSummon(inst, mode, need) {
    if (!need) { act({ type: 'summon', uid: inst.uid, mode, tributes: [] }); return; }
    B.mode = { kind: 'tribute', uid: inst.uid, summonMode: mode, need, chosen: [] };
    render();
  }

  function startActivate(inst, chk) {
    if (!chk.kind) { act({ type: 'activate', uid: inst.uid }); return; }
    if (chk.kind === 'graveOwn' || chk.kind === 'graveAny') {
      pickFromGrave(chk.targets, (uid) => act({ type: 'activate', uid: inst.uid, target: uid }));
      return;
    }
    B.mode = { kind: 'target', uid: inst.uid, cardId: inst.id, targets: chk.targets };
    render();
  }

  function startAttack(inst) {
    const o = E().attackOptions(B.view, B.me, inst);
    if (!o.targets.length && o.direct) { act({ type: 'attack', uid: inst.uid, target: null }); return; }
    B.mode = { kind: 'attack', uid: inst.uid, targets: o.targets, direct: o.direct };
    render();
  }

  function graveCards(uids) {
    const v = B.view;
    const all = [...v.players[0].grave, ...v.players[1].grave];
    return uids.map((u) => all.find((g) => g.uid === u)).filter(Boolean);
  }

  function pickFromGrave(uids, done) {
    const { h, cardEl, modal } = U();
    const list = h('div', { class: 'pick-list' });
    const md = modal({ title: 'Escolha um monstro do Cemitério', body: list, actions: [{ label: 'Cancelar', cls: 'ghost' }] });
    graveCards(uids).forEach((g) => {
      const el = cardEl(g.id, { uid: g.uid, title: true });
      el.tabIndex = 0;
      el.addEventListener('mouseenter', () => setDetail({ id: g.id }));
      const choose = () => { md.close(); done(g.uid); };
      el.addEventListener('click', choose);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') choose(); });
      list.append(el);
    });
  }

  function showGrave(p) {
    const { h, cardEl, modal } = U();
    const P = B.view.players[p];
    const list = h('div', { class: 'pick-list' });
    P.grave.slice().reverse().forEach((g) => {
      const el = cardEl(g.id, { uid: g.uid, title: true });
      el.addEventListener('mouseenter', () => setDetail({ id: g.id }));
      el.addEventListener('click', () => setDetail({ id: g.id }));
      list.append(el);
    });
    modal({ title: `Cemitério de ${P.name} (${P.grave.length})`, body: P.grave.length ? list : 'Vazio.', actions: [{ label: 'Fechar' }] });
  }

  function confirmSurrender() {
    U().modal({ title: 'Desistir do duelo?', body: 'O oponente vence imediatamente.',
      actions: [{ label: 'Continuar', cls: 'ghost' }, { label: 'Desistir', cls: 'red', onClick: (c) => { c(); act({ type: 'surrender' }); } }] });
  }

  function findInst(uid) {
    const v = B.view;
    for (const P of v.players) for (const z of ['monsters', 'spells']) { const f = P[z].find((x) => x && x.uid === uid); if (f) return f; }
    return null;
  }

  function showResponse() {
    const v = B.view;
    const pen = v.pending;
    const key = v.logSeq + ':' + pen.trigger;
    if (B.promptKey === key) return;
    B.promptKey = key;
    const { h, cardEl, modal } = U();
    let desc = '';
    if (pen.trigger === 'attack') {
      const A = findInst(pen.ctx.attacker);
      const an = A && A.id ? `${PD.card(A.id).name} (${E().getAtk(v, A)} ATK)` : 'Um monstro';
      let tn = 'você diretamente';
      if (pen.ctx.target != null) { const T = findInst(pen.ctx.target); tn = T && T.id ? PD.card(T.id).name : 'um monstro seu'; }
      desc = `${an} vai atacar ${tn}.`;
    } else {
      const M = findInst(pen.ctx.uid);
      desc = M && M.id ? `O oponente invocou ${PD.card(M.id).name} (${E().getAtk(v, M)} ATK).` : 'O oponente invocou um monstro.';
    }
    PD.Audio.play('trap');
    const list = h('div', { class: 'stack' });
    const md = modal({
      title: pen.trigger === 'attack' ? 'Ataque declarado!' : 'Invocação do oponente!',
      body: h('div', { class: 'stack' }, h('p', { style: { margin: 0 } }, desc, ' Ativar uma armadilha?'), list),
      dismissable: false,
      actions: [{ label: 'Não ativar', cls: 'ghost', onClick: (c) => { c(); act({ type: 'respond', uid: null }); } }],
    });
    (pen.options || []).forEach((uid) => {
      const inst = findInst(uid);
      if (!inst) return;
      const c = PD.card(inst.id);
      list.append(h('div', { class: 'row', style: { alignItems: 'center', flexWrap: 'nowrap' } },
        cardEl(c.id, { uid }),
        h('div', { class: 'grow', style: { minWidth: 0 } }, h('b', { class: 'kbd' }, c.name), h('div', { class: 'small' }, PD.cardText(c))),
        h('button', { class: 'btn gold', onclick: () => { md.close(); act({ type: 'respond', uid }); } }, 'Ativar')));
    });
  }

  function showEnd() {
    if (B.endShown) return;
    B.endShown = true;
    const { h, modal } = U();
    const v = B.view;
    const won = v.winner === B.me;
    const draw = v.winner === 'draw';
    const label = draw ? 'EMPATE' : won ? 'VITÓRIA!' : 'DERROTA';
    const m = B.m;
    modal({
      title: 'Fim do duelo',
      body: h('div', null,
        h('div', { class: 'big-result ' + (won ? 'win' : draw ? '' : 'lose') }, label),
        h('p', { style: { textAlign: 'center' } }, v.winReason),
        h('p', { class: 'muted small', style: { textAlign: 'center' } }, `Duelo de ${v.turn} turnos.`)),
      dismissable: false,
      actions: [
        { label: 'Ver mesa', cls: 'ghost', onClick: (c) => c() },
        { label: 'Voltar ao lobby', onClick: (c) => { c(); m.leave(); killScene(); B = null; PD.App.show('lobby'); } },
        !B.closed ? { label: m.mode === 'guest' ? 'Pedir revanche' : 'Revanche', cls: 'gold', onClick: (c) => {
          if (m.mode === 'guest') { m.rematch(); U().toast('Pedido de revanche enviado.'); return; }
          c(); m.rematch();
        } } : null,
      ].filter(Boolean),
    });
  }

  window.addEventListener('resize', () => { if (B && PD.App.screen === 'duel') fitHands(); });
  window.addEventListener('beforeunload', () => { if (B && B.m.mode !== 'cpu') B.m.leave(); });

  function dispose() { if (B) { U().closeMenu(); killScene(); B.m.leave(); B = null; } }
  function setLowRes(on) { if (B && B.scene) B.scene.setLowRes(on); }

  /** Gancho usado pelos testes automatizados para clicar em objetos da cena 3D. */
  const debug = () => B && { view: B.view, me: B.me, mode: B.mode, pick: (uid) => onScenePick({ uid }, window.innerWidth / 2, window.innerHeight / 2) };

  PD.Battle = { attach, active, confirmLeave, dispose, setLowRes, debug, render: () => render() };
})();
