/* Prancheta FC — partida ao vivo: lances, narração e desenho do campo (pixel art ou 3D) */

const MS_POR_MIN = 780; // 1 minuto de jogo = 0,7 s na velocidade 1x

function kitsDoJogo(h, a) {
  const kh = CL[h].kit; let ka = CL[a].kit;
  const d = (x, y) => { const A = hexRgb(x), B = hexRgb(y); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
  if (d(kh.c1, ka.c1) < 90 || (kh.pad === ka.pad && kh.pad !== 'solid' && d(kh.c2, ka.c2) < 90)) {
    const alt = lum(kh.c1) > 0.6 ? (lum(ka.c2) < 0.5 ? ka.c2 : '#1D2B53') : (lum(ka.c2) > 0.6 ? ka.c2 : '#F4F4F4');
    ka = { pad: 'solid', c1: alt, c2: ka.c1, c3: alt, c4: ka.c1 };
  }
  return [kh, ka];
}

class Partida {
  constructor(h, a, seed) {
    this.ids = [h, a];
    this.r = rng(seed);
    this.min = 0; this.placar = [0, 0]; this.gols = [];
    this.stats = { posse: [0, 0], chutes: [0, 0], noGol: [0, 0], cart: [0, 0], esc: [0, 0] };
    this.narr = []; this.fase = 'pre'; this.acrescimo = [2 + Math.floor(this.r() * 3), 3 + Math.floor(this.r() * 4)];
    this.subs = 0; this.kits = kitsDoJogo(h, a); this.tUser = h === S.clube ? 0 : 1;
    this.amarelos = new Set();
    this.montarJogadores();
    this.ball = { x: .5, y: .5, z: 0 }; this.posse = 0; this.portador = null; this.acao = null; this.pausa = 0;
    this.saidaDeBola(0);
  }
  tatica(t) { return S.cl[this.ids[t]].tatica; }
  forca(t) { const f = forcaTime(this.ids[t]); if (t === 0) { f.ata += 1.5; f.mei += 1; f.def += 1; } return f; }
  montarJogadores() {
    this.pl = [];
    for (let t = 0; t < 2; t++) {
      const tat = this.tatica(t); const slots = FORMACOES[tat.formacao];
      tat.tit.forEach((id, i) => {
        const j = S.jog[id]; if (!j) return;
        const [pos, bx, by] = slots[i];
        const p = { j, t, slot: pos, bx, by, x: 0, y: 0, vx: 0, mov: 0 };
        this.colocar(p, true); this.pl.push(p);
      });
    }
  }
  campo(t, x, y) { return t === 0 ? [x, y] : [1 - x, 1 - y]; } // coordenada do time → campo
  local(t, x, y) { return t === 0 ? [x, y] : [1 - x, 1 - y]; }
  colocar(p, ini) {
    const [x, y] = this.campo(p.t, ini ? p.bx * 0.5 : p.bx, p.by);
    p.x = x; p.y = y;
  }
  saidaDeBola(t) {
    this.posse = t; this.ball = { x: .5, y: .5, z: 0 };
    this.pl.forEach(p => this.colocar(p, true));
    const ata = this.pl.filter(p => p.t === t && p.slot !== 'GOL').sort((a, b) => b.bx - a.bx)[0];
    if (ata) { ata.x = .5; ata.y = .5; this.portador = ata; }
  }
  jogadoresDo(t) { return this.pl.filter(p => p.t === t); }
  goleiro(t) { return this.pl.find(p => p.t === t && p.slot === 'GOL') || this.jogadoresDo(t)[0]; }
  maisProximo(t, x, y, exceto) {
    let best = null, bd = 9;
    for (const p of this.pl) { if (p.t !== t || p === exceto || p.slot === 'GOL') continue; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
    return best || this.goleiro(t);
  }
  falar(txt, tipo) { this.narr.unshift({ min: Math.min(90 + this.acrescimo[1], Math.max(1, Math.ceil(this.min))), txt, tipo: tipo || '' }); if (this.narr.length > 60) this.narr.pop(); }
  nomeT(t) { return CL[this.ids[t]].nome; }

  // decide o próximo lance a partir de quem está com a bola
  proximaAcao() {
    const r = this.r; const c = this.portador; const t = c.t, o = 1 - t;
    const F = this.forca(t), G = this.forca(o);
    const [bx, by] = this.local(t, this.ball.x, this.ball.y);
    const post = this.tatica(t).postura;
    const zona = bx < .36 ? 'def' : bx < .68 ? 'mei' : 'ata';
    let pChute = zona === 'ata' ? .42 + (bx - .68) * 1.0 : zona === 'mei' && bx > .55 ? .09 : 0;
    if (post === 'ofensiva') pChute += .05; if (post === 'defensiva') pChute -= .03;
    if (c.slot === 'GOL') pChute = 0;
    const pConduz = zona === 'def' ? .12 : zona === 'mei' ? .26 : .22;
    const x = r();
    if (x < pChute) return this.acaoChute(c, F, G, bx, by);
    if (x < pChute + pConduz) return this.acaoConduzir(c, F, G, bx, by);
    return this.acaoPasse(c, F, G, bx, by);
  }
  acaoPasse(c, F, G, bx, by) {
    const r = this.r, t = c.t, o = 1 - t;
    const comp = this.jogadoresDo(t).filter(p => p !== c);
    const cands = comp.map(p => { const [px, py] = this.local(t, p.x, p.y); const ad = px - bx; const dist = Math.hypot(px - bx, py - by); let w = Math.max(.05, 1 + ad * 4) * Math.exp(-Math.abs(dist - .22) * 4); if (p.slot === 'GOL') w *= bx < .3 ? .4 : .02; return { p, w }; });
    const tot = cands.reduce((s, k) => s + k.w, 0); let z = r() * tot; let alvo = cands[0].p;
    for (const k of cands) { z -= k.w; if (z <= 0) { alvo = k.p; break; } }
    const [ax, ay] = this.local(t, alvo.x, alvo.y);
    const dest = this.campo(t, Math.min(.97, ax + .03 + r() * .05), Math.max(.04, Math.min(.96, ay + (r() - .5) * .08)));
    const pOk = clamp(.84 + (F.mei - G.mei) / 220 + (F.ata - G.def) / 320 - (bx > .66 ? .1 : 0) - (this.tatica(o).marcacao === 'pressao' ? .04 : 0), .55, .95);
    const ok = r() < pOk;
    const dist = Math.hypot(dest[0] - this.ball.x, dest[1] - this.ball.y);
    const longo = dist > .32;
    if (ok) return { tipo: 'passe', de: c, para: alvo, dest, dur: 260 + dist * 820, alto: longo };
    const meio = [this.ball.x + (dest[0] - this.ball.x) * (.45 + r() * .4), this.ball.y + (dest[1] - this.ball.y) * (.45 + r() * .4)];
    const ladrao = this.maisProximo(o, meio[0], meio[1]);
    return { tipo: 'interceptado', de: c, para: ladrao, dest: meio, dur: 240 + dist * 600, alto: longo };
  }
  acaoConduzir(c, F, G, bx, by) {
    const r = this.r, t = c.t, o = 1 - t;
    const nx = Math.min(.95, bx + .07 + r() * .08), ny = clamp(by + (r() - .5) * .16, .06, .94);
    const dest = this.campo(t, nx, ny);
    const pOk = clamp(.72 + ((c.j.attrs.dri + c.j.ovr) / 2 - G.def) / 170, .5, .88);
    const ok = r() < pOk;
    const marc = this.maisProximo(o, dest[0], dest[1]);
    if (ok) return { tipo: 'conduz', de: c, para: c, dest, dur: 420 + r() * 200, drible: r() < .3, marc };
    const falta = r() < .16;
    return { tipo: falta ? 'falta' : 'desarme', de: c, para: falta ? c : marc, dest: [(this.ball.x + dest[0]) / 2, (this.ball.y + dest[1]) / 2], dur: 420, marc };
  }
  acaoChute(c, F, G, bx, by) {
    const r = this.r, t = c.t, o = 1 - t;
    const gk = this.goleiro(o);
    const dist = Math.hypot(1 - bx, .5 - by);
    const fin = (c.j.attrs.fin * .65 + c.j.ovr * .35);
    const gkv = gk.j.pos === 'GOL' ? (gk.j.attrs.gol * .6 + gk.j.ovr * .4) : 35;
    const pAlvo = clamp(.53 + (fin - 72) / 150 - dist * .5, .22, .78);
    const pGol = clamp(.44 + (fin - gkv) / 160 - dist * .6 + (F.ata - G.def) / 220, .1, .58);
    const x = r();
    let res = 'fora';
    if (x < pAlvo) res = r() < pGol ? 'gol' : 'defesa';
    else if (r() < .25) res = 'bloqueio';
    const gy = .5 + (r() - .5) * (res === 'fora' ? .3 : .1);
    const dest = this.campo(t, res === 'bloqueio' ? bx + .05 : 1.0, res === 'bloqueio' ? by : gy);
    return { tipo: 'chute', de: c, gk, res, dest, dur: 360 + dist * 600, alto: true, dist };
  }

  iniciarAcao() {
    if (this.fase !== 'jogo') return;
    this.acao = this.proximaAcao(); this.acao.t0 = 0; this.acao.de0 = { x: this.ball.x, y: this.ball.y };
    const a = this.acao;
    if (a.tipo === 'chute') {
      this.stats.chutes[a.de.t]++; if (a.res === 'gol' || a.res === 'defesa') this.stats.noGol[a.de.t]++;
      const longe = a.dist > .3;
      if (a.res !== 'gol') this.falar(longe ? `${a.de.j.nome} arrisca de longe...` : `${a.de.j.nome} finaliza!`, 'chance');
    }
    if (a.tipo === 'passe' && this.r() < .1) this.falar(`${a.de.j.nome} toca para ${a.para.j.nome}.`);
    if (a.tipo === 'conduz' && a.drible) this.falar(`${a.de.j.nome} passa pelo marcador!`);
  }
  concluirAcao() {
    const a = this.acao; const r = this.r; this.acao = null;
    this.ball.x = a.dest[0]; this.ball.y = a.dest[1]; this.ball.z = 0;
    switch (a.tipo) {
      case 'passe': this.portador = a.para; a.para.x = this.ball.x; a.para.y = this.ball.y; break;
      case 'conduz': this.portador = a.de; break;
      case 'interceptado': this.posse = a.para.t; this.portador = a.para; if (r() < .25) this.falar(`${a.para.j.nome} intercepta o passe.`); break;
      case 'desarme': this.posse = a.para.t; this.portador = a.para; if (r() < .35) this.falar(`Bom desarme de ${a.para.j.nome}.`); break;
      case 'falta': {
        const inf = a.marc; const t = inf.t;
        if (r() < .3) {
          this.stats.cart[t]++;
          if (this.amarelos.has(inf.j.id)) { this.falar(`Segundo amarelo para ${inf.j.nome}! ${this.nomeT(t)} com um a menos.`, 'cartao'); this.pl = this.pl.filter(p => p !== inf); }
          else { this.amarelos.add(inf.j.id); this.falar(`Falta de ${inf.j.nome}. Cartão amarelo.`, 'cartao'); }
        } else this.falar(`Falta de ${inf.j.nome} em ${a.de.j.nome}.`);
        this.portador = a.de; this.pausa = 500; break;
      }
      case 'chute': this.resolverChute(a); break;
    }
  }
  resolverChute(a) {
    const t = a.de.t, o = 1 - t;
    if (a.res === 'gol') {
      this.placar[t]++; const m = Math.ceil(this.min);
      this.gols.push({ min: Math.min(m, 90), clube: this.ids[t], jog: a.de.j.id });
      this.falar(`GOOOOL! ${a.de.j.nome} marca para o ${this.nomeT(t)}! ${this.placar[0]} × ${this.placar[1]}`, 'gol');
      this.comemorando = { t, ate: 2200, jog: a.de };
      this.pausa = 2200; this.aposPausa = () => this.saidaDeBola(o);
      return;
    }
    if (a.res === 'defesa') {
      if (this.r() < .4) { this.stats.esc[t]++; this.falar(`${a.gk.j.nome} espalma para escanteio!`, 'chance'); const [cx, cy] = this.campo(t, .98, this.r() < .5 ? .03 : .97); this.ball.x = cx; this.ball.y = cy; this.posse = t; this.portador = this.maisProximo(t, cx, cy); this.portador.x = cx; this.portador.y = cy; this.pausa = 600; return; }
      this.falar(`Defesa de ${a.gk.j.nome}!`, 'chance');
    } else if (a.res === 'bloqueio') this.falar('A zaga bloqueia o chute.');
    else this.falar('Para fora.');
    this.posse = o; this.portador = a.res === 'bloqueio' ? this.maisProximo(o, this.ball.x, this.ball.y) : a.gk;
    if (a.res !== 'bloqueio') { const [gx, gy] = this.campo(o, .06, .5); this.ball.x = gx; this.ball.y = gy; a.gk.x = gx; a.gk.y = gy; this.pausa = 450; }
  }

  // avança a simulação dt milissegundos (já multiplicados pela velocidade)
  passo(dt) {
    if (this.fase !== 'jogo') { this.moverJogadores(dt); return; }
    this.min += dt / MS_POR_MIN;
    this.stats.posse[this.posse] += dt;
    if (this.comemorando) { this.comemorando.ate -= dt; if (this.comemorando.ate <= 0) this.comemorando = null; }
    if (this.pausa > 0) { this.pausa -= dt; if (this.pausa <= 0 && this.aposPausa) { this.aposPausa(); this.aposPausa = null; } this.moverJogadores(dt); return; }
    const fimTempo = this.tempo === 1 ? 45 + this.acrescimo[0] : 90 + this.acrescimo[1];
    if (!this.acao && this.min >= fimTempo) {
      if (this.tempo === 1) { this.fase = 'intervalo'; this.falar(`Fim do primeiro tempo: ${this.nomeT(0)} ${this.placar[0]} × ${this.placar[1]} ${this.nomeT(1)}.`, 'apito'); }
      else { this.fase = 'fim'; this.falar(`Fim de jogo! ${this.nomeT(0)} ${this.placar[0]} × ${this.placar[1]} ${this.nomeT(1)}.`, 'apito'); }
      return;
    }
    if (!this.acao) this.iniciarAcao();
    const a = this.acao; if (!a) return;
    a.t0 += dt; const k = Math.min(1, a.t0 / a.dur);
    this.ball.x = a.de0.x + (a.dest[0] - a.de0.x) * k; this.ball.y = a.de0.y + (a.dest[1] - a.de0.y) * k;
    this.ball.z = a.alto ? Math.sin(k * Math.PI) * (a.tipo === 'chute' ? .05 : .09) : 0;
    if (a.tipo === 'conduz') { a.de.x = this.ball.x; a.de.y = this.ball.y; }
    this.moverJogadores(dt);
    if (k >= 1) this.concluirAcao();
  }
  alvoDe(p) {
    const t = p.t; const atacando = this.posse === t;
    const [bx, by] = this.local(t, this.ball.x, this.ball.y);
    if (this.comemorando && this.comemorando.t === t && p !== this.comemorando.jog) { const c = this.comemorando.jog; return [c.x + (p.bx - .5) * .08, c.y + (p.by - .5) * .1]; }
    if (p.slot === 'GOL') return this.campo(t, .035 + bx * .05, .5 + (by - .5) * .25);
    let tx = p.bx * .6 + bx * .4 + (atacando ? .07 : -.06);
    let ty = p.by * .78 + by * .22;
    if (!atacando) { const press = this.pressionadores || []; if (press.includes(p)) { tx = bx - .02; ty = by; } }
    if (this.acao && this.acao.para === p && this.acao.tipo === 'passe') return this.acao.dest;
    return this.campo(t, clamp(tx, .04, .96), clamp(ty, .04, .96));
  }
  moverJogadores(dt) {
    const def = 1 - this.posse;
    this.pressionadores = this.pl.filter(p => p.t === def && p.slot !== 'GOL').sort((a, b) => Math.hypot(a.x - this.ball.x, a.y - this.ball.y) - Math.hypot(b.x - this.ball.x, b.y - this.ball.y)).slice(0, 2);
    const v = 0.00032 * dt;
    for (const p of this.pl) {
      if (this.portador === p && (!this.acao || this.acao.tipo === 'conduz')) { p.mov = this.acao ? 1 : 0; continue; }
      const [tx, ty] = this.alvoDe(p); const dx = tx - p.x, dy = ty - p.y; const d = Math.hypot(dx, dy);
      if (d > .004) { const s = Math.min(d, v * (d > .1 ? 1.3 : 1)); p.x += dx / d * s; p.y += dy / d * s; p.mov = 1; p.vx = dx; } else p.mov = 0;
    }
  }
  comecar() { this.fase = 'jogo'; this.tempo = 1; this.falar(`Rola a bola no ${CL[this.ids[0]].estadio}!`, 'apito'); }
  segundoTempo() { this.fase = 'jogo'; this.tempo = 2; this.min = 45; this.saidaDeBola(1); this.falar('Começa o segundo tempo.', 'apito'); }
  // termina o jogo sem animação
  simularAteOFim() {
    let guard = 0;
    if (this.fase === 'pre') this.comecar();
    while (this.fase !== 'fim' && guard++ < 200000) {
      if (this.fase === 'intervalo') { this.segundoTempo(); continue; }
      this.passo(this.acao ? this.acao.dur : 120);
    }
  }
  substituir(saiId, entraId) {
    const p = this.pl.find(x => x.j.id === saiId && x.t === this.tUser); const e = S.jog[entraId]; if (!p || !e) return false;
    const tat = S.cl[S.clube].tatica; const i = tat.tit.indexOf(saiId); if (i >= 0) tat.tit[i] = entraId;
    this.falar(`Substituição no ${this.nomeT(p.t)}: sai ${p.j.nome}, entra ${e.nome}.`, 'sub');
    p.j = e; this.subs++; return true;
  }
  resultado() { return { h: this.ids[0], a: this.ids[1], gh: this.placar[0], ga: this.placar[1], gols: this.gols.slice() }; }
  posseP() { const s = this.stats.posse[0] + this.stats.posse[1] || 1; return [Math.round(this.stats.posse[0] / s * 100), 100 - Math.round(this.stats.posse[0] / s * 100)]; }
}

// ---------- desenho ----------
class CampoView {
  constructor(canvas, partida, estilo) { this.cv = canvas; this.p = partida; this.estilo = estilo; this.t = 0; this.prep(); }
  prep() {
    const kits = this.p.kits;
    this.frames = new Map();
    for (const pl of this.p.pl) this.frames.set(pl.j.id, quadrosPartida(pl.j, pl.slot === 'GOL' ? kitGoleiro(kits[pl.t]) : kits[pl.t], this.estilo));
    if (this.estilo === 'pixel') { this.cv.width = 400; this.cv.height = 250; this.fundo = this.fundoPixel(); }
    else this.redimensionar();
  }
  framesDe(pl) {
    if (!this.frames.has(pl.j.id)) this.frames.set(pl.j.id, quadrosPartida(pl.j, pl.slot === 'GOL' ? kitGoleiro(this.p.kits[pl.t]) : this.p.kits[pl.t], this.estilo));
    return this.frames.get(pl.j.id);
  }
  redimensionar() {
    if (this.estilo === 'pixel') return;
    const w = Math.max(320, this.cv.clientWidth || 800); const dpr = Math.min(2, window.devicePixelRatio || 1);
    const h = Math.round(w * 0.58);
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr); this.dpr = dpr; this.W = w; this.H = h;
    this.fundo = this.fundo3D();
  }
  // ----- pixel -----
  px(x, y) { return [20 + x * 360, 34 + y * 196]; }
  fundoPixel() {
    const c = document.createElement('canvas'); c.width = 400; c.height = 250; const g = c.getContext('2d');
    const r = rng(42);
    g.fillStyle = '#20243A'; g.fillRect(0, 0, 400, 250);
    const k0 = this.p.kits[0], k1 = this.p.kits[1];
    for (let y = 2; y < 26; y += 3) for (let x = 2; x < 398; x += 2) { if (r() < .8) { const cs = x < 200 ? [k0.c1, k0.c2, '#F4F4F4', PELES[1], PELES[3]] : [k1.c1, k1.c2, '#F4F4F4', PELES[2], PELES[4]]; g.fillStyle = cs[Math.floor(r() * cs.length)]; g.fillRect(x, y, 1, 2); } }
    g.fillStyle = '#12131B'; g.fillRect(0, 27, 400, 2);
    for (let x = 0; x < 400; x += 20) { g.fillStyle = (x / 20) % 2 ? k0.c1 : k1.c1; g.fillRect(x, 29, 20, 3); }
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#3E9B4F' : '#47AD59'; g.fillRect(i * 400 / 12, 32, 400 / 12 + 1, 218); }
    g.fillStyle = '#EAF6E4';
    const L = (x, y, w, h) => g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    const [x0, y0] = this.px(0, 0), [x1, y1] = this.px(1, 1);
    L(x0, y0, x1 - x0, 1); L(x0, y1, x1 - x0 + 1, 1); L(x0, y0, 1, y1 - y0); L(x1, y0, 1, y1 - y0); L((x0 + x1) / 2, y0, 1, y1 - y0);
    for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; L((x0 + x1) / 2 + Math.cos(t) * 26, (y0 + y1) / 2 + Math.sin(t) * 26, 1, 1); }
    for (const s of [0, 1]) {
      const ax = s ? x1 - 58 : x0, bx = s ? x1 - 20 : x0;
      L(ax, y0 + 46, 58, 1); L(ax, y1 - 46, 58, 1); L(s ? ax : ax + 58, y0 + 46, 1, y1 - y0 - 92);
      L(bx, y0 + 78, 20, 1); L(bx, y1 - 78, 20, 1); L(s ? bx : bx + 20, y0 + 78, 1, y1 - y0 - 156);
      g.fillStyle = '#F4F4F4'; const gx = s ? x1 + 1 : x0 - 8; L(gx, y0 + 84, 8, 1); L(gx, y1 - 84, 8, 1); L(s ? gx + 7 : gx, y0 + 84, 1, y1 - y0 - 168);
      g.fillStyle = 'rgba(255,255,255,.35)'; for (let yy = y0 + 86; yy < y1 - 84; yy += 3) L(gx + (s ? 1 : 1), yy, 6, 1);
      g.fillStyle = '#EAF6E4';
    }
    return c;
  }
  desenharPixel() {
    const ctx = this.cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.fundo, 0, 0);
    const P = this.p; const lista = P.pl.slice().sort((a, b) => a.y - b.y);
    const [bxs, bys] = this.px(P.ball.x, P.ball.y);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(Math.round(bxs) - 1, Math.round(bys) + 1, 3, 1);
    for (const pl of lista) {
      const [sx, sy] = this.px(pl.x, pl.y); const fr = this.framesDe(pl);
      const f = pl.mov ? 1 + (Math.floor(this.t / 140 + pl.bx * 7) % 2) : 0;
      const img = fr[f];
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(Math.round(sx) - 3, Math.round(sy), 7, 1);
      if (P.portador === pl) { ctx.fillStyle = '#F9C80E'; ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - img.height - 4, 3, 2); ctx.fillRect(Math.round(sx), Math.round(sy) - img.height - 2, 1, 1); }
      ctx.drawImage(img, Math.round(sx - img.width / 2), Math.round(sy - img.height + 1));
    }
    const bz = P.ball.z * 160;
    ctx.fillStyle = '#12131B'; ctx.fillRect(Math.round(bxs) - 2, Math.round(bys - bz) - 3, 4, 4);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(Math.round(bxs) - 1, Math.round(bys - bz) - 2, 2, 2);
    if (P.comemorando) { ctx.fillStyle = 'rgba(18,19,27,.75)'; ctx.fillRect(130, 108, 140, 32); ctx.fillStyle = '#F9C80E'; ctx.font = '16px Silkscreen, monospace'; ctx.textAlign = 'center'; ctx.fillText('GOOOL!', 200, 130); }
  }
  // ----- 3D -----
  pr(x, y) { // campo → tela (perspectiva)
    const d = 1 - y; const Z = 1 + d * .75; const W = this.W, H = this.H;
    const sx = W / 2 + (x - .5) * W * .9 / Z; const sy = -0.713 * H + 1.633 * H * 0.98 / Z - H * .02;
    return [sx, sy, 1 / Z];
  }
  fundo3D() {
    const c = document.createElement('canvas'); c.width = this.cv.width; c.height = this.cv.height; const g = c.getContext('2d');
    g.scale(this.dpr, this.dpr); const W = this.W, H = this.H; const r = rng(7);
    g.fillStyle = grad(g, 0, 0, 0, H * .4, [[0, '#070A16'], [1, '#18203F']]); g.fillRect(0, 0, W, H);
    const k0 = this.p.kits[0], k1 = this.p.kits[1];
    const [fx0, fy0] = this.pr(0, 0), [fx1] = this.pr(1, 0);
    for (let i = 0; i < 900; i++) { const x = r() * W, y = r() * (fy0 - 6); const cs = x < W / 2 ? [k0.c1, k0.c2, '#E8E8E8'] : [k1.c1, k1.c2, '#E8E8E8']; g.globalAlpha = .35 + r() * .5; g.fillStyle = cs[Math.floor(r() * 3)]; g.beginPath(); g.arc(x, y, 1.2 + r() * 1.6 * (y / fy0), 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
    for (const x of [W * .12, W * .88]) { g.fillStyle = rgrad(g, x, 6, 0, x, 6, W * .35, [[0, 'rgba(255,244,210,.35)'], [1, 'rgba(255,244,210,0)']]); g.fillRect(0, 0, W, H); }
    // placas de publicidade
    g.fillStyle = grad(g, 0, fy0 - 12, 0, fy0, [[0, k0.c1], [1, shade(k0.c1, -0.4)]]); g.fillRect(fx0 - 30, fy0 - 12, (fx1 - fx0) / 2 + 30, 10);
    g.fillStyle = grad(g, 0, fy0 - 12, 0, fy0, [[0, k1.c1], [1, shade(k1.c1, -0.4)]]); g.fillRect(W / 2, fy0 - 12, (fx1 - fx0) / 2 + 30, 10);
    // gramado
    const quad = (x0, y0, x1, y1, fill) => { const a = this.pr(x0, y0), b = this.pr(x1, y0), cc = this.pr(x1, y1), d = this.pr(x0, y1); g.fillStyle = fill; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(cc[0], cc[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill(); };
    quad(-.06, -.06, 1.06, 1.08, '#1F7A3A');
    for (let i = 0; i < 14; i++) quad(i / 14, 0, (i + 1) / 14, 1, i % 2 ? '#2E9A4C' : '#33A653');
    g.fillStyle = rgrad(g, W / 2, H * .6, 0, W / 2, H * .6, W * .6, [[0, 'rgba(255,255,255,.10)'], [1, 'rgba(0,0,0,.28)']]); g.fillRect(0, fy0, W, H - fy0);
    // linhas
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.6;
    const line = pts => { g.beginPath(); pts.forEach(([x, y], i) => { const [sx, sy] = this.pr(x, y); i ? g.lineTo(sx, sy) : g.moveTo(sx, sy); }); g.stroke(); };
    line([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]); line([[.5, 0], [.5, 1]]);
    const circ = []; for (let a = 0; a <= 48; a++) { const t = a / 48 * Math.PI * 2; circ.push([.5 + Math.cos(t) * .087, .5 + Math.sin(t) * .15]); } line(circ);
    for (const s of [0, 1]) { const e = s ? 1 : 0, dd = s ? -1 : 1; line([[e, .2], [e + dd * .16, .2], [e + dd * .16, .8], [e, .8]]); line([[e, .37], [e + dd * .055, .37], [e + dd * .055, .63], [e, .63]]); }
    g.fillStyle = rgrad(g, W / 2, H / 2, W * .3, W / 2, H / 2, W * .75, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.45)']]); g.fillRect(0, 0, W, H);
    return c;
  }
  gol3D(g, lado, frente) {
    const x = lado ? 1 : 0, dd = lado ? 1 : -1, y0 = .44, y1 = .56;
    const ph = this.H * .085;
    const a = this.pr(x, y0), b = this.pr(x, y1), a2 = this.pr(x + dd * .035, y0), b2 = this.pr(x + dd * .035, y1);
    if (!frente) {
      g.fillStyle = 'rgba(235,240,255,.14)'; g.beginPath(); g.moveTo(a[0], a[1] - ph * a[2]); g.lineTo(a2[0], a2[1] - ph * a2[2] * .8); g.lineTo(b2[0], b2[1] - ph * b2[2] * .8); g.lineTo(b[0], b[1] - ph * b[2]); g.lineTo(b[0], b[1]); g.lineTo(b2[0], b2[1]); g.lineTo(a2[0], a2[1]); g.lineTo(a[0], a[1]); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = .8;
      for (let i = 1; i < 8; i++) { const t = i / 8; const p = [a2[0] + (b2[0] - a2[0]) * t, a2[1] + (b2[1] - a2[1]) * t]; const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0], p[1] - ph * .8 * (a2[2] + (b2[2] - a2[2]) * t)); g.lineTo(q[0], q[1] - ph * (a[2] + (b[2] - a[2]) * t)); g.stroke(); }
      return;
    }
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[0], a[1] - ph * a[2]); g.lineTo(b[0], b[1] - ph * b[2]); g.lineTo(b[0], b[1]); g.stroke();
  }
  desenhar3D() {
    const ctx = this.cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.fundo, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const P = this.p; const H = this.H;
    this.gol3D(ctx, 0, false); this.gol3D(ctx, 1, false);
    const lista = P.pl.slice().sort((a, b) => a.y - b.y);
    const [bx, by, bs] = this.pr(P.ball.x, P.ball.y);
    let bolaDesenhada = false;
    const bola = () => {
      const z = P.ball.z * H * 1.1 * bs; const rB = H * .013 * bs + 1.4;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(bx, by, rB * 1.2, rB * .45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgrad(ctx, bx - rB * .4, by - z - rB * .4, 0, bx, by - z, rB * 1.2, [[0, '#FFFFFF'], [.6, '#E3E6EE'], [1, '#8D93A6']]);
      ctx.beginPath(); ctx.arc(bx, by - z - rB, rB, 0, Math.PI * 2); ctx.fill();
      bolaDesenhada = true;
    };
    for (const pl of lista) {
      if (!bolaDesenhada && pl.y > P.ball.y) bola();
      const [sx, sy, s] = this.pr(pl.x, pl.y); const fr = this.framesDe(pl);
      const f = pl.mov ? 1 + (Math.floor(this.t / 110 + pl.bx * 9) % 3) : 0;
      const img = fr[f]; const hh = H * .2 * s; const ww = hh * img.width / img.height;
      ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(sx, sy, ww * .32, ww * .1, 0, 0, Math.PI * 2); ctx.fill();
      if (P.portador === pl) { ctx.strokeStyle = 'rgba(255,200,60,.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, ww * .42, ww * .14, 0, 0, Math.PI * 2); ctx.stroke(); }
      const flip = pl.vx < 0;
      if (flip) { ctx.save(); ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.drawImage(img, -ww / 2, sy - hh * (78 / 84), ww, hh); ctx.restore(); }
      else ctx.drawImage(img, sx - ww / 2, sy - hh * (78 / 84), ww, hh);
    }
    if (!bolaDesenhada) bola();
    this.gol3D(ctx, 0, true); this.gol3D(ctx, 1, true);
    if (P.comemorando) {
      const W = this.W; ctx.fillStyle = 'rgba(8,10,20,.55)'; ctx.fillRect(0, H * .38, W, H * .2);
      ctx.font = `italic 800 ${Math.round(H * .13)}px 'Barlow Condensed', sans-serif`; ctx.textAlign = 'center';
      ctx.fillStyle = grad(ctx, 0, H * .4, 0, H * .56, [[0, '#FFE58A'], [1, '#FF9F1C']]); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 12;
      ctx.fillText('GOOOOL!', W / 2, H * .53); ctx.shadowBlur = 0;
    }
  }
  desenhar(dt) { this.t += dt; if (this.estilo === 'pixel') this.desenharPixel(); else this.desenhar3D(); }
}
