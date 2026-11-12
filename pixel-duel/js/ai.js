/* Pixel Duel — oponente CPU (heurísticas gulosas, sem olhar cartas ocultas). */
(function () {
  const PD = (window.PD = window.PD || {});
  const E = () => PD.Engine;
  const C = (inst) => (inst && inst.id ? PD.card(inst.id) : null);
  const FACE_DOWN_GUESS = 1500;

  /** Força aparente de um monstro do oponente (sem espiar cartas baixadas). */
  function threat(s, m) {
    if (!m.faceUp) return FACE_DOWN_GUESS;
    return E().getAtk(s, m);
  }
  function oppBestAtk(s, o) {
    let best = 0;
    for (const m of E().monstersOf(s, o)) if (m.faceUp && m.pos === 'atk') best = Math.max(best, E().getAtk(s, m));
    return best;
  }
  function myBestAtk(s, p) {
    let best = 0;
    for (const m of E().monstersOf(s, p)) if (m.faceUp) best = Math.max(best, E().getAtk(s, m));
    return best;
  }
  const canBattleSoon = (s, p) => s.phase === 'main1' && s.turn > 1 && s.players[p].stunTurn !== s.turn;

  /* ---------- magias ---------- */
  function scoreSpell(s, p, inst, chk) {
    const c = C(inst);
    const o = 1 - p;
    const P = s.players[p];
    const O = s.players[o];
    const myMons = E().monstersOf(s, p);
    const oppMons = E().monstersOf(s, o);

    if (c.sub === 'field') {
      if (s.field && s.field.inst.id === c.id) return { score: -1 };
      const match = (cc) => cc && cc.kind === 'monster' && ((c.field.attr && cc.attr === c.field.attr) || (c.field.race && cc.race === c.field.race));
      const mine = myMons.filter((m) => m.faceUp && match(C(m))).length + P.hand.filter((h) => match(C(h))).length * 0.5;
      const theirs = oppMons.filter((m) => m.faceUp && match(C(m))).length;
      const sc = (mine - theirs) * 15 + (s.field && s.field.owner !== p ? 10 : 0);
      return { score: mine > theirs ? sc : -1 };
    }

    let score = 0;
    let target = null;
    for (const op of c.ops) {
      switch (op.op) {
        case 'damage': score += op.n >= O.lp ? 1000 : 25 + op.n / 40; break;
        case 'heal': score += P.lp <= 2500 ? 45 : P.lp <= 5000 ? 12 : -5; break;
        case 'draw': score += P.deck.length > op.n + 3 ? 35 * op.n : -10; break;
        case 'destroy':
          if (op.t === 'oppMonster') {
            const best = chk.targets.map((u) => E().locate(s, u).inst).sort((a, b) => threat(s, b) - threat(s, a))[0];
            target = best.uid;
            score += 15 + threat(s, best) / 45;
          } else if (op.t === 'oppST') {
            const set = chk.targets.map((u) => E().locate(s, u).inst);
            target = (set.find((x) => !x.faceUp) || set[0]).uid;
            score += 22;
          } else if (op.t === 'allOppMonsters') {
            const n = oppMons.filter((m) => !op.maxAtk || (m.faceUp && E().getAtk(s, m) <= op.maxAtk)).length;
            score += n ? 25 * n : -50;
          } else if (op.t === 'allMonsters') {
            const theirs = oppMons.reduce((a, m) => a + threat(s, m), 0);
            const mine = myMons.reduce((a, m) => a + (m.faceUp ? E().getAtk(s, m) : E().getDef(s, m)), 0);
            score += theirs > mine + 800 ? 40 + (theirs - mine) / 100 : -60;
          } else if (op.t === 'allST') {
            const diff = E().stOf(s, o).length - E().stOf(s, p).length;
            score += diff > 0 ? 18 * diff : -40;
          }
          break;
        case 'buff': {
          if (op.t === 'ownMonster') {
            const mine = chk.targets.map((u) => E().locate(s, u).inst).sort((a, b) => E().getAtk(s, b) - E().getAtk(s, a));
            const best = mine.find((m) => m.pos === 'atk') || mine[0];
            target = best.uid;
            score += canBattleSoon(s, p) && best.pos === 'atk' ? 24 : 6;
          } else if (op.t === 'allOwn') {
            const attackers = myMons.filter((m) => m.faceUp && m.pos === 'atk').length;
            score += canBattleSoon(s, p) && attackers ? 12 * attackers : -10;
          }
          break;
        }
        case 'debuff': {
          if (op.t === 'oppMonster') {
            const best = chk.targets.map((u) => E().locate(s, u).inst).sort((a, b) => E().getAtk(s, b) - E().getAtk(s, a))[0];
            target = best.uid;
            score += E().getAtk(s, best) >= myBestAtk(s, p) ? 22 : 8;
          }
          break;
        }
        case 'revive': {
          const best = chk.targets.map((u) => E().locate(s, u).inst).sort((a, b) => C(b).atk - C(a).atk)[0];
          target = best.uid;
          score += C(best).atk / 55;
          break;
        }
        case 'stun':
          score += oppMons.length && (oppBestAtk(s, o) > myBestAtk(s, p) || P.lp < O.lp) ? 28 : -5;
          break;
      }
    }
    return { score, target };
  }

  function bestActivation(s, p) {
    const P = s.players[p];
    const cands = [];
    P.hand.forEach((h) => { const c = C(h); if (c && c.kind === 'spell') cands.push({ inst: h, fromField: false }); });
    P.spells.forEach((st) => {
      if (!st || st.faceUp) return;
      const c = C(st);
      if (c.kind === 'spell' || (c.kind === 'trap' && c.trigger === 'manual')) cands.push({ inst: st, fromField: true });
    });
    let best = null;
    for (const cd of cands) {
      const chk = E().activateCheck(s, p, cd.inst, cd.fromField);
      if (!chk.ok) continue;
      const r = scoreSpell(s, p, cd.inst, chk);
      if (r.score > 0 && (!best || r.score > best.score)) best = { score: r.score, action: { type: 'activate', player: p, uid: cd.inst.uid, target: r.target } };
    }
    return best && best.action;
  }

  /* ---------- invocação ---------- */
  function monValue(s, m) { return m.faceUp ? Math.max(E().getAtk(s, m), E().getDef(s, m) * 0.7) : C(m).def * 0.8; }

  function bestSummon(s, p) {
    const P = s.players[p];
    if (P.normalSummoned) return null;
    const mine = E().monstersOf(s, p);
    const o = 1 - p;
    const threatMax = Math.max(0, ...E().monstersOf(s, o).map((m) => (m.faceUp && m.pos === 'atk' ? E().getAtk(s, m) : m.faceUp ? 0 : 1200)));
    let best = null;
    for (const h of P.hand) {
      const c = C(h);
      if (!c || c.kind !== 'monster') continue;
      const chk = E().summonCheck(s, p, h);
      if (!chk.ok) continue;
      const sorted = mine.slice().sort((a, b) => monValue(s, a) - monValue(s, b));
      const tributes = sorted.slice(0, chk.need);
      const lost = tributes.reduce((a, m) => a + monValue(s, m), 0);
      const maxTrib = Math.max(0, ...tributes.map((m) => monValue(s, m)));
      if (chk.need && c.atk < maxTrib + 400) continue;
      let score = Math.max(c.atk, c.def * 0.75) - lost * 0.55;
      if (c.fx && c.fx.on === 'summon') score += 250;
      if (c.fx && c.fx.on === 'flip') score += 150;
      if (c.aura) score += 150;
      if (c.kw) score += 120 * c.kw.length;
      if (!best || score > best.score) {
        let mode = 'atk';
        if (c.fx && c.fx.on === 'flip') mode = 'set';
        else if (c.atk < threatMax && c.def >= c.atk) mode = 'set';
        else if (c.atk < threatMax && c.atk < 1600) mode = 'set';
        best = { score, action: { type: 'summon', player: p, uid: h.uid, mode, tributes: tributes.map((m) => m.uid) } };
      }
    }
    return best && best.action;
  }

  function bestFlipOrPosition(s, p) {
    const o = 1 - p;
    const oppMons = E().monstersOf(s, o);
    const visibleMax = oppBestAtk(s, o);
    for (const m of E().monstersOf(s, p)) {
      const c = C(m);
      if (!m.faceUp) {
        if (m.setTurn === s.turn) continue;
        if (c.fx && c.fx.on === 'flip') {
          const useful = c.fx.ops.some((op) => op.op !== 'destroy' || (op.t === 'randOppMonster' ? oppMons.length : E().stOf(s, o).length));
          if (useful) return { type: 'flipSummon', player: p, uid: m.uid };
        }
        if (s.phase === 'main1' && c.atk > visibleMax + 100 && c.atk >= 1400) return { type: 'flipSummon', player: p, uid: m.uid };
        continue;
      }
      if (m.summonedTurn === s.turn || m.posTurn === s.turn || m.atkTurn === s.turn) continue;
      const atk = E().getAtk(s, m);
      if (m.pos === 'def' && s.phase === 'main1' && s.turn > 1) {
        const canHit = !oppMons.length || oppMons.some((x) => x.faceUp && (x.pos === 'atk' ? E().getAtk(s, x) < atk : E().getDef(s, x) < atk));
        if (canHit && atk >= visibleMax) return { type: 'changePos', player: p, uid: m.uid };
      }
      if (m.pos === 'atk' && s.phase === 'main2' && atk < visibleMax && E().getDef(s, m) > atk) {
        return { type: 'changePos', player: p, uid: m.uid };
      }
    }
    return null;
  }

  function bestSet(s, p) {
    const P = s.players[p];
    if (E().freeZone(P.spells) < 0) return null;
    const trap = P.hand.find((h) => C(h).kind === 'trap');
    if (trap) return { type: 'setST', player: p, uid: trap.uid };
    return null;
  }

  function mainAction(s, p) {
    return bestActivation(s, p) || bestSummon(s, p) || bestFlipOrPosition(s, p) || bestSet(s, p);
  }

  /* ---------- batalha ---------- */
  function battleAction(s, p) {
    const o = 1 - p;
    const attackers = E().monstersOf(s, p).filter((m) => E().canAttackWith(s, p, m)).sort((a, b) => E().getAtk(s, b) - E().getAtk(s, a));
    for (const m of attackers) {
      const opts = E().attackOptions(s, p, m);
      const atk = E().getAtk(s, m);
      const c = C(m);
      const pierce = c.kw && c.kw.includes('pierce');
      let best = null;
      if (opts.direct) best = { v: opts.targets.length ? atk / 25 : 1000, target: null };
      for (const u of opts.targets) {
        const t = E().locate(s, u).inst;
        let v = -1;
        if (!t.faceUp) v = atk >= 1700 ? 45 : atk >= 1500 ? 15 : -1;
        else if (t.pos === 'atk') {
          const ta = E().getAtk(s, t);
          if (atk > ta) v = 80 + ta / 20 + (atk - ta) / 30;
          else if (atk === ta && ta >= 2000) v = 20;
        } else {
          const td = E().getDef(s, t);
          if (atk > td) v = 50 + E().getAtk(s, t) / 30 + (pierce ? (atk - td) / 20 : 0);
        }
        if (v > 0 && (!best || v > best.v)) best = { v, target: u };
      }
      if (best) return { type: 'attack', player: p, uid: m.uid, target: best.target };
    }
    return null;
  }

  /* ---------- respostas (armadilhas) ---------- */
  const TRAP_PRIORITY = { attacker: 5, reflect: 4, debuff: 3, negate: 2 };
  function trapRank(c) {
    let r = 0;
    for (const op of c.ops) {
      if (op.op === 'destroy' && op.t === 'attacker') r = Math.max(r, TRAP_PRIORITY.attacker);
      if (op.op === 'reflect') r = Math.max(r, TRAP_PRIORITY.reflect);
      if (op.op === 'debuff') r = Math.max(r, TRAP_PRIORITY.debuff);
      if (op.op === 'negate') r = Math.max(r, TRAP_PRIORITY.negate);
    }
    return r;
  }

  function respond(s, p) {
    const pen = s.pending;
    const traps = pen.options.map((u) => E().locate(s, u).inst);
    if (pen.trigger === 'attack') {
      const A = E().locate(s, pen.ctx.attacker);
      if (!A) return { type: 'respond', player: p, uid: null };
      const atk = E().getAtk(s, A.inst);
      let harm = 0;
      if (pen.ctx.target == null) harm = atk;
      else {
        const T = E().locate(s, pen.ctx.target).inst;
        if (T.pos === 'atk' && T.faceUp) harm = atk > E().getAtk(s, T) ? atk - E().getAtk(s, T) + E().getAtk(s, T) : 0;
        else harm = atk > E().getDef(s, T) ? 400 + C(T).def / 4 : 0;
      }
      if (harm < 700 && atk < 1800) return { type: 'respond', player: p, uid: null };
      const sorted = traps.sort((a, b) => trapRank(C(b)) - trapRank(C(a)));
      for (const t of sorted) {
        const c = C(t);
        const deb = c.ops.find((op) => op.op === 'debuff');
        if (deb && pen.ctx.target != null) {
          const T = E().locate(s, pen.ctx.target).inst;
          const guard = T.faceUp ? (T.pos === 'atk' ? E().getAtk(s, T) : E().getDef(s, T)) : 1200;
          if (atk - deb.atk >= guard && pen.ctx.target != null) continue;
        }
        return { type: 'respond', player: p, uid: t.uid };
      }
      return { type: 'respond', player: p, uid: null };
    }
    if (pen.trigger === 'summon') {
      const M = E().locate(s, pen.ctx.uid);
      if (!M) return { type: 'respond', player: p, uid: null };
      const atk = E().getAtk(s, M.inst);
      const mc = C(M.inst);
      const worth = atk >= 1500 || mc.level >= 5 || !!mc.fx || !!mc.aura;
      if (worth) return { type: 'respond', player: p, uid: traps[0].uid };
      return { type: 'respond', player: p, uid: null };
    }
    return { type: 'respond', player: p, uid: null };
  }

  function choose(s, p) {
    if (s.winner !== null) return null;
    if (s.pending) return s.pending.player === p ? respond(s, p) : null;
    if (s.current !== p) return null;
    if (s.phase === 'main1' || s.phase === 'main2') {
      const a = mainAction(s, p);
      if (a) return a;
      if (s.phase === 'main1' && s.turn > 1 && E().monstersOf(s, p).some((m) => m.faceUp && m.pos === 'atk') && s.players[p].stunTurn !== s.turn) {
        return { type: 'phase', player: p, to: 'battle' };
      }
      return { type: 'endTurn', player: p };
    }
    if (s.phase === 'battle') return battleAction(s, p) || { type: 'phase', player: p, to: 'main2' };
    return { type: 'endTurn', player: p };
  }

  PD.AI = { choose };
})();
