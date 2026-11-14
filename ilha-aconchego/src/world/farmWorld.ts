import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import { FARM_CROP_DEFS, growthStage, type FarmCropId } from '../data/crops';
import {
  BARN, COOP, CREEK, CREEK_BEACH, CREEK_WIDTH, FARM_TILES, GREENHOUSE, HIVES, KITCHEN, LEVELS, MACHINE_PADS, MINE_NODES, PEN, PEN_YARD, POND,
  SHIPPING_BIN, SMITHY, STUMPS, WORKBENCH,
} from '../data/map';
import { absoluteDay } from '../core/clock';
import type { GameState, PlotState } from '../core/types';
import { instantiate, type Placement } from '../render/instancing';
import { canvasTexture, seededRandom } from '../render/textures';
import { heightAt } from './terrain';

/** Everything of stage 3 that changes with the game state, plus the pen, the pond and the work spots. */
export interface FarmWorld {
  root: THREE.Group;
  /** Redraws the farm, machines, rocks, stumps and markers from the state. */
  sync(state: Readonly<GameState>): void;
  update(dt: number, elapsed: number, reducedMotion: boolean): void;
  /** Where an animal is right now (it wanders around the yard). */
  animalAt(id: string): THREE.Vector3 | null;
  /** Little bounce when an animal is petted or fed. */
  cheerAnimal(id: string): void;
  /** Splash of droplets over watered tiles. */
  splash(tileIds: readonly string[]): void;
}

const FLOOR = LEVELS.main.top;
const _v = new THREE.Vector3();

interface Wanderer {
  id: string;
  object: THREE.Object3D;
  target: THREE.Vector2;
  wait: number;
  speed: number;
  hop: number;
  cheer: number;
  marker: THREE.Object3D;
}

