import * as THREE from 'three';
import {
  ACCESSORIES, APPEARANCE_OPTIONS, cleanName, DEFAULT_APPEARANCE, EYES, HAIR_STYLES, MOUTHS, NAME_MAX_LENGTH, OUTFITS, randomAppearance, SPECIES,
  type Appearance,
} from '../data/appearance';
import { DEFAULT_ISLAND, DEFAULT_PLAYER, FRUITS, type FruitId } from '../data/defaults';
import { fruitItem, ITEMS } from '../data/items';
import { t, type MessageKey } from '../i18n';
import { animateAvatar, buildAvatar, disposeAvatar } from '../render/avatar';

export interface CreatorResult {
  name: string;
  islandName: string;
  nativeFruit: FruitId;
  appearance: Appearance;
}

type ChoiceField = 'species' | 'eyes' | 'mouth' | 'hairStyle' | 'outfit' | 'accessory';
type ColorField = 'skin' | 'eyeColor' | 'hairColor' | 'topColor' | 'bottomColor' | 'shoes';
type Field =
  | { kind: 'choice'; key: ChoiceField; options: readonly string[]; label: (v: string) => string }
  | { kind: 'color'; key: ColorField }
  | { kind: 'blush' }
  | { kind: 'text'; key: 'name' | 'island' }
  | { kind: 'fruit' };

const choice = (key: ChoiceField, options: readonly string[], prefix: string): Field => ({ kind: 'choice', key, options, label: v => t(`${prefix}.${v}` as MessageKey) });

const TABS: { id: string; label: MessageKey; fields: Field[] }[] = [
  { id: 'body', label: 'creator.tab.body', fields: [choice('species', SPECIES, 'species'), { kind: 'color', key: 'skin' }] },
  { id: 'face', label: 'creator.tab.face', fields: [choice('eyes', EYES, 'eyes'), { kind: 'color', key: 'eyeColor' }, choice('mouth', MOUTHS, 'mouth'), { kind: 'blush' }] },
  { id: 'hair', label: 'creator.tab.hair', fields: [choice('hairStyle', HAIR_STYLES, 'hairStyle'), { kind: 'color', key: 'hairColor' }] },
  { id: 'clothes', label: 'creator.tab.clothes', fields: [choice('outfit', OUTFITS, 'outfit'), { kind: 'color', key: 'topColor' }, { kind: 'color', key: 'bottomColor' }, { kind: 'color', key: 'shoes' }] },
  { id: 'accessory', label: 'creator.tab.accessory', fields: [choice('accessory', ACCESSORIES, 'accessory')] },
  { id: 'island', label: 'creator.tab.island', fields: [{ kind: 'text', key: 'name' }, { kind: 'text', key: 'island' }, { kind: 'fruit' }] },
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** 3D preview on its own small canvas: the character on a grass disc, turning slowly or by dragging. */
function createPreview(canvas: HTMLCanvasElement) {
  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return { setAppearance() {}, dispose() {} };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9b79a, 1.7));
  const sun = new THREE.DirectionalLight(0xfff2de, 1.6);
  sun.position.set(2.5, 5, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2 });
  scene.add(sun);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.16, 40), new THREE.MeshLambertMaterial({ color: 0x8ccb6a }));
  base.position.y = -0.08;
  base.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.06, 8, 48), new THREE.MeshLambertMaterial({ color: 0xe6c9ae }));
  rim.rotation.x = Math.PI / 2;
  scene.add(base, rim);
  [0xf27ba5, 0xffd166, 0xffffff, 0xb892ff, 0xf27ba5, 0xffffff].forEach((c, i) => {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshLambertMaterial({ color: c }));
    f.position.set(Math.cos(a) * 0.95, 0.06, Math.sin(a) * 0.95);
    scene.add(f);
  });

  let avatar: THREE.Group | null = null, fitHeight = 2.2, yaw = 0.35, dragging = false, lastX = 0, idle = 0, running = true, time = 0, last = performance.now();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || !renderer) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Fit the whole character (and the grass disc) whatever the canvas shape.
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const byHeight = (fitHeight * 1.18 + 0.5) / 2 / tanHalf;
    const byWidth = 2.9 / 2 / (tanHalf * camera.aspect);
    const d = Math.max(byHeight, byWidth);
    camera.position.set(0, fitHeight * 0.5 + d * 0.16, d);
    camera.lookAt(0, fitHeight * 0.47, 0);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  canvas.addEventListener('pointerdown', e => {
    dragging = true;
    lastX = e.clientX;
    idle = 0;
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.012;
    lastX = e.clientX;
  });
  const up = () => {
    dragging = false;
    idle = 0;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  const loop = (now: number) => {
    if (!running || !renderer) return;
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    if (!dragging) idle += dt;
    if (!dragging && idle > 1.5 && !reduceMotion) yaw += dt * 0.5;
    if (avatar) {
      avatar.rotation.y = yaw;
      animateAvatar(avatar, 0, 0, 0, time);
    }
    renderer.render(scene, camera);
  };
  requestAnimationFrame(loop);

  return {
    setAppearance(a: Appearance) {
      if (avatar) {
        scene.remove(avatar);
        disposeAvatar(avatar);
      }
      avatar = buildAvatar(a);
      avatar.traverse(o => (o.castShadow = true));
      scene.add(avatar);
      fitHeight = new THREE.Box3().setFromObject(avatar).max.y;
      resize();
    },
    dispose() {
      running = false;
      observer.disconnect();
      if (avatar) disposeAvatar(avatar);
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer = null;
    },
  };
}

