/* Pixel Duel — motor de regras.
 * O estado é um objeto JSON puro: o anfitrião roda o motor e envia uma "visão"
 * (com cartas ocultas removidas) para o outro jogador. */
(function () {
  const PD = (window.PD = window.PD || {});
  const card = (inst) => (inst && inst.id ? PD.card(inst.id) : null);

  /* ---------- aleatoriedade determinística ---------- */
  function rand(s) {
    let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function shuffle(s, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand(s) * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];

  /* ---------- criação ---------- */
  function newInst(s, id, owner) {
    return { uid: s.uid++, id, owner, faceUp: false, pos: 'atk', atkMod: 0, defMod: 0, tmpAtk: 0, tmpDef: 0,
      summonedTurn: -1, setTurn: -1, posTurn: -1, atkTurn: -1, atkCount: 0 };
  }

  function createGame(opts) {
    const s = {
      v: 1, rng: (opts.seed >>> 0) || 1, uid: 1, turn: 1, current: opts.first || 0, phase: 'main1',
      winner: null, winReason: '', field: null, pending: null, log: [], logSeq: 0, events: [],
      players: [0, 1].map((p) => ({
        name: opts.names[p], lp: PD.RULES.startLP, deck: [], hand: [], grave: [],
        monsters: [null, null, null, null, null], spells: [null, null, null, null, null],
        normalSummoned: false, stunTurn: -1,
      })),
    };
    [0, 1].forEach((p) => {
      const P = s.players[p];
      P.deck = shuffle(s, opts.decks[p].map((id) => newInst(s, id, p)));
    });
    log(s, `O duelo começou! ${s.players[0].name} x ${s.players[1].name}.`);
    [0, 1].forEach((p) => drawCards(s, p, PD.RULES.startHand, true));
    beginTurn(s, true);
    s.events = [];
    return s;
  }

  /* ---------- utilidades ---------- */
  function log(s, text, kind) { s.log.push({ n: ++s.logSeq, turn: s.turn, text, kind: kind || '' }); }
  const ev = (s, e) => s.events.push(e);
  const opp = (p) => 1 - p;

  function locate(s, uid) {
    for (let p = 0; p < 2; p++) {
      const P = s.players[p];
      for (const zone of ['monsters', 'spells']) {
        const i = P[zone].findIndex((c) => c && c.uid === uid);
        if (i >= 0) return { p, zone, i, inst: P[zone][i] };
      }
      for (const zone of ['hand', 'grave']) {
        const i = P[zone].findIndex((c) => c && c.uid === uid);
        if (i >= 0) return { p, zone, i, inst: P[zone][i] };
      }
    }
    if (s.field && s.field.inst.uid === uid) return { p: s.field.owner, zone: 'field', i: 0, inst: s.field.inst };
    return null;
  }

  const monstersOf = (s, p) => s.players[p].monsters.filter(Boolean);
  const stOf = (s, p) => s.players[p].spells.filter(Boolean);
  const freeZone = (arr) => arr.findIndex((c) => !c);

  function fieldBonus(s, c, stat) {
    if (!s.field || !c) return 0;
    const f = card(s.field.inst);
    if (!f || !f.field) return 0;
    const ok = (f.field.attr && f.field.attr === c.attr) || (f.field.race && f.field.race === c.race);
    return ok ? f.field[stat] || 0 : 0;
  }

  function auraBonus(s, p, inst, c) {
    let b = 0;
    for (const o of monstersOf(s, p)) {
      if (o.uid === inst.uid || !o.faceUp) continue;
      const oc = card(o);
      if (oc && oc.aura && ((oc.aura.race && oc.aura.race === c.race) || (oc.aura.attr && oc.aura.attr === c.attr))) b += oc.aura.atk;
    }
    return b;
  }

  function controllerOf(s, inst) {
    for (let p = 0; p < 2; p++) if (s.players[p].monsters.some((m) => m && m.uid === inst.uid)) return p;
    return inst.owner;
  }

  function getAtk(s, inst) {
    const c = card(inst);
    if (!c || c.kind !== 'monster') return 0;
    let v = c.atk + (inst.atkMod || 0) + (inst.tmpAtk || 0);
    if (inst.faceUp) v += fieldBonus(s, c, 'atk') + auraBonus(s, controllerOf(s, inst), inst, c);
    return Math.max(0, v);
  }
  function getDef(s, inst) {
    const c = card(inst);
    if (!c || c.kind !== 'monster') return 0;
    let v = c.def + (inst.defMod || 0) + (inst.tmpDef || 0);
    if (inst.faceUp) v += fieldBonus(s, c, 'def');
    return Math.max(0, v);
  }

  function resetInst(inst) {
    Object.assign(inst, { faceUp: false, pos: 'atk', atkMod: 0, defMod: 0, tmpAtk: 0, tmpDef: 0,
      summonedTurn: -1, setTurn: -1, posTurn: -1, atkTurn: -1, atkCount: 0 });
  }

  function drawCards(s, p, n, silent) {
    const P = s.players[p];
    let drawn = 0;
    for (let i = 0; i < n && P.deck.length; i++) { P.hand.push(P.deck.pop()); drawn++; }
    if (drawn) {
      ev(s, { t: 'draw', p, n: drawn });
      if (!silent) log(s, `${P.name} comprou ${drawn === 1 ? '1 carta' : drawn + ' cartas'}.`);
    }
    return drawn;
  }

  function checkWin(s) {
    if (s.winner !== null) return true;
    const dead = [0, 1].filter((p) => s.players[p].lp <= 0);
    if (!dead.length) return false;
    if (dead.length === 2) { s.winner = 'draw'; s.winReason = 'Os dois jogadores chegaram a 0 PV.'; }
    else { s.winner = opp(dead[0]); s.winReason = `${s.players[dead[0]].name} chegou a 0 PV.`; }
    s.pending = null;
    ev(s, { t: 'win', winner: s.winner });
    log(s, s.winner === 'draw' ? 'Empate!' : `${s.players[s.winner].name} venceu o duelo!`, 'win');
    return true;
  }

  function damage(s, p, n) {
    if (n <= 0 || s.winner !== null) return;
    const P = s.players[p];
    P.lp = Math.max(0, P.lp - n);
    ev(s, { t: 'damage', p, n, lp: P.lp });
    log(s, `${P.name} sofreu ${n} de dano (${P.lp} PV).`, 'dmg');
    checkWin(s);
  }
  function heal(s, p, n) {
    const P = s.players[p];
    P.lp += n;
    ev(s, { t: 'heal', p, n, lp: P.lp });
    log(s, `${P.name} recuperou ${n} PV (${P.lp} PV).`, 'heal');
  }

  /** Remove uma carta do campo e manda ao Cemitério do dono. */
  function toGrave(s, uid) {
    const loc = locate(s, uid);
    if (!loc) return null;
    const { inst } = loc;
    if (loc.zone === 'field') s.field = null;
    else if (loc.zone === 'monsters' || loc.zone === 'spells') s.players[loc.p][loc.zone][loc.i] = null;
    else if (loc.zone === 'hand') s.players[loc.p].hand.splice(loc.i, 1);
    else return null;
    resetInst(inst);
    s.players[inst.owner].grave.push(inst);
    return { inst, p: loc.p, zone: loc.zone };
  }

  function destroy(s, uid, why) {
    const loc = locate(s, uid);
    if (!loc || !['monsters', 'spells', 'field'].includes(loc.zone)) return false;
    const c = card(loc.inst);
    const wasFaceUpMonster = loc.zone === 'monsters' && loc.inst.faceUp;
    toGrave(s, uid);
    ev(s, { t: 'destroy', p: loc.p, uid, id: loc.inst.id });
    log(s, `${c.name} (${s.players[loc.p].name}) foi destruído${why ? ' ' + why : ''}.`, 'destroy');
    if (wasFaceUpMonster && c.fx && c.fx.on === 'destroyed' && s.winner === null) {
      log(s, `Efeito de ${c.name}!`, 'fx');
      ev(s, { t: 'fx', p: loc.p, id: c.id });
      runOps(s, loc.p, c.fx.ops, { self: loc.inst });
    }
    return true;
  }

  /* ---------- turnos ---------- */
  function beginTurn(s, first) {
    const p = s.current;
    const P = s.players[p];
    P.normalSummoned = false;
    s.phase = 'main1';
    ev(s, { t: 'turn', p, turn: s.turn });
    log(s, `Turno ${s.turn} — ${P.name}`, 'turn');
    if (!first) {
      if (!P.deck.length) {
        s.winner = opp(p);
        s.winReason = `${P.name} não tinha cartas para comprar.`;
        ev(s, { t: 'win', winner: s.winner });
        log(s, `${P.name} ficou sem cartas no deck! ${s.players[s.winner].name} venceu.`, 'win');
        return;
      }
      drawCards(s, p, 1);
    }
  }

  function endTurn(s) {
    for (let p = 0; p < 2; p++) for (const m of monstersOf(s, p)) { m.tmpAtk = 0; m.tmpDef = 0; }
    s.current = opp(s.current);
    s.turn++;
    beginTurn(s, false);
  }

  /* ---------- efeitos ---------- */
  function chosenKind(c) {
    if (!c || !c.ops) return null;
    for (const op of c.ops) {
      if (op.op === 'revive') return op.from === 'any' ? 'graveAny' : 'graveOwn';
      if (op.t === 'oppMonster') return op.op === 'debuff' ? 'oppMonsterUp' : 'oppMonster';
      if (op.t === 'oppST') return 'oppST';
      if (op.t === 'ownMonster') return 'ownMonsterUp';
    }
    return null;
  }

  /** Alvos válidos (uids) para uma carta que pede escolha. */
  function validTargets(s, p, c) {
    const kind = chosenKind(c);
    const o = opp(p);
    switch (kind) {
      case 'oppMonster': return monstersOf(s, o).map((m) => m.uid);
      case 'oppMonsterUp': return monstersOf(s, o).filter((m) => m.faceUp).map((m) => m.uid);
      case 'oppST': return stOf(s, o).map((m) => m.uid);
      case 'ownMonsterUp': return monstersOf(s, p).filter((m) => m.faceUp).map((m) => m.uid);
      case 'graveOwn': return s.players[p].grave.filter((g) => card(g) && card(g).kind === 'monster').map((g) => g.uid);
      case 'graveAny': return [p, o].flatMap((q) => s.players[q].grave.filter((g) => card(g) && card(g).kind === 'monster').map((g) => g.uid));
    }
    return null;
  }

  function opUsable(s, p, op) {
    const o = opp(p);
    switch (op.op) {
      case 'destroy':
        if (op.t === 'allOppMonsters') return monstersOf(s, o).some((m) => m.faceUp && (!op.maxAtk || getAtk(s, m) <= op.maxAtk)) || (!op.maxAtk && monstersOf(s, o).length > 0);
        if (op.t === 'allMonsters') return monstersOf(s, 0).length + monstersOf(s, 1).length > 0;
        if (op.t === 'allST') return stOf(s, 0).length + stOf(s, 1).length > 0;
        return true;
      case 'buff': if (op.t === 'allOwn') return monstersOf(s, p).some((m) => m.faceUp); return true;
      case 'revive': return freeZone(s.players[p].monsters) >= 0;
      case 'stun': return true;
    }
    return true;
  }

  function runOps(s, p, ops, ctx) {
    const o = opp(p);
    for (const op of ops) {
      if (s.winner !== null) return;
      switch (op.op) {
        case 'damage': damage(s, o, op.n); break;
        case 'heal': heal(s, p, op.n); break;
        case 'draw': drawCards(s, p, op.n); break;
        case 'destroy': {
          let targets = [];
          if (op.t === 'oppMonster' || op.t === 'oppST') targets = ctx.target != null ? [ctx.target] : [];
          else if (op.t === 'randOppMonster') { const m = monstersOf(s, o); if (m.length) targets = [pick(s, m).uid]; }
          else if (op.t === 'randOppST') { const m = stOf(s, o); if (m.length) targets = [pick(s, m).uid]; }
          else if (op.t === 'attacker') targets = ctx.attacker != null ? [ctx.attacker] : [];
          else if (op.t === 'summoned') targets = ctx.summoned != null ? [ctx.summoned] : [];
          else if (op.t === 'allOppMonsters') targets = monstersOf(s, o).filter((m) => !op.maxAtk || (m.faceUp && getAtk(s, m) <= op.maxAtk)).map((m) => m.uid);
          else if (op.t === 'allMonsters') targets = [...monstersOf(s, 0), ...monstersOf(s, 1)].map((m) => m.uid);
          else if (op.t === 'allST') targets = [...stOf(s, 0), ...stOf(s, 1)].map((m) => m.uid);
          if (!targets.length) log(s, 'Nenhum alvo para destruir.');
          targets.forEach((u) => destroy(s, u, 'por efeito'));
          break;
        }
        case 'buff': {
          let list = [];
          if (op.t === 'ownMonster') { const l = locate(s, ctx.target); if (l && l.zone === 'monsters') list = [l.inst]; }
          else if (op.t === 'self' && ctx.self) list = [ctx.self];
          else if (op.t === 'allOwn') list = monstersOf(s, p).filter((m) => m.faceUp);
          for (const m of list) {
            if (op.temp) { m.tmpAtk += op.atk || 0; m.tmpDef += op.def || 0; }
            else { m.atkMod += op.atk || 0; m.defMod += op.def || 0; }
            ev(s, { t: 'buff', uid: m.uid, atk: op.atk || 0, def: op.def || 0 });
            log(s, `${card(m).name} ficou mais forte (${getAtk(s, m)} ATK).`);
          }
          break;
        }
        case 'debuff': {
          let list = [];
          if (op.t === 'oppMonster') { const l = locate(s, ctx.target); if (l && l.zone === 'monsters') list = [l.inst]; }
          else if (op.t === 'attacker') { const l = locate(s, ctx.attacker); if (l && l.zone === 'monsters') list = [l.inst]; }
          else if (op.t === 'summoned') { const l = locate(s, ctx.summoned); if (l && l.zone === 'monsters') list = [l.inst]; }
          else if (op.t === 'allOpp') list = monstersOf(s, o).filter((m) => m.faceUp);
          for (const m of list) {
            m.atkMod -= op.atk;
            ev(s, { t: 'buff', uid: m.uid, atk: -op.atk, def: 0 });
            log(s, `${card(m).name} perdeu ${op.atk} de ATK (${getAtk(s, m)} ATK).`);
          }
          break;
        }
        case 'revive': {
          const z = freeZone(s.players[p].monsters);
          const loc = locate(s, ctx.target);
          if (z < 0 || !loc || loc.zone !== 'grave') break;
          const inst = s.players[loc.p].grave.splice(loc.i, 1)[0];
          resetInst(inst);
          inst.faceUp = true; inst.pos = 'atk'; inst.summonedTurn = s.turn;
          s.players[p].monsters[z] = inst;
          ev(s, { t: 'summon', p, uid: inst.uid, id: inst.id, how: 'special' });
          log(s, `${s.players[p].name} trouxe ${card(inst).name} de volta do Cemitério!`, 'summon');
          ctx.revived = inst.uid;
          break;
        }
        case 'negate': ctx.negated = true; ev(s, { t: 'negate' }); log(s, 'O ataque foi negado!'); break;
        case 'endBattle': ctx.endBattle = true; break;
        case 'reflect': {
          const l = locate(s, ctx.attacker);
          ctx.negated = true;
          ev(s, { t: 'negate' });
          if (l) damage(s, l.p, Math.floor(getAtk(s, l.inst) / 2));
          break;
        }
        case 'stun':
          s.players[o].stunTurn = s.turn + 1;
          log(s, `${s.players[o].name} não poderá atacar no próximo turno.`);
          break;
      }
    }
  }

  function condOk(s, c, inst) {
    if (!c.cond || !inst) return true;
    const a = getAtk(s, inst);
    if (c.cond.minAtk != null && a < c.cond.minAtk) return false;
    if (c.cond.maxAtk != null && a > c.cond.maxAtk) return false;
    return true;
  }

  /** Armadilhas do jogador p que podem responder a um gatilho. */
  function respondableTraps(s, p, trigger, inst) {
    return s.players[p].spells.filter((st) => {
      if (!st || st.faceUp) return false;
      const c = card(st);
      return c && c.kind === 'trap' && c.trigger === trigger && st.setTurn < s.turn && condOk(s, c, inst);
    }).map((st) => st.uid);
  }

  function afterSummon(s, p, inst, how) {
    const o = opp(p);
    const traps = inst.faceUp ? respondableTraps(s, o, 'summon', inst) : [];
    if (traps.length) {
      s.pending = { type: 'respond', player: o, trigger: 'summon', options: traps, ctx: { kind: 'summon', p, uid: inst.uid, how } };
      ev(s, { t: 'prompt', p: o });
      return;
    }
    finishSummon(s, p, inst.uid, how);
  }

  function finishSummon(s, p, uid, how) {
    const loc = locate(s, uid);
    if (!loc || loc.zone !== 'monsters' || !loc.inst.faceUp || s.winner !== null) return;
    const c = card(loc.inst);
    const want = how === 'flip' ? 'flip' : how === 'normal' ? 'summon' : null;
    if (c.fx && want && c.fx.on === want) {
      log(s, `Efeito de ${c.name}!`, 'fx');
      ev(s, { t: 'fx', p, id: c.id });
      runOps(s, p, c.fx.ops, { self: loc.inst });
    }
  }

  /* ---------- batalha ---------- */
  function maxAttacks(inst) { const c = card(inst); return c && c.kw && c.kw.includes('double') ? 2 : 1; }
  function attacksLeft(s, inst) { return inst.atkTurn === s.turn ? maxAttacks(inst) - inst.atkCount : maxAttacks(inst); }

  function canAttackWith(s, p, inst) {
    if (s.current !== p || s.phase !== 'battle' || s.turn === 1) return false;
    if (s.players[p].stunTurn === s.turn) return false;
    return inst && inst.faceUp && inst.pos === 'atk' && attacksLeft(s, inst) > 0;
  }

  function attackOptions(s, p, inst) {
    if (!canAttackWith(s, p, inst)) return { targets: [], direct: false };
    const targets = monstersOf(s, opp(p)).map((m) => m.uid);
    const c = card(inst);
    const direct = targets.length === 0 || !!(c && c.kw && c.kw.includes('direct'));
    return { targets, direct };
  }

  function resolveBattle(s, p, attackerUid, targetUid) {
    const la = locate(s, attackerUid);
    if (!la || la.zone !== 'monsters' || la.p !== p || !la.inst.faceUp || la.inst.pos !== 'atk') {
      log(s, 'O ataque não aconteceu.');
      return;
    }
    const A = la.inst;
    const ac = card(A);
    const o = opp(p);
    if (targetUid == null) {
      ev(s, { t: 'attack', p, uid: A.uid, target: null });
      log(s, `${ac.name} atacou ${s.players[o].name} diretamente!`, 'atk');
      damage(s, o, getAtk(s, A));
      return;
    }
    const lt = locate(s, targetUid);
    if (!lt || lt.zone !== 'monsters' || lt.p !== o) { log(s, 'O alvo do ataque sumiu.'); return; }
    const D = lt.inst;
    ev(s, { t: 'attack', p, uid: A.uid, target: D.uid });
    let flipped = false;
    if (!D.faceUp) {
      D.faceUp = true;
      flipped = true;
      ev(s, { t: 'flip', p: o, uid: D.uid, id: D.id });
      log(s, `${card(D).name} foi revelado!`);
    }
    const dc = card(D);
    log(s, `${ac.name} (${getAtk(s, A)}) atacou ${dc.name} (${D.pos === 'atk' ? getAtk(s, D) + ' ATK' : getDef(s, D) + ' DEF'}).`, 'atk');
    const atk = getAtk(s, A);
    const kill = [];
    if (D.pos === 'atk') {
      const datk = getAtk(s, D);
      if (atk > datk) { kill.push(D.uid); damage(s, o, atk - datk); }
      else if (atk < datk) { kill.push(A.uid); damage(s, p, datk - atk); }
      else if (atk > 0) { kill.push(A.uid, D.uid); }
    } else {
      const ddef = getDef(s, D);
      if (atk > ddef) { kill.push(D.uid); if (ac.kw && ac.kw.includes('pierce')) damage(s, o, atk - ddef); }
      else if (atk < ddef) damage(s, p, ddef - atk);
    }
    kill.forEach((u) => destroy(s, u, 'em batalha'));
    if (flipped && dc.fx && dc.fx.on === 'flip' && s.winner === null) {
      log(s, `Efeito de VIRAR de ${dc.name}!`, 'fx');
      ev(s, { t: 'fx', p: o, id: dc.id });
      runOps(s, o, dc.fx.ops, { self: D });
    }
  }

  /* ---------- ações ---------- */
  const fail = (error) => ({ ok: false, error });
  const isMain = (s) => s.phase === 'main1' || s.phase === 'main2';

  function summonCheck(s, p, inst) {
    const c = card(inst);
    if (!c || c.kind !== 'monster') return { ok: false, why: 'Não é um monstro.' };
    if (s.current !== p || !isMain(s)) return { ok: false, why: 'Só na sua Fase Principal.' };
    if (s.players[p].normalSummoned) return { ok: false, why: 'Você já invocou neste turno.' };
    const need = PD.tributesFor(c.level);
    const have = monstersOf(s, p).length;
    if (have < need) return { ok: false, why: `Precisa de ${need} monstro(s) para sacrificar.`, need };
    if (need === 0 && have >= 5) return { ok: false, why: 'Sem espaço no campo.', need };
    return { ok: true, need };
  }

  function activateCheck(s, p, inst, fromField) {
    const c = card(inst);
    if (!c || c.kind === 'monster') return { ok: false, why: 'Não pode ser ativada.' };
    if (s.current !== p || !isMain(s)) return { ok: false, why: 'Só na sua Fase Principal.' };
    if (c.kind === 'trap') {
      if (!fromField) return { ok: false, why: 'Armadilhas precisam ser baixadas primeiro.' };
      if (c.trigger !== 'manual') return { ok: false, why: 'Esta armadilha ativa sozinha quando o gatilho acontece.' };
      if (inst.setTurn >= s.turn) return { ok: false, why: 'Espere até o próximo turno para ativá-la.' };
    }
    if (c.sub === 'field') return { ok: true, kind: null, targets: null };
    for (const op of c.ops) if (!opUsable(s, p, op)) return { ok: false, why: 'Não há alvos para este efeito.' };
    const targets = validTargets(s, p, c);
    if (targets && !targets.length) return { ok: false, why: 'Não há alvos válidos.' };
    return { ok: true, kind: chosenKind(c), targets };
  }

  const handlers = {
    summon(s, a) {
      const P = s.players[a.player];
      const hi = P.hand.findIndex((h) => h.uid === a.uid);
      if (hi < 0) return fail('Carta não está na mão.');
      const inst = P.hand[hi];
      const chk = summonCheck(s, a.player, inst);
      if (!chk.ok) return fail(chk.why);
      const trib = [...new Set(a.tributes || [])];
      if (trib.length !== chk.need) return fail(`Escolha ${chk.need} monstro(s) para sacrificar.`);
      for (const u of trib) if (!P.monsters.some((m) => m && m.uid === u)) return fail('Sacrifício inválido.');
      const c = card(inst);
      if (trib.length) {
        const names = trib.map((u) => card(locate(s, u).inst).name);
        trib.forEach((u) => toGrave(s, u));
        ev(s, { t: 'tribute', p: a.player, uids: trib });
        log(s, `${P.name} sacrificou ${names.join(' e ')}.`);
      }
      const z = freeZone(P.monsters);
      if (z < 0) return fail('Sem espaço no campo.');
      P.hand.splice(P.hand.findIndex((h) => h.uid === a.uid), 1);
      const set = a.mode === 'set';
      inst.faceUp = !set; inst.pos = set ? 'def' : 'atk'; inst.summonedTurn = s.turn; inst.setTurn = s.turn;
      P.monsters[z] = inst;
      P.normalSummoned = true;
      if (set) {
        ev(s, { t: 'set', p: a.player, uid: inst.uid, kind: 'monster' });
        log(s, `${P.name} baixou um monstro em defesa.`);
      } else {
        ev(s, { t: 'summon', p: a.player, uid: inst.uid, id: inst.id, how: 'normal' });
        log(s, `${P.name} invocou ${c.name} (${c.atk}/${c.def}).`, 'summon');
        afterSummon(s, a.player, inst, 'normal');
      }
      return { ok: true };
    },

    flipSummon(s, a) {
      const loc = locate(s, a.uid);
      if (!loc || loc.zone !== 'monsters' || loc.p !== a.player) return fail('Monstro inválido.');
      const inst = loc.inst;
      if (s.current !== a.player || !isMain(s)) return fail('Só na sua Fase Principal.');
      if (inst.faceUp) return fail('Já está com a face para cima.');
      if (inst.setTurn === s.turn) return fail('Não pode virar no mesmo turno em que foi baixado.');
      inst.faceUp = true; inst.pos = 'atk'; inst.posTurn = s.turn;
      ev(s, { t: 'flip', p: a.player, uid: inst.uid, id: inst.id });
      ev(s, { t: 'summon', p: a.player, uid: inst.uid, id: inst.id, how: 'flip' });
      log(s, `${s.players[a.player].name} virou ${card(inst).name}!`, 'summon');
      afterSummon(s, a.player, inst, 'flip');
      return { ok: true };
    },

    changePos(s, a) {
      const loc = locate(s, a.uid);
      if (!loc || loc.zone !== 'monsters' || loc.p !== a.player) return fail('Monstro inválido.');
      const inst = loc.inst;
      if (s.current !== a.player || !isMain(s)) return fail('Só na sua Fase Principal.');
      if (!inst.faceUp) return fail('Use "Virar" para monstros baixados.');
      if (inst.summonedTurn === s.turn) return fail('Não pode mudar a posição no turno em que foi invocado.');
      if (inst.posTurn === s.turn) return fail('Já mudou de posição neste turno.');
      if (inst.atkTurn === s.turn) return fail('Já atacou neste turno.');
      inst.pos = inst.pos === 'atk' ? 'def' : 'atk';
      inst.posTurn = s.turn;
      ev(s, { t: 'pos', p: a.player, uid: inst.uid, pos: inst.pos });
      log(s, `${card(inst).name} foi para ${inst.pos === 'atk' ? 'Ataque' : 'Defesa'}.`);
      return { ok: true };
    },

    setST(s, a) {
      const P = s.players[a.player];
      const hi = P.hand.findIndex((h) => h.uid === a.uid);
      if (hi < 0) return fail('Carta não está na mão.');
      const inst = P.hand[hi];
      const c = card(inst);
      if (c.kind === 'monster') return fail('Monstros não vão para essa zona.');
      if (c.sub === 'field') return fail('Magias de Campo são ativadas direto.');
      if (s.current !== a.player || !isMain(s)) return fail('Só na sua Fase Principal.');
      const z = freeZone(P.spells);
      if (z < 0) return fail('Zona de Magias/Armadilhas cheia.');
      P.hand.splice(hi, 1);
      inst.faceUp = false; inst.setTurn = s.turn;
      P.spells[z] = inst;
      ev(s, { t: 'set', p: a.player, uid: inst.uid, kind: 'st' });
      log(s, `${P.name} baixou uma carta.`);
      return { ok: true };
    },

    activate(s, a) {
      const p = a.player;
      const P = s.players[p];
      const loc = locate(s, a.uid);
      if (!loc || loc.p !== p || !['hand', 'spells'].includes(loc.zone)) return fail('Carta inválida.');
      const inst = loc.inst;
      if (loc.zone === 'spells' && inst.faceUp) return fail('Já está ativa.');
      const chk = activateCheck(s, p, inst, loc.zone === 'spells');
      if (!chk.ok) return fail(chk.why);
      if (chk.targets && !chk.targets.includes(a.target)) return fail('Escolha um alvo válido.');
      const c = card(inst);
      // tira a carta da mão/zona enquanto resolve
      if (loc.zone === 'hand') P.hand.splice(loc.i, 1); else P.spells[loc.i] = null;
      ev(s, { t: 'activate', p, uid: inst.uid, id: inst.id });
      log(s, `${P.name} ativou ${c.name}!`, 'act');
      if (c.sub === 'field') {
        if (s.field) {
          const old = s.field;
          s.field = null;
          resetInst(old.inst);
          s.players[old.inst.owner].grave.push(old.inst);
        }
        inst.faceUp = true;
        s.field = { inst, owner: p };
        ev(s, { t: 'field', p, id: c.id });
        return { ok: true };
      }
      const ctx = { target: a.target, self: inst };
      runOps(s, p, c.ops, ctx);
      resetInst(inst);
      P.grave.push(inst);
      if (ctx.revived != null && s.winner === null) {
        const r = locate(s, ctx.revived);
        if (r) afterSummon(s, p, r.inst, 'special');
      }
      return { ok: true };
    },

    attack(s, a) {
      const p = a.player;
      const loc = locate(s, a.uid);
      if (!loc || loc.zone !== 'monsters' || loc.p !== p) return fail('Monstro inválido.');
      const inst = loc.inst;
      if (!canAttackWith(s, p, inst)) {
        if (s.players[p].stunTurn === s.turn) return fail('Você não pode atacar neste turno.');
        return fail('Este monstro não pode atacar agora.');
      }
      const optn = attackOptions(s, p, inst);
      if (a.target == null ? !optn.direct : !optn.targets.includes(a.target)) return fail('Alvo inválido.');
      if (inst.atkTurn !== s.turn) { inst.atkTurn = s.turn; inst.atkCount = 0; }
      inst.atkCount++;
      const o = opp(p);
      ev(s, { t: 'declare', p, uid: inst.uid, target: a.target == null ? null : a.target });
      const traps = respondableTraps(s, o, 'attack', inst);
      if (traps.length) {
        s.pending = { type: 'respond', player: o, trigger: 'attack', options: traps, ctx: { kind: 'attack', p, attacker: inst.uid, target: a.target == null ? null : a.target } };
        ev(s, { t: 'prompt', p: o });
        log(s, `${card(inst).name} declarou um ataque...`);
        return { ok: true };
      }
      resolveBattle(s, p, inst.uid, a.target == null ? null : a.target);
      return { ok: true };
    },

    respond(s, a) {
      const pen = s.pending;
      if (!pen || pen.player !== a.player) return fail('Nada para responder.');
      const ctx = pen.ctx;
      s.pending = null;
      const tctx = {};
      if (a.uid != null) {
        if (!pen.options.includes(a.uid)) { s.pending = pen; return fail('Armadilha inválida.'); }
        const loc = locate(s, a.uid);
        const P = s.players[a.player];
        const inst = loc.inst;
        const c = card(inst);
        P.spells[loc.i] = null;
        ev(s, { t: 'activate', p: a.player, uid: inst.uid, id: inst.id });
        log(s, `${P.name} ativou a armadilha ${c.name}!`, 'act');
        if (ctx.kind === 'attack') { tctx.attacker = ctx.attacker; }
        if (ctx.kind === 'summon') { tctx.summoned = ctx.uid; }
        runOps(s, a.player, c.ops, tctx);
        resetInst(inst);
        P.grave.push(inst);
      }
      if (s.winner !== null) return { ok: true };
      if (ctx.kind === 'attack') {
        if (tctx.endBattle) { s.phase = 'main2'; ev(s, { t: 'phase', p: s.current, phase: 'main2' }); log(s, 'A Fase de Batalha terminou.'); }
        if (!tctx.negated) resolveBattle(s, ctx.p, ctx.attacker, ctx.target);
      } else if (ctx.kind === 'summon') {
        finishSummon(s, ctx.p, ctx.uid, ctx.how);
      }
      return { ok: true };
    },

    phase(s, a) {
      if (s.current !== a.player) return fail('Não é o seu turno.');
      if (a.to === 'battle') {
        if (s.phase !== 'main1') return fail('Só da Fase Principal 1.');
        if (s.turn === 1) return fail('Quem começa não pode atacar no primeiro turno.');
      } else if (a.to === 'main2') {
        if (s.phase !== 'battle') return fail('Só da Fase de Batalha.');
      } else return fail('Fase inválida.');
      s.phase = a.to;
      ev(s, { t: 'phase', p: a.player, phase: a.to });
      return { ok: true };
    },

    endTurn(s, a) {
      if (s.current !== a.player) return fail('Não é o seu turno.');
      endTurn(s);
      return { ok: true };
    },

    surrender(s, a) {
      s.winner = opp(a.player);
      s.winReason = `${s.players[a.player].name} desistiu.`;
      s.pending = null;
      ev(s, { t: 'win', winner: s.winner });
      log(s, `${s.players[a.player].name} desistiu do duelo.`, 'win');
      return { ok: true };
    },
  };

  function apply(s, a) {
    s.events = [];
    if (!a || !handlers[a.type]) return fail('Ação desconhecida.');
    if (s.winner !== null) return fail('O duelo acabou.');
    if (a.player !== 0 && a.player !== 1) return fail('Jogador inválido.');
    if (s.pending && a.type !== 'respond' && a.type !== 'surrender') return fail('Aguardando a resposta do oponente.');
    const r = handlers[a.type](s, a);
    if (r.ok) r.events = s.events.slice();
    return r;
  }

  /** Cópia do estado do ponto de vista do jogador p (esconde mão e cartas baixadas do oponente). */
  function viewFor(s, p) {
    const v = JSON.parse(JSON.stringify(s));
    delete v.rng;
    delete v.events;
    const hide = (c) => ({ uid: c.uid, hidden: true, faceUp: false, pos: c.pos, setTurn: c.setTurn, summonedTurn: c.summonedTurn, owner: c.owner });
    v.players.forEach((P, q) => {
      P.deckCount = P.deck.length;
      P.deck = [];
      if (q !== p) {
        P.hand = P.hand.map(hide);
        P.monsters = P.monsters.map((m) => (m && !m.faceUp ? hide(m) : m));
        P.spells = P.spells.map((m) => (m && !m.faceUp ? hide(m) : m));
      }
    });
    if (v.pending && v.pending.player !== p) v.pending = { type: v.pending.type, player: v.pending.player, trigger: v.pending.trigger, ctx: v.pending.ctx };
    v.me = p;
    return v;
  }

  PD.Engine = {
    createGame, apply, viewFor, getAtk, getDef, locate, card,
    summonCheck, activateCheck, attackOptions, canAttackWith, attacksLeft, validTargets, chosenKind,
    monstersOf, stOf, freeZone, respondableTraps,
  };
})();
