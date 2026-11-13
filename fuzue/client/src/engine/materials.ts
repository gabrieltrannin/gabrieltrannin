import * as THREE from 'three';

/** Cor dos contornos e detalhes escuros. */
export const INK = '#22170e';

/** Degradê de 3 faixas que dá o visual de desenho (toon shading). */
const gradientMap = (() => {
  const data = new Uint8Array([150, 150, 150, 255, 210, 210, 210, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

const cache = new Map<string, THREE.MeshToonMaterial>();

/** Material toon de uma cor (reaproveitado entre malhas). */
export function toon(color: string): THREE.MeshToonMaterial {
  let m = cache.get(color);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap });
    cache.set(color, m);
  }
  return m;
}

/** Material toon com textura. */
export function toonMap(map: THREE.Texture): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color: '#ffffff', map, gradientMap });
}

const outlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
const SPHERE = shared(new THREE.SphereGeometry(1, 24, 16));

/** Marca uma geometria usada por várias telas (não é liberada ao trocar de tela). */
export function shared<T extends THREE.BufferGeometry>(g: T): T {
  g.userData.shared = true;
  return g;
}

/** Esfera (ou elipsoide) de raio `r`. */
export function ball(r: number, mat: THREE.Material, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const m = new THREE.Mesh(SPHERE, mat);
  m.scale.set(r * sx, r * sy, r * sz);
  return m;
}

/** Contorno escuro: uma cópia um pouco maior desenhada só por dentro. */
export function outline<T extends THREE.Mesh>(mesh: T, k = 1.07, ky?: number): T {
  const o = new THREE.Mesh(mesh.geometry, outlineMat);
  o.scale.set(k, ky ?? k, k);
  mesh.add(o);
  return mesh;
}

/** Cria uma textura desenhada num canvas 2D. */
export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (g) draw(g, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Listras diagonais de bala (repetem horizontalmente). */
export function stripeTexture(a: string, b: string): THREE.CanvasTexture {
  const tex = canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = a;
    g.fillRect(0, 0, w, h);
    g.fillStyle = b;
    for (let x = -h; x < w + h; x += 32) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 16, 0);
      g.lineTo(x + 16 + h, h);
      g.lineTo(x + h, h);
      g.closePath();
      g.fill();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Pseudo-aleatório com semente (o cenário fica igual para todo mundo). */
export function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
