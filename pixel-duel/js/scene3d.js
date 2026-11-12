/* Pixel Duel — mesa de duelo em 3D (Three.js).
 * Cartas são objetos físicos sobre a mesa; monstros com a face para cima ganham
 * um modelo 3D em pé sobre a carta. A cena é sincronizada a partir da "visão"
 * do estado e oferece animações (ataque, destruição, revelação, ativação). */
(function () {
  const PD = (window.PD = window.PD || {});
  const THREE = window.THREE;
  if (!THREE) return;

  const CW = 1.0, CH = 1.4, CT = 0.03;
  const COLX = [-3.2, -1.6, 0, 1.6, 3.2];
  const ROWZ = { me: { monsters: 1.25, spells: 3.0 }, opp: { monsters: -1.25, spells: -3.0 } };
  const PILES = {
    me: { grave: [4.9, 1.25], deck: [4.9, 3.0] },
    opp: { grave: [-4.9, -1.25], deck: [-4.9, -3.0] },
  };
  const FIELD_POS = [-4.9, 1.25];
  const TABLE_W = 13, TABLE_D = 10.4;
  const MODEL_SCALE = 1.5;

  const FRAME = {
    fogo: ['#f07a4c', '#8d2614'], agua: ['#5aa2f2', '#163f8c'], terra: ['#c99856', '#5c3a14'],
    vento: ['#6fd384', '#1b6431'], luz: ['#f6dc78', '#9a7414'], trevas: ['#a77ae0', '#3c1a6d'],
    spell: ['#6cd0f5', '#0f5378'], trap: ['#f27a92', '#6d0f2a'],
  };
  const FIELD_TINT = { fogo: 0xff6a3a, agua: 0x3a8cff, terra: 0xd09a50, vento: 0x4fe07a, luz: 0xffe070, trevas: 0xa060ff };

  /* ---------- texturas desenhadas em canvas ---------- */
  function roundRect(x, X, Y, w, h, r) {
    x.beginPath();
    x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r);
    x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
  }
  const texCache = new Map();
  function canvasTex(cv) {
    const t = new THREE.CanvasTexture(cv);
    t.anisotropy = 4;
    return t;
  }

  function cardFaceTexture(id, atk, def) {
    const key = `${id}|${atk}|${def}`;
    if (texCache.has(key)) return texCache.get(key);
    const c = PD.card(id);
    const W = 256, H = 358;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    const fr = c.kind === 'monster' ? FRAME[c.attr] : FRAME[c.kind];
    const gr = x.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, fr[0]); gr.addColorStop(1, fr[1]);
    x.fillStyle = '#05060f';
    roundRect(x, 0, 0, W, H, 16); x.fill();
    x.fillStyle = gr;
    roundRect(x, 5, 5, W - 10, H - 10, 12); x.fill();
    x.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(x, 14, 13, W - 28, 34, 6); x.fill();
    let fs = 22;
    x.font = `${fs}px "Russo One", "Arial Black", sans-serif`;
    while (x.measureText(c.name).width > W - 44 && fs > 12) { fs--; x.font = `${fs}px "Russo One", "Arial Black", sans-serif`; }
    x.fillStyle = '#fff';
    x.textBaseline = 'middle';
    x.fillText(c.name, 22, 31);
    if (c.kind === 'monster') {
      x.fillStyle = '#f4c24f';
      for (let i = 0; i < c.level; i++) {
        const cx = W - 26 - i * 17, cy = 60;
        x.beginPath(); x.moveTo(cx, cy - 6); x.lineTo(cx + 6, cy); x.lineTo(cx, cy + 6); x.lineTo(cx - 6, cy); x.closePath(); x.fill();
      }
    }
    const art = PD.Sprites.cardArtCanvas ? PD.Sprites.cardArtCanvas(id) : null;
    x.fillStyle = '#000';
    x.fillRect(18, 72, W - 36, W - 36);
    if (art) x.drawImage(art, 20, 74, W - 40, W - 40);
    x.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(x, 14, H - 62, W - 28, 46, 6); x.fill();
    x.textAlign = 'center';
    if (c.kind === 'monster') {
      x.font = '24px "Russo One", "Arial Black", sans-serif';
      x.fillStyle = atk > c.atk ? '#7dffc0' : atk < c.atk ? '#ff8a7a' : '#fff';
      x.fillText(`ATK ${atk}`, W * 0.29, H - 39);
      x.fillStyle = def > c.def ? '#7dffc0' : def < c.def ? '#ff8a7a' : '#fff';
      x.fillText(`DEF ${def}`, W * 0.72, H - 39);
    } else {
      x.font = '22px "Russo One", "Arial Black", sans-serif';
      x.fillStyle = '#fff';
      x.fillText(c.kind === 'trap' ? 'ARMADILHA' : c.sub === 'field' ? 'MAGIA DE CAMPO' : 'MAGIA', W / 2, H - 39);
    }
    const t = canvasTex(cv);
    texCache.set(key, t);
    return t;
  }

  function cardBackTexture() {
    if (texCache.has('back')) return texCache.get('back');
    const W = 256, H = 358;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    x.fillStyle = '#05060f'; roundRect(x, 0, 0, W, H, 16); x.fill();
    const gr = x.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, H * 0.7);
    gr.addColorStop(0, '#3348b8'); gr.addColorStop(1, '#0e1440');
    x.fillStyle = gr; roundRect(x, 6, 6, W - 12, H - 12, 12); x.fill();
    x.strokeStyle = '#c9952a'; x.lineWidth = 5; roundRect(x, 18, 18, W - 36, H - 36, 8); x.stroke();
    x.save(); x.translate(W / 2, H / 2);
    for (let r = 30; r < 140; r += 22) { x.strokeStyle = `rgba(244,194,79,${0.5 - r / 400})`; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke(); }
    x.rotate(Math.PI / 4);
    x.fillStyle = '#f4c24f'; x.fillRect(-30, -30, 60, 60);
    x.fillStyle = '#0e1440'; x.fillRect(-18, -18, 36, 36);
    x.fillStyle = '#f4c24f'; x.fillRect(-8, -8, 16, 16);
    x.restore();
    const t = canvasTex(cv);
    texCache.set('back', t);
    return t;
  }

  function tableTexture() {
    const W = 1300, H = 1040;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    const gr = x.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
    gr.addColorStop(0, '#26306e'); gr.addColorStop(1, '#0c1030');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    const toPx = (wx, wz) => [((wx + TABLE_W / 2) / TABLE_W) * W, ((wz + TABLE_D / 2) / TABLE_D) * H];
    const zone = (wx, wz, label, col) => {
      const [cx, cy] = toPx(wx, wz);
      const w = (1.22 / TABLE_W) * W, h = (1.62 / TABLE_D) * H;
      x.strokeStyle = col || 'rgba(140,160,255,0.45)';
      x.lineWidth = 3; x.setLineDash([12, 8]);
      roundRect(x, cx - w / 2, cy - h / 2, w, h, 10); x.stroke();
      x.setLineDash([]);
      if (label) {
        x.fillStyle = 'rgba(160,175,255,0.55)'; x.font = '18px "Russo One", sans-serif'; x.textAlign = 'center';
        x.fillText(label, cx, cy + h / 2 + 22);
      }
    };
    ['me', 'opp'].forEach((side) => {
      COLX.forEach((cx) => { zone(cx, ROWZ[side].monsters); zone(cx, ROWZ[side].spells, null, 'rgba(120,200,255,0.3)'); });
      zone(PILES[side].grave[0], PILES[side].grave[1], 'CEMITÉRIO', 'rgba(200,150,255,0.4)');
      zone(PILES[side].deck[0], PILES[side].deck[1], 'DECK', 'rgba(244,194,79,0.45)');
    });
    zone(FIELD_POS[0], FIELD_POS[1], 'CAMPO', 'rgba(120,255,190,0.4)');
    x.strokeStyle = 'rgba(244,194,79,0.35)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(W * 0.05, H / 2); x.lineTo(W * 0.95, H / 2); x.stroke();
    x.beginPath(); x.arc(W / 2, H / 2, 60, 0, Math.PI * 2); x.stroke();
    const t = canvasTex(cv);
    return t;
  }

  function badgeTexture(atk, def, pos, c) {
    const cv = document.createElement('canvas');
    cv.width = 192; cv.height = 56;
    const x = cv.getContext('2d');
    x.fillStyle = 'rgba(6,8,26,0.85)'; roundRect(x, 2, 2, 188, 52, 12); x.fill();
    x.strokeStyle = pos === 'atk' ? '#f4c24f' : '#5aa2f2'; x.lineWidth = 3; roundRect(x, 2, 2, 188, 52, 12); x.stroke();
    x.font = '26px "Russo One", "Arial Black", sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'center';
    const col = (v, base, on) => (v > base ? '#7dffc0' : v < base ? '#ff8a7a' : on ? '#ffffff' : '#7b84b8');
    x.fillStyle = col(atk, c.atk, pos === 'atk'); x.fillText(String(atk), 52, 30);
    x.fillStyle = '#5b649c'; x.fillText('/', 96, 30);
    x.fillStyle = col(def, c.def, pos === 'def'); x.fillText(String(def), 142, 30);
    return canvasTex(cv);
  }

  /* ---------- interpolação ---------- */
  const ease = { out: (t) => 1 - Math.pow(1 - t, 3), inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), lin: (t) => t, in: (t) => t * t * t };

  /* ---------- cena ---------- */
  function create(host, hooks) {
    const H = hooks || {};
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    const lowRes = () => !!(PD.App && PD.App.settings && PD.App.settings.ps1);
    renderer.setPixelRatio(lowRes() ? 0.42 : Math.min(window.devicePixelRatio || 1, 2));
    const canvas = renderer.domElement;
    canvas.className = 'stage-canvas' + (lowRes() ? ' lowres' : '');
    host.append(canvas);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070918);
    scene.fog = new THREE.Fog(0x070918, 16, 34);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    scene.add(camera);
    const target = new THREE.Vector3(0, 0, 0.3);

    const hemi = new THREE.HemisphereLight(0xc8d4ff, 0x1a1030, 0.75);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 0.75);
    key.position.set(3, 10, 6);
    scene.add(key);
    const fieldLight = new THREE.PointLight(0x6680ff, 0.6, 14);
    fieldLight.position.set(0, 2.5, 0);
    scene.add(fieldLight);

    // mesa
    const tableMat = new THREE.MeshStandardMaterial({ map: tableTexture(), roughness: 0.9, metalness: 0 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(TABLE_W, 0.3, TABLE_D), [
      new THREE.MeshStandardMaterial({ color: 0x1a1f4a }), new THREE.MeshStandardMaterial({ color: 0x1a1f4a }),
      tableMat, new THREE.MeshStandardMaterial({ color: 0x0a0c20 }),
      new THREE.MeshStandardMaterial({ color: 0x1a1f4a }), new THREE.MeshStandardMaterial({ color: 0x1a1f4a }),
    ]);
    table.position.y = -0.15;
    scene.add(table);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x2b3478, metalness: 0.6, roughness: 0.35, flatShading: true });
    [[0, -TABLE_D / 2, TABLE_W + 0.4, 0.4], [0, TABLE_D / 2, TABLE_W + 0.4, 0.4]].forEach(([px, pz, w, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.36, d), rimMat); m.position.set(px, -0.05, pz); scene.add(m);
    });
    [[-TABLE_W / 2, 0], [TABLE_W / 2, 0]].forEach(([px, pz]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.36, TABLE_D), rimMat); m.position.set(px, -0.05, pz); scene.add(m);
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 24), new THREE.MeshBasicMaterial({ color: 0x05060f }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -2.5;
    scene.add(floor);
    // pilares de luz decorativos
    const pillars = [];
    [[-7.6, -5.6], [7.6, -5.6], [-7.6, 5.6], [7.6, 5.6]].forEach(([px, pz]) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 5, 6), new THREE.MeshStandardMaterial({ color: 0x1b2266, flatShading: true }));
      m.position.set(px, 0, pz); scene.add(m);
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), new THREE.MeshStandardMaterial({ color: 0x8fb0ff, emissive: 0x4f70ff, emissiveIntensity: 1.2, flatShading: true }));
      orb.position.set(px, 2.9, pz); scene.add(orb); pillars.push(orb);
    });

    const cardGeo = new THREE.BoxGeometry(CW, CT, CH);
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x0c0e22 });
    const glowGeo = new THREE.PlaneGeometry(CW + 0.3, CH + 0.3);
    const shadowGeo = new THREE.CircleGeometry(0.62, 14);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });

    const entries = new Map();
    const piles = {};
    const tweens = [];
    const particles = [];
    let shakeT = 0, shakeAmp = 0;
    let disposed = false;
    let raf = 0;
    const clock = new THREE.Clock();

    function tween(ms, fn, ez) {
      return new Promise((resolve) => tweens.push({ t0: performance.now(), ms, fn, ez: ez || ease.inOut, resolve }));
    }

    function makeCardMesh(faceTex, backTex) {
      const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.55 });
      const backMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.55 });
      const m = new THREE.Mesh(cardGeo, [edgeMat, edgeMat, faceMat, backMat, edgeMat, edgeMat]);
      return m;
    }

    function zonePos(side, zone, i) {
      if (zone === 'field') return new THREE.Vector3(FIELD_POS[0], 0, FIELD_POS[1]);
      return new THREE.Vector3(side === 'me' ? COLX[i] : COLX[4 - i], 0, ROWZ[side][zone]);
    }

    function tagPick(obj, data) { obj.traverse((o) => { o.userData.pick = data; }); }

    function createEntry(d) {
      const root = new THREE.Group();
      const pivot = new THREE.Group();
      root.add(pivot);
      const card = makeCardMesh(cardBackTexture(), cardBackTexture());
      card.position.y = CT / 2;
      pivot.add(card);
      const glowM = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0xf4c24f, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      glowM.rotation.x = -Math.PI / 2;
      glowM.position.y = 0.004;
      glowM.visible = false;
      pivot.add(glowM);
      scene.add(root);
      const e = { uid: d.uid, root, pivot, card, glow: glowM, model: null, modelId: null, badge: null, badgeKey: '', faceKey: '', info: {}, glowMode: null };
      entries.set(d.uid, e);
      tagPick(root, { uid: d.uid });
      return e;
    }

    function removeModel(e) {
      if (!e.model) return;
      e.root.remove(e.model);
      e.model.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
      e.model = null; e.modelId = null;
    }

    function ensureModel(e, id, side, appear) {
      if (e.modelId === id) return;
      removeModel(e);
      const c = PD.card(id);
      const holder = new THREE.Group();
      const m = PD.Models.monster(c);
      m.scale.setScalar(MODEL_SCALE);
      holder.add(m);
      const sh = new THREE.Mesh(shadowGeo, shadowMat);
      sh.rotation.x = -Math.PI / 2; sh.position.y = 0.04;
      holder.add(sh);
      holder.position.y = CT + 0.02;
      holder.userData.baseYaw = side === 'me' ? Math.PI - 0.5 : 0.25;
      holder.rotation.y = holder.userData.baseYaw;
      e.root.add(holder);
      e.model = holder; e.modelId = id;
      e.modelInner = m;
      tagPick(holder, { uid: e.uid });
      holder.userData.grow = appear ? 0.01 : 1;
      if (appear) {
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4, 12, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(PD.ATTRS[c.attr].color), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
        beam.position.y = 2;
        e.root.add(beam);
        tween(520, (k) => { holder.userData.grow = Math.max(0.01, k); holder.position.y = CT + 0.02 + (1 - k) * 0.8; }, ease.out);
        tween(700, (k) => { beam.material.opacity = 0.6 * (1 - k); beam.scale.set(1 - k * 0.6, 1, 1 - k * 0.6); }, ease.lin)
          .then(() => { e.root.remove(beam); beam.geometry.dispose(); beam.material.dispose(); });
      }
    }

    function updateBadge(e, atk, def, pos, c) {
      const k = `${atk}|${def}|${pos}`;
      if (!e.model) { if (e.badge) { e.root.remove(e.badge); e.badge.material.map.dispose(); e.badge.material.dispose(); e.badge = null; e.badgeKey = ''; } return; }
      if (e.badgeKey === k) return;
      if (!e.badge) {
        e.badge = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
        e.badge.renderOrder = 10;
        e.badge.scale.set(0.95, 0.28, 1);
        e.root.add(e.badge);
      } else if (e.badge.material.map) e.badge.material.map.dispose();
      e.badge.material.map = badgeTexture(atk, def, pos, c);
      e.badge.material.needsUpdate = true;
      e.badgeKey = k;
    }

    function updateEntry(e, d, view, fresh) {
      const { inst, side, zone, i } = d;
      const known = !!inst.id && !inst.hidden;
      const c = known ? PD.card(inst.id) : null;
      const isMon = zone === 'monsters';
      const atk = isMon && known ? PD.Engine.getAtk(view, inst) : 0;
      const def = isMon && known ? PD.Engine.getDef(view, inst) : 0;
      // texturas
      const faceKey = known ? `${inst.id}|${atk}|${def}` : 'back';
      if (e.faceKey !== faceKey) {
        e.card.material[2].map = known ? cardFaceTexture(inst.id, isMon ? atk : c.atk || 0, isMon ? def : c.def || 0) : cardBackTexture();
        e.card.material[2].needsUpdate = true;
        e.faceKey = faceKey;
      }
      // posição
      const to = zonePos(side, zone, i);
      if (fresh) {
        e.root.position.set(to.x, 1.6, to.z + (side === 'me' ? 2.2 : -2.2));
        const from = e.root.position.clone();
        tween(420, (k) => { e.root.position.lerpVectors(from, to, k); e.root.position.y = from.y * (1 - k) + Math.sin(k * Math.PI) * 0.4; }, ease.out);
      } else if (e.root.position.distanceTo(to) > 0.01) {
        const from = e.root.position.clone();
        tween(380, (k) => e.root.position.lerpVectors(from, to, k));
      }
      // face para cima / para baixo e posição de defesa
      const flipTo = inst.faceUp || zone === 'field' ? 0 : Math.PI;
      if (fresh) e.pivot.rotation.z = flipTo;
      else if (Math.abs(e.pivot.rotation.z - flipTo) > 0.01) { const f0 = e.pivot.rotation.z; tween(320, (k) => { e.pivot.rotation.z = f0 + (flipTo - f0) * k; e.pivot.position.y = Math.sin(k * Math.PI) * 0.5; }); }
      const yawTo = isMon && inst.pos === 'def' ? Math.PI / 2 : 0;
      if (fresh) e.pivot.rotation.y = yawTo;
      else if (Math.abs(e.pivot.rotation.y - yawTo) > 0.01) { const y0 = e.pivot.rotation.y; tween(300, (k) => { e.pivot.rotation.y = y0 + (yawTo - y0) * k; }); }
      // modelo 3D
      if (isMon && known && inst.faceUp) {
        ensureModel(e, inst.id, side, !fresh || inst.summonedTurn === view.turn);
        const s = inst.pos === 'def' ? 0.78 : 1;
        e.model.userData.defScale = s;
        updateBadge(e, atk, def, inst.pos, c);
        const hgt = (e.modelInner.userData.height || 1) * s * MODEL_SCALE;
        e.badge.position.set(0, hgt + 0.32, 0);
      } else {
        removeModel(e);
        updateBadge(e, 0, 0, 'atk', null);
      }
      e.info = { p: d.p, side, zone, i, id: inst.id, faceUp: inst.faceUp, pos: inst.pos, hidden: !known };
    }

    function removeEntry(e) {
      scene.remove(e.root);
      removeModel(e);
      e.card.material.forEach((m, k) => { if (k === 2 || k === 3) m.dispose(); });
      if (e.badge) { e.badge.material.map && e.badge.material.map.dispose(); e.badge.material.dispose(); }
      e.glow.material.dispose();
      entries.delete(e.uid);
    }

    function updatePile(key, side, kind, count, topId, p) {
      let pl = piles[key];
      const [px, pz] = PILES[side][kind];
      if (!pl) {
        pl = { root: new THREE.Group(), stack: null, top: null };
        pl.root.position.set(px, 0, pz);
        scene.add(pl.root);
        piles[key] = pl;
      }
      if (pl.stack) { pl.root.remove(pl.stack); pl.stack.geometry.dispose(); pl.stack = null; }
      if (pl.top) { pl.root.remove(pl.top); pl.top = null; }
      if (count > 0) {
        const hgt = Math.min(0.45, 0.02 + count * 0.011);
        pl.stack = new THREE.Mesh(new THREE.BoxGeometry(CW, hgt, CH), [edgeMat, edgeMat, new THREE.MeshStandardMaterial({ color: 0x1a2263 }), edgeMat, edgeMat, edgeMat]);
        pl.stack.position.y = hgt / 2;
        pl.root.add(pl.stack);
        const topTex = kind === 'deck' ? cardBackTexture() : topId ? cardFaceTexture(topId, PD.card(topId).atk || 0, PD.card(topId).def || 0) : cardBackTexture();
        pl.top = makeCardMesh(topTex, cardBackTexture());
        pl.top.position.y = hgt + CT / 2;
        pl.root.add(pl.top);
      }
      tagPick(pl.root, { pile: kind, p });
    }

    let fieldTintKey = '';
    function setFieldTint(view) {
      let key = 'none';
      if (view.field) {
        const fc = PD.card(view.field.inst.id);
        if (fc && fc.field) key = fc.field.attr || (fc.field.race === 'maquina' ? 'terra' : fc.field.race === 'dragao' ? 'fogo' : 'luz');
      }
      if (key === fieldTintKey) return;
      fieldTintKey = key;
      const col = new THREE.Color(key === 'none' ? 0x6680ff : FIELD_TINT[key]);
      const c0 = fieldLight.color.clone();
      const h0 = hemi.color.clone();
      const h1 = key === 'none' ? new THREE.Color(0xc8d4ff) : new THREE.Color(0xffffff).lerp(col, 0.45);
      tween(800, (k) => {
        fieldLight.color.copy(c0).lerp(col, k);
        fieldLight.intensity = key === 'none' ? 0.6 : 1.4;
        hemi.color.copy(h0).lerp(h1, k);
        tableMat.color.copy(new THREE.Color(0xffffff).lerp(key === 'none' ? new THREE.Color(0xffffff) : col, k * 0.35));
      });
    }

    /** Sincroniza a cena com a visão do estado (me = índice do jogador local). */
    function sync(view, me) {
      const desired = new Map();
      [0, 1].forEach((p) => {
        const side = p === me ? 'me' : 'opp';
        ['monsters', 'spells'].forEach((zone) => view.players[p][zone].forEach((inst, i) => { if (inst) desired.set(inst.uid, { uid: inst.uid, inst, p, side, zone, i }); }));
      });
      if (view.field) desired.set(view.field.inst.uid, { uid: view.field.inst.uid, inst: view.field.inst, p: view.field.owner, side: view.field.owner === me ? 'me' : 'opp', zone: 'field', i: 0 });
      for (const [uid, e] of [...entries]) if (!desired.has(uid)) removeEntry(e);
      for (const [uid, d] of desired) {
        const fresh = !entries.has(uid);
        const e = fresh ? createEntry(d) : entries.get(uid);
        updateEntry(e, d, view, fresh);
      }
      [0, 1].forEach((p) => {
        const side = p === me ? 'me' : 'opp';
        const P = view.players[p];
        updatePile(side + 'deck', side, 'deck', P.deckCount, null, p);
        const top = P.grave.length ? P.grave[P.grave.length - 1].id : null;
        updatePile(side + 'grave', side, 'grave', P.grave.length, top, p);
      });
      setFieldTint(view);
    }

    const GLOW = { target: 0xf4c24f, chosen: 0xff5a4a, act: 0x5ee0a6 };
    function setHighlights(h) {
      const hl = h || {};
      for (const e of entries.values()) {
        let mode = null;
        if (hl.chosen && hl.chosen.includes(e.uid)) mode = 'chosen';
        else if (hl.targets && hl.targets.includes(e.uid)) mode = 'target';
        else if (hl.canAct && hl.canAct.includes(e.uid)) mode = 'act';
        e.glowMode = mode;
        e.glow.visible = !!mode;
        if (mode) e.glow.material.color.setHex(GLOW[mode]);
        if (e.badge) e.badge.material.opacity = hl.used && hl.used.includes(e.uid) ? 0.4 : 1;
      }
    }

    /* ---------- animações ---------- */
    function edgePoint(attackerSide) { return new THREE.Vector3(0, 0.3, attackerSide === 'me' ? -4.6 : 4.6); }

    function flashEntry(e, color) {
      if (!e) return Promise.resolve();
      const mats = [];
      (e.model || e.card).traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.emissive) mats.push([m, m.emissive.clone(), m.emissiveIntensity]); }); });
      const col = new THREE.Color(color || 0xffffff);
      return tween(320, (k) => {
        const a = Math.sin(k * Math.PI);
        mats.forEach(([m, e0, i0]) => { m.emissive.copy(e0).lerp(col, a); m.emissiveIntensity = i0 + a * 1.2; });
      }, ease.lin);
    }

    function burst(pos, color, n, power) {
      const geo = new THREE.TetrahedronGeometry(0.08, 0);
      for (let k = 0; k < (n || 16); k++) {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.3), transparent: true }));
        m.position.copy(pos);
        const pw = power || 1;
        particles.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 5 * pw, (1.5 + Math.random() * 3.5) * pw, (Math.random() - 0.5) * 5 * pw), r: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0), life: 0, max: 0.7 + Math.random() * 0.5 });
        scene.add(m);
      }
    }

    function shake(amp, ms) { shakeAmp = Math.max(shakeAmp, amp); shakeT = Math.max(shakeT, ms || 300); }

    async function animAttack(uid, targetUid, attackerP, me) {
      const e = entries.get(uid);
      if (!e) return;
      const side = attackerP === me ? 'me' : 'opp';
      const t = targetUid != null ? entries.get(targetUid) : null;
      const obj = e.model || e.root;
      const world0 = e.root.position.clone();
      const goal = t ? t.root.position.clone() : edgePoint(side);
      const start = obj.position.clone();
      const rel = goal.clone().sub(world0);
      const back = rel.clone().normalize().multiplyScalar(-0.35);
      if (e.model) {
        const yaw0 = e.model.rotation.y;
        const face = Math.atan2(rel.x, rel.z);
        await tween(180, (k) => { obj.position.set(start.x + back.x * k, start.y + 0.15 * k, start.z + back.z * k); e.model.rotation.y = yaw0 + (face - yaw0) * k; }, ease.out);
        await tween(200, (k) => { obj.position.set(start.x + back.x * (1 - k) + rel.x * 0.82 * k, start.y + 0.15 + Math.sin(k * Math.PI) * 0.6, start.z + back.z * (1 - k) + rel.z * 0.82 * k); }, ease.in);
        const hit = goal.clone(); hit.y = 0.6;
        burst(hit, t && t.info.id ? (PD.card(t.info.id).attr ? PD.ATTRS[PD.card(t.info.id).attr].color : 0xffffff) : 0xffe08a, 14, 0.8);
        shake(0.18, 260);
        if (t) flashEntry(t, 0xffffff);
        await tween(320, (k) => { obj.position.set(start.x + rel.x * 0.82 * (1 - k), start.y + 0.15 * (1 - k), start.z + rel.z * 0.82 * (1 - k)); e.model.rotation.y = face + (e.model.userData.baseYaw - face) * k; }, ease.out);
        obj.position.copy(start);
      } else {
        await tween(420, (k) => { const a = Math.sin(k * Math.PI); e.root.position.set(world0.x + rel.x * 0.6 * a, world0.y + a * 0.5, world0.z + rel.z * 0.6 * a); });
        e.root.position.copy(world0);
      }
    }

    async function animDestroy(uid) {
      const e = entries.get(uid);
      if (!e) return;
      const id = e.info.id;
      const c = id ? PD.card(id) : null;
      const col = c ? (c.kind === 'monster' ? PD.ATTRS[c.attr].color : c.kind === 'trap' ? '#f27a92' : '#6cd0f5') : '#8fa0ff';
      await flashEntry(e, 0xffffff);
      const pos = e.root.position.clone(); pos.y = 0.5;
      burst(pos, col, 26, 1.1);
      removeEntry(e);
      await new Promise((r) => setTimeout(r, 260));
    }

    async function animReveal(uid, id, me) {
      const e = entries.get(uid);
      if (!e) return;
      const c = PD.card(id);
      e.card.material[2].map = cardFaceTexture(id, c.atk || 0, c.def || 0);
      e.card.material[2].needsUpdate = true;
      e.faceKey = '';
      const f0 = e.pivot.rotation.z;
      await tween(320, (k) => { e.pivot.rotation.z = f0 * (1 - k); e.pivot.position.y = Math.sin(k * Math.PI) * 0.5; });
      if (c.kind === 'monster') ensureModel(e, id, e.info.side || (e.info.p === me ? 'me' : 'opp'), true);
    }

    async function animActivate(id, kind) {
      const c = PD.card(id);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.24), new THREE.MeshBasicMaterial({ map: cardFaceTexture(id, c.atk || 0, c.def || 0), transparent: true, depthTest: false }));
      mesh.renderOrder = 20;
      mesh.position.set(0, 0.1, -5);
      camera.add(mesh);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.4, 32), new THREE.MeshBasicMaterial({ color: kind === 'trap' ? 0xff5a7a : kind === 'fx' ? 0xf4c24f : 0x5ad8ff, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, side: THREE.DoubleSide }));
      ring.renderOrder = 19;
      ring.position.set(0, 0.1, -5.2);
      camera.add(ring);
      await tween(380, (k) => { mesh.scale.setScalar(0.2 + k * 0.8); mesh.rotation.y = (1 - k) * Math.PI * 2; ring.scale.setScalar(0.4 + k * 0.8); ring.material.opacity = k; }, ease.out);
      await tween(420, (k) => { mesh.rotation.y = Math.sin(k * Math.PI * 2) * 0.08; ring.rotation.z = k * 2; }, ease.lin);
      await tween(260, (k) => { mesh.material.opacity = 1 - k; mesh.scale.setScalar(1 + k * 0.3); ring.material.opacity = 1 - k; ring.scale.setScalar(1.2 + k); }, ease.in);
      camera.remove(mesh); camera.remove(ring);
      mesh.geometry.dispose(); mesh.material.dispose(); ring.geometry.dispose(); ring.material.dispose();
    }

    function animBuff(uid, up) { const e = entries.get(uid); return flashEntry(e, up ? 0x5ee0a6 : 0xff5a4a); }

    /* ---------- câmera e tamanho ---------- */
    function fitCamera() {
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      camera.aspect = w / h;
      const elev = w / h < 1 ? 1.12 : 0.98;
      const dir = new THREE.Vector3(0, Math.sin(elev), Math.cos(elev));
      const pts = [];
      [-5.55, 5.55].forEach((px) => [-4.0, 4.0].forEach((pz) => [0, 1.8].forEach((py) => pts.push(new THREE.Vector3(px, py, pz)))));
      let d = 6;
      for (; d < 60; d += 0.25) {
        camera.position.copy(target).addScaledVector(dir, d);
        camera.lookAt(target);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();
        if (pts.every((p) => { const q = p.clone().project(camera); return Math.abs(q.x) <= 0.97 && Math.abs(q.y) <= 0.97; })) break;
      }
      camera.userData.base = camera.position.clone();
    }

    function resize() {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      fitCamera();
    }
    const ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(host); else window.addEventListener('resize', resize);

    /* ---------- seleção com o mouse/toque ---------- */
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function pickAt(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const objs = [];
      entries.forEach((e) => objs.push(e.root));
      Object.values(piles).forEach((pl) => objs.push(pl.root));
      const hits = ray.intersectObjects(objs, true);
      for (const hhit of hits) if (hhit.object.userData.pick && hhit.object.visible) return hhit.object.userData.pick;
      return null;
    }
    let down = null;
    canvas.addEventListener('pointerdown', (ev) => { down = { x: ev.clientX, y: ev.clientY }; });
    canvas.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 8) { down = null; return; }
      down = null;
      const pk = pickAt(ev.clientX, ev.clientY);
      if (H.onPick) H.onPick(pk, ev.clientX, ev.clientY);
    });
    let hoverQueued = null;
    let lastHover = null;
    canvas.addEventListener('pointermove', (ev) => { if (ev.pointerType === 'mouse') hoverQueued = [ev.clientX, ev.clientY]; });
    canvas.addEventListener('pointerleave', () => { hoverQueued = null; if (lastHover) { lastHover = null; canvas.style.cursor = ''; } });

    /* ---------- laço de renderização ---------- */
    function loop() {
      if (disposed) return;
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const now = performance.now();
      const dt = Math.min(0.05, clock.getDelta());
      const t = clock.elapsedTime;
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i];
        const k = Math.min(1, (now - tw.t0) / tw.ms);
        tw.fn(tw.ez(k));
        if (k >= 1) { tweens.splice(i, 1); tw.resolve(); }
      }
      entries.forEach((e) => {
        if (e.modelInner && e.modelInner.userData.anim) e.modelInner.userData.anim(t);
        if (e.model) e.model.scale.setScalar((e.model.userData.grow == null ? 1 : e.model.userData.grow) * (e.model.userData.defScale || 1));
        if (e.glowMode) e.glow.material.opacity = 0.45 + Math.sin(t * 6) * 0.25;
      });
      pillars.forEach((o, i) => { o.rotation.y = t * 0.8 + i; o.position.y = 2.9 + Math.sin(t * 1.5 + i) * 0.12; });
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.life += dt;
        pt.v.y -= 9 * dt;
        pt.m.position.addScaledVector(pt.v, dt);
        pt.m.rotation.x += pt.r.x * dt; pt.m.rotation.y += pt.r.y * dt;
        pt.m.material.opacity = Math.max(0, 1 - pt.life / pt.max);
        if (pt.life >= pt.max) { scene.remove(pt.m); pt.m.material.dispose(); particles.splice(i, 1); }
      }
      if (camera.userData.base) {
        camera.position.copy(camera.userData.base);
        if (shakeT > 0) {
          shakeT -= dt * 1000;
          camera.position.x += (Math.random() - 0.5) * shakeAmp;
          camera.position.y += (Math.random() - 0.5) * shakeAmp;
          if (shakeT <= 0) shakeAmp = 0;
        }
      }
      if (hoverQueued) {
        const pk = pickAt(hoverQueued[0], hoverQueued[1]);
        hoverQueued = null;
        const key = pk ? (pk.uid != null ? 'u' + pk.uid : pk.pile + pk.p) : null;
        if (key !== (lastHover && lastHover.key)) {
          lastHover = pk ? { key } : null;
          canvas.style.cursor = pk ? 'pointer' : '';
          if (H.onHover) H.onHover(pk);
        }
      }
      renderer.render(scene, camera);
    }
    resize();
    loop();

    function setLowRes(on) {
      renderer.setPixelRatio(on ? 0.42 : Math.min(window.devicePixelRatio || 1, 2));
      canvas.classList.toggle('lowres', on);
      resize();
    }

    function dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      [...entries.values()].forEach(removeEntry);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      renderer.dispose();
      canvas.remove();
    }

    return { sync, setHighlights, animAttack, animDestroy, animReveal, animActivate, animBuff, shake, resize, dispose, setLowRes, canvas };
  }

  PD.Scene3D = { create, supported: () => !!(THREE && PD.GFX3D) };
})();
