import './ui/styles.css';
import * as THREE from 'three';
import { assets } from './assets/registry';
import { registerProceduralAssets } from './assets/procedural';
import { ClockDriver } from './core/clock';
import { Game, SYSTEM } from './core/game';
import { createInitialState } from './core/state';
import type { Actor } from './core/types';
import { DEFAULT_DAY_LENGTH_MIN } from './data/calendar';
import { DEFAULT_PLAYER } from './data/defaults';
import { t } from './i18n';
import { CameraRig } from './render/camera';
import { createRenderer, fitToWindow } from './render/renderer';
import { createHud } from './ui/hud';
import { TEST_ISLAND, buildTestScene } from './world/testScene';

function showFatal(message: string): void {
  const box = document.createElement('div');
  box.className = 'fatal';
  box.textContent = message;
  document.body.append(box);
}

function start(): void {
  document.title = t('app.title');
  const canvas = document.getElementById('scene') as HTMLCanvasElement | null;
  const uiRoot = document.getElementById('ui');
  if (!canvas || !uiRoot) throw new Error('Missing #scene or #ui in index.html');

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = createRenderer(canvas);
  } catch {
    showFatal(t('app.webglError'));
    return;
  }

  // Logic: the game state and the clock. Nothing here knows about Three.js.
  const game = new Game(createInitialState());
  const localActor: Actor = { id: DEFAULT_PLAYER.id, role: 'host' };
  const driver = new ClockDriver({
    dayLengthMin: DEFAULT_DAY_LENGTH_MIN,
    onAdvance: steps => {
      if (!game.state.time.dayEnded) game.dispatch({ type: 'time.advance', steps }, SYSTEM);
    },
    onSync: minuteOfDay => {
      if (minuteOfDay !== game.state.time.minuteOfDay) game.dispatch({ type: 'time.sync', minuteOfDay }, SYSTEM);
    },
  });

  // Rendering: the test scene built from the asset registry.
  registerProceduralAssets(assets);
  const scene = new THREE.Scene();
  const world = buildTestScene(scene, assets);
  const rig = new CameraRig();
  rig.target.set(0, TEST_ISLAND.top, 1.5);
  fitToWindow(renderer, (w, h) => {
    rig.resize(w, h);
    rig.frameArea(TEST_ISLAND.width + 6, TEST_ISLAND.depth + 6);
    // Portrait phones put the camera farther away; keep the fog behind the island.
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = rig.distance * 1.15;
      scene.fog.far = rig.distance * 3;
    }
  });

  const hud = createHud(uiRoot, game, { dev: import.meta.env.DEV, localActor });

  document.addEventListener('visibilitychange', () => driver.setPaused(document.hidden));

  let last = performance.now();
  let elapsed = 0;
  renderer.setAnimationLoop(now => {
    const dtMs = Math.min(1000, now - last);
    last = now;
    elapsed += dtMs / 1000;
    driver.update(dtMs);
    world.update(dtMs / 1000, elapsed);
    rig.update();
    renderer.render(scene, rig.camera);
    hud.frame(dtMs);
  });

  if (import.meta.env.DEV) Object.assign(window, { __game: game, __assets: assets });
}

start();
