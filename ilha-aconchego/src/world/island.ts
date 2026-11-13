import * as THREE from 'three';
import { LEVELS, PIER, RAMP, STAIRS, type RoundedRect } from '../data/map';
import { materials } from '../render/materials';
import { cliffTexture, sandTexture } from '../render/textures';
import { box, cyl, vcMesh } from '../assets/procedural/parts';

/** Rounded rectangle in the XZ plane as a Shape (shape y = -world z), corners in the order back-left, back-right, front-right, front-left. */
export function roundedRectShape(rect: RoundedRect): THREE.Shape {
  const [bl, br, fr, fl] = typeof rect.r === 'number' ? [rect.r, rect.r, rect.r, rect.r] : rect.r;
  const { x0, x1 } = rect, yTop = -rect.z0, yBottom = -rect.z1;
  const s = new THREE.Shape();
  s.moveTo(x0 + fl, yBottom);
  s.lineTo(x1 - fr, yBottom);
  s.quadraticCurveTo(x1, yBottom, x1, yBottom + fr);
  s.lineTo(x1, yTop - br);
  s.quadraticCurveTo(x1, yTop, x1 - br, yTop);
  s.lineTo(x0 + bl, yTop);
  s.quadraticCurveTo(x0, yTop, x0, yTop - bl);
  s.lineTo(x0, yBottom + fl);
  s.quadraticCurveTo(x0, yBottom, x0 + fl, yBottom);
  return s;
}

/** Extrudes a shape upward from y0. Material 0 = top (and hidden bottom) cap, material 1 = side walls. */
function slab(shape: THREE.Shape, y0: number, height: number, top: THREE.Material, side: THREE.Material): THREE.Mesh {
  const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  const m = new THREE.Mesh(g, [top, side]);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Cliff-band texture stretched so one band set covers the wall height (the top row sits at the top edge). */
function cliffMaterial(height: number): THREE.MeshLambertMaterial {
  const t = cliffTexture();
  t.repeat.set(1 / 4, 1 / height);
  t.offset.set(0, -(1 - height) / height);
  return new THREE.MeshLambertMaterial({ map: t });
}

/** Rounded grass lip running along the top edge of a cliff. */
function lip(shape: THREE.Shape, y: number, material: THREE.Material): THREE.Mesh {
  const points = shape.getSpacedPoints(220);
  points.pop();
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p.x, y, -p.y)), true);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 440, 0.14, 6, true), material);
  m.receiveShadow = true;
  return m;
}

/**
 * The island body: beach, main level and upper level with cliffs and grass lips,
 * the ramp between levels, the stairs to the beach and the pier.
 */
export function buildIsland(groundTexture: THREE.Texture): THREE.Group {
  const m = materials();
  const root = new THREE.Group();
  root.name = 'island';
  const ground = new THREE.MeshLambertMaterial({ map: groundTexture });
  const sand = sandTexture();
  sand.repeat.set(0.22, 0.22);

  const beach = LEVELS.beach, main = LEVELS.main, upper = LEVELS.upper;
  const mainShape = roundedRectShape(main);
  const upperShape = roundedRectShape(upper);
  root.add(
    slab(roundedRectShape(beach), beach.bottom, beach.top - beach.bottom, new THREE.MeshLambertMaterial({ map: sand }), new THREE.MeshLambertMaterial({ color: 0xd9c08a })),
    slab(mainShape, beach.top, main.top - beach.top, ground, cliffMaterial(main.top - beach.top)),
    slab(upperShape, main.top, upper.top - main.top, ground, cliffMaterial(upper.top - main.top)),
    lip(mainShape, main.top, m.lip),
    lip(upperShape, upper.top, m.lip),
  );

  // Ramp: a wedge from the upper level down to the main level, with wooden edging.
  const rise = upper.top - main.top, run = RAMP.zBottom - RAMP.zTop, width = RAMP.x1 - RAMP.x0;
  const wedge = new THREE.Shape();
  wedge.moveTo(0, 0);
  wedge.lineTo(run, 0);
  wedge.lineTo(0, rise);
  wedge.lineTo(0, 0);
  const wedgeGeo = new THREE.ExtrudeGeometry(wedge, { depth: width, bevelEnabled: false });
  wedgeGeo.rotateY(-Math.PI / 2);
  wedgeGeo.translate(RAMP.x1, main.top, RAMP.zTop);
  const ramp = new THREE.Mesh(wedgeGeo, [new THREE.MeshLambertMaterial({ color: 0xc98552 }), new THREE.MeshLambertMaterial({ color: 0xc9a06b })]);
  ramp.castShadow = ramp.receiveShadow = true;
  const slope = Math.atan2(rise, run), length = Math.hypot(rise, run), midY = main.top + rise / 2 + 0.06, midZ = (RAMP.zTop + RAMP.zBottom) / 2;
  root.add(ramp, vcMesh([box(0.16, 0.2, length, RAMP.x0 + 0.03, midY, midZ, 0x9c6b3c, slope), box(0.16, 0.2, length, RAMP.x1 - 0.03, midY, midZ, 0x9c6b3c, slope)], 'ramp-edge'));

  // Stairs down to the beach.
  const steps: THREE.BufferGeometry[] = [];
  const depth = (STAIRS.z1 - STAIRS.z0) / STAIRS.steps, drop = (main.top - beach.top) / STAIRS.steps;
  for (let i = 0; i < STAIRS.steps; i++) {
    const top = main.top - (i + 1) * drop;
    steps.push(box(STAIRS.x1 - STAIRS.x0, top, depth, (STAIRS.x0 + STAIRS.x1) / 2, top / 2, STAIRS.z0 + depth * (i + 0.5), i % 2 ? 0xc9b79a : 0xd3c2a4));
  }
  root.add(vcMesh(steps, 'stairs'));

  // Pier: plank deck on posts.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(PIER.x1 - PIER.x0 + 0.1, 0.14, PIER.z1 - PIER.z0), m.deck);
  deck.position.set((PIER.x0 + PIER.x1) / 2, PIER.deck - 0.07, (PIER.z0 + PIER.z1) / 2);
  deck.castShadow = deck.receiveShadow = true;
  const posts: THREE.BufferGeometry[] = [];
  for (const x of [PIER.x0 + 0.05, PIER.x1 - 0.05]) for (let z = PIER.z0 + 0.4; z < PIER.z1; z += 2) posts.push(cyl(0.12, 0.12, 1.5, x, -0.1, z, 0x7a563a, 8));
  posts.push(cyl(0.12, 0.12, 1.5, PIER.x0 + 0.05, -0.1, PIER.z1 - 0.05, 0x7a563a, 8), cyl(0.12, 0.12, 1.5, PIER.x1 - 0.05, -0.1, PIER.z1 - 0.05, 0x7a563a, 8));
  root.add(deck, vcMesh(posts, 'pier-posts'));
  return root;
}
