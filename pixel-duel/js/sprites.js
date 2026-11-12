/* Pixel Duel — gerador de pixel art.
 * Cada tipo de monstro tem uma "máscara" (silhueta com células aleatórias).
 * A semente vem do id da carta, então cada carta tem um sprite único e estável. */
(function () {
  const PD = (window.PD = window.PD || {});

  /* Legenda das máscaras:
   *  .  vazio         #  corpo           ?  corpo ou vazio
   *  *  corpo ou contorno                o  contorno
   *  a  destaque ou corpo                A  destaque
   *  E  olho          B  roupa (retratos) s  pele (retratos)
   * Máscaras "half" têm 10 colunas e são espelhadas (a coluna 9 fica no centro). */
  const MASKS = {
    guerreiro: { half: true, rows: [
      '........?A',
      '.......?AA',
      '......####',
      '.....#####',
      '.....#####',
      '.....oEooo',
      '.....#####',
      '......####',
      '..**...###',
      '.*##a#####',
      '.###a##aa#',
      '.##?.#####',
      '.##..##a##',
      '.?#..#####',
      '.##..AAAAA',
      '.....###..',
      '.....###..',
      '.....?##..',
      '....####..',
      '....###...',
    ] },
    mago: { half: true, rows: [
      '.........A',
      '........aA',
      '........##',
      '.......a##',
      '.......###',
      '......a###',
      '....AAAAAA',
      '......####',
      '......#E##',
      '......####',
      '......?aa#',
      '.....#####',
      '...?######',
      '..?*.#####',
      '..*..##a##',
      '.....##a##',
      '....###a##',
      '....######',
      '...#######',
      '...??#####',
    ] },
    maquina: { half: true, rows: [
      '........*?',
      '.........A',
      '......####',
      '......#EE#',
      '......####',
      '.......o##',
      '...?######',
      '..*#######',
      '..##.#aAa#',
      '..##.#####',
      '..##.#a#a#',
      '..oo.#####',
      '.....#####',
      '.....##...',
      '.....##...',
      '....###...',
      '....####..',
    ] },
    demonio: { half: true, rows: [
      '.....?....',
      '.....*....',
      '......*###',
      '*.....####',
      '**....#E##',
      '*?*...####',
      '*??*..#ooo',
      '*???*.####',
      '.*???#####',
      '..*??#####',
      '...*.#aa##',
      '....##aa##',
      '....#.####',
      '...?..####',
      '......##..',
      '......##..',
      '.....###..',
    ] },
    planta: { half: true, rows: [
      '.......AA.',
      '....A.AaaA',
      '....AA####',
      '...Aa#####',
      '...A##E###',
      '...Aa#####',
      '....A#oooo',
      '....AA####',
      '.......AAA',
      '........##',
      '...?#...##',
      '..*##*..##',
      '..?###.###',
      '....####.#',
      '........##',
      '......####',
      '....??####',
      '...?.*.??.',
    ] },
    inseto: { half: true, rows: [
      '.....*....',
      '......*...',
      '.......*##',
      '.......#E#',
      '..*....###',
      '...*.#####',
      '....######',
      '..*o##a###',
      '.*..#aaAoo',
      '...######o',
      '..*#aa###o',
      '.*.######o',
      '...#aa###o',
      '..*.#####o',
      '....####..',
      '.....###..',
    ] },
    espirito: { half: true, rows: [
      '......aAAA',
      '..........',
      '......####',
      '.....#####',
      '.....#E###',
      '.....#####',
      '*....##o##',
      '**...#####',
      '*?*.######',
      '.*?#######',
      '..?#######',
      '...?######',
      '....######',
      '....######',
      '....?#####',
      '....*?####',
      '.....??#?#',
      '......?.?*',
    ] },
    retrato: { half: true, rows: [
      '.....AAAAA',
      '....AAAAAA',
      '...AAAAAAA',
      '...AAsssss',
      '...Assssss',
      '...AssEsss',
      '...Assssss',
      '...?ssssss',
      '....sssssD',
      '.....sssss',
      '......ssss',
      '....BBBsss',
      '..BBBBBBBB',
      '.BBBBBBBBa',
      'BBBBBBBBBa',
      'BBBBBBBBaB',
    ] },
    dragao: { half: false, rows: [
      '..........*.....*...',
      '..........**...**...',
      '...........*?*?*....',
      '...*.......*****?...',
      '..***......******...',
      '.##E#*.....*****....',
      '######.....****.....',
      '###..##...#####.....',
      '.A....##.#######....',
      '.......#########....',
      '......##aaaa#####...',
      '......##aaaa######..',
      '.......#aaa###..###.',
      '.......########...##',
      '........#####......#',
      '.......##...##.....#',
      '.......#....#......?',
      '......##...##.......',
    ] },
    fera: { half: false, rows: [
      '..*.*...............',
      '..###...............',
      '.#E##*..............',
      '######.......?......',
      'A###########?*......',
      '...##########*......',
      '....##########*.....',
      '....###aaaa####**...',
      '....###aaaa####..*..',
      '....##aaaa#####.....',
      '....#########.......',
      '....##.##..##.##....',
      '....##.##..##.##....',
      '....#..#...#..#.....',
      '...##.##..##.##.....',
    ] },
    aquatico: { half: false, rows: [
      '...........*..*.....',
      '.........*****......',
      '......##########....',
      '....######?#######.*',
      '..##E##########aa***',
      '.###############a***',
      '..aaa########aa##.*.',
      '...aaaaaaaaa####...*',
      '.....?aa###?........',
      '.......*?*..........',
    ] },
  };

  /* Glifos 12x12 para Magias e Armadilhas. # = cor principal, a = brilho */
  const GLYPHS = {
    flame: [
      '.....a......', '....aa......', '....a#a.....', '...a##a..a..', '...a###a.aa.', '..a####aa#a.',
      '..a###a####a', '.a###aa###a.', '.a##aaaa##a.', '.a##a..a##a.', '..a##aa##a..', '...aaaaaa...'],
    heart: [
      '............', '..aaa..aaa..', '.a###aa###a.', 'a##a######a.', 'a#a#######a.', 'a#########a.',
      '.a#######a..', '..a#####a...', '...a###a....', '....a#a.....', '.....a......', '............'],
    cards: [
      '............', '..aaaaaa....', '..a####a....', '..a#aaaaaaa.', '..a#a#####a.', '..a#a#a#a#a.',
      '..a#a##a##a.', '..aaa#a#a#a.', '....a#####a.', '....a#####a.', '....aaaaaaa.', '............'],
    bolt: [
      '......aaaa..', '.....a##a...', '....a##a....', '...a##a.....', '..a######a..', '..aaaa##a...',
      '.....a#a....', '....a#a.....', '...a#a......', '..a#a.......', '..aa........', '............'],
    burst: [
      '.....a......', '.a...a...a..', '..a..#..a...', '...a.#.a....', '....###.....', 'aa##a#a##aa.',
      '....###.....', '...a.#.a....', '..a..#..a...', '.a...a...a..', '.....a......', '............'],
    skull: [
      '............', '...aaaaaa...', '..a######a..', '.a########a.', '.a#aa##aa#a.', '.a#aa##aa#a.',
      '.a########a.', '..a##aa##a..', '...a#aa#a...', '...a#a#a#...', '....aaaa....', '............'],
    sword: [
      '..........aa', '.........a#a', '........a#a.', '.......a#a..', '......a#a...', '.....a#a....',
      '..a.a#a.....', '...a#a......', '...aa.......', '..a.a.......', '.a..........', '............'],
    down: [
      '....aaaa....', '....a##a....', '....a##a....', '....a##a....', '.aaaa##aaaa.', '..a######a..',
      '...a####a...', '....a##a....', '.....aa.....', '............', '.aaaaaaaaaa.', '............'],
    ankh: [
      '....aaaa....', '...a####a...', '...a#aa#a...', '...a#aa#a...', '....a##a....', '.aaaa##aaaa.',
      '.a########a.', '.aaaa##aaaa.', '....a##a....', '....a##a....', '....a##a....', '....aaaa....'],
    shield: [
      '.aaaaaaaaaa.', '.a########a.', '.a##aaaa##a.', '.a##a##a##a.', '.a##aaaa##a.', '.a########a.',
      '..a######a..', '..a######a..', '...a####a...', '....a##a....', '.....aa.....', '............'],
    mirror: [
      '.....aa.....', '....a##a....', '...a#aa#a...', '..a#a..a#a..', '.a#a....a#a.', 'a#a......a#a',
      '.a#a....a#a.', '..a#a..a#a..', '...a#aa#a...', '....a##a....', '.....aa.....', '............'],
    spikes: [
      '............', '.a...a...a..', '.a...a...a..', 'a#a.a#a.a#a.', 'a#a.a#a.a#a.', '#a#a#a#a#a#a',
      '############', 'aaaaaaaaaaaa', '#a#a#a#a#a#a', '############', '............', '............'],
    bars: [
      'aaaaaaaaaaaa', 'a#..#..#..#a', 'a#..#..#..#a', 'a#..#..#..#a', 'aaaaaaaaaaaa', 'a#..#..#..#a',
      'a#..#..#..#a', 'a#..#..#..#a', 'aaaaaaaaaaaa', '............', '............', '............'],
    land: [
      '..........a.', '.........a#a', '..........a.', '...a........', '..a#a.......', '.a###a..a...',
      'a#####aa#a..', '#######a##a.', '##########aa', 'aaaaaaaaaaaa', '#a#a#a#a#a#a', '############'],
    eye: [
      '............', '............', '...aaaaaa...', '..a######a..', '.a##aaaa##a.', 'a##a####a##a',
      '.a##aaaa##a.', '..a######a..', '...aaaaaa...', '............', '............', '............'],
  };

  /* ---------- utilidades de cor ---------- */
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry(seed) {
    return function () {
      let t = (seed = (seed + 0x6d2b79f5) | 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- geração da silhueta ---------- */
  // códigos: 0 vazio, 1 corpo, 2 contorno, 3 destaque, 4 olho, 5 roupa, 6 pele, 7 sombra
  function buildGrid(maskName, rnd) {
    const m = MASKS[maskName];
    const rows = m.rows;
    const w = m.half ? 20 : rows[0].length;
    const h = rows.length;
    const g = Array.from({ length: h }, () => new Array(w).fill(0));
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        let v = 0;
        if (ch === '#') v = 1;
        else if (ch === '?') v = rnd() < 0.5 ? 1 : 0;
        else if (ch === '*') v = rnd() < 0.5 ? 1 : 2;
        else if (ch === 'o') v = 2;
        else if (ch === 'a') v = rnd() < 0.5 ? 3 : 1;
        else if (ch === 'A') v = 3;
        else if (ch === 'E') v = 4;
        else if (ch === 'B') v = 5;
        else if (ch === 's') v = 6;
        else if (ch === 'D') v = 7;
        g[y][x] = v;
        if (m.half) g[y][w - 1 - x] = v;
      }
    }
    // contorno automático
    const out = g.map((r) => r.slice());
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (g[y][x] !== 0) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const v = (g[y + dy] || [])[x + dx];
        return v && v !== 2;
      });
      if (n) out[y][x] = -1; // contorno externo
    }
    return { grid: out, w, h };
  }

  function paletteFor(seedStr, baseHue, rnd) {
    const hue = baseHue + (rnd() - 0.5) * 36;
    const accHue = hue + (rnd() < 0.5 ? 150 : -120) + (rnd() - 0.5) * 40;
    const sat = 55 + rnd() * 30;
    return {
      body: (l) => hsl(hue, sat, l),
      acc: (l) => hsl(accHue, 70, l),
      eye: rnd() < 0.5 ? [255, 244, 140] : rnd() < 0.5 ? [255, 90, 80] : [140, 255, 240],
      outline: hsl(hue, 45, 10),
    };
  }

  /* ---------- desenho ---------- */
  const cache = new Map();

  function newCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function drawBackground(ctx, W, H, hue, rnd, style) {
    const img = ctx.createImageData(W, H);
    const top = hsl(hue, 45, style === 'trap' ? 22 : 18);
    const bot = hsl(hue + 20, 55, style === 'trap' ? 34 : 34);
    const glow = hsl(hue, 60, 46);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = y / (H - 1);
      // dithering ordenado 2x2 para a transição de cor
      const bayer = [[0, 2], [3, 1]][y % 2][x % 2] / 4;
      let col = t + bayer * 0.35 > 0.62 ? bot : top;
      const dx = x - W / 2, dy = y - H * 0.55;
      if (dx * dx + dy * dy < (W * 0.36) ** 2 && (x + y) % 2 === 0) col = glow;
      const i = (y * W + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // estrelinhas
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H * 0.45), 1, 1);
    }
  }

  function paintSprite(ctx, built, pal, ox, oy) {
    const { grid, w, h } = built;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = grid[y][x];
      if (v === 0) continue;
      let col;
      const up = (grid[y - 1] || [])[x];
      const down = (grid[y + 1] || [])[x];
      const shadeL = 46 - (y / h) * 14 + (up === 0 || up === -1 ? 14 : 0) - (down === 0 || down === -1 ? 10 : 0);
      if (v === -1 || v === 2) col = pal.outline;
      else if (v === 1) col = pal.body(shadeL);
      else if (v === 3) col = pal.acc(shadeL + 10);
      else if (v === 4) col = pal.eye;
      else if (v === 5) col = pal.cloth(shadeL);
      else if (v === 6) col = pal.skin(shadeL + 18);
      else if (v === 7) col = pal.skin(shadeL);
      ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }

  function bbox(built) {
    let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
    built.grid.forEach((r, y) => r.forEach((v, x) => { if (v) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }));
    return { x0, y0, x1, y1 };
  }

  const ART = 24;

  function monsterArt(c) {
    const rnd = mulberry(hashStr(c.id + c.name));
    const cv = newCanvas(ART, ART);
    const ctx = cv.getContext('2d');
    const hue = PD.ATTRS[c.attr].hue;
    drawBackground(ctx, ART, ART, hue + 180 + (rnd() - 0.5) * 60, rnd, 'monster');
    const built = buildGrid(c.race, rnd);
    const pal = paletteFor(c.id, hue, rnd);
    const b = bbox(built);
    const ox = Math.round((ART - (b.x1 - b.x0 + 1)) / 2) - b.x0;
    const oy = ART - 2 - b.y1;
    // sombra no chão
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(Math.round(ART / 2 - 6), ART - 2, 12, 1);
    paintSprite(ctx, built, pal, ox, oy);
    return cv;
  }

  function glyphFor(c) {
    if (c.kind === 'spell' && c.sub === 'field') return 'land';
    const op = c.ops[0] || {};
    switch (op.op) {
      case 'damage': return 'flame';
      case 'heal': return 'heart';
      case 'draw': return 'cards';
      case 'destroy':
        if (op.t === 'allMonsters') return 'skull';
        if (op.t === 'oppST' || op.t === 'allST' || op.t === 'randOppST') return 'burst';
        if (op.t === 'summoned') return 'spikes';
        return 'bolt';
      case 'buff': return 'sword';
      case 'debuff': return 'down';
      case 'revive': return 'ankh';
      case 'negate': return 'shield';
      case 'reflect': return 'mirror';
      case 'stun': return 'bars';
    }
    return 'eye';
  }

  function spellArt(c) {
    const rnd = mulberry(hashStr(c.id + c.name));
    const cv = newCanvas(ART, ART);
    const ctx = cv.getContext('2d');
    const isTrap = c.kind === 'trap';
    let hue = isTrap ? 345 : 196;
    if (c.sub === 'field') hue = c.field.attr ? PD.ATTRS[c.field.attr].hue : 150;
    drawBackground(ctx, ART, ART, hue + (rnd() - 0.5) * 20, rnd, isTrap ? 'trap' : 'spell');
    // círculo mágico / moldura de armadilha
    ctx.fillStyle = isTrap ? 'rgba(255,190,190,0.35)' : 'rgba(190,240,255,0.35)';
    for (let a = 0; a < 40; a++) {
      const ang = (a / 40) * Math.PI * 2;
      const r = 10.5;
      if (isTrap && a % 4 > 1) continue;
      ctx.fillRect(Math.round(12 + Math.cos(ang) * r), Math.round(12 + Math.sin(ang) * r), 1, 1);
    }
    const g = GLYPHS[glyphFor(c)];
    const main = isTrap ? hsl(hue + 10, 80, 62) : hsl(hue - 10, 85, 66);
    const hi = isTrap ? hsl(hue, 40, 12) : hsl(hue + 10, 50, 12);
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      const ch = g[y][x];
      if (ch === '.') continue;
      const col = ch === '#' ? main : hi;
      ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      ctx.fillRect(6 + x, 6 + y, 1, 1);
    }
    return cv;
  }

  function portrait(o) {
    const rnd = mulberry(hashStr(o.seed));
    const cv = newCanvas(ART, ART);
    const ctx = cv.getContext('2d');
    drawBackground(ctx, ART, ART, o.cloth + 180, rnd, 'monster');
    const built = buildGrid('retrato', rnd);
    const pal = {
      body: (l) => hsl(o.skin, 50, l + 20),
      acc: (l) => hsl(o.hair, 60, l - 4),
      cloth: (l) => hsl(o.cloth, 60, l),
      skin: (l) => hsl(o.skin, 55, l + 6),
      eye: [30, 20, 40],
      outline: hsl(o.cloth, 40, 10),
    };
    const b = bbox(built);
    const ox = Math.round((ART - (b.x1 - b.x0 + 1)) / 2) - b.x0;
    paintSprite(ctx, built, pal, ox, ART - 1 - b.y1);
    return cv;
  }

  function cardArt(id) {
    if (cache.has(id)) return cache.get(id);
    const c = PD.card(id);
    let url = '';
    if (c) {
      const cv = c.kind === 'monster' ? monsterArt(c) : spellArt(c);
      url = cv.toDataURL();
    }
    cache.set(id, url);
    return url;
  }

  function portraitArt(o) {
    const key = 'portrait:' + o.id;
    if (!cache.has(key)) cache.set(key, portrait(o).toDataURL());
    return cache.get(key);
  }

  PD.Sprites = { cardArt, portraitArt, glyphFor, MASKS, GLYPHS };
})();
