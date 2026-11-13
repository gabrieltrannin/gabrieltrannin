import './ui/styles.css';
import * as THREE from 'three';
import { registerProceduralAssets } from './assets/procedural';
import { assets } from './assets/registry';
import { ClockDriver, seasonOf } from './core/clock';
import { Game, SYSTEM } from './core/game';
import { createInitialState } from './core/state';
import type { Actor } from './core/types';
import { DEFAULT_DAY_LENGTH_MIN, type SeasonId } from './data/calendar';
import { DEFAULT_PLAYER } from './data/defaults';
import { LEVELS, OVERVIEW } from './data/map';
import { t } from './i18n';
import { Atmosphere } from './render/atmosphere';
import { CameraRig, type CameraMode } from './render/camera';
import { PostFx } from './render/postfx';
import { createRenderer, fitToWindow } from './render/renderer';
import { WeatherFx } from './render/weatherFx';
import { createDevPanel } from './ui/devPanel';
import { createHud } from './ui/hud';
import { buildWorld } from './world/world';

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

  const phone = window.matchMedia('(pointer: coarse)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = createRenderer(canvas, { maxPixelRatio: phone ? 1.5 : 2 });
  } catch {
    showFatal(t('app.webglError'));
    return;
  }

  // Logic: the game state and the clock. Nothing here knows about Three.js.
  const game = new Game(createInitialState());
  const localActor: Actor = { id: DEFAULT_PLAYER.id, role: 'host' };
  let clockPaused = false;
  const driver = new ClockDriver({
    dayLengthMin: DEFAULT_DAY_LENGTH_MIN,
    onAdvance: steps => {
      if (!game.state.time.dayEnded) game.dispatch({ type: 'time.advance', steps }, SYSTEM);
    },
    onSync: minuteOfDay => {
      if (minuteOfDay !== game.state.time.minuteOfDay) game.dispatch({ type: 'time.sync', minuteOfDay }, SYSTEM);
    },
  });
  const updatePause = () => driver.setPaused(clockPaused || document.hidden);
  document.addEventListener('visibilitychange', updatePause);

  // World and look.
  registerProceduralAssets(assets);
  const scene = new THREE.Scene();
  const atmosphere = new Atmosphere(scene, phone ? 1024 : 2048);
  const weatherFx = new WeatherFx();
  scene.add(weatherFx.root);
  let season: SeasonId = seasonOf(game.state.time);
  const world = buildWorld(assets, { season, nativeFruit: game.state.island.nativeFruit, maxAnisotropy: renderer.capabilities.getMaxAnisotropy() });
  scene.add(world.root);

  const syncLook = () => {
    const s = seasonOf(game.state.time);
    if (s !== season) {
      season = s;
      world.setSeason(s);
    }
    weatherFx.setSeason(season);
    atmosphere.setTime(game.state.time.minuteOfDay);
    atmosphere.setWeather(game.state.weather);
    weatherFx.setWeather(game.state.weather);
  };
  syncLook();
  game.on(syncLook);

  const rig = new CameraRig();
  rig.setOverview({ x: OVERVIEW.x, y: LEVELS.main.top, z: OVERVIEW.z, width: OVERVIEW.width, depth: OVERVIEW.depth });
  rig.setFollowTarget(world.walker.object);
  rig.attachDrag(canvas);
  const post = new PostFx(renderer, scene, rig.camera, phone ? 2 : 4);
  fitToWindow(renderer, (w, h) => {
    rig.resize(w, h);
    post.setSize(w, h);
  });
  rig.snap();

  createHud(uiRoot, game);
  const dev = import.meta.env.DEV
    ? createDevPanel(uiRoot, game, {
        localActor,
        getCameraMode: () => rig.mode,
        setCameraMode: (mode: CameraMode) => rig.setMode(mode),
        isClockPaused: () => clockPaused,
        setClockPaused: paused => {
          clockPaused = paused;
          updatePause();
        },
      })
    : null;

  // Signs are painted with the web fonts; repaint once they have loaded.
  void document.fonts?.ready.then(() => world.repaintSigns());

  let last = performance.now();
  let elapsed = 0;
  renderer.setAnimationLoop(now => {
    const dtMs = Math.min(250, now - last);
    last = now;
    const dt = dtMs / 1000;
    elapsed += dt;
    driver.update(dtMs);
    world.update(dt, elapsed, reducedMotion);
    weatherFx.update(dt, elapsed, { camera: rig.camera, night: atmosphere.night, cameraYaw: rig.yaw, cloudColor: atmosphere.cloudColor, particles: true, reducedMotion });
    atmosphere.update(dt, weatherFx.flash);
    world.sea.setTint(atmosphere.waterTint);
    rig.update(dt);
    atmosphere.setViewDistance(rig.currentDistance);
    post.render(dt);
    dev?.frame(dtMs);
  });

  if (import.meta.env.DEV) Object.assign(window, { __game: game, __assets: assets, __rig: rig, __scene: scene, __renderer: renderer });
}

start();
