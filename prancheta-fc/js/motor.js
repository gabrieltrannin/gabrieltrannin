/* Prancheta FC — regras do jogo: mundo, elencos, calendário, simulação, mercado e finanças */

let S = null; // estado da carreira
const CL = {}; // clubes brasileiros (dados fixos) por id

// ---------- montagem dos clubes ----------
CLUBES_RAW.trim().split('\n').forEach(l => {
  const [id, nome, sigla, cidade, uf, estadio, cap, div, rep, caixa, kit] = l.split('|');
  CL[id] = { id, nome, sigla, cidade, uf, estadio, cap: +cap, div, rep: +rep, caixa: +caixa, kit: parseKit(kit) };
});

const KITS_EXT = {
  'Manchester City': 'solid:#6CABDD:#1C2C5B:#F4F4F4', 'Arsenal': 'solid:#EF0107:#F4F4F4:#F4F4F4', 'Liverpool': 'solid:#C8102E:#F6EB61:#C8102E',
  'Chelsea': 'solid:#034694:#F4F4F4:#034694', 'Manchester United': 'solid:#DA291C:#161616:#F4F4F4', 'Tottenham': 'solid:#F4F4F4:#132257:#132257',
  'Newcastle': 'stripes:#161616:#F4F4F4:#161616', 'Aston Villa': 'solid:#670E36:#95BFE5:#F4F4F4', 'Real Madrid': 'solid:#F4F4F4:#FEBE10:#F4F4F4',
  'Barcelona': 'stripes:#A50044:#004D98:#004D98', 'Atlético de Madrid': 'stripes:#CB3524:#F4F4F4:#272E61', 'Athletic Club': 'stripes:#EE2523:#F4F4F4:#161616',
  'Inter': 'stripes:#0068A8:#161616:#161616', 'Milan': 'stripes:#FB090B:#161616:#F4F4F4', 'Juventus': 'stripes:#161616:#F4F4F4:#F4F4F4',
  'Napoli': 'solid:#12A0D7:#F4F4F4:#F4F4F4', 'Roma': 'solid:#8E1F2F:#F0BC42:#8E1F2F', 'Atalanta': 'stripes:#1E71B8:#161616:#161616',
  'Bayern de Munique': 'solid:#DC052D:#F4F4F4:#DC052D', 'Borussia Dortmund': 'solid:#FDE100:#161616:#161616', 'Bayer Leverkusen': 'solid:#E32221:#161616:#161616',
  'Paris Saint-Germain': 'band:#004170:#DA291C:#004170:#F4F4F4', 'Olympique de Marseille': 'solid:#F4F4F4:#2FAEE0:#F4F4F4', 'Monaco': 'solid:#E7192D:#F4F4F4:#F4F4F4',
  'Benfica': 'solid:#E83030:#F4F4F4:#F4F4F4', 'Porto': 'stripes:#00428C:#F4F4F4:#00428C', 'Sporting': 'hoops:#008057:#F4F4F4:#161616',
  'Al-Nassr': 'solid:#FCD116:#1D3D8F:#1D3D8F', 'Al-Hilal': 'solid:#1F4FA3:#F4F4F4:#F4F4F4', 'Al-Ittihad': 'stripes:#FFD600:#161616:#161616', 'Al-Ahli': 'solid:#127A3B:#F4F4F4:#F4F4F4',
  'Galatasaray': 'stripes:#A90432:#FDB912:#F4F4F4', 'Fenerbahçe': 'stripes:#FFED00:#163962:#F4F4F4', 'Inter Miami': 'solid:#F7B5CD:#161616:#F7B5CD',
  'LAFC': 'solid:#161616:#C39E6D:#161616', 'Boca Juniors': 'band:#103F79:#FCB813:#103F79', 'River Plate': 'sash:#F4F4F4:#E1001A:#161616',
  'Racing Club': 'stripes:#7AC1E8:#F4F4F4:#161616', 'Monterrey': 'stripes:#0D1A3E:#F4F4F4:#0D1A3E', 'Tigres': 'solid:#FDB927:#004D9F:#FDB927', 'Club América': 'solid:#FFE600:#00205B:#00205B',
};
function kitExterno(nome) {
  if (KITS_EXT[nome]) return parseKit(KITS_EXT[nome]);
  const r = rng(hashStr(nome)); const pal = ['#C8102E', '#0B3D91', '#F4F4F4', '#161616', '#0A8A3E', '#FFD200', '#6CABDD', '#7A1E2C', '#F47A20'];
  const c1 = pal[Math.floor(r() * pal.length)]; let c2 = pal[Math.floor(r() * pal.length)]; if (c2 === c1) c2 = '#F4F4F4';
  return { pad: ['solid', 'stripes', 'hoops'][Math.floor(r() * 3)], c1, c2, c3: r() < .5 ? '#F4F4F4' : '#161616', c4: c2 };
}
const LIGA_EXT = {}; MUNDO.forEach(l => LIGA_EXT[l.sigla] = l);