/**
 * First screen of the game: build the character and name yourself and the island.
 * Starts from Ana (the default) and resolves when the player presses "Começar a jogar".
 */
export function openCreator(root: HTMLElement): Promise<CreatorResult> {
  return new Promise(resolve => {
    let appearance: Appearance = { ...DEFAULT_APPEARANCE };
    let name = DEFAULT_PLAYER.name;
    let islandName = DEFAULT_ISLAND.name;
    let nativeFruit: FruitId = DEFAULT_ISLAND.nativeFruit;
    let active = 0;

    const screen = el('div', 'creator-screen');
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-modal', 'true');
    screen.setAttribute('aria-labelledby', 'creator-title');
    const card = el('div', 'creator');
    const stage = el('div', 'creator__stage');
    const canvas = el('canvas', 'creator__canvas');
    canvas.setAttribute('aria-label', t('creator.dragHint'));
    const nameTag = el('div', 'creator__nametag', name);
    stage.append(canvas, el('p', 'creator__hint', t('creator.dragHint')), nameTag);

    const panel = el('div', 'creator__panel');
    const title = el('h1', 'creator__title', t('creator.title'));
    title.id = 'creator-title';
    const tabs = el('div', 'creator__tabs');
    tabs.setAttribute('role', 'tablist');
    const body = el('div', 'creator__body');
    body.setAttribute('role', 'tabpanel');
    const actions = el('div', 'creator__actions');
    const randomBtn = el('button', 'ui-btn', t('creator.random'));
    const resetBtn = el('button', 'ui-btn', t('creator.reset'));
    const startBtn = el('button', 'ui-btn ui-btn--primary', t('creator.start'));
    for (const b of [randomBtn, resetBtn, startBtn]) b.type = 'button';
    actions.append(randomBtn, resetBtn, startBtn);
    panel.append(title, el('p', 'creator__subtitle', t('creator.subtitle')), tabs, body, actions);
    card.append(stage, panel);
    screen.append(card);
    root.append(screen);

    const preview = createPreview(canvas);
    preview.setAppearance(appearance);

    const renderTabs = () => {
      tabs.replaceChildren(
        ...TABS.map((tab, i) => {
          const b = el('button', 'creator__tab', t(tab.label));
          b.type = 'button';
          b.id = `creator-tab-${tab.id}`;
          b.setAttribute('role', 'tab');
          b.setAttribute('aria-selected', String(i === active));
          b.tabIndex = i === active ? 0 : -1;
          b.addEventListener('click', () => selectTab(i));
          return b;
        }),
      );
      body.setAttribute('aria-labelledby', `creator-tab-${TABS[active]!.id}`);
    };

    const group = (labelKey: MessageKey, control: HTMLElement) => {
      const wrap = el('div', 'creator__field');
      const label = el('div', 'creator__label', t(labelKey));
      label.id = `creator-label-${labelKey.split('.').pop()}`;
      control.setAttribute('role', 'group');
      control.setAttribute('aria-labelledby', label.id);
      wrap.append(label, control);
      return wrap;
    };

    const chip = (text: string, pressed: boolean, onClick: () => void) => {
      const b = el('button', 'chip', text);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(pressed));
      b.addEventListener('click', onClick);
      return b;
    };

    const renderBody = () => {
      // Re-rendering replaces the buttons; keep keyboard focus on the same one.
      const focused = Array.from(body.querySelectorAll('button')).indexOf(document.activeElement as HTMLButtonElement);
      const fields = TABS[active]!.fields.map(field => {
        if (field.kind === 'choice') {
          const row = el('div', 'chips');
          for (const option of field.options) row.append(chip(field.label(option), appearance[field.key] === option, () => update({ [field.key]: option })));
          return group(`creator.field.${field.key}`, row);
        }
        if (field.kind === 'color') {
          const row = el('div', 'swatches');
          const label = t(`creator.field.${field.key}`);
          APPEARANCE_OPTIONS[field.key].forEach((color, i) => {
            const b = el('button', 'swatch');
            b.type = 'button';
            b.style.background = color;
            b.setAttribute('aria-label', t('creator.optionN', { label, n: i + 1 }));
            b.setAttribute('aria-pressed', String(appearance[field.key] === color));
            b.addEventListener('click', () => update({ [field.key]: color }));
            row.append(b);
          });
          return group(`creator.field.${field.key}`, row);
        }
        if (field.kind === 'blush') {
          const row = el('div', 'chips');
          row.append(chip(t('blush.on'), appearance.blush, () => update({ blush: true })), chip(t('blush.off'), !appearance.blush, () => update({ blush: false })));
          return group('creator.field.blush', row);
        }
        if (field.kind === 'text') {
          const wrap = el('div', 'creator__field');
          const id = `creator-${field.key}`;
          const label = el('label', 'creator__label', t(field.key === 'name' ? 'creator.field.name' : 'creator.field.island'));
          label.htmlFor = id;
          const input = el('input', 'text-input');
          input.id = id;
          input.maxLength = NAME_MAX_LENGTH;
          input.autocomplete = 'off';
          input.value = field.key === 'name' ? name : islandName;
          input.addEventListener('input', () => {
            if (field.key === 'name') {
              name = input.value;
              nameTag.textContent = cleanName(name, DEFAULT_PLAYER.name);
            } else islandName = input.value;
          });
          wrap.append(label, input);
          return wrap;
        }
        const row = el('div', 'chips');
        for (const fruit of FRUITS) {
          row.append(chip(`${ITEMS[fruitItem(fruit)].icon} ${t(`fruit.${fruit}`)}`, nativeFruit === fruit, () => {
            nativeFruit = fruit;
            renderBody();
          }));
        }
        const wrap = group('creator.field.fruit', row);
        wrap.append(el('p', 'creator__note', t('creator.islandHint')));
        return wrap;
      });
      body.replaceChildren(...fields);
      if (focused >= 0) body.querySelectorAll('button')[focused]?.focus({ preventScroll: true });
    };

    const update = (patch: Partial<Appearance>) => {
      appearance = { ...appearance, ...patch };
      preview.setAppearance(appearance);
      renderBody();
    };

    const selectTab = (i: number, focus = false) => {
      active = (i + TABS.length) % TABS.length;
      renderTabs();
      renderBody();
      if (focus) (tabs.children[active] as HTMLElement | undefined)?.focus();
    };
    tabs.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        selectTab(active + (e.key === 'ArrowRight' ? 1 : -1), true);
      }
    });

    randomBtn.addEventListener('click', () => update(randomAppearance(Math.random)));
    resetBtn.addEventListener('click', () => update({ ...DEFAULT_APPEARANCE }));
    startBtn.addEventListener('click', () => {
      preview.dispose();
      screen.remove();
      resolve({ name: cleanName(name, DEFAULT_PLAYER.name), islandName: cleanName(islandName, DEFAULT_ISLAND.name), nativeFruit, appearance });
    });

    renderTabs();
    renderBody();
    startBtn.focus({ preventScroll: true });
  });
}