export function buildFarmWorld(assets: AssetRegistry): FarmWorld {
  const root = new THREE.Group();
  root.name = 'farm-world';
  const rnd = seededRandom(303);
  const cache = new Map<string, THREE.Object3D>();
  const template = (name: string) => {
    let t = cache.get(name);
    if (!t) cache.set(name, (t = assets.create(name)));
    return t;
  };
  const place = (name: string, x: number, z: number, ry = 0, y = heightAt(x, z)) => {
    const o = assets.create(name);
    o.position.set(x, y, z);
    o.rotation.y = ry;
    root.add(o);
    return o;
  };

  // ---------- Fixed buildings and work spots ----------
  place('barn', BARN.x, BARN.z);
  place('coop', COOP.x, COOP.z);
  place('smithy', SMITHY.x, SMITHY.z);
  place('shipping.bin', SHIPPING_BIN[0], SHIPPING_BIN[1], -0.35);
  place('kitchen', KITCHEN[0], KITCHEN[1], 0.25);
  place('workbench', WORKBENCH[0], WORKBENCH[1]);
  const greenhouse = place('greenhouse', GREENHOUSE.x, GREENHOUSE.z);
  for (const [x, z] of MACHINE_PADS) place('machine.pad', x, z);
  const fires: THREE.Object3D[] = [];
  root.traverse(o => o.name === 'fire' && fires.push(o));

  // Pen fence: log posts around the pen, with the gate open on the east side.
  const posts: Placement[] = [];
  const line = (ax: number, az: number, bx: number, bz: number) => {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 0.36));
    for (let k = 0; k <= n; k++) posts.push({ x: ax + ((bx - ax) * k) / n, y: FLOOR, z: az + ((bz - az) * k) / n, sy: 0.85 + rnd() * 0.25, ry: rnd() * 3 });
  };
  line(PEN.x0, PEN.z1, PEN.x1, PEN.z1);
  line(PEN.x0, PEN.z0, PEN.x0, PEN.z1);
  line(PEN.x1, PEN.z0, PEN.x1, PEN.gate[0]);
  line(PEN.x1, PEN.gate[1], PEN.x1, PEN.z1);
  line(BARN.x + BARN.w / 2 + 0.05, PEN.z0, COOP.x - COOP.w / 2 - 0.05, PEN.z0);
  line(COOP.x + COOP.w / 2 + 0.5, PEN.z0, PEN.x1, PEN.z0);
  for (const z of PEN.gate) posts.push({ x: PEN.x1, y: FLOOR, z, s: 1.15, sy: 1.45 });
  root.add(instantiate(assets.create('fence.log'), posts, 'pen-fence'));

  // ---------- Pond, creek and waterfall ----------
  const ripple = canvasTexture(128, 128, (ctx, w, h, r) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.0)';
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(200,240,250,${0.25 + r() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(r() * w, r() * h, 8 + r() * 10, 2 + r() * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat: true, seed: 8 });
  ripple.repeat.set(2, 2);
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x4fb9cf, map: ripple, transparent: true, opacity: 0.92 });
  const pond = new THREE.Mesh(new THREE.CircleGeometry(1, 40), waterMat);
  pond.rotation.x = -Math.PI / 2;
  pond.scale.set(POND.rx, POND.rz, 1);
  pond.position.set(POND.x, FLOOR + 0.03, POND.z);
  pond.receiveShadow = true;
  root.add(pond);
  const ribbon = (points: THREE.Vector3[], width: number) => {
    const curve = new THREE.CatmullRomCurve3(points);
    const n = 24, pos: number[] = [], uv: number[] = [], index: number[] = [];
    for (let i = 0; i <= n; i++) {
      const p = curve.getPoint(i / n), t = curve.getTangent(i / n);
      const side = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(width / 2);
      pos.push(p.x - side.x, p.y, p.z - side.z, p.x + side.x, p.y, p.z + side.z);
      uv.push(0, i / 3, 1, i / 3);
      if (i < n) index.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  };
  const creekMat = new THREE.MeshLambertMaterial({ color: 0x5cc4d8, map: ripple.clone(), transparent: true, opacity: 0.92, side: THREE.DoubleSide });
  (creekMat.map as THREE.Texture).repeat.set(1, 1);
  (creekMat.map as THREE.Texture).needsUpdate = true;
  root.add(new THREE.Mesh(ribbon([new THREE.Vector3(POND.x, FLOOR + 0.035, POND.z + 0.6), ...CREEK.map(([x, z]) => new THREE.Vector3(x, FLOOR + 0.035, z))], CREEK_WIDTH), creekMat));
  root.add(new THREE.Mesh(ribbon([new THREE.Vector3(CREEK_BEACH.x, LEVELS.beach.top + 0.03, CREEK_BEACH.z0 + 0.1), new THREE.Vector3(CREEK_BEACH.x + 0.2, LEVELS.beach.top + 0.03, (CREEK_BEACH.z0 + CREEK_BEACH.z1) / 2), new THREE.Vector3(CREEK_BEACH.x - 0.1, LEVELS.beach.top - 0.05, CREEK_BEACH.z1)], CREEK_WIDTH * 0.9), creekMat));
  const fallTexture = canvasTexture(64, 128, (ctx, w, h, r) => {
    ctx.fillStyle = '#BFEFF7';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.5})`;
      ctx.fillRect(r() * w, r() * h, 2 + r() * 3, 14 + r() * 26);
    }
  }, { repeat: true, seed: 12 });
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(CREEK_WIDTH, FLOOR - LEVELS.beach.top + 0.1), new THREE.MeshLambertMaterial({ map: fallTexture, transparent: true, opacity: 0.9 }));
  fall.position.set(CREEK[CREEK.length - 1]![0], (FLOOR + LEVELS.beach.top) / 2, CREEK[CREEK.length - 1]![1] + 0.03);
  root.add(fall);
  const foam = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
  foam.scale.set(0.55, 0.12, 0.35);
  foam.position.set(CREEK_BEACH.x, LEVELS.beach.top + 0.04, CREEK_BEACH.z0 + 0.25);
  root.add(foam);
  // Pebbles around the pond.
  const pebbles: Placement[] = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd() * 0.1;
    if (a > 1.2 && a < 1.75) continue;
    pebbles.push({ x: POND.x + Math.cos(a) * (POND.rx + 0.1), y: FLOOR, z: POND.z + Math.sin(a) * (POND.rz + 0.1), s: 0.22 + rnd() * 0.12, ry: rnd() * 6 });
  }
  root.add(instantiate(assets.create('rock'), pebbles, 'pond-rim'));

  // ---------- Dynamic: farm tiles ----------
  let dynamic = new THREE.Group();
  root.add(dynamic);

  // ---------- Animals ----------
  const animals = new Map<string, Wanderer>();
  const yardPoint = () => new THREE.Vector2(PEN_YARD.x0 + rnd() * (PEN_YARD.x1 - PEN_YARD.x0), PEN_YARD.z0 + rnd() * (PEN_YARD.z1 - PEN_YARD.z0));

  // ---------- Markers over things to pick up ----------
  const markers: THREE.Object3D[] = [];
  const markerAt = (x: number, y: number, z: number) => {
    const m = assets.create('marker.ready');
    m.position.set(x, y, z);
    m.userData.baseY = y;
    dynamic.add(m);
    markers.push(m);
  };

  // Droplets for watering.
  const dropGeometry = new THREE.SphereGeometry(0.05, 6, 4);
  const dropMaterial = new THREE.MeshLambertMaterial({ color: 0x8fd8ef, transparent: true, opacity: 0.85 });
  const drops: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];

  const plotVisual = (plot: PlotState): { asset: string; s: number } | null => {
    if (!plot.crop) return null;
    const crop = plot.crop as FarmCropId;
    const stage = growthStage(crop, plot.growth, plot.ripe);
    if (stage === 0) return { asset: 'crop.seed', s: 1 };
    if (stage === 1) return { asset: 'crop.sprout', s: 0.85 };
    if (stage === 2) return { asset: `crop.${crop}.young`, s: 0.62 };
    if (stage === 3) return { asset: `crop.${crop}.young`, s: 0.92 };
    return { asset: `crop.${FARM_CROP_DEFS[crop].visual}`, s: 1 };
  };

  const sync = (state: Readonly<GameState>) => {
    root.remove(dynamic);
    dynamic.traverse(o => {
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
    });
    dynamic = new THREE.Group();
    dynamic.name = 'farm-dynamic';
    root.add(dynamic);
    markers.length = 0;

    // Soil, crops and sprinklers.
    const soil: Placement[] = [], wet: boolean[] = [];
    const crops = new Map<string, Placement[]>();
    const sprinklers: Placement[] = [];
    for (const tile of FARM_TILES) {
      const plot = state.plots[tile.id];
      if (!plot || (tile.greenhouse && !state.greenhouse)) continue;
      const y = heightAt(tile.x, tile.z) + (tile.greenhouse ? 0.1 : 0);
      if (plot.tilled) {
        soil.push({ x: tile.x, y, z: tile.z, sx: tile.w / 1.05, sz: tile.d / 1.07 });
        wet.push(plot.watered);
      }
      if (plot.sprinkler) sprinklers.push({ x: tile.x, y: y + 0.05, z: tile.z });
      const visual = plotVisual(plot);
      if (visual) {
        const list = crops.get(visual.asset) ?? [];
        const k = tile.id.length * 7 + tile.col * 3 + tile.row;
        list.push({ x: tile.x, y: y + 0.08, z: tile.z, s: visual.s * (tile.greenhouse ? 0.8 : 1), ry: (k * 1.7) % (Math.PI * 2) });
        crops.set(visual.asset, list);
      }
    }
    if (soil.length) {
      const g = instantiate(template('soil.tilled'), soil, 'soil');
      const color = new THREE.Color();
      for (const child of g.children as THREE.InstancedMesh[]) {
        wet.forEach((w, i) => child.setColorAt(i, w ? color.setRGB(0.55, 0.52, 0.55) : color.setRGB(1, 1, 1)));
        if (child.instanceColor) child.instanceColor.needsUpdate = true;
      }
      dynamic.add(g);
    }
    for (const [asset, list] of crops) dynamic.add(instantiate(template(asset), list));
    if (sprinklers.length) dynamic.add(instantiate(template('farm.sprinkler'), sprinklers));

    // Machines on their pads.
    const now = absoluteDay(state.time) * 1440 + state.time.minuteOfDay;
    MACHINE_PADS.forEach(([x, z], i) => {
      const m = state.machines[String(i)];
      if (!m) return;
      const o = template(`machine.${m.kind}`).clone();
      o.position.set(x, heightAt(x, z) + 0.08, z);
      dynamic.add(o);
      if (m.output && now >= m.readyAt) markerAt(x, heightAt(x, z) + 1.5, z);
    });

    // Rocks (or rubble), stumps (with or without wood) and beehives with honey.
    MINE_NODES.forEach(([x, z], i) => {
      const node = state.nodes[`node-${i}`];
      const o = template(node?.ore ? `node.${node.ore}` : 'node.rubble').clone();
      o.position.set(x, heightAt(x, z), z);
      o.rotation.y = i * 1.3;
      dynamic.add(o);
    });
    STUMPS.forEach(([x, z], i) => {
      const o = template('stump').clone();
      o.position.set(x, heightAt(x, z), z);
      o.rotation.y = i * 2.1;
      const wood = o.getObjectByName('wood');
      if (wood) wood.visible = state.stumps[`stump-${i}`] === undefined;
      dynamic.add(o);
    });
    const winter = state.time.seasonIndex === 3;
    HIVES.forEach(([x, z], i) => {
      if (!winter && absoluteDay(state.time) >= (state.hives[`hive-${i}`] ?? 0)) markerAt(x, heightAt(x, z) + 1.6, z);
    });

    // Greenhouse glass.
    greenhouse.traverse(o => {
      if (o.name === 'only:broken') o.visible = !state.greenhouse;
      if (o.name === 'only:fixed') o.visible = state.greenhouse;
    });

    // Animals: create once, then just update their "ready" sparkle.
    for (const a of state.animals) {
      let w = animals.get(a.id);
      if (!w) {
        const object = assets.create(`animal.${a.kind}`);
        const start = yardPoint();
        object.position.set(start.x, FLOOR, start.y);
        root.add(object);
        const marker = assets.create('marker.ready');
        root.add(marker);
        w = { id: a.id, object, target: yardPoint(), wait: rnd() * 3, speed: a.kind === 'chicken' ? 0.7 : 0.45, hop: rnd() * 6, cheer: 0, marker };
        animals.set(a.id, w);
      }
      w.marker.visible = a.ready;
      w.marker.userData.height = a.kind === 'cow' ? 1.6 : a.kind === 'sheep' ? 1.2 : 0.85;
    }
  };

  return {
    root,
    sync,
    animalAt(id) {
      return animals.get(id)?.object.position ?? null;
    },
    cheerAnimal(id) {
      const w = animals.get(id);
      if (w) w.cheer = 0.8;
    },
    splash(tileIds) {
      for (const id of tileIds) {
        const tile = FARM_TILES.find(t => t.id === id);
        if (!tile) continue;
        for (let k = 0; k < 5; k++) {
          const mesh = new THREE.Mesh(dropGeometry, dropMaterial);
          mesh.position.set(tile.x + (rnd() - 0.5) * 0.5, heightAt(tile.x, tile.z) + 0.6, tile.z + (rnd() - 0.5) * 0.5);
          root.add(mesh);
          drops.push({ mesh, vel: new THREE.Vector3((rnd() - 0.5) * 0.6, 0.6 + rnd(), (rnd() - 0.5) * 0.6), life: 0.6 });
        }
      }
    },
    update(dt, elapsed, reducedMotion) {
      if (!reducedMotion) {
        ripple.offset.set(elapsed * 0.02, elapsed * 0.01);
        (creekMat.map as THREE.Texture).offset.set(0, -elapsed * 0.35);
        fallTexture.offset.y = elapsed * 0.9;
      }
      for (const f of fires) f.scale.setScalar(0.9 + Math.sin(elapsed * 13 + f.id) * 0.08 + Math.sin(elapsed * 7.3) * 0.05);
      for (const m of markers) {
        m.position.y = (m.userData.baseY as number) + Math.sin(elapsed * 3) * 0.08;
        m.rotation.y = elapsed * 1.5;
      }
      // Animals wander: walk to a random point in the yard, rest a little, pick another.
      for (const w of animals.values()) {
        const p = w.object.position;
        w.cheer = Math.max(0, w.cheer - dt);
        let moving = false;
        if (w.wait > 0) w.wait -= dt;
        else {
          _v.set(w.target.x - p.x, 0, w.target.y - p.z);
          const d = _v.length();
          if (d < 0.1) {
            w.wait = 1.5 + rnd() * 4;
            w.target = yardPoint();
          } else {
            const step = Math.min(d, w.speed * dt);
            p.x += (_v.x / d) * step;
            p.z += (_v.z / d) * step;
            const target = Math.atan2(_v.x, _v.z);
            const diff = Math.atan2(Math.sin(target - w.object.rotation.y), Math.cos(target - w.object.rotation.y));
            w.object.rotation.y += diff * Math.min(1, dt * 5);
            moving = true;
          }
        }
        w.hop += dt * (moving ? 9 : 0) + (w.cheer > 0 ? dt * 12 : 0);
        p.y = FLOOR + (moving || w.cheer > 0 ? Math.abs(Math.sin(w.hop)) * (w.cheer > 0 ? 0.18 : 0.05) : 0);
        w.marker.position.set(p.x, FLOOR + (w.marker.userData.height as number) + Math.sin(elapsed * 3) * 0.08, p.z);
        w.marker.rotation.y = elapsed * 1.5;
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]!;
        d.life -= dt;
        d.vel.y -= 4 * dt;
        d.mesh.position.addScaledVector(d.vel, dt);
        if (d.life <= 0) {
          root.remove(d.mesh);
          drops.splice(i, 1);
        }
      }
    },
  };
}