// ---------- valores ----------
const IDADE_F = i => i <= 20 ? 1.5 : i <= 23 ? 1.3 : i <= 27 ? 1 : i <= 29 ? .8 : i <= 31 ? .55 : i <= 33 ? .35 : .18;
function valorDe(ovr, idade, ext) {
  const euro = 35 * Math.exp(0.165 * (ovr - 80)) * IDADE_F(idade) * (ext ? 1 : 0.45);
  return Math.max(0.05, euro * 6); // R$ mi
}
function salarioDe(ovr, prest) { // R$ mil por mês
  const mult = !prest ? 1 : prest >= 88 ? 2.2 : prest >= 70 ? 2.0 : 1.3;
  return Math.max(6, Math.round(25 * Math.exp((ovr - 60) / 6.2) * mult));
}
function attrsDe(pos, ovr, seed) {
  const r = rng(seed); const v = b => Math.max(25, Math.min(99, Math.round(ovr + b + (r() - .5) * 8)));
  const P = { GOL: [-30, -12, -25, -10, -6, 4], LD: [-14, -2, 0, 1, 2, -40], LE: [-14, -2, 0, 1, 2, -40], ZAG: [-22, -8, -14, 5, 3, -40], VOL: [-12, 2, -6, 3, 2, -40], MC: [-6, 4, 0, -4, 0, -40], MEI: [0, 5, 4, -14, -4, -40], PE: [0, 0, 5, -18, 0, -40], PD: [0, 0, 5, -18, 0, -40], ATA: [5, -4, 1, -22, 1, -40] }[pos];
  return { fin: v(P[0]), pas: v(P[1]), dri: v(P[2]), def: v(P[3]), fis: v(P[4]), gol: pos === 'GOL' ? v(P[5]) : Math.max(10, v(P[5])) };
}

// ---------- criação do mundo ----------
let _seq = 0;
function novoJogador(o) {
  const id = 'j' + (++_seq);
  const ext = !!o.ext;
  const j = { id, nome: o.nome, pos: o.pos, idade: o.idade, ovr: o.ovr, nac: o.nac || 'BRA', clube: o.clube || null, ext: o.ext || null, liga: o.liga,
    real: !!o.real, look: gerarLook(o.nome, o.nac || 'BRA'), cond: 100, moral: 72, gols: 0, jogos: 0, venda: false,
    contrato: 2026 + 1 + (hashStr(o.nome) % 4) };
  const prest = ext ? LIGA_EXT[o.liga].prest : 0;
  j.valor = +valorDe(j.ovr, j.idade, ext).toFixed(2);
  j.salario = salarioDe(j.ovr, prest);
  j.attrs = attrsDe(j.pos, j.ovr, hashStr(j.nome + j.pos));
  S.jog[id] = j; return j;
}
function parseElenco(str) { return str.split(';').map(s => { const [nome, pos, idade, ovr, nac] = s.split(','); return { nome, pos, idade: +idade, ovr: +ovr, nac: nac || 'BRA' }; }); }

const MOLDE = { GOL: 3, LD: 2, ZAG: 4, LE: 2, VOL: 3, MC: 2, MEI: 2, PE: 2, PD: 2, ATA: 3 };
function nomeGerado(r, usados) {
  for (let t = 0; t < 30; t++) {
    const x = r(); let n;
    if (x < 0.28) n = NOMES_APELIDOS[Math.floor(r() * NOMES_APELIDOS.length)];
    else n = NOMES_PRIMEIROS[Math.floor(r() * NOMES_PRIMEIROS.length)] + ' ' + SOBRENOMES[Math.floor(r() * SOBRENOMES.length)];
    if (!usados.has(n)) { usados.add(n); return n; }
  }
  return 'Jogador ' + Math.floor(r() * 999);
}
function completarElenco(cl, lista) {
  const r = rng(hashStr('elenco-' + cl.id));
  const usados = new Set(lista.map(p => p.nome));
  const base = cl.div === 'A' ? 66 : 45 + cl.rep * 0.33;
  const cont = {}; lista.forEach(p => cont[p.pos] = (cont[p.pos] || 0) + 1);
  for (const pos of ORDEM_POS) {
    const alvo = cl.div === 'A' ? Math.max(1, MOLDE[pos] - 1) : MOLDE[pos];
    while ((cont[pos] || 0) < alvo) {
      const idade = 18 + Math.floor(r() * 16);
      const curva = idade < 21 ? -4 : idade < 24 ? -1 : idade < 31 ? 1 : -2;
      const ovr = Math.round(base + curva + (r() - 0.5) * 10 - (cl.div === 'A' ? 2 : 0));
      lista.push({ nome: nomeGerado(r, usados), pos, idade, ovr: Math.max(45, Math.min(78, ovr)), nac: 'BRA', gerado: true });
      cont[pos] = (cont[pos] || 0) + 1;
    }
  }
  if ((cont.GOL || 0) < 2) lista.push({ nome: nomeGerado(r, usados), pos: 'GOL', idade: 20, ovr: Math.round(base - 6), nac: 'BRA', gerado: true });
  return lista;
}

