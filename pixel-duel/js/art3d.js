/* Pixel Duel — modelos 3D low-poly (estilo PS1) gerados por código.
 * PD.Models.monster(card) monta o modelo de um monstro; cada tipo tem um corpo
 * próprio e a semente da carta varia proporções, cores e acessórios.
 * Também gera a arte das cartas e os retratos renderizando os modelos fora da tela. */
(function () {
  const PD = (window.PD = window.PD || {});
  const THREE = window.THREE;
  if (!THREE) return;

  /* ---------- utilidades ---------- */
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    return function () {
      let t = (seed = (seed + 0x6d2b79f5) | 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hsl = (h, s, l) => new THREE.Color().setHSL((((h % 360) + 360) % 360) / 360, s, l);

  function mat(color, o) {
    const opts = o || {};
    return new THREE.MeshStandardMaterial(Object.assign({
      color, flatShading: true, roughness: 0.62, metalness: 0.08,
    }, opts));
  }
  const glow = (color, intensity) => mat(color, { emissive: color, emissiveIntensity: intensity == null ? 1.2 : intensity, roughness: 0.3 });

  function add(parent, geo, material, pos, rot, scl) {
    const m = new THREE.Mesh(geo, material);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    if (scl) m.scale.set(scl[0], scl[1], scl[2]);
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  const G = {
    box: (x, y, z) => new THREE.BoxGeometry(x, y, z),
    sph: (r, w, h) => new THREE.SphereGeometry(r, w || 7, h || 5),
    cone: (r, h, s) => new THREE.ConeGeometry(r, h, s || 5),
    cyl: (a, b, h, s) => new THREE.CylinderGeometry(a, b, h, s || 6),
    ico: (r, d) => new THREE.IcosahedronGeometry(r, d || 0),
    oct: (r) => new THREE.OctahedronGeometry(r, 0),
    tor: (r, t, a, b) => new THREE.TorusGeometry(r, t, a || 4, b || 10),
  };

  function wingGeo(rnd, bat) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0.18, 0.42);
    s.lineTo(0.72, 0.62 + rnd() * 0.15);
    if (bat) {
      s.lineTo(0.62, 0.32); s.lineTo(0.66, 0.08); s.lineTo(0.44, 0.16); s.lineTo(0.36, -0.08); s.lineTo(0.2, 0.02);
    } else {
      s.lineTo(0.66, 0.3); s.lineTo(0.5, 0.18); s.lineTo(0.42, 0.0);
    }
    s.lineTo(0, 0);
    return new THREE.ShapeGeometry(s);
  }

  function palette(card, rnd) {
    const hue = PD.ATTRS[card.attr].hue + (rnd() - 0.5) * 30;
    const acc = hue + (rnd() < 0.5 ? 150 : -120) + (rnd() - 0.5) * 40;
    return {
      hue,
      body: mat(hsl(hue, 0.5 + rnd() * 0.25, 0.42)),
      body2: mat(hsl(hue + 10, 0.45, 0.28)),
      acc: mat(hsl(acc, 0.65, 0.55)),
      metal: mat(hsl(hue, 0.15, 0.7), { metalness: 0.7, roughness: 0.3 }),
      dark: mat(hsl(hue, 0.3, 0.12)),
      skin: mat(hsl(25 + rnd() * 15, 0.45, 0.62)),
      eye: glow(rnd() < 0.5 ? new THREE.Color(1, 0.9, 0.3) : rnd() < 0.5 ? new THREE.Color(1, 0.25, 0.2) : new THREE.Color(0.3, 1, 0.95)),
      orb: glow(hsl(acc, 0.9, 0.6), 1.5),
    };
  }

  /* ---------- corpos por tipo ---------- */
  const BUILD = {
    dragao(g, P, rnd, A) {
      add(g, G.sph(0.32, 7, 5), P.body, [0, 0.42, -0.05], null, [1, 0.85, 1.3]);
      add(g, G.sph(0.24, 6, 4), P.acc, [0, 0.36, 0.1], null, [1, 0.8, 1.1]);
      const neck = add(g, G.cyl(0.09, 0.14, 0.45), P.body, [0, 0.72, 0.22], [-0.5, 0, 0]);
      const head = new THREE.Group();
      head.position.set(0, 0.95, 0.36);
      g.add(head);
      add(head, G.box(0.26, 0.2, 0.3), P.body);
      add(head, G.box(0.18, 0.12, 0.2), P.body2, [0, -0.04, 0.2]);
      [-1, 1].forEach((sx) => {
        add(head, G.sph(0.035, 5, 4), P.eye, [sx * 0.1, 0.04, 0.13]);
        add(head, G.cone(0.04, 0.22, 4), P.dark, [sx * 0.09, 0.15, -0.08], [-0.7, 0, sx * -0.2]);
        if (rnd() < 0.5) add(head, G.cone(0.03, 0.14, 4), P.dark, [sx * 0.14, 0.1, -0.12], [-0.9, 0, sx * -0.6]);
      });
      const wings = [-1, 1].map((sx) => {
        const piv = new THREE.Group();
        piv.position.set(sx * 0.14, 0.62, -0.12);
        const w = add(piv, wingGeo(rnd, rnd() < 0.4), mat(P.acc.color.clone().lerp(P.body.color, 0.4), { side: THREE.DoubleSide }));
        w.scale.set(sx * (1 + rnd() * 0.3), 1, 1);
        piv.rotation.y = sx * 0.7;
        g.add(piv);
        return piv;
      });
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => add(g, G.cyl(0.06, 0.05, 0.3, 5), P.body2, [sx * 0.17, 0.15, sz * 0.18]));
      let prev = new THREE.Vector3(0, 0.36, -0.42);
      for (let i = 0; i < 3; i++) {
        add(g, G.cone(0.1 - i * 0.025, 0.28, 5), i === 2 ? P.dark : P.body, [0, prev.y - 0.04 * i, prev.z - 0.12], [-Math.PI / 2 + 0.3, 0, 0]);
        prev = new THREE.Vector3(0, prev.y - 0.05, prev.z - 0.2);
      }
      if (A.big) for (let i = 0; i < 4; i++) add(g, G.cone(0.04, 0.14, 4), P.dark, [0, 0.72 - i * 0.04, 0.05 - i * 0.14], [-0.4, 0, 0]);
      return (t) => {
        wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 3.2) * 0.35; });
        head.rotation.y = Math.sin(t * 0.8) * 0.18;
        neck.rotation.x = -0.5 + Math.sin(t * 1.6) * 0.04;
      };
    },

    guerreiro(g, P, rnd) {
      const armor = rnd() < 0.5 ? P.metal : P.body;
      [-1, 1].forEach((sx) => {
        add(g, G.box(0.13, 0.34, 0.14), P.body2, [sx * 0.09, 0.17, 0]);
        add(g, G.box(0.15, 0.06, 0.2), P.dark, [sx * 0.09, 0.03, 0.03]);
        add(g, G.sph(0.1, 5, 4), armor, [sx * 0.24, 0.68, 0]);
        add(g, G.box(0.09, 0.3, 0.1), P.body2, [sx * 0.26, 0.5, 0]);
      });
      add(g, G.box(0.36, 0.34, 0.22), armor, [0, 0.53, 0]);
      add(g, G.box(0.22, 0.2, 0.04), P.acc, [0, 0.56, 0.12]);
      add(g, G.box(0.38, 0.06, 0.24), P.dark, [0, 0.37, 0]);
      const head = new THREE.Group();
      head.position.set(0, 0.84, 0);
      g.add(head);
      add(head, G.cyl(0.13, 0.13, 0.22, 7), armor);
      add(head, G.box(0.18, 0.035, 0.02), P.eye, [0, 0, 0.125]);
      if (rnd() < 0.6) add(head, G.cone(0.05, 0.24, 4), P.acc, [0, 0.2, -0.02]);
      else [-1, 1].forEach((sx) => add(head, G.cone(0.035, 0.2, 4), P.acc, [sx * 0.13, 0.12, 0], [0, 0, sx * -0.7]));
      const sword = new THREE.Group();
      sword.position.set(0.3, 0.38, 0.1);
      g.add(sword);
      add(sword, G.box(0.04, 0.56, 0.015), P.metal, [0, 0.36, 0]);
      add(sword, G.box(0.16, 0.03, 0.04), P.acc, [0, 0.07, 0]);
      add(sword, G.box(0.03, 0.12, 0.03), P.dark, [0, 0, 0]);
      sword.rotation.x = 0.25;
      if (rnd() < 0.75) {
        add(g, G.cyl(0.17, 0.17, 0.04, 6), P.acc, [-0.34, 0.5, 0.07], [Math.PI / 2, 0, 0]);
        add(g, G.cyl(0.05, 0.05, 0.05, 6), P.metal, [-0.34, 0.5, 0.1], [Math.PI / 2, 0, 0]);
      }
      return (t) => { sword.rotation.x = 0.25 + Math.sin(t * 2) * 0.08; head.rotation.y = Math.sin(t * 0.7) * 0.15; };
    },

    mago(g, P, rnd) {
      add(g, G.cone(0.3, 0.7, 7), P.body, [0, 0.35, 0]);
      add(g, G.cyl(0.32, 0.32, 0.04, 7), P.acc, [0, 0.03, 0]);
      add(g, G.cyl(0.12, 0.16, 0.2, 6), P.body2, [0, 0.66, 0]);
      add(g, G.sph(0.13, 6, 5), P.skin, [0, 0.85, 0]);
      [-1, 1].forEach((sx) => add(g, G.sph(0.025, 4, 3), P.eye, [sx * 0.05, 0.87, 0.115]));
      if (rnd() < 0.5) add(g, G.cone(0.09, 0.22, 5), mat(0xe8e8f0), [0, 0.7, 0.08], [Math.PI, 0, 0]);
      add(g, G.cyl(0.25, 0.25, 0.03, 8), P.body2, [0, 0.95, 0]);
      const hat = add(g, G.cone(0.14, 0.45, 7), P.body, [0, 1.18, -0.02], [-0.18, 0, 0.12]);
      add(g, G.tor(0.135, 0.02, 3, 8), P.acc, [0, 0.98, 0], [Math.PI / 2, 0, 0]);
      const staff = new THREE.Group();
      staff.position.set(0.3, 0, 0.08);
      g.add(staff);
      add(staff, G.cyl(0.02, 0.025, 1.0, 5), P.dark, [0, 0.5, 0]);
      const orb = add(staff, G.ico(0.075, 0), P.orb, [0, 1.06, 0]);
      add(g, G.sph(0.05, 4, 3), P.skin, [0.27, 0.6, 0.1]);
      return (t) => { orb.rotation.y = t * 2; orb.scale.setScalar(1 + Math.sin(t * 4) * 0.12); hat.rotation.z = 0.12 + Math.sin(t * 1.3) * 0.05; };
    },

    fera(g, P, rnd, A) {
      add(g, G.sph(0.25, 7, 5), P.body, [0, 0.42, 0], null, [0.9, 0.78, 1.5]);
      add(g, G.sph(0.18, 6, 4), P.acc, [0, 0.36, 0.08], null, [0.9, 0.7, 1.2]);
      if (rnd() < 0.5) add(g, G.sph(0.2, 6, 4), P.body2, [0, 0.55, 0.26], null, [1.1, 1, 0.8]);
      const head = new THREE.Group();
      head.position.set(0, 0.6, 0.4);
      g.add(head);
      add(head, G.box(0.24, 0.22, 0.26), P.body);
      add(head, G.box(0.14, 0.1, 0.16), P.body2, [0, -0.05, 0.17]);
      add(head, G.box(0.06, 0.04, 0.03), P.dark, [0, -0.01, 0.26]);
      [-1, 1].forEach((sx) => {
        add(head, G.cone(0.05, 0.14, 4), P.body2, [sx * 0.08, 0.16, -0.04]);
        add(head, G.sph(0.028, 4, 3), P.eye, [sx * 0.07, 0.04, 0.13]);
      });
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => add(g, G.cyl(0.06, 0.05, 0.32, 5), P.body2, [sx * 0.13, 0.16, sz * 0.22]));
      const tail = new THREE.Group();
      tail.position.set(0, 0.5, -0.36);
      g.add(tail);
      add(tail, G.cone(0.05, 0.36, 5), P.body, [0, 0.12, -0.08], [-0.6, 0, 0]);
      let wings = [];
      if (A.card.attr === 'vento' || rnd() < 0.15) {
        wings = [-1, 1].map((sx) => {
          const piv = new THREE.Group();
          piv.position.set(sx * 0.12, 0.6, 0.05);
          const w = add(piv, wingGeo(rnd, false), mat(P.acc.color, { side: THREE.DoubleSide }));
          w.scale.set(sx * 0.9, 0.9, 1);
          piv.rotation.y = sx * 0.9;
          g.add(piv);
          return piv;
        });
      }
      return (t) => {
        tail.rotation.z = Math.sin(t * 5) * 0.4;
        head.rotation.x = Math.sin(t * 1.5) * 0.07;
        wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 3) * 0.3; });
      };
    },

    maquina(g, P, rnd) {
      const metal = rnd() < 0.5 ? P.metal : P.body;
      [-1, 1].forEach((sx) => {
        add(g, G.box(0.12, 0.3, 0.14), P.body2, [sx * 0.1, 0.17, 0]);
        add(g, G.box(0.16, 0.05, 0.22), P.dark, [sx * 0.1, 0.025, 0.03]);
        add(g, G.sph(0.08, 5, 4), P.metal, [sx * 0.27, 0.68, 0]);
      });
      add(g, G.box(0.3, 0.1, 0.18), P.dark, [0, 0.35, 0]);
      add(g, G.box(0.42, 0.34, 0.28), metal, [0, 0.56, 0]);
      const core = add(g, G.cyl(0.07, 0.07, 0.03, 8), P.orb, [0, 0.58, 0.15], [Math.PI / 2, 0, 0]);
      const head = new THREE.Group();
      head.position.set(0, 0.83, 0);
      g.add(head);
      add(head, G.box(0.22, 0.16, 0.2), P.body);
      add(head, G.box(0.18, 0.05, 0.02), P.eye, [0, 0.01, 0.105]);
      add(head, G.cyl(0.01, 0.01, 0.16, 4), P.dark, [0.07, 0.15, 0]);
      add(head, G.sph(0.025, 4, 3), P.orb, [0.07, 0.24, 0]);
      const cannon = rnd() < 0.5;
      [-1, 1].forEach((sx) => {
        if (cannon && sx === 1) add(g, G.cyl(0.07, 0.07, 0.38, 7), P.dark, [0.3, 0.52, 0.12], [Math.PI / 2, 0, 0]);
        else {
          add(g, G.cyl(0.05, 0.05, 0.3, 6), P.body2, [sx * 0.29, 0.5, 0]);
          add(g, G.box(0.1, 0.08, 0.1), P.dark, [sx * 0.29, 0.33, 0]);
        }
      });
      const gear = add(g, G.tor(0.12, 0.035, 4, 8), P.acc, [0, 0.6, -0.17]);
      return (t) => { gear.rotation.z = t * 2; core.material.emissiveIntensity = 1 + Math.sin(t * 5) * 0.6; head.rotation.y = Math.sin(t * 0.9) * 0.25; };
    },

    demonio(g, P, rnd) {
      [-1, 1].forEach((sx) => {
        add(g, G.cyl(0.07, 0.05, 0.32, 5), P.body2, [sx * 0.1, 0.16, 0]);
        add(g, G.cyl(0.05, 0.04, 0.32, 5), P.body2, [sx * 0.27, 0.5, 0.04], [0, 0, sx * 0.3]);
        add(g, G.cone(0.03, 0.08, 4), P.dark, [sx * 0.32, 0.33, 0.06], [Math.PI, 0, 0]);
      });
      add(g, G.sph(0.22, 6, 5), P.body, [0, 0.55, 0], null, [1, 1.1, 0.8]);
      add(g, G.sph(0.14, 5, 4), P.acc, [0, 0.52, 0.1], null, [1, 1, 0.5]);
      const head = new THREE.Group();
      head.position.set(0, 0.86, 0.04);
      g.add(head);
      add(head, G.box(0.22, 0.2, 0.2), P.body);
      add(head, G.box(0.14, 0.03, 0.02), P.dark, [0, -0.06, 0.1]);
      [-1, 1].forEach((sx) => {
        add(head, G.box(0.05, 0.03, 0.02), P.eye, [sx * 0.05, 0.03, 0.1]);
        add(head, G.cone(0.045, 0.26, 5), P.dark, [sx * 0.11, 0.16, 0], [0, 0, sx * -0.55]);
      });
      const wings = [-1, 1].map((sx) => {
        const piv = new THREE.Group();
        piv.position.set(sx * 0.1, 0.66, -0.12);
        const w = add(piv, wingGeo(rnd, true), mat(P.body2.color, { side: THREE.DoubleSide }));
        w.scale.set(sx * 1.2, 1.1, 1);
        piv.rotation.y = sx * 0.6;
        g.add(piv);
        return piv;
      });
      const tail = add(g, G.cyl(0.02, 0.03, 0.45, 4), P.body2, [0, 0.3, -0.25], [-1.1, 0, 0]);
      add(g, G.cone(0.05, 0.1, 3), P.acc, [0, 0.12, -0.45], [-2, 0, 0]);
      return (t) => {
        wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 1.8) * 0.3; });
        g.position.y = Math.sin(t * 1.8) * 0.03;
        tail.rotation.z = Math.sin(t * 2.2) * 0.2;
      };
    },

    planta(g, P, rnd) {
      const stemM = mat(hsl(110 + rnd() * 30, 0.5, 0.32));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        add(g, G.cone(0.04, 0.22, 4), stemM, [Math.cos(a) * 0.1, 0.06, Math.sin(a) * 0.1], [Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3]);
      }
      const upper = new THREE.Group();
      g.add(upper);
      add(upper, G.cyl(0.05, 0.07, 0.55, 5), stemM, [0, 0.3, 0]);
      [-1, 1].forEach((sx) => add(upper, G.sph(0.12, 5, 3), stemM, [sx * 0.16, 0.32, 0], [0, 0, sx * 0.5], [1.7, 0.3, 0.8]));
      const head = new THREE.Group();
      head.position.set(0, 0.68, 0.02);
      upper.add(head);
      const n = 5 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        add(head, G.sph(0.11, 5, 3), P.body, [Math.cos(a) * 0.19, Math.sin(a) * 0.19, -0.03], [0, 0, a], [1.6, 0.8, 0.35]);
      }
      add(head, G.sph(0.14, 7, 5), P.acc, [0, 0, 0.02]);
      add(head, G.box(0.14, 0.04, 0.03), P.dark, [0, -0.05, 0.14]);
      [-1, 1].forEach((sx) => add(head, G.sph(0.025, 4, 3), P.eye, [sx * 0.05, 0.04, 0.13]));
      return (t) => { upper.rotation.z = Math.sin(t * 1.4) * 0.08; head.rotation.z = Math.sin(t * 0.8) * 0.2; };
    },

    inseto(g, P, rnd) {
      add(g, G.sph(0.2, 7, 5), P.body, [0, 0.32, -0.24], null, [1, 0.8, 1.4]);
      add(g, G.tor(0.17, 0.02, 3, 10), P.acc, [0, 0.33, -0.24], [0, 0, 0], [1, 0.85, 1]);
      add(g, G.sph(0.14, 6, 5), P.body2, [0, 0.34, 0.03]);
      const head = new THREE.Group();
      head.position.set(0, 0.38, 0.2);
      g.add(head);
      add(head, G.sph(0.11, 6, 5), P.body);
      [-1, 1].forEach((sx) => {
        add(head, G.sph(0.05, 5, 4), P.eye, [sx * 0.07, 0.03, 0.06]);
        add(head, G.cone(0.025, 0.12, 4), P.dark, [sx * 0.04, -0.05, 0.12], [Math.PI / 2, 0, sx * 0.4]);
        add(head, G.cyl(0.008, 0.008, 0.3, 3), P.dark, [sx * 0.06, 0.18, 0.05], [0.5, 0, sx * -0.4]);
      });
      for (let i = 0; i < 3; i++) {
        [-1, 1].forEach((sx) => {
          const z = 0.12 - i * 0.12;
          add(g, G.cyl(0.018, 0.018, 0.24, 4), P.dark, [sx * 0.17, 0.3, z], [0, 0, sx * 1.1]);
          add(g, G.cyl(0.015, 0.012, 0.26, 4), P.dark, [sx * 0.3, 0.14, z], [0, 0, sx * -0.3]);
        });
      }
      const wingM = mat(P.acc.color, { transparent: true, opacity: 0.45, side: THREE.DoubleSide });
      const wings = [-1, 1].map((sx) => {
        const piv = new THREE.Group();
        piv.position.set(sx * 0.06, 0.44, -0.02);
        add(piv, G.sph(0.18, 6, 3), wingM, [sx * 0.12, 0.02, -0.15], null, [0.5, 0.06, 1.4]);
        g.add(piv);
        return piv;
      });
      return (t) => { wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (0.2 + Math.sin(t * 22) * 0.25); }); head.rotation.y = Math.sin(t * 1.1) * 0.2; };
    },

    aquatico(g, P, rnd) {
      if (rnd() < 0.5) {
        const body = new THREE.Group();
        body.position.y = 0.5;
        g.add(body);
        add(body, G.sph(0.25, 8, 6), P.body, [0, 0, 0], null, [0.7, 0.9, 1.6]);
        add(body, G.sph(0.18, 6, 4), P.acc, [0, -0.08, 0.05], null, [0.6, 0.6, 1.4]);
        const tail = new THREE.Group();
        tail.position.set(0, 0, -0.38);
        body.add(tail);
        const fin = new THREE.Shape();
        fin.moveTo(0, 0); fin.lineTo(0.25, -0.3); fin.lineTo(0.08, 0); fin.lineTo(0.25, 0.3); fin.lineTo(0, 0);
        add(tail, new THREE.ShapeGeometry(fin), mat(P.acc.color, { side: THREE.DoubleSide }), [0, 0, -0.05], [0, Math.PI / 2, 0]);
        const dorsal = new THREE.Shape();
        dorsal.moveTo(-0.2, 0); dorsal.lineTo(0.1, 0.25); dorsal.lineTo(0.2, 0); dorsal.lineTo(-0.2, 0);
        add(body, new THREE.ShapeGeometry(dorsal), mat(P.acc.color, { side: THREE.DoubleSide }), [0, 0.2, 0], [0, Math.PI / 2, 0]);
        [-1, 1].forEach((sx) => add(body, G.sph(0.04, 5, 4), P.eye, [sx * 0.13, 0.06, 0.28]));
        add(body, G.box(0.1, 0.03, 0.04), P.dark, [0, -0.06, 0.38]);
        return (t) => { tail.rotation.y = Math.sin(t * 4) * 0.5; body.position.y = 0.5 + Math.sin(t * 1.6) * 0.05; body.rotation.y = Math.sin(t * 0.7) * 0.2; };
      }
      const segs = [];
      for (let i = 0; i < 8; i++) {
        const k = i / 7;
        const s = add(g, G.sph(0.11 - k * 0.03 + 0.04, 6, 4), i % 2 ? P.body : P.body2, [0, 0, 0]);
        segs.push(s);
      }
      const head = new THREE.Group();
      g.add(head);
      add(head, G.box(0.2, 0.15, 0.26), P.body);
      add(head, G.box(0.14, 0.06, 0.12), P.acc, [0, -0.06, 0.14]);
      [-1, 1].forEach((sx) => {
        add(head, G.sph(0.03, 4, 3), P.eye, [sx * 0.08, 0.05, 0.1]);
        add(head, G.cone(0.03, 0.18, 4), P.acc, [sx * 0.09, 0.1, -0.1], [-1, 0, sx * -0.3]);
      });
      return (t) => {
        segs.forEach((s, i) => {
          const k = i / 7;
          s.position.set(Math.sin(k * 4.5 + t * 2) * 0.16 * (1 - k * 0.5), 0.1 + k * 0.72, -0.25 + k * 0.4);
        });
        const top = segs[segs.length - 1].position;
        head.position.set(top.x, top.y + 0.1, top.z + 0.1);
        head.rotation.y = Math.sin(t * 1.2) * 0.25;
      };
    },

    espirito(g, P, rnd, A) {
      const pts = [[0, 1], [0.15, 0.97], [0.24, 0.86], [0.27, 0.68], [0.28, 0.48], [0.33, 0.3], [0.4, 0.16], [0.3, 0.2], [0.24, 0.12], [0.16, 0.2], [0, 0.18]]
        .map(([x, y]) => new THREE.Vector2(x, y));
      const body = new THREE.Group();
      g.add(body);
      add(body, new THREE.LatheGeometry(pts, 8), mat(P.body.color, { transparent: true, opacity: 0.9, emissive: P.body.color, emissiveIntensity: 0.35, side: THREE.DoubleSide }));
      [-1, 1].forEach((sx) => {
        add(body, G.sph(0.045, 5, 4), P.eye, [sx * 0.08, 0.78, 0.22], null, [0.8, 1.3, 0.5]);
        add(body, G.sph(0.06, 5, 4), P.body, [sx * 0.33, 0.55, 0.05]);
      });
      const halo = (A.card.attr === 'luz' || rnd() < 0.3) ? add(body, G.tor(0.15, 0.022, 4, 14), glow(new THREE.Color(1, 0.85, 0.35), 1.3), [0, 1.12, 0], [Math.PI / 2, 0, 0]) : null;
      const motes = [];
      for (let i = 0; i < 4; i++) motes.push(add(g, G.oct(0.04), P.orb, [0, 0, 0]));
      return (t) => {
        body.position.y = 0.06 + Math.sin(t * 1.7) * 0.06;
        body.rotation.y = Math.sin(t * 0.6) * 0.3;
        if (halo) halo.rotation.z = t;
        motes.forEach((m, i) => {
          const a = t * 1.2 + (i / motes.length) * Math.PI * 2;
          m.position.set(Math.cos(a) * 0.45, 0.4 + Math.sin(t * 2 + i) * 0.15, Math.sin(a) * 0.45);
          m.rotation.y = t * 3;
        });
      };
    },
  };

  /** Monta o modelo 3D de um monstro (frente para +z, altura ~1). */
  function monster(card) {
    const rnd = rng(hashStr(card.id + card.name));
    const P = palette(card, rnd);
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);
    const A = { card, big: card.level >= 7 };
    const anim = (BUILD[card.race] || BUILD.fera)(inner, P, rnd, A);
    const scale = 0.85 + Math.min(card.level, 8) * 0.04 + (rnd() - 0.5) * 0.08;
    inner.scale.setScalar(scale);
    if (card.level >= 7) {
      add(inner, G.tor(0.32, 0.02, 3, 16), glow(PD.ATTRS[card.attr].color && new THREE.Color(PD.ATTRS[card.attr].color), 0.9), [0, 0.02, 0], [Math.PI / 2, 0, 0]);
    }
    const phase = rnd() * 10;
    g.userData.anim = (t) => anim && anim(t + phase);
    g.userData.height = 1.15 * scale;
    return g;
  }

  /* ---------- ícones de Magias e Armadilhas ---------- */
  function shapeFromPoints(pts) {
    const s = new THREE.Shape();
    pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    return s;
  }
  const extrude = (shape, depth) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: depth || 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 5 });
    geo.center();
    return geo;
  };
  function heartShape() {
    const s = new THREE.Shape();
    s.moveTo(0, -0.38);
    s.bezierCurveTo(-0.5, 0.0, -0.42, 0.42, 0, 0.2);
    s.bezierCurveTo(0.42, 0.42, 0.5, 0.0, 0, -0.38);
    return s;
  }
  function flameShape() {
    const s = new THREE.Shape();
    s.moveTo(0, -0.42);
    s.quadraticCurveTo(-0.4, -0.3, -0.3, 0.05);
    s.quadraticCurveTo(-0.24, 0.2, -0.08, 0.46);
    s.quadraticCurveTo(-0.02, 0.22, 0.06, 0.18);
    s.quadraticCurveTo(0.2, 0.32, 0.16, 0.5);
    s.quadraticCurveTo(0.42, 0.18, 0.32, -0.12);
    s.quadraticCurveTo(0.26, -0.36, 0, -0.42);
    return s;
  }
  function star(n, r1, r2) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 ? r2 : r1;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return shapeFromPoints(pts);
  }
  function shieldShape() {
    const s = new THREE.Shape();
    s.moveTo(-0.32, 0.38); s.lineTo(0.32, 0.38); s.lineTo(0.32, 0.05);
    s.quadraticCurveTo(0.3, -0.28, 0, -0.44);
    s.quadraticCurveTo(-0.3, -0.28, -0.32, 0.05);
    s.lineTo(-0.32, 0.38);
    return s;
  }

  function glyphGroup(name, m, m2) {
    const g = new THREE.Group();
    switch (name) {
      case 'flame': add(g, extrude(flameShape()), m); add(g, extrude(flameShape(), 0.05), m2, [0, -0.08, 0.1], null, [0.5, 0.5, 1]); break;
      case 'heart': add(g, extrude(heartShape()), m); break;
      case 'cards':
        add(g, G.box(0.4, 0.56, 0.04), m2, [-0.1, 0.04, -0.05], [0, 0, 0.25]);
        add(g, G.box(0.4, 0.56, 0.04), m, [0.08, -0.02, 0.05], [0, 0, -0.12]);
        add(g, G.oct(0.09), m2, [0.08, -0.02, 0.1]);
        break;
      case 'bolt': add(g, extrude(shapeFromPoints([[0.1, 0.5], [-0.25, 0.0], [-0.02, 0.0], [-0.14, -0.5], [0.26, 0.08], [0.03, 0.08], [0.2, 0.5]])), m); break;
      case 'burst': add(g, extrude(star(8, 0.48, 0.2)), m); add(g, G.ico(0.14), m2, [0, 0, 0.1]); break;
      case 'skull':
        add(g, G.sph(0.3, 8, 6), m, [0, 0.06, 0]);
        add(g, G.box(0.3, 0.16, 0.24), m, [0, -0.2, 0.02]);
        [-1, 1].forEach((sx) => add(g, G.sph(0.08, 6, 4), m2, [sx * 0.11, 0.06, 0.24]));
        break;
      case 'sword':
        add(g, G.box(0.09, 0.78, 0.04), m, [0, 0.12, 0]);
        add(g, G.cone(0.065, 0.14, 4), m, [0, 0.58, 0], [0, Math.PI / 4, 0]);
        add(g, G.box(0.34, 0.06, 0.08), m2, [0, -0.28, 0]);
        add(g, G.box(0.06, 0.18, 0.06), m2, [0, -0.4, 0]);
        g.rotation.z = -0.7;
        break;
      case 'down': add(g, extrude(shapeFromPoints([[-0.12, 0.45], [0.12, 0.45], [0.12, 0.0], [0.32, 0.0], [0, -0.45], [-0.32, 0.0], [-0.12, 0.0]])), m); break;
      case 'ankh':
        add(g, G.tor(0.15, 0.06, 5, 10), m, [0, 0.28, 0], null, [0.85, 1.1, 1]);
        add(g, G.box(0.1, 0.5, 0.1), m, [0, -0.2, 0]);
        add(g, G.box(0.52, 0.1, 0.1), m, [0, 0.04, 0]);
        break;
      case 'shield': add(g, extrude(shieldShape()), m); add(g, extrude(star(4, 0.18, 0.07), 0.04), m2, [0, 0.02, 0.1]); break;
      case 'mirror': add(g, G.oct(0.4), m2, null, null, [0.8, 1.1, 0.4]); add(g, G.tor(0.42, 0.04, 4, 4), m, null, [0, 0, Math.PI / 4]); break;
      case 'spikes':
        add(g, G.box(0.9, 0.12, 0.3), m2, [0, -0.3, 0]);
        for (let i = -2; i <= 2; i++) add(g, G.cone(0.08, 0.5 - Math.abs(i) * 0.06, 4), m, [i * 0.18, -0.03 - Math.abs(i) * 0.03, 0]);
        break;
      case 'bars':
        add(g, G.box(0.8, 0.08, 0.12), m2, [0, 0.36, 0]);
        add(g, G.box(0.8, 0.08, 0.12), m2, [0, -0.36, 0]);
        for (let i = -2; i <= 2; i++) add(g, G.cyl(0.035, 0.035, 0.72, 5), m, [i * 0.17, 0, 0]);
        break;
      case 'land':
        add(g, G.cone(0.32, 0.6, 5), m, [-0.14, -0.1, 0]);
        add(g, G.cone(0.24, 0.42, 5), m2, [0.22, -0.19, 0.05]);
        add(g, G.ico(0.11, 0), glow(new THREE.Color(1, 0.85, 0.4), 1.2), [0.28, 0.3, -0.05]);
        break;
      default: add(g, G.sph(0.3, 8, 6), m, null, null, [1.4, 0.7, 0.5]); add(g, G.sph(0.14, 6, 4), m2, [0, 0, 0.12]);
    }
    return g;
  }

  function spellIcon(card) {
    const isTrap = card.kind === 'trap';
    let hue = isTrap ? 350 : 195;
    if (card.sub === 'field') hue = card.field.attr ? PD.ATTRS[card.field.attr].hue : card.field.race === 'dragao' ? 15 : 35;
    const m = mat(hsl(hue, 0.75, isTrap ? 0.55 : 0.6), { metalness: 0.55, roughness: 0.3, emissive: hsl(hue, 0.8, 0.3), emissiveIntensity: 0.6 });
    const m2 = mat(hsl(hue + 30, 0.5, 0.25), { metalness: 0.4, roughness: 0.4 });
    const g = new THREE.Group();
    const icon = glyphGroup(PD.Sprites && PD.Sprites.glyphFor ? PD.Sprites.glyphFor(card) : 'eye', m, m2);
    icon.position.y = 0.55;
    g.add(icon);
    const ring = add(g, G.tor(0.62, 0.025, 3, 24), glow(hsl(hue, 0.9, 0.6), 1), [0, 0.55, -0.15]);
    const ring2 = add(g, new THREE.RingGeometry(0.42, 0.46, 6), glow(hsl(hue + 20, 0.9, 0.55), 0.8), [0, 0.55, -0.18]);
    ring2.material.side = THREE.DoubleSide;
    g.userData.anim = (t) => { icon.rotation.y = Math.sin(t * 1.4) * 0.5; ring2.rotation.z = t * 0.6; ring.rotation.z = -t * 0.3; };
    g.userData.height = 1.1;
    return g;
  }

  /* ---------- retratos (personagens originais) ---------- */
  function character(o) {
    const rnd = rng(hashStr(o.seed || o.id));
    const g = new THREE.Group();
    const skin = mat(hsl(o.skin != null ? o.skin : 26, 0.45, 0.6));
    const hair = mat(hsl(o.hair, 0.55, 0.38));
    const cloth = mat(hsl(o.cloth, 0.55, 0.42));
    const cloth2 = mat(hsl(o.cloth + 20, 0.5, 0.25));
    const gold = mat(0xe8b84a, { metalness: 0.7, roughness: 0.3 });
    add(g, G.box(1.0, 0.42, 0.46), cloth, [0, 0.21, 0]);
    add(g, G.box(0.42, 0.1, 0.48), cloth2, [0, 0.42, 0]);
    add(g, G.cyl(0.11, 0.12, 0.2, 6), skin, [0, 0.5, 0]);
    const head = new THREE.Group();
    head.position.set(0, 0.84, 0);
    g.add(head);
    add(head, G.sph(0.27, 8, 7), skin, [0, 0, 0], null, [1, 1.15, 1]);
    [-1, 1].forEach((sx) => {
      add(head, G.box(0.07, 0.07, 0.03), mat(0xffffff), [sx * 0.1, 0.03, 0.25]);
      add(head, G.box(0.035, 0.05, 0.02), mat(0x1a1430), [sx * 0.1, 0.03, 0.265]);
      add(head, G.box(0.1, 0.025, 0.03), hair, [sx * 0.1, 0.11, 0.25], [0, 0, sx * -0.12]);
      add(head, G.sph(0.05, 4, 3), skin, [sx * 0.27, 0, 0]);
    });
    add(head, G.box(0.05, 0.08, 0.05), skin, [0, -0.04, 0.28]);
    add(head, G.box(0.08, 0.018, 0.02), mat(0xc0605a), [0, -0.14, 0.255]);
    const style = o.style || ['cap', 'bob', 'long', 'crop'][Math.floor(rnd() * 4)];
    add(head, G.sph(0.29, 8, 5, ), hair, [0, 0.06, -0.02], null, [1.02, 0.95, 1.02]).geometry = new THREE.SphereGeometry(0.29, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55);
    if (style === 'bob' || style === 'long') {
      [-1, 1].forEach((sx) => add(head, G.box(0.1, style === 'long' ? 0.62 : 0.36, 0.3), hair, [sx * 0.27, style === 'long' ? -0.18 : -0.04, -0.04]));
      add(head, G.box(0.56, style === 'long' ? 0.6 : 0.36, 0.1), hair, [0, style === 'long' ? -0.18 : -0.04, -0.24]);
      add(head, G.box(0.5, 0.08, 0.1), hair, [0, 0.2, 0.22], [0.3, 0, 0]);
    } else if (style === 'cap') {
      add(head, G.sph(0.3, 8, 4), cloth2, [0, 0.08, 0], null, [1.04, 0.8, 1.04]).geometry = new THREE.SphereGeometry(0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.5);
      add(head, G.box(0.4, 0.03, 0.22), cloth2, [0, 0.12, 0.3]);
    } else {
      add(head, G.box(0.46, 0.08, 0.14), hair, [0, 0.21, 0.18], [0.4, 0, 0]);
    }
    if (o.accessory === 'crown') {
      add(head, G.cyl(0.2, 0.22, 0.08, 8), gold, [0, 0.33, 0]);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; add(head, G.cone(0.04, 0.12, 4), gold, [Math.cos(a) * 0.19, 0.42, Math.sin(a) * 0.19]); }
      add(head, G.oct(0.04), glow(new THREE.Color(1, 0.2, 0.2), 1), [0, 0.34, 0.22]);
    } else if (o.accessory === 'goggles') {
      [-1, 1].forEach((sx) => add(head, G.tor(0.065, 0.025, 4, 8), mat(0x333344, { metalness: 0.6 }), [sx * 0.1, 0.2, 0.24], [0.3, 0, 0]));
      [-1, 1].forEach((sx) => add(head, G.cyl(0.05, 0.05, 0.02, 8), glow(new THREE.Color(0.3, 0.9, 1), 0.7), [sx * 0.1, 0.2, 0.24], [Math.PI / 2 + 0.3, 0, 0]));
      add(head, G.box(0.6, 0.04, 0.04), mat(0x222233), [0, 0.2, 0.06]);
    } else if (o.accessory === 'headdress') {
      add(head, G.cyl(0.29, 0.29, 0.06, 10), gold, [0, 0.18, 0]);
      add(head, G.cone(0.06, 0.14, 4), gold, [0, 0.27, 0.27], [0.4, 0, 0]);
      [-1, 1].forEach((sx) => add(head, G.box(0.08, 0.5, 0.2), mat(hsl(o.cloth, 0.6, 0.45)), [sx * 0.28, -0.12, -0.05]));
    } else if (o.accessory === 'cap') {
      add(head, G.sph(0.3, 8, 4), cloth, [0, 0.08, 0], null, [1.04, 0.8, 1.04]).geometry = new THREE.SphereGeometry(0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.5);
      add(head, G.box(0.42, 0.03, 0.24), cloth, [0, 0.12, 0.3]);
    }
    if (o.accessory === 'crown' || rnd() < 0.4) add(g, G.box(0.06, 0.2, 0.02), gold, [0.18, 0.28, 0.24]);
    g.userData.height = 1.25;
    g.userData.anim = (t) => { head.rotation.y = Math.sin(t * 0.8) * 0.15; };
    return g;
  }

  /* ---------- renderização fora da tela (arte das cartas e retratos) ---------- */
  let offR = null;
  function offscreen() {
    if (offR) return offR;
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
    renderer.setPixelRatio(1);
    renderer.setSize(192, 192, false);
    offR = renderer;
    return offR;
  }

  function bgTexture(top, bottom, ring) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    if (ring) {
      const rg = x.createRadialGradient(32, 40, 2, 32, 40, 30);
      rg.addColorStop(0, ring); rg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = rg; x.fillRect(0, 0, 64, 64);
    }
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  function disposeTree(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  }

  function snapshot(model, opts) {
    const renderer = offscreen();
    const scene = new THREE.Scene();
    const tex = bgTexture(opts.top, opts.bottom, opts.ring);
    scene.background = tex;
    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x302040, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(1.5, 2.5, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(opts.rim || 0x88aaff, 0.6);
    rim.position.set(-2, 1.5, -2.5);
    scene.add(rim);
    if (model.userData.anim) model.userData.anim(opts.t || 0.6);
    scene.add(model);
    if (!opts.noGround) {
      const ground = new THREE.Mesh(new THREE.CircleGeometry(0.62, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0.001;
      scene.add(ground);
    }
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const cam = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
    const radius = Math.max(size.x, size.y, size.z) * (opts.zoom || 0.62);
    const dist = radius / Math.tan((32 * Math.PI) / 360) * 1.05;
    const dir = new THREE.Vector3(opts.yaw != null ? opts.yaw : 0.55, opts.pitch != null ? opts.pitch : 0.32, 1).normalize();
    cam.position.copy(center).addScaledVector(dir, dist);
    cam.lookAt(center.x, center.y - size.y * 0.02, center.z);
    renderer.render(scene, cam);
    const out = document.createElement('canvas');
    out.width = 192; out.height = 192;
    out.getContext('2d').drawImage(renderer.domElement, 0, 0);
    disposeTree(model);
    tex.dispose();
    return out;
  }

  const canvasCache = new Map();
  const urlCache = new Map();

  function cardArtCanvas(id) {
    if (canvasCache.has(id)) return canvasCache.get(id);
    const c = PD.card(id);
    let cv = null;
    if (c) {
      if (c.kind === 'monster') {
        const hue = PD.ATTRS[c.attr].hue;
        const css = (h, s, l) => `hsl(${h},${s}%,${l}%)`;
        cv = snapshot(monster(c), { top: css(hue + 200, 35, 18), bottom: css(hue + 180, 45, 34), ring: css(hue, 70, 45), rim: new THREE.Color().setHSL(hue / 360, 0.8, 0.6) });
      } else {
        const trap = c.kind === 'trap';
        cv = snapshot(spellIcon(c), { top: trap ? '#2a0816' : '#071c2e', bottom: trap ? '#5a1430' : '#0e3d5c', ring: trap ? 'rgba(255,90,120,0.6)' : 'rgba(90,220,255,0.6)', yaw: 0.25, pitch: 0.1, zoom: 0.55, noGround: true });
      }
    }
    canvasCache.set(id, cv);
    return cv;
  }

  function cardArt(id) {
    if (urlCache.has(id)) return urlCache.get(id);
    const cv = cardArtCanvas(id);
    const url = cv ? cv.toDataURL() : '';
    urlCache.set(id, url);
    return url;
  }

  function portraitCanvas(o) {
    const key = 'portrait:' + (o.id || o.seed);
    if (canvasCache.has(key)) return canvasCache.get(key);
    const css = (h, s, l) => `hsl(${h},${s}%,${l}%)`;
    const cv = snapshot(character(o), { top: css(o.cloth + 180, 40, 22), bottom: css(o.cloth + 200, 45, 40), ring: css(o.cloth + 180, 60, 50), yaw: 0.22, pitch: 0.12, zoom: 0.5, noGround: true });
    canvasCache.set(key, cv);
    return cv;
  }
  function portraitArt(o) {
    const key = 'portrait:' + (o.id || o.seed);
    if (urlCache.has(key)) return urlCache.get(key);
    const url = portraitCanvas(o).toDataURL();
    urlCache.set(key, url);
    return url;
  }

  function supported() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  PD.Models = { monster, spellIcon, character, hsl, mat, glow };
  if (supported()) {
    PD.GFX3D = true;
    PD.Sprites = Object.assign({}, PD.Sprites, { cardArt, cardArtCanvas, portraitArt, portraitCanvas });
  }
})();
