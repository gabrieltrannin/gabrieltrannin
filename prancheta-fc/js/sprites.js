/* Prancheta FC — gráficos gerados no navegador
 * - Bonecos em pixel art (grade de pixels + contorno automático)
 * - Bonecos "meio 3D" (chibi com volume, luz e sombra em canvas)
 * - Escudos genéricos com as cores do clube (sem logos oficiais)
 */

// ---------- utilidades de cor ----------
function hexRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rgbHex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function shade(h, f) { const [r, g, b] = hexRgb(h); return f >= 0 ? rgbHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f) : rgbHex(r * (1 + f), g * (1 + f), b * (1 + f)); }
function mix(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
function lum(h) { const [r, g, b] = hexRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- aparência dos jogadores ----------
const PELES = ['#F5D2B0', '#E6B08A', '#C98F62', '#A86C45', '#80502F', '#5C3820'];
const CABELOS = ['#17110D', '#2B1C13', '#4A2F1E', '#7A5230', '#C69A55', '#E6C885', '#9A3B1E'];
const ESTILOS = ['curto', 'curto', 'raspado', 'afro', 'longo', 'careca', 'moicano', 'topete', 'topete'];
const NAC_CLARA = new Set(['NOR', 'SWE', 'DEN', 'GER', 'NED', 'BEL', 'ING', 'SCO', 'IRL', 'POL', 'CRO', 'SRB', 'SVN', 'SVK', 'CZE', 'AUT', 'SUI', 'UKR', 'RUS', 'HUN', 'ISL', 'ITA', 'ESP', 'POR', 'FRA', 'USA', 'CAN', 'ARG', 'URU', 'CHI', 'GRE', 'TUR', 'GEO']);
const NAC_ESCURA = new Set(['SEN', 'CIV', 'CMR', 'NGA', 'GHA', 'GAB', 'GUI', 'MAR', 'ALG', 'EGY']);
const LOOKS_FIXOS = {
  'Erling Haaland': { pele: 0, cabelo: 5, estilo: 'longo', barba: false },
  'Lionel Messi': { pele: 1, cabelo: 2, estilo: 'curto', barba: true },
  'Cristiano Ronaldo': { pele: 1, cabelo: 0, estilo: 'topete', barba: false },
  'Neymar': { pele: 2, cabelo: 4, estilo: 'topete', barba: true },
  'Vinícius Júnior': { pele: 4, cabelo: 0, estilo: 'afro', barba: false },
  'Hulk': { pele: 2, cabelo: 0, estilo: 'raspado', barba: false },
  'Arrascaeta': { pele: 1, cabelo: 2, estilo: 'curto', barba: true },
  'Pedro': { pele: 2, cabelo: 0, estilo: 'raspado', barba: true },
  'Kylian Mbappé': { pele: 4, cabelo: 0, estilo: 'careca', barba: false },
  'Lamine Yamal': { pele: 3, cabelo: 0, estilo: 'afro', barba: false },
  'Thiago Silva': { pele: 2, cabelo: 0, estilo: 'raspado', barba: false },
  'Germán Cano': { pele: 1, cabelo: 0, estilo: 'raspado', barba: true },
  'Memphis': { pele: 4, cabelo: 0, estilo: 'moicano', barba: true },
  'Raphinha': { pele: 2, cabelo: 0, estilo: 'afro', barba: false },
};
function gerarLook(nome, nac) {
  if (LOOKS_FIXOS[nome]) return { ...LOOKS_FIXOS[nome] };
  const r = rng(hashStr(nome + '|' + nac));
  let pele;
  if (NAC_CLARA.has(nac)) pele = Math.floor(r() * 3.2);
  else if (NAC_ESCURA.has(nac)) pele = 3 + Math.floor(r() * 3);
  else pele = Math.floor(r() * 6);
  let cabelo = r() < 0.75 ? Math.floor(r() * 3) : 3 + Math.floor(r() * 4);
  if (pele >= 3) cabelo = Math.floor(r() * 2);
  let estilo = ESTILOS[Math.floor(r() * ESTILOS.length)];
  if (pele >= 3 && r() < 0.35) estilo = 'afro';
  return { pele, cabelo, estilo, barba: r() < 0.3 };
}

// ---------- uniformes ----------
function parseKit(s) {
  const [pad, c1, c2, c3, c4] = s.split(':');
  return { pad, c1, c2, c3, c4: c4 || c2 };
}
const CORES_GOLEIRO = ['#2BD96B', '#FF8A1F', '#FFD23F', '#19C3E6', '#B45CFF'];
function kitGoleiro(kit) {
  const c = CORES_GOLEIRO.find(x => Math.abs(lum(x) - lum(kit.c1)) > 0.12 && x !== kit.c1) || '#2BD96B';
  return { pad: 'solid', c1: c, c2: shade(c, -0.45), c3: shade(c, -0.55), c4: c, gk: true };
}
// cor da camisa em um ponto (u,v ∈ [0,1]) para o padrão do uniforme
function corPadrao(kit, u, v, n) {
  const { pad, c1, c2, c4 } = kit;
  n = n || 8;
  switch (pad) {
    case 'stripes': return Math.floor(u * n) % 2 ? c2 : c1;
    case 'stripes3': { const k = Math.floor(u * n) % 4; return [c1, c4, c2, c4][k]; }
    case 'hoops': return Math.floor(v * (n * 0.75)) % 2 ? c2 : c1;
    case 'hoops3': { const k = Math.floor(v * (n * 0.75)) % 4; return [c1, c4, c2, c4][k]; }
    case 'sash': { const d = u - v * 0.9; return (d > -0.12 && d < 0.18) ? c2 : c1; }
    case 'band': { if (v > 0.32 && v < 0.47) return c2; if (kit.c4 !== kit.c2 && v >= 0.47 && v < 0.58) return c4; return c1; }
    default: return c1;
  }
}

// ---------- PIXEL ART ----------
const PX_OUT = '#12131B';
function spritePixelGrid(look, kit, frame) {
  const W = 16, H = 22;
  const g = Array.from({ length: H }, () => Array(W).fill(null));
  const pele = PELES[look.pele], peleS = shade(pele, -0.18), cab = CABELOS[look.cabelo];
  const set = (r, c, col) => { if (r >= 0 && r < H && c >= 0 && c < W) g[r][c] = col; };
  const fillRow = (r, a, b, col) => { for (let c = a; c <= b; c++) set(r, c, col); };
  // cabeça
  fillRow(2, 5, 10, pele); for (let r = 3; r <= 7; r++) fillRow(r, 4, 11, pele); fillRow(8, 5, 10, pele);
  set(5, 3, peleS); set(5, 12, peleS);
  for (let r = 3; r <= 8; r++) set(r, 11, peleS);
  set(5, 6, '#1A1A1A'); set(5, 9, '#1A1A1A');
  set(4, 6, shade(cab, 0.1)); set(4, 9, shade(cab, 0.1));
  set(7, 7, shade(pele, -0.32)); set(7, 8, shade(pele, -0.32));
  // cabelo
  const E = look.estilo;
  if (E === 'curto' || E === 'longo') { fillRow(1, 5, 10, cab); fillRow(2, 4, 11, cab); set(3, 4, cab); set(3, 11, cab); set(3, 5, cab); }
  if (E === 'longo') { for (let r = 3; r <= 9; r++) { set(r, 3, cab); set(r, 12, cab); } }
  if (E === 'topete') { fillRow(0, 6, 10, cab); fillRow(1, 5, 11, cab); fillRow(2, 4, 11, cab); set(3, 4, cab); set(3, 11, cab); }
  if (E === 'afro') { fillRow(0, 5, 10, cab); fillRow(1, 4, 11, cab); fillRow(2, 3, 12, cab); set(3, 3, cab); set(3, 4, cab); set(3, 11, cab); set(3, 12, cab); set(4, 3, cab); set(4, 12, cab); }
  if (E === 'raspado') { const c = mix(cab, pele, 0.45); fillRow(2, 5, 10, c); set(3, 4, c); set(3, 11, c); }
  if (E === 'moicano') { fillRow(0, 7, 8, cab); fillRow(1, 7, 8, cab); fillRow(2, 6, 9, cab); }
  if (E === 'careca') { set(3, 6, shade(pele, 0.3)); }
  if (look.barba) { set(6, 4, cab); set(6, 11, cab); set(7, 4, cab); set(7, 5, cab); set(7, 6, cab); set(7, 9, cab); set(7, 10, cab); set(7, 11, cab); fillRow(8, 5, 10, cab); }
  // pescoço
  set(9, 7, peleS); set(9, 8, peleS);
  // camisa (corpo 10..15, colunas 4..11)
  for (let r = 10; r <= 15; r++) for (let c = 4; c <= 11; c++) {
    let col = corPadrao(kit, (c - 4) / 8, (r - 10) / 6, 8);
    if (c >= 10) col = shade(col, -0.16); else if (c === 4) col = shade(col, 0.08);
    set(r, c, col);
  }
  set(10, 7, kit.c2 === kit.c1 ? shade(kit.c1, -0.3) : kit.c2); set(10, 8, kit.c2 === kit.c1 ? shade(kit.c1, -0.3) : kit.c2);
  // mangas e braços
  const manga = kit.pad === 'stripes' || kit.pad === 'stripes3' ? kit.c1 : corPadrao(kit, 0.5, 0.15);
  set(10, 3, manga); set(10, 12, shade(manga, -0.16));
  for (let r = 11; r <= 12; r++) { set(r, 2, manga); set(r, 3, manga); set(r, 12, shade(manga, -0.16)); set(r, 13, shade(manga, -0.16)); }
  const mao = kit.gk ? '#F2F2F2' : pele;
  set(13, 2, pele); set(13, 3, pele); set(13, 12, peleS); set(13, 13, peleS);
  set(14, 2, mao); set(14, 3, mao); set(14, 12, kit.gk ? '#D9D9D9' : peleS); set(14, 13, kit.gk ? '#D9D9D9' : peleS);
  // calção
  const cal = kit.c3;
  fillRow(16, 4, 11, cal); fillRow(17, 4, 6, cal); fillRow(17, 9, 11, cal); set(16, 10, shade(cal, -0.16)); set(16, 11, shade(cal, -0.16)); set(17, 10, shade(cal, -0.16)); set(17, 11, shade(cal, -0.16));
  set(17, 7, shade(cal, -0.25)); set(17, 8, shade(cal, -0.25));
  // pernas (frame 0 = parado, 1/2 = corrida)
  const meia = kit.gk ? kit.c1 : (lum(kit.c1) > 0.85 ? kit.c3 : kit.c1);
  const perna = (c0, up) => {
    set(18 - up, c0, pele); set(18 - up, c0 + 1, peleS);
    set(19 - up, c0, meia); set(19 - up, c0 + 1, shade(meia, -0.16));
    set(20 - up, c0, meia); set(20 - up, c0 + 1, shade(meia, -0.16));
    set(21 - up, c0 - 1, '#1E1E24'); set(21 - up, c0, '#2A2A33'); set(21 - up, c0 + 1, '#F2F2F2');
  };
  perna(5, frame === 1 ? 1 : 0); perna(9, frame === 2 ? 1 : 0);
  return g;
}
function gridParaCanvas(g, pad = 1) {
  const H = g.length, W = g[0].length;
  const cv = document.createElement('canvas'); cv.width = W + pad * 2; cv.height = H + pad * 2;
  const ctx = cv.getContext('2d');
  const filled = (r, c) => r >= 0 && r < H && c >= 0 && c < W && g[r][c];
  for (let r = -pad; r < H + pad; r++) for (let c = -pad; c < W + pad; c++) {
    if (filled(r, c)) { ctx.fillStyle = g[r][c]; ctx.fillRect(c + pad, r + pad, 1, 1); }
    else if (filled(r - 1, c) || filled(r + 1, c) || filled(r, c - 1) || filled(r, c + 1)) { ctx.fillStyle = PX_OUT; ctx.fillRect(c + pad, r + pad, 1, 1); }
  }
  return cv;
}
// boneco pequeno para a partida em pixel art (7x10 + contorno)
function miniPixelGrid(look, kit, frame) {
  const W = 7, H = 10; const g = Array.from({ length: H }, () => Array(W).fill(null));
  const pele = PELES[look.pele], cab = CABELOS[look.cabelo];
  const set = (r, c, col) => { if (r >= 0 && r < H && c >= 0 && c < W) g[r][c] = col; };
  const careca = look.estilo === 'careca' || look.estilo === 'raspado';
  set(0, 2, careca ? pele : cab); set(0, 3, careca ? pele : cab); set(0, 4, careca ? pele : cab);
  if (look.estilo === 'afro') { set(0, 1, cab); set(0, 5, cab); set(1, 1, cab); set(1, 5, cab); }
  set(1, 2, pele); set(1, 3, pele); set(1, 4, pele); if (look.estilo !== 'afro') { set(1, 1, careca ? pele : cab); set(1, 5, careca ? pele : cab); }
  set(2, 2, pele); set(2, 3, pele); set(2, 4, shade(pele, -0.15));
  for (let c = 1; c <= 5; c++) { set(3, c, corPadrao(kit, (c - 1) / 5, 0.1, 5)); set(4, c, corPadrao(kit, (c - 1) / 5, 0.5, 5)); set(5, c, corPadrao(kit, (c - 1) / 5, 0.9, 5)); }
  set(4, 0, pele); set(4, 6, pele);
  for (let c = 1; c <= 5; c++) set(6, c, kit.c3);
  if (frame === 0) { set(7, 2, pele); set(7, 4, pele); set(8, 2, '#222'); set(8, 4, '#222'); }
  else if (frame === 1) { set(7, 1, pele); set(7, 4, pele); set(8, 1, '#222'); set(8, 5, '#222'); }
  else { set(7, 2, pele); set(7, 5, pele); set(8, 1, '#222'); set(8, 5, '#222'); }
  return g;
}

// ---------- 3D (chibi com volume) ----------
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function capsula(ctx, x1, y1, x2, y2, w, fill) {
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = fill; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
function grad(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
function rgrad(ctx, x, y, r0, x1, y1, r1, stops) { const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }

// desenha um boneco 3D com os pés em (cx, gy) e altura h
function desenha3D(ctx, cx, gy, h, look, kit, opts = {}) {
  const fase = opts.fase || 0; // corrida: ângulo em radianos
  const correndo = !!opts.correndo;
  const pele = PELES[look.pele], cab = CABELOS[look.cabelo];
  const sw = Math.sin(fase) * (correndo ? 1 : 0);
  ctx.save();
  // sombra no chão
  if (!opts.semSombra) {
    ctx.fillStyle = rgrad(ctx, cx, gy, 0, cx, gy, h * 0.26, [[0, 'rgba(0,0,0,.45)'], [1, 'rgba(0,0,0,0)']]);
    ctx.beginPath(); ctx.ellipse(cx, gy, h * 0.26, h * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  }
  const bob = correndo ? Math.abs(Math.cos(fase)) * h * 0.025 : 0;
  ctx.translate(0, -bob);
  // pernas
  const meia = kit.gk ? kit.c1 : (lum(kit.c1) > 0.85 ? kit.c3 : kit.c1);
  const perna = (dx, off) => {
    const x = cx + dx, top = gy - h * 0.3, bot = gy - h * 0.05 - off;
    capsula(ctx, x, top, x + off * 0.3, bot, h * 0.085, grad(ctx, x - h * 0.05, 0, x + h * 0.05, 0, [[0, shade(pele, 0.12)], [1, shade(pele, -0.25)]]));
    capsula(ctx, x + off * 0.15, top + h * 0.1, x + off * 0.3, bot, h * 0.092, grad(ctx, x - h * 0.05, 0, x + h * 0.05, 0, [[0, shade(meia, 0.15)], [1, shade(meia, -0.3)]]));
    ctx.fillStyle = grad(ctx, x, bot - h * 0.03, x, bot + h * 0.04, [[0, '#4A4A55'], [1, '#121218']]);
    ctx.beginPath(); ctx.ellipse(x + off * 0.3 + h * 0.012, bot + h * 0.012, h * 0.062, h * 0.036, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x + off * 0.3 - h * 0.012, bot, h * 0.025, h * 0.01, 0, 0, Math.PI * 2); ctx.fill();
  };
  perna(-h * 0.065, sw * h * 0.06); perna(h * 0.065, -sw * h * 0.06);
  // calção
  const cal = kit.c3;
  ctx.fillStyle = grad(ctx, cx - h * 0.15, 0, cx + h * 0.15, 0, [[0, shade(cal, 0.18)], [0.55, cal], [1, shade(cal, -0.35)]]);
  rr(ctx, cx - h * 0.145, gy - h * 0.375, h * 0.29, h * 0.12, h * 0.045); ctx.fill();
  // braços (atrás do tronco)
  const pelB = grad(ctx, 0, gy - h * 0.6, 0, gy - h * 0.35, [[0, shade(pele, 0.1)], [1, shade(pele, -0.2)]]);
  const manga = kit.pad === 'stripes' || kit.pad === 'stripes3' || kit.pad === 'band' ? kit.c1 : corPadrao(kit, 0.5, 0.1);
  const braco = (sx, d) => {
    const x0 = cx + sx * h * 0.155, y0 = gy - h * 0.58;
    const x1 = cx + sx * h * 0.215 + d * h * 0.05, y1 = gy - h * 0.4;
    capsula(ctx, x0, y0, x1, y1, h * 0.075, pelB);
    capsula(ctx, x0, y0, x0 + (x1 - x0) * 0.45, y0 + (y1 - y0) * 0.45, h * 0.088, grad(ctx, x0 - h * 0.05, 0, x0 + h * 0.05, 0, [[0, shade(manga, 0.15)], [1, shade(manga, -0.3)]]));
    ctx.fillStyle = kit.gk ? grad(ctx, x1, y1 - h * 0.04, x1, y1 + h * 0.04, [[0, '#FFFFFF'], [1, '#BFC3CC']]) : shade(pele, -0.05);
    ctx.beginPath(); ctx.arc(x1, y1 + h * 0.01, h * (kit.gk ? 0.05 : 0.04), 0, Math.PI * 2); ctx.fill();
  };
  braco(-1, sw); braco(1, -sw);
  // tronco com padrão
  const tx = cx - h * 0.16, ty = gy - h * 0.625, tw = h * 0.32, th = h * 0.28;
  ctx.save(); rr(ctx, tx, ty, tw, th, h * 0.075); ctx.clip();
  const N = 24;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    ctx.fillStyle = corPadrao(kit, i / N, j / N, 6);
    ctx.fillRect(tx + (i / N) * tw - 0.5, ty + (j / N) * th - 0.5, tw / N + 1, th / N + 1);
  }
  // volume: luz de cima/esquerda, sombra embaixo/direita
  ctx.fillStyle = grad(ctx, tx, ty, tx + tw, ty + th, [[0, 'rgba(255,255,255,.32)'], [0.45, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,.42)']]);
  ctx.fillRect(tx, ty, tw, th);
  ctx.fillStyle = rgrad(ctx, tx + tw * 0.3, ty + th * 0.2, 0, tx + tw * 0.3, ty + th * 0.2, tw * 0.5, [[0, 'rgba(255,255,255,.22)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fillRect(tx, ty, tw, th);
  // gola
  ctx.fillStyle = kit.c2 === kit.c1 ? shade(kit.c1, -0.35) : kit.c2;
  ctx.beginPath(); ctx.moveTo(cx - h * 0.055, ty); ctx.lineTo(cx, ty + h * 0.05); ctx.lineTo(cx + h * 0.055, ty); ctx.closePath(); ctx.fill();
  ctx.restore();
  // contorno suave do tronco
  ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = Math.max(1, h * 0.008); rr(ctx, tx, ty, tw, th, h * 0.075); ctx.stroke();
  // pescoço
  ctx.fillStyle = shade(pele, -0.22); rr(ctx, cx - h * 0.04, gy - h * 0.66, h * 0.08, h * 0.05, h * 0.02); ctx.fill();
  // cabeça
  const hx = cx, hy = gy - h * 0.8, R = h * 0.19;
  if (look.estilo === 'afro') { ctx.fillStyle = rgrad(ctx, hx - R * 0.4, hy - R * 0.9, 0, hx, hy - R * 0.3, R * 1.35, [[0, shade(cab, 0.25)], [1, shade(cab, -0.3)]]); ctx.beginPath(); ctx.arc(hx, hy - R * 0.25, R * 1.18, 0, Math.PI * 2); ctx.fill(); }
  if (look.estilo === 'longo') { ctx.fillStyle = shade(cab, -0.12); rr(ctx, hx - R * 1.08, hy - R * 0.4, R * 2.16, R * 1.55, R * 0.5); ctx.fill(); }
  // orelhas
  ctx.fillStyle = shade(pele, -0.12);
  ctx.beginPath(); ctx.ellipse(hx - R * 0.98, hy + R * 0.08, R * 0.17, R * 0.24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx + R * 0.98, hy + R * 0.08, R * 0.17, R * 0.24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgrad(ctx, hx - R * 0.35, hy - R * 0.4, R * 0.05, hx, hy, R * 1.05, [[0, shade(pele, 0.28)], [0.55, pele], [1, shade(pele, -0.3)]]);
  ctx.beginPath(); ctx.arc(hx, hy, R, 0, Math.PI * 2); ctx.fill();
  // barba
  if (look.barba) {
    ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = shade(cab, 0.05); ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(hx, hy + R * 0.78, R * 0.95, R * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = shade(pele, 0.05); ctx.beginPath(); ctx.ellipse(hx, hy + R * 0.42, R * 0.22, R * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // cabelo
  const cabG = grad(ctx, hx, hy - R, hx, hy, [[0, shade(cab, 0.28)], [1, shade(cab, -0.2)]]);
  ctx.fillStyle = cabG;
  if (look.estilo === 'curto' || look.estilo === 'longo') {
    ctx.beginPath(); ctx.arc(hx, hy - R * 0.08, R * 1.04, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(hx + R * 0.4, hy - R * 0.55, hx - R * 0.2, hy - R * 0.42); ctx.quadraticCurveTo(hx - R * 0.7, hy - R * 0.35, hx - R * 1.03, hy - R * 0.1); ctx.fill();
  } else if (look.estilo === 'topete') {
    ctx.beginPath(); ctx.arc(hx, hy - R * 0.06, R * 1.04, Math.PI * 1.05, Math.PI * 1.95); ctx.quadraticCurveTo(hx + R * 0.9, hy - R * 1.5, hx - R * 0.2, hy - R * 1.32); ctx.quadraticCurveTo(hx - R * 0.95, hy - R * 1.1, hx - R * 1.02, hy - R * 0.2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(hx - R * 0.15, hy - R * 1.05, R * 0.4, R * 0.12, -0.3, 0, Math.PI * 2); ctx.fill();
  } else if (look.estilo === 'afro') {
    ctx.beginPath(); ctx.arc(hx, hy - R * 0.25, R * 1.12, Math.PI * 1.05, Math.PI * 1.95); ctx.quadraticCurveTo(hx, hy - R * 0.55, hx - R * 1.08, hy - R * 0.35); ctx.fill();
  } else if (look.estilo === 'raspado') {
    ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(hx, hy - R * 0.02, R * 1.0, Math.PI * 1.08, Math.PI * 1.92); ctx.quadraticCurveTo(hx, hy - R * 0.62, hx - R * 0.98, hy - R * 0.28); ctx.fill(); ctx.globalAlpha = 1;
  } else if (look.estilo === 'moicano') {
    ctx.beginPath(); ctx.ellipse(hx, hy - R * 0.85, R * 0.24, R * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  }
  // olhos
  const ey = hy + R * 0.12, ex = R * 0.36;
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#1B1B22'; ctx.beginPath(); ctx.ellipse(hx + s * ex, ey, R * 0.12, R * 0.17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(hx + s * ex - R * 0.04, ey - R * 0.06, R * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = shade(cab, -0.1); ctx.lineWidth = Math.max(1, R * 0.08); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx + s * ex - R * 0.15, ey - R * 0.3); ctx.lineTo(hx + s * ex + R * 0.13, ey - R * 0.33 + (s > 0 ? 0 : 0.02)); ctx.stroke();
  }
  // bochechas e boca
  ctx.fillStyle = 'rgba(255,110,110,.18)';
  ctx.beginPath(); ctx.ellipse(hx - R * 0.6, hy + R * 0.42, R * 0.18, R * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx + R * 0.6, hy + R * 0.42, R * 0.18, R * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = shade(pele, -0.45); ctx.lineWidth = Math.max(1, R * 0.07);
  ctx.beginPath(); ctx.arc(hx, hy + R * 0.42, R * 0.17, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  // brilho de borda na cabeça
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = Math.max(1, R * 0.06);
  ctx.beginPath(); ctx.arc(hx, hy, R * 0.94, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
  ctx.restore();
}

// ---------- cache de imagens ----------
const _cacheImg = new Map();
function retratoURL(jog, estilo, modo = 'corpo') {
  const kit = jog.pos === 'GOL' ? kitGoleiro(jog.kit) : jog.kit;
  const key = [estilo, modo, jog.nome, kit.pad, kit.c1, kit.c2, kit.c3, jog.look.estilo, jog.look.pele].join('|');
  if (_cacheImg.has(key)) return _cacheImg.get(key);
  let url;
  if (estilo === 'pixel') {
    const cv = gridParaCanvas(spritePixelGrid(jog.look, kit, 0));
    if (modo === 'busto') {
      const b = document.createElement('canvas'); b.width = 18; b.height = 15;
      b.getContext('2d').drawImage(cv, 0, 0); url = b.toDataURL();
    } else url = cv.toDataURL();
  } else {
    const W = modo === 'busto' ? 120 : 120, H = modo === 'busto' ? 104 : 168;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    if (modo === 'busto') desenha3D(ctx, W / 2, H * 1.62, H * 1.58, jog.look, kit, { semSombra: true });
    else desenha3D(ctx, W / 2, H - 8, H - 14, jog.look, kit, {});
    url = cv.toDataURL();
  }
  _cacheImg.set(key, url);
  return url;
}

// quadros da partida (canvas) por jogador
function quadrosPartida(jog, kit, estilo) {
  const key = ['partida', estilo, jog.nome, kit.c1, kit.c2, kit.pad, kit.gk ? 1 : 0].join('|');
  if (_cacheImg.has(key)) return _cacheImg.get(key);
  let fr;
  if (estilo === 'pixel') fr = [0, 1, 2].map(f => gridParaCanvas(miniPixelGrid(jog.look, kit, f)));
  else fr = [0, 1, 2, 3].map(i => {
    const cv = document.createElement('canvas'); cv.width = 56; cv.height = 84;
    desenha3D(cv.getContext('2d'), 28, 78, 72, jog.look, kit, { correndo: i > 0, fase: i * Math.PI / 2, semSombra: true });
    return cv;
  });
  _cacheImg.set(key, fr);
  return fr;
}

// ---------- escudos ----------
function escudoSVG(cl, estilo, tam = 40) {
  const k = cl.kit; const id = 'e' + cl.id + estilo;
  const txtCor = lum(k.c1) > 0.6 ? '#15161C' : '#FFFFFF';
  const sig = cl.sigla;
  let faixas = '';
  const W = 40, H = 46;
  const n = 5;
  if (k.pad === 'stripes' || k.pad === 'stripes3') for (let i = 0; i < n; i++) { const cols = k.pad === 'stripes' ? [k.c1, k.c2] : [k.c1, k.c4, k.c2, k.c4]; faixas += `<rect x="${i * W / n}" y="0" width="${W / n + .3}" height="${H}" fill="${cols[i % cols.length]}"/>`; }
  else if (k.pad === 'hoops' || k.pad === 'hoops3') for (let i = 0; i < 6; i++) { const cols = k.pad === 'hoops' ? [k.c1, k.c2] : [k.c1, k.c4, k.c2, k.c4]; faixas += `<rect x="0" y="${i * H / 6}" width="${W}" height="${H / 6 + .3}" fill="${cols[i % cols.length]}"/>`; }
  else if (k.pad === 'sash') faixas = `<rect width="${W}" height="${H}" fill="${k.c1}"/><polygon points="0,4 10,0 40,40 40,46 32,46 0,12" fill="${k.c2}"/>`;
  else if (k.pad === 'band') faixas = `<rect width="${W}" height="${H}" fill="${k.c1}"/><rect y="17" width="${W}" height="6" fill="${k.c2}"/>${k.c4 !== k.c2 ? `<rect y="23" width="${W}" height="4" fill="${k.c4}"/>` : ''}`;
  else faixas = `<rect width="${W}" height="${H}" fill="${k.c1}"/><rect width="${W}" height="11" fill="${k.c2}"/>`;
  if (estilo === 'pixel') {
    const pts = '4,2 36,2 36,28 34,28 34,32 32,32 32,35 29,35 29,38 26,38 26,40 23,40 23,42 17,42 17,40 14,40 14,38 11,38 11,35 8,35 8,32 6,32 6,28 4,28';
    return `<svg class="escudo" width="${tam}" height="${tam * 1.15}" viewBox="0 0 40 46" shape-rendering="crispEdges" aria-hidden="true"><defs><clipPath id="${id}"><polygon points="${pts}"/></clipPath></defs><g clip-path="url(#${id})">${faixas}</g><rect x="9" y="14" width="22" height="12" fill="${lum(k.c1) > 0.6 ? '#FFFFFF' : '#15161C'}" opacity=".85"/><text x="20" y="23.5" text-anchor="middle" font-family="Silkscreen, monospace" font-size="8" fill="${lum(k.c1) > 0.6 ? '#15161C' : '#FFFFFF'}">${sig}</text><polygon points="${pts}" fill="none" stroke="#12131B" stroke-width="2"/></svg>`;
  }
  const path = 'M20 2C27 2 33 3.6 37 6V23C37 33.5 29.5 40 20 44C10.5 40 3 33.5 3 23V6C7 3.6 13 2 20 2Z';
  return `<svg class="escudo" width="${tam}" height="${tam * 1.15}" viewBox="0 0 40 46" aria-hidden="true"><defs><clipPath id="${id}"><path d="${path}"/></clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient></defs><g clip-path="url(#${id})">${faixas}<rect width="40" height="46" fill="url(#${id}g)"/><ellipse cx="14" cy="6" rx="16" ry="7" fill="#fff" opacity=".22"/></g><circle cx="20" cy="22" r="9.5" fill="${lum(k.c1) > 0.6 ? '#FFFFFF' : '#15161C'}" opacity=".88"/><text x="20" y="25.6" text-anchor="middle" font-family="'Barlow Condensed', sans-serif" font-weight="800" font-size="9.5" fill="${lum(k.c1) > 0.6 ? '#15161C' : '#FFFFFF'}">${sig}</text><path d="${path}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1.4"/><path d="M20 3.6C26.5 3.6 32 5 35.4 7" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1"/></svg>`;
}

// ---------- estádio (banner da Central) ----------
function desenhaEstadio(cv, cl, estilo) {
  const ctx = cv.getContext('2d');
  const k = cl.kit; const r = rng(hashStr(cl.id));
  if (estilo === 'pixel') {
    const W = 240, H = 72; cv.width = W; cv.height = H;
    ctx.imageSmoothingEnabled = false;
    const ceu = ['#0B0D1E', '#121634', '#1A1F48', '#232A5C'];
    for (let y = 0; y < 30; y++) { ctx.fillStyle = ceu[Math.min(3, Math.floor(y / 8))]; ctx.fillRect(0, y, W, 1); }
    for (let i = 0; i < 26; i++) { ctx.fillStyle = r() < .5 ? '#FFFFFF' : '#8FA0FF'; ctx.fillRect(Math.floor(r() * W), Math.floor(r() * 18), 1, 1); }
    // refletores
    for (const x of [18, W - 22]) {
      ctx.fillStyle = '#2B2E3F'; ctx.fillRect(x + 1, 6, 2, 30);
      ctx.fillStyle = '#FFF6C9'; ctx.fillRect(x - 2, 3, 8, 4);
      ctx.fillStyle = 'rgba(255,246,201,.10)';
      ctx.beginPath(); ctx.moveTo(x - 2, 7); ctx.lineTo(x + 6, 7); ctx.lineTo(x + 50 * (x < W / 2 ? 1 : -0.2), 60); ctx.lineTo(x - 50 * (x < W / 2 ? 0.2 : 1), 60); ctx.fill();
    }
    // arquibancadas
    const cores = [k.c1, k.c2, k.c1, '#F4F4F4', shade(k.c1, -0.4), PELES[1], PELES[3]];
    for (let tier = 0; tier < 3; tier++) {
      const y0 = 26 + tier * 9;
      ctx.fillStyle = shade('#3A3F5C', -tier * 0.1); ctx.fillRect(0, y0, W, 9);
      for (let x = 2; x < W - 2; x += 2) for (let y = y0 + 2; y < y0 + 8; y += 3) {
        if (r() < 0.82) { ctx.fillStyle = cores[Math.floor(r() * cores.length)]; ctx.fillRect(x, y, 1, 2); }
      }
      ctx.fillStyle = '#1A1C2A'; ctx.fillRect(0, y0 + 8, W, 1);
    }
    // faixa de publicidade e gramado
    ctx.fillStyle = k.c1; ctx.fillRect(0, 53, W, 3); ctx.fillStyle = k.c2; for (let x = 0; x < W; x += 12) ctx.fillRect(x, 54, 6, 1);
    for (let y = 56; y < H; y++) { ctx.fillStyle = Math.floor((y - 56) / 4) % 2 ? '#3E9B4F' : '#47AD59'; ctx.fillRect(0, y, W, 1); }
    ctx.fillStyle = '#E8F5E0'; ctx.fillRect(0, 58, W, 1); ctx.fillRect(W / 2, 58, 1, H - 58);
    return;
  }
  const W = 960, H = 280; cv.width = W; cv.height = H;
  ctx.fillStyle = grad(ctx, 0, 0, 0, H, [[0, '#060914'], [0.45, '#121A36'], [1, '#0B1022']]); ctx.fillRect(0, 0, W, H);
  // feixes de luz
  for (const [x, d] of [[90, 1], [W - 90, -1]]) {
    ctx.fillStyle = rgrad(ctx, x, 40, 0, x, 40, 360, [[0, 'rgba(255,240,200,.38)'], [1, 'rgba(255,240,200,0)']]);
    ctx.beginPath(); ctx.moveTo(x - 20, 40); ctx.lineTo(x + 20, 40); ctx.lineTo(x + d * 420, H); ctx.lineTo(x + d * 60, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFF8E0'; ctx.shadowColor = '#FFE9A8'; ctx.shadowBlur = 30; rr(ctx, x - 26, 24, 52, 18, 5); ctx.fill(); ctx.shadowBlur = 0;
  }
  // arquibancada curva
  for (let tier = 0; tier < 4; tier++) {
    const y0 = 92 + tier * 34, curv = 26 - tier * 4;
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, y0 + curv); ctx.quadraticCurveTo(W / 2, y0 - curv, W, y0 + curv); ctx.lineTo(W, y0 + curv + 34); ctx.quadraticCurveTo(W / 2, y0 - curv + 34, 0, y0 + curv + 34); ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, y0, 0, y0 + 40, [[0, '#2A3150'], [1, '#161B30']]); ctx.fill(); ctx.clip();
    const cores = [k.c1, k.c1, k.c2, '#F4F4F4', shade(k.c1, -0.3)];
    for (let i = 0; i < 520; i++) {
      const x = r() * W, y = y0 - 26 + r() * 64;
      ctx.fillStyle = cores[Math.floor(r() * cores.length)]; ctx.globalAlpha = 0.55 + r() * 0.45;
      ctx.beginPath(); ctx.arc(x, y, 2.2 + r() * 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // gramado
  ctx.fillStyle = grad(ctx, 0, 228, 0, H, [[0, '#2F9A4A'], [1, '#1D6B33']]); ctx.fillRect(0, 228, W, H - 228);
  for (let i = 0; i < 12; i += 2) { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(i * W / 12, 228, W / 12, H - 228); }
  ctx.fillStyle = grad(ctx, 0, 220, 0, 232, [[0, k.c1], [1, shade(k.c1, -0.4)]]); ctx.fillRect(0, 220, W, 10);
  ctx.fillStyle = rgrad(ctx, W / 2, H, 0, W / 2, H, W * 0.6, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.5)']]); ctx.fillRect(0, 0, W, H);
}