function criarMundo() {
  _seq = 0;
  S.jog = {}; S.cl = {};
  for (const id in CL) {
    const c = CL[id];
    S.cl[id] = { id, div: c.div, rep: c.rep, elenco: [], form: [], tatica: null };
    let lista = ELENCOS_A[id] ? parseElenco(ELENCOS_A[id]).map(p => ({ ...p, real: true })) : [];
    lista = completarElenco(c, lista);
    lista.forEach(p => { const j = novoJogador({ ...p, clube: id, liga: c.div, real: !!p.real }); S.cl[id].elenco.push(j.id); });
  }
  S.ext = [];
  for (const L of MUNDO) for (const nomeClube in L.clubes) {
    parseElenco(L.clubes[nomeClube]).forEach(p => { const j = novoJogador({ ...p, ext: nomeClube, liga: L.sigla, real: true }); S.ext.push(j.id); });
  }
  for (const id in S.cl) S.cl[id].tatica = taticaAuto(id);
}

// ---------- táticas ----------
const VIZ = {
  GOL: {}, LD: { LE: .86, ZAG: .84, PD: .82, VOL: .74 }, LE: { LD: .86, ZAG: .84, PE: .82, VOL: .74 },
  ZAG: { VOL: .86, LD: .82, LE: .82 }, VOL: { MC: .95, ZAG: .85, MEI: .82 }, MC: { VOL: .93, MEI: .93, PD: .8, PE: .8 },
  MEI: { MC: .92, PE: .9, PD: .9, ATA: .86 }, PE: { PD: .92, MEI: .88, ATA: .86, LE: .74 }, PD: { PE: .92, MEI: .88, ATA: .86, LD: .74 },
  ATA: { PE: .87, PD: .87, MEI: .84 },
};
function encaixe(slot, pos) { if (slot === pos) return 1; if (slot === 'GOL' || pos === 'GOL') return .3; return VIZ[slot][pos] || .66; }
function efetivo(j, slot) { return j.ovr * encaixe(slot, j.pos) * (0.86 + 0.14 * j.cond / 100) * (0.96 + 0.08 * j.moral / 100); }

function taticaAuto(clubeId, formacao) {
  const c = S.cl[clubeId];
  formacao = formacao || (c.tatica && c.tatica.formacao) || ['4-3-3', '4-4-2', '4-2-3-1'][hashStr(clubeId) % 3];
  const slots = FORMACOES[formacao];
  const disp = c.elenco.map(id => S.jog[id]).filter(Boolean);
  const usados = new Set(); const tit = Array(11).fill(null);
  const ordem = slots.map((s, i) => i).sort((a, b) => (slots[a][0] === 'GOL' ? -1 : 0) - (slots[b][0] === 'GOL' ? -1 : 0));
  for (const i of ordem) {
    let best = null, bv = -1;
    for (const j of disp) { if (usados.has(j.id)) continue; const v = efetivo(j, slots[i][0]); if (v > bv) { bv = v; best = j; } }
    if (best) { tit[i] = best.id; usados.add(best.id); }
  }
  const prev = c.tatica || {};
  return { formacao, tit, postura: prev.postura || 'equilibrada', ritmo: prev.ritmo || 'normal', marcacao: prev.marcacao || 'normal' };
}
function forcaTime(clubeId, tat) {
  tat = tat || S.cl[clubeId].tatica;
  const slots = FORMACOES[tat.formacao];
  const g = { def: [], mei: [], ata: [] };
  tat.tit.forEach((id, i) => {
    const j = S.jog[id]; if (!j) return; const slot = slots[i][0]; const e = efetivo(j, slot);
    if (slot === 'GOL') { g.def.push(e, e); }
    else if (['LD', 'LE', 'ZAG'].includes(slot)) { g.def.push(e); if (slot !== 'ZAG') g.mei.push(e * .97); }
    else if (slot === 'VOL') { g.def.push(e); g.mei.push(e); }
    else if (slot === 'MC') g.mei.push(e);
    else if (slot === 'MEI') { g.mei.push(e); g.ata.push(e); }
    else g.ata.push(e);
  });
  const m = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 40;
  let def = m(g.def), mei = m(g.mei), ata = m(g.ata);
  const p = tat.postura;
  if (p === 'ofensiva') { ata += 2.5; def -= 2.5; } if (p === 'defensiva') { ata -= 2.5; def += 2.5; }
  if (tat.marcacao === 'pressao') { mei += 1.5; def -= 1; } if (tat.marcacao === 'recuada') { def += 1; mei -= 1; }
  const faltam = tat.tit.filter(id => !S.jog[id]).length;
  const geral = (def * .34 + mei * .32 + ata * .34) - faltam * 6;
  return { def: Math.round(def), mei: Math.round(mei), ata: Math.round(ata), geral: Math.round(geral * 10) / 10 };
}

// ---------- calendário ----------
function gerarRodadas(ids, turnos, seed) {
  const r = rng(seed); const t = ids.slice();
  for (let i = t.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [t[i], t[k]] = [t[k], t[i]]; }
  const n = t.length; const rod = [];
  for (let k = 0; k < n - 1; k++) {
    const jogos = [];
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      jogos.push(k % 2 === 0 ? [a, b] : [b, a]);
    }
    rod.push(jogos); t.splice(1, 0, t.pop());
  }
  if (turnos === 2) rod.push(...rod.map(js => js.map(([a, b]) => [b, a])));
  return rod;
}
function novaTabela(ids) { const t = {}; ids.forEach(id => t[id] = { j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 }); return t; }
function montarTemporada() {
  S.div = {};
  for (const d of ['A', 'B', 'C']) {
    const ids = Object.keys(S.cl).filter(id => S.cl[id].div === d);
    S.div[d] = { ids, rodadas: gerarRodadas(ids, DIVISOES[d].turnos, hashStr('cal' + S.ano + d)), tabela: novaTabela(ids), res: [], feitas: 0 };
  }
}
const INICIO = new Date(2026, 2, 28);
function dataRodada(i) { const d = new Date(INICIO.getTime() + i * 7 * 864e5); d.setFullYear(S.ano); return d; }
function fmtData(d) { return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()] + ', ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }

function classificacao(d) {
  const T = S.div[d].tabela;
  return Object.keys(T).sort((a, b) => {
    const x = T[a], y = T[b];
    return y.pts - x.pts || y.v - x.v || (y.gp - y.gc) - (x.gp - x.gc) || y.gp - x.gp || CL[a].nome.localeCompare(CL[b].nome);
  });
}
function posicao(id) { return classificacao(S.cl[id].div).indexOf(id) + 1; }
function zonaDe(d, pos) { const z = DIVISOES[d].zonas.find(([a, b]) => pos >= a && pos <= b); return z ? z[2] : ''; }

// ---------- simulação rápida ----------
function poisson(l, r) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= r(); } while (p > L && k < 12); return k - 1; }
function escolherAutor(clubeId, r) {
  const tat = S.cl[clubeId].tatica; const slots = FORMACOES[tat.formacao];
  const W = { ATA: 6, PE: 3.4, PD: 3.4, MEI: 2.6, MC: 1.2, VOL: .7, LD: .55, LE: .55, ZAG: .5, GOL: 0 };
  const cand = tat.tit.map((id, i) => ({ id, w: (W[slots[i][0]] || 1) * Math.pow((S.jog[id] || { ovr: 50 }).ovr / 70, 3) })).filter(c => S.jog[c.id]);
  const tot = cand.reduce((s, c) => s + c.w, 0); let x = r() * tot;
  for (const c of cand) { x -= c.w; if (x <= 0) return c.id; } return cand[0] && cand[0].id;
}
function simularRapido(h, a, seed) {
  const r = rng(seed);
  const fh = forcaTime(h), fa = forcaTime(a);
  const lh = 1.38 * Math.exp(((fh.ata - fa.def) * .6 + (fh.mei - fa.mei) * .4) / 20);
  const la = 1.08 * Math.exp(((fa.ata - fh.def) * .6 + (fa.mei - fh.mei) * .4) / 20);
  const gh = poisson(Math.min(4.2, lh), r), ga = poisson(Math.min(4.2, la), r);
  const gols = [];
  for (let i = 0; i < gh; i++) gols.push({ min: 1 + Math.floor(r() * 90), clube: h, jog: escolherAutor(h, r) });
  for (let i = 0; i < ga; i++) gols.push({ min: 1 + Math.floor(r() * 90), clube: a, jog: escolherAutor(a, r) });
  gols.sort((x, y) => x.min - y.min);
  return { h, a, gh, ga, gols };
}
function aplicarResultado(d, res) {
  const T = S.div[d].tabela; const H = T[res.h], A = T[res.a];
  H.j++; A.j++; H.gp += res.gh; H.gc += res.ga; A.gp += res.ga; A.gc += res.gh;
  if (res.gh > res.ga) { H.v++; H.pts += 3; A.d++; } else if (res.gh < res.ga) { A.v++; A.pts += 3; H.d++; } else { H.e++; A.e++; H.pts++; A.pts++; }
  res.gols.forEach(g => { const j = S.jog[g.jog]; if (j) j.gols++; });
  for (const [c, gf, gc] of [[res.h, res.gh, res.ga], [res.a, res.ga, res.gh]]) {
    const f = S.cl[c].form; f.push(gf > gc ? 'V' : gf === gc ? 'E' : 'D'); if (f.length > 5) f.shift();
    S.cl[c].tatica.tit.forEach(id => { const j = S.jog[id]; if (j) j.jogos++; });
  }
}
function simularRodadaDivisao(d, i, exceto) {
  const D = S.div[d]; if (i >= D.rodadas.length || D.res[i]) return;
  const lista = [];
  D.rodadas[i].forEach(([h, a], k) => {
    if (exceto && (h === exceto.h && a === exceto.a)) { lista.push(exceto); aplicarResultado(d, exceto); return; }
    if (h !== S.clube) S.cl[h].tatica = taticaAuto(h);
    if (a !== S.clube) S.cl[a].tatica = taticaAuto(a);
    const res = simularRapido(h, a, hashStr(S.ano + d + i + '-' + k));
    lista.push(res); aplicarResultado(d, res);
  });
  D.res[i] = lista; D.feitas = i + 1;
}

// ---------- jogo do usuário e avanço ----------
function minhaDiv() { return S.cl[S.clube].div; }
function proximoJogo() {
  const D = S.div[minhaDiv()]; if (S.rodada >= D.rodadas.length) return null;
  const j = D.rodadas[S.rodada].find(([h, a]) => h === S.clube || a === S.clube);
  return j ? { h: j[0], a: j[1], rodada: S.rodada, data: dataRodada(S.rodada), casa: j[0] === S.clube } : null;
}
function fimTemporada() { return S.rodada >= S.div[minhaDiv()].rodadas.length; }

function concluirRodada(resUser) {
  const d = minhaDiv(); const i = S.rodada;
  const jogo = proximoJogo();
  // condição física
  for (const id of S.cl[S.clube].elenco) { const j = S.jog[id]; if (!j) continue; j.cond = Math.min(100, j.cond + 14 + (S.estrutura.ct - 1) * 3); }
  S.cl[S.clube].tatica.tit.forEach(id => { const j = S.jog[id]; if (j) j.cond = Math.max(40, j.cond - 26); });
  for (const dd of ['A', 'B', 'C']) simularRodadaDivisao(dd, i, dd === d ? resUser : null);
  // finanças
  financasRodada(jogo, resUser);
  // diretoria, torcida e moral
  const meu = resUser.h === S.clube ? [resUser.gh, resUser.ga] : [resUser.ga, resUser.gh];
  const delta = meu[0] > meu[1] ? 1 : meu[0] === meu[1] ? 0 : -1;
  S.diretoria = clamp(S.diretoria + delta * 3 + (posicao(S.clube) <= S.objetivo.pos ? 1 : -1), 0, 100);
  S.torcida = clamp(S.torcida + delta * 5 + (meu[0] >= 3 ? 2 : 0), 0, 100);
  S.cl[S.clube].elenco.forEach(id => { const j = S.jog[id]; if (j) j.moral = clamp(j.moral + delta * 4 + (S.cl[S.clube].tatica.tit.includes(id) ? 1 : -1), 20, 100); });
  // notícias
  const adv = CL[jogo.casa ? jogo.a : jogo.h];
  const placar = `${CL[resUser.h].sigla} ${resUser.gh} × ${resUser.ga} ${CL[resUser.a].sigla}`;
  if (delta > 0) noticia('Vitória', `${placar}. A torcida saiu cantando do ${CL[resUser.h].estadio}.`, 'bom');
  else if (delta < 0) noticia('Derrota', `${placar}. A diretoria espera reação contra o próximo adversário.`, 'ruim');
  else noticia('Empate', `${placar} diante do ${adv.nome}.`, '');
  propostasPorJogadores();
  if (S.rodada % 6 === 2) boatoMercado();
  S.rodada++;
  if (fimTemporada()) encerrarTemporada();
  salvar();
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ---------- finanças ----------
function receitaMensalEstimada(id) {
  id = id || S.clube; const c = CL[id], d = S.cl[id].div;
  const tv = DIVISOES[d].tv * 4, pat = Math.pow(S.cl[id].rep / 100, 3) * 3 * 4;
  const ing = 2 * c.cap * 0.62 * DIVISOES[d].ingresso / 1e6;
  return tv + pat + ing;
}
function folhaMensal(id) { return S.cl[id || S.clube].elenco.reduce((s, jid) => s + (S.jog[jid] ? S.jog[jid].salario : 0), 0) / 1000; }
function tetoSalarial() { return receitaMensalEstimada() * 0.62; }
function custoOperacional() { return receitaMensalEstimada() * 0.3 * (1 + (S.estrutura.ct - 1) * 0.08); }
function publicoEstimado() {
  const c = CL[S.clube], d = S.cl[S.clube].div, base = DIVISOES[d].ingresso;
  const forma = S.cl[S.clube].form.filter(x => x === 'V').length * 0.03;
  const taxa = clamp(0.38 + S.torcida / 220 + forma - (S.preco - base) / base * 0.45, 0.12, 1);
  return Math.round(c.cap * taxa);
}
function lancar(desc, valor) { S.caixa += valor; S.extrato.unshift({ rod: S.rodada + 1, desc, valor }); if (S.extrato.length > 60) S.extrato.pop(); }
function financasRodada(jogo) {
  const d = minhaDiv();
  lancar('Cota de TV', DIVISOES[d].tv);
  lancar('Patrocínio', Math.pow(S.cl[S.clube].rep / 100, 3) * 3);
  if (jogo.casa) { const p = publicoEstimado(); S.ultimoPublico = p; lancar(`Bilheteria (${p.toLocaleString('pt-BR')} pagantes)`, p * S.preco / 1e6); }
  if ((S.rodada + 1) % 4 === 0) { lancar('Folha salarial do mês', -folhaMensal()); lancar('Custos do clube (CT, viagens, equipe)', -custoOperacional()); }
}

// ---------- notícias ----------
function noticia(titulo, texto, tipo, extra) { S.news.unshift({ id: 'n' + Date.now() + Math.random().toString(36).slice(2, 6), rod: S.rodada + 1, titulo, texto, tipo: tipo || '', ...extra }); if (S.news.length > 40) S.news.pop(); }
function boatoMercado() {
  const r = rng(hashStr('boato' + S.rodada + S.ano));
  const j = S.jog[S.ext[Math.floor(r() * S.ext.length)]];
  const c = CL[Object.keys(CL)[Math.floor(r() * 20)]];
  noticia('Bastidores', `Imprensa diz que o ${c.nome} sondou ${j.nome} (${j.ext}).`, 'info');
}

// ---------- mercado ----------
function prestDe(j) { return j.ext ? LIGA_EXT[j.liga].prest : 0; }
function nomeClubeDe(j) { return j.ext ? j.ext : j.clube ? CL[j.clube].nome : 'Sem clube'; }
function kitJog(j) { return j.ext ? kitExterno(j.ext) : j.clube ? CL[j.clube].kit : parseKit('solid:#8A8F9E:#F4F4F4:#3B3F4C'); }
function ligaNome(j) { return j.ext ? LIGA_EXT[j.liga].liga : 'Brasileirão ' + (S.cl[j.clube] ? 'Série ' + S.cl[j.clube].div : ''); }
function interesse(j) {
  const meu = S.cl[S.clube];
  let s = meu.rep - Math.pow(Math.max(0, j.ovr - 60), 1.35) * 0.75 + 8;
  if (j.ext) { s -= (prestDe(j) - 60) * 0.5; if (j.idade < 30 && prestDe(j) >= 88) s -= 22; if (j.nac === 'BRA') s += 12; }
  else if (j.clube) { const o = S.cl[j.clube]; const ord = { A: 3, B: 2, C: 1 }; if (ord[o.div] > ord[meu.div]) s -= (o.rep - meu.rep) * 0.5 + 10; if (ord[o.div] < ord[meu.div]) s += 12; }
  if (j.idade >= 33) s += 22; else if (j.idade >= 30) s += 10;
  if (meu.div === 'A' && posicao(S.clube) <= 6 && S.rodada > 3) s += 5;
  return s;
}
function nivelInteresse(j) { const s = interesse(j); return s >= 25 ? ['alto', 'Alto'] : s >= 5 ? ['medio', 'Médio'] : s >= -15 ? ['baixo', 'Baixo'] : ['nao', 'Sem interesse']; }
function titularNoClube(j) { if (!j.clube) return false; const t = S.cl[j.clube].tatica; return t && t.tit.includes(j.id); }
function pedidaClube(j) { return +(j.valor * (titularNoClube(j) ? 1.3 : 1.05) * (j.contrato - S.ano >= 3 ? 1.1 : 1)).toFixed(2); }
function pedidaSalario(j) {
  const base = j.ext ? j.salario : j.salario * 1.12;
  const lvl = nivelInteresse(j)[0];
  return Math.round(base * (lvl === 'alto' ? 1 : lvl === 'medio' ? 1.12 : 1.3));
}

function listaMercado(f) {
  const ids = [...S.ext, ...Object.keys(S.cl).filter(id => id !== S.clube).flatMap(id => S.cl[id].elenco)];
  const q = (f.busca || '').trim().toLowerCase();
  let L = ids.map(id => S.jog[id]).filter(j => j && j.clube !== S.clube);
  if (f.liga && f.liga !== 'todas') L = L.filter(j => f.liga === 'BR' ? !j.ext : f.liga.length === 1 ? (!j.ext && S.cl[j.clube] && S.cl[j.clube].div === f.liga) : j.liga === f.liga);
  if (f.pos && f.pos !== 'todas') L = L.filter(j => j.pos === f.pos);
  if (q) L = L.filter(j => j.nome.toLowerCase().includes(q) || nomeClubeDe(j).toLowerCase().includes(q));
  if (f.max) L = L.filter(j => pedidaClube(j) <= f.max);
  if (f.interessados) L = L.filter(j => nivelInteresse(j)[0] !== 'nao');
  if (f.reais) L = L.filter(j => j.real);
  L.sort((a, b) => f.ordem === 'valor' ? pedidaClube(a) - pedidaClube(b) : f.ordem === 'idade' ? a.idade - b.idade : b.ovr - a.ovr);
  return L;
}

// proposta: { fase: 'clube' | 'jogador', valor, salario, anos }
function negociarClube(j, valor) {
  if (valor > S.caixa) return { ok: false, msg: `Você só tem ${fmtMi(S.caixa)} em caixa.` };
  const ped = pedidaClube(j);
  const r = rng(hashStr(j.id + S.rodada + Math.round(valor * 100)))();
  const tol = 0.95 + r * 0.08;
  if (valor >= ped * tol) return { ok: true, msg: `${nomeClubeDe(j)} aceitou ${fmtMi(valor)}.` };
  if (valor >= ped * 0.78) return { ok: false, contra: +(ped * 1.02).toFixed(2), msg: `${nomeClubeDe(j)} recusou e pediu ${fmtMi(ped * 1.02)}.` };
  return { ok: false, msg: `${nomeClubeDe(j)} achou a proposta baixa demais. O clube não negocia por menos de ${fmtMi(ped * 0.95)}.` };
}
function negociarJogador(j, salario, anos) {
  const [lvl] = nivelInteresse(j);
  if (lvl === 'nao') return { ok: false, msg: `${j.nome} não quer jogar no ${CL[S.clube].nome} agora.` };
  const ped = pedidaSalario(j);
  const novaFolha = folhaMensal() + salario / 1000;
  if (novaFolha > tetoSalarial()) return { ok: false, msg: `A diretoria vetou: a folha passaria de ${fmtMi(tetoSalarial())} por mês.` };
  if (salario < ped * 0.9) return { ok: false, contra: ped, msg: `${j.nome} pede pelo menos ${fmtMil(ped)} por mês.` };
  const base = { alto: .95, medio: .72, baixo: .38 }[lvl];
  const p = clamp(base + (salario / ped - 1) * 0.9 + (anos >= 3 ? .04 : 0), 0, .99);
  const r = rng(hashStr(j.id + 'sal' + S.rodada + salario + anos))();
  if (r < p) return { ok: true, msg: `${j.nome} aceitou ${fmtMil(salario)} por mês até ${S.ano + anos}.` };
  return { ok: false, contra: Math.round(ped * 1.15), msg: `${j.nome} ficou em dúvida. Com ${fmtMil(Math.round(ped * 1.15))} por mês o acordo sai.` };
}
function concluirContratacao(j, valor, salario, anos) {
  const origem = nomeClubeDe(j);
  if (j.ext) S.ext = S.ext.filter(id => id !== j.id);
  else if (j.clube) { const o = S.cl[j.clube]; o.elenco = o.elenco.filter(id => id !== j.id); o.tatica = taticaAuto(o.id); }
  j.ext = null; j.clube = S.clube; j.liga = minhaDiv(); j.salario = salario; j.contrato = S.ano + anos; j.moral = 85; j.venda = false;
  S.cl[S.clube].elenco.push(j.id);
  lancar(`Contratação: ${j.nome}`, -valor);
  noticia('Negócio fechado', `${j.nome} (${origem}) é o novo reforço do ${CL[S.clube].nome} por ${fmtMi(valor)}.`, 'bom');
  salvar();
}

// propostas de outros clubes pelos seus jogadores à venda
function propostasPorJogadores() {
  const r = rng(hashStr('prop' + S.rodada + S.ano));
  for (const id of S.cl[S.clube].elenco) {
    const j = S.jog[id]; if (!j || !j.venda) continue;
    if (S.news.some(n => n.proposta && n.proposta.jog === id && !n.resolvida)) continue;
    if (r() > 0.55) continue;
    let comprador;
    if (j.ovr >= 76 && r() < 0.6) { const L = MUNDO[Math.floor(r() * MUNDO.length)]; const cs = Object.keys(L.clubes); comprador = { ext: cs[Math.floor(r() * cs.length)], liga: L.sigla }; }
    else { const cands = Object.keys(S.cl).filter(c => c !== S.clube && S.cl[c].rep >= S.cl[S.clube].rep - 15); comprador = { clube: cands[Math.floor(r() * cands.length)] }; }
    const valor = +(j.valor * (0.75 + r() * 0.45)).toFixed(2);
    const nome = comprador.ext || CL[comprador.clube].nome;
    noticia('Proposta recebida', `${nome} oferece ${fmtMi(valor)} por ${j.nome}.`, 'proposta', { proposta: { jog: id, valor, ...comprador } });
  }
}
function responderProposta(nid, aceitar) {
  const n = S.news.find(x => x.id === nid); if (!n || n.resolvida) return;
  n.resolvida = aceitar ? 'aceita' : 'recusada';
  const p = n.proposta; const j = S.jog[p.jog];
  if (!aceitar || !j || j.clube !== S.clube) { salvar(); return; }
  S.cl[S.clube].elenco = S.cl[S.clube].elenco.filter(id => id !== j.id);
  const t = S.cl[S.clube].tatica; t.tit = t.tit.map(id => id === j.id ? null : id);
  if (p.ext) { j.ext = p.ext; j.liga = p.liga; j.clube = null; S.ext.push(j.id); }
  else { j.clube = p.clube; j.liga = S.cl[p.clube].div; S.cl[p.clube].elenco.push(j.id); }
  j.venda = false;
  lancar(`Venda: ${j.nome}`, p.valor);
  noticia('Venda concluída', `${j.nome} foi vendido para o ${p.ext || CL[p.clube].nome} por ${fmtMi(p.valor)}.`, 'bom');
  // completa a escalação com o melhor reserva
  const nova = taticaAuto(S.clube, t.formacao); t.tit = t.tit.map((id, i) => id || nova.tit.find(x => !t.tit.includes(x)) || null);
  salvar();
}

// ---------- temporada ----------
function objetivoDe(clubeId) {
  const d = S.cl[clubeId].div; const ord = S.div[d].ids.slice().sort((a, b) => S.cl[b].rep - S.cl[a].rep);
  const k = ord.indexOf(clubeId) + 1;
  if (d === 'A') return k <= 2 ? { pos: 2, txt: 'Brigar pelo título' } : k <= 6 ? { pos: 6, txt: 'Vaga na Libertadores' } : k <= 12 ? { pos: 12, txt: 'Vaga na Sul-Americana' } : { pos: 16, txt: 'Evitar o rebaixamento' };
  if (d === 'B') return k <= 6 ? { pos: 4, txt: 'Subir para a Série A' } : k <= 14 ? { pos: 10, txt: 'Fazer campanha segura' } : { pos: 16, txt: 'Evitar o rebaixamento' };
  return k <= 8 ? { pos: 8, txt: 'Classificar para a 2ª fase' } : { pos: 16, txt: 'Fazer campanha segura' };
}
function encerrarTemporada() {
  for (const d of ['A', 'B', 'C']) { const D = S.div[d]; for (let i = D.feitas; i < D.rodadas.length; i++) simularRodadaDivisao(d, i); }
  const d = minhaDiv(), pos = posicao(S.clube);
  const cumpriu = pos <= S.objetivo.pos;
  S.resumo = { ano: S.ano, div: d, pos, cumpriu, campeao: { A: classificacao('A')[0], B: classificacao('B')[0], C: classificacao('C')[0] } };
  noticia('Fim de temporada', `${CL[S.clube].nome} terminou a ${DIVISOES[d].curto} em ${pos}º. Objetivo: ${S.objetivo.txt} — ${cumpriu ? 'cumprido' : 'não cumprido'}.`, cumpriu ? 'bom' : 'ruim');
}
function novaTemporada() {
  const A = classificacao('A'), B = classificacao('B'), C = classificacao('C');
  A.slice(-4).forEach(id => S.cl[id].div = 'B'); B.slice(0, 4).forEach(id => S.cl[id].div = 'A');
  B.slice(-4).forEach(id => S.cl[id].div = 'C'); C.slice(0, 4).forEach(id => S.cl[id].div = 'B');
  S.ano++;
  const r = rng(hashStr('evo' + S.ano));
  for (const id in S.jog) {
    const j = S.jog[id]; j.idade++; j.gols = 0; j.jogos = 0; j.cond = 100;
    const dv = j.idade <= 22 ? 1 + Math.floor(r() * 3) : j.idade <= 28 ? Math.floor(r() * 3) - 1 : j.idade <= 31 ? -Math.floor(r() * 2) : -1 - Math.floor(r() * 3);
    j.ovr = clamp(j.ovr + dv, 40, 94); j.valor = +valorDe(j.ovr, j.idade, !!j.ext).toFixed(2);
    if (j.clube && j.liga !== S.cl[j.clube].div) j.liga = S.cl[j.clube].div;
  }
  for (const id in S.cl) { S.cl[id].form = []; S.cl[id].tatica = id === S.clube ? taticaAuto(id, S.cl[id].tatica.formacao) : taticaAuto(id); }
  montarTemporada(); S.rodada = 0; S.resumo = null; S.objetivo = objetivoDe(S.clube);
  noticia('Nova temporada', `Começa a temporada ${S.ano}. Meta da diretoria: ${S.objetivo.txt.toLowerCase()}.`, 'info');
  salvar();
}

// ---------- novo jogo / salvar ----------
function criarCarreira(visual) {
  S = { v: 1, ano: 2026, visual: visual || 'pixel', tecnico: 'Técnico', clube: null, rodada: 0, news: [], extrato: [],
        diretoria: 68, torcida: 62, preco: 50, estrutura: { ct: 1, base: 1, estadio: 1 } };
  criarMundo(); montarTemporada();
}
function assumirClube(clubeId, tecnico) {
  S.clube = clubeId; S.tecnico = tecnico || 'Técnico';
  S.preco = DIVISOES[CL[clubeId].div].ingresso;
  S.caixa = CL[clubeId].caixa; S.objetivo = objetivoDe(clubeId);
  noticia('Bem-vindo', `${S.tecnico}, a diretoria do ${CL[clubeId].nome} confia em você. Meta da temporada: ${S.objetivo.txt.toLowerCase()}.`, 'info');
  noticia('Mercado aberto', 'A janela de transferências está aberta. Dá para contratar em 11 ligas estrangeiras e em todos os clubes das Séries A, B e C.', 'info');
  salvar();
}
function novoJogo(clubeId, tecnico, visual) { criarCarreira(visual); assumirClube(clubeId, tecnico); }
const CHAVE = 'prancheta-fc-v1';
function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify({ S, seq: _seq })); } catch (e) { } }
function carregar() { try { const raw = localStorage.getItem(CHAVE); if (!raw) return false; const o = JSON.parse(raw); if (!o || !o.S || o.S.v !== 1) return false; S = o.S; _seq = o.seq || 0; return true; } catch (e) { return false; } }
function temSave() { try { return !!localStorage.getItem(CHAVE); } catch (e) { return false; } }
function apagarSave() { try { localStorage.removeItem(CHAVE); } catch (e) { } }

// ---------- formatação ----------
function fmtMi(v) { const a = Math.abs(v); const s = a >= 1000 ? (a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' bi' : a >= 1 ? a.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi' : Math.round(a * 1000).toLocaleString('pt-BR') + ' mil'; return (v < 0 ? '−' : '') + 'R$ ' + s; }
function fmtMil(v) { return v >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi' : 'R$ ' + Math.round(v).toLocaleString('pt-BR') + ' mil'; }
