import './ui/styles.css';
import * as THREE from 'three';
import { registerProceduralAssets } from './assets/procedural';
import { assets } from './assets/registry';
import { absoluteDay, ClockDriver, seasonOf } from './core/clock';
import type { CommandError } from './core/commands';
import { Game, SYSTEM } from './core/game';
import { toSaveFile, type SaveFile } from './core/save';
import { createInitialState } from './core/state';
import type { Actor, GameState } from './core/types';
import { DEFAULT_DAY_LENGTH_MIN, type SeasonId } from './data/calendar';
import { BED_CROPS_BY_SEASON } from './data/crops';
import { DEFAULT_PLAYER } from './data/defaults';
import { HOTBAR_SIZE } from './data/items';
import {
  BED_REACH, BEDS, HOUSE_DOOR, LEVELS, ORCHARD, orchardTreeId, OVERVIEW, PLAYER_START, PROPS, STALLS, TOUR_PLACES, TREE_REACH,
} from './data/map';
import { Interactions } from './game/interactions';
import { Pet } from './game/pet';
import { PlayerController } from './game/playerController';
import { t } from './i18n';
import { Input } from './input/input';
import { deleteGame, loadGame, storeGame } from './platform/saveStore';
import { Atmosphere } from './render/atmosphere';
import { buildAvatar } from './render/avatar';
import { CameraRig, type CameraMode } from './render/camera';
import { PostFx } from './render/postfx';
import { createRenderer, fitToWindow } from './render/renderer';
import { WeatherFx } from './render/weatherFx';
import { Bubbles } from './ui/bubbles';
import { openCreator } from './ui/creator';
import { createDevPanel } from './ui/devPanel';
import { createHud } from './ui/hud';
import { createInventoryPanel } from './ui/inventoryPanel';
import { createTouchControls } from './ui/touchControls';
import { buildColliders } from './world/collision';
import { heightAt } from './world/terrain';
import { buildWorld } from './world/world';

/** How often the walked position is written into the game state, and how often it is saved. */
const MOVE_COMMIT_S = 0.5;
const RESUME_SAVE_S = 10;
const TOUR_CHECK_S = 0.4;
const CAMERA_TURN_SPEED = 1.8;

function showFatal(message: string): void {
  const box = document.createElement('div');
  box.className = 'fatal';
  box.textContent = message;
  document.body.append(box);
}

function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0]! || 1;
}

/** The saved island, or a new one made with the character creator (the first screen). */
async function bootState(uiRoot: HTMLElement): Promise<{ state: GameState; isNew: boolean }> {
  const saved = await loadGame();
  if (saved) return { state: saved.state, isNew: false };
  const c = await openCreator(uiRoot);
  const state = createInitialState({
    seed: randomSeed(),
    islandName: c.islandName,
    nativeFruit: c.nativeFruit,
    playerId: DEFAULT_PLAYER.id,
    playerName: c.name,
    appearance: c.appearance,
  });
  return { state, isNew: true };
}

async function start(): Promise<void> {
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
  const boot = await bootState(uiRoot);
  const game = new Game(boot.state);
  const playerId = DEFAULT_PLAYER.id;
  const localActor: Actor = { id: playerId, role: 'host' };
  const me = () => game.state.players[playerId]!;

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

  // Saving: on sleep, every few seconds while playing, and when the page is hidden or closed.
  let saveDirty = boot.isNew;
  let saving: Promise<boolean> = Promise.resolve(true);
  const save = (reason: SaveFile['reason']): Promise<boolean> => {
    saveDirty = false;
    const file = toSaveFile(game.state, reason, Date.now());
    saving = saving.then(() => storeGame(file));
    return saving;
  };
  if (boot.isNew) void save('sleep');
  game.on(() => (saveDirty = true));

  // World and look.
  registerProceduralAssets(assets);
  const scene = new THREE.Scene();
  const atmosphere = new Atmosphere(scene, phone ? 1024 : 2048);
  const weatherFx = new WeatherFx();
  scene.add(weatherFx.root);
  let season: SeasonId = seasonOf(game.state.time);
  const world = buildWorld(assets, { season, nativeFruit: game.state.island.nativeFruit, maxAnisotropy: renderer.capabilities.getMaxAnisotropy() });
  scene.add(world.root);

  // Orchard trees already shaken today show no fruit.
  const shakenToday = (index: number) => game.state.trees[orchardTreeId(index)]?.shakenDay === absoluteDay(game.state.time);
  const syncOrchard = () => ORCHARD.forEach((_, i) => world.setOrchardFruit(i, !shakenToday(i)));
  syncOrchard();

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
  game.on(event => {
    if (event.type !== 'player.moved' && event.type !== 'inventory.changed') syncLook();
    if (event.type === 'day.started' || event.type === 'date.changed') syncOrchard();
  });

  // The player's character and the pet.
  const avatar = buildAvatar(me().appearance);
  avatar.name = 'player';
  scene.add(avatar);
  const colliders = buildColliders();
  const player = new PlayerController(avatar, colliders, me().position);
  const pet = new Pet(assets.create('pet.bunny'), player.x - 0.8, player.z - 0.6);
  scene.add(pet.object);

  const rig = new CameraRig();
  rig.setOverview({ x: OVERVIEW.x, y: LEVELS.main.top, z: OVERVIEW.z, width: OVERVIEW.width, depth: OVERVIEW.depth });
  rig.setFollowTarget(avatar);
  rig.setMode('follow');
  rig.yaw = 0;
  rig.attachDrag(canvas);
  const post = new PostFx(renderer, scene, rig.camera, phone ? 2 : 4);
  let viewW = window.innerWidth, viewH = window.innerHeight;
  fitToWindow(renderer, (w, h) => {
    viewW = w;
    viewH = h;
    rig.resize(w, h);
    post.setSize(w, h);
  });
  rig.snap();

  // Interface.
  const input = new Input();
  createTouchControls(uiRoot, input.touch);
  const bubbles = new Bubbles(uiRoot);
  const setMap = (open: boolean) => {
    rig.setMode(open ? 'overview' : 'follow');
    hud.setMapOpen(open);
  };
  const hud = createHud(uiRoot, game, {
    playerId,
    onSelectSlot: slot => game.dispatch({ type: 'inventory.select', slot }, localActor),
    onToggleMap: () => setMap(rig.mode !== 'overview'),
  });
  const bag = createInventoryPanel(uiRoot, {
    getInventory: () => me().inventory,
    onMove: (from, to) => game.dispatch({ type: 'inventory.move', from, to }, localActor),
    onClose: () => bag.close(),
  });
  game.on(event => {
    if (event.type === 'inventory.changed' && bag.isOpen) bag.refresh();
  });
  const sleepFade = document.createElement('div');
  sleepFade.className = 'sleep-fade';
  sleepFade.textContent = t('msg.sleeping');
  sleepFade.hidden = true;
  uiRoot.append(sleepFade);

  /** Writes the walked position into the game state (a command, like every other action). */
  let moveDirty = false;
  const commitMove = () => {
    if (!moveDirty) return;
    moveDirty = false;
    game.dispatch({ type: 'player.move', x: player.x, z: player.z, facing: player.facing }, localActor);
  };

  const errorText = (error: CommandError | undefined): string =>
    error === 'too_far' ? t('msg.tooFar') : error === 'inventory_full' ? t('msg.inventoryFull') : t('msg.shaken');
  const above = (x: number, z: number, height: number) => () => new THREE.Vector3(x, heightAt(x, z) + height, z);

  // Things to act on with E / Ação.
  const interactions = new Interactions();
  interactions.add({
    id: 'house',
    at: () => ({ x: HOUSE_DOOR[0], z: HOUSE_DOOR[1] }),
    radius: BED_REACH,
    label: () => t('interact.sleep'),
    act: () => {
      commitMove();
      const r = game.dispatch({ type: 'sleep' }, localActor);
      if (!r.ok) return hud.toast(errorText(r.error));
      sleepFade.hidden = false;
      sleepFade.classList.remove('sleep-fade--out');
      player.teleport(PLAYER_START.x, PLAYER_START.z, PLAYER_START.facing);
      moveDirty = true;
      commitMove();
      rig.snap();
      void save('sleep').then(ok => hud.toast(ok ? t('msg.saved') : t('msg.saveFailed')));
      window.setTimeout(() => sleepFade.classList.add('sleep-fade--out'), 900);
      window.setTimeout(() => (sleepFade.hidden = true), 1700);
    },
  });
  const mailbox = PROPS.find(p => p.asset === 'mailbox');
  if (mailbox) {
    const [x, z] = mailbox.at;
    interactions.add({
      id: 'mailbox',
      at: () => ({ x, z }),
      radius: 1.6,
      label: () => t('interact.mail'),
      act: () => bubbles.show('mailbox', t('msg.mail', { island: game.state.island.name }), above(x, z, 1.5), 5),
    });
  }
  for (const bed of BEDS) {
    const [x, z] = bed.sign;
    interactions.add({
      id: `sign-${bed.id}`,
      at: () => ({ x, z }),
      radius: 1.5,
      label: () => t('interact.sign'),
      act: () => bubbles.show(`sign-${bed.id}`, t('msg.sign', { crop: t(`crop.${BED_CROPS_BY_SEASON[season][bed.id]}`) }), above(x, z, 1.2)),
    });
  }
  ORCHARD.forEach(([x, z], index) => {
    interactions.add({
      id: orchardTreeId(index),
      at: () => ({ x, z }),
      radius: TREE_REACH,
      label: () => t('interact.shake'),
      enabled: () => !shakenToday(index),
      act: () => {
        commitMove();
        const r = game.dispatch({ type: 'tree.shake', treeId: orchardTreeId(index) }, localActor);
        world.shakeOrchardTree(index);
        if (r.ok) return;
        hud.toast(r.error === 'not_available' && season === 'winter' ? t('msg.winterTree') : errorText(r.error));
      },
    });
  });
  interactions.add({
    id: 'pet',
    at: () => ({ x: pet.object.position.x, z: pet.object.position.z }),
    radius: 1.5,
    label: () => t('interact.pet'),
    act: () => {
      pet.cheer();
      bubbles.show('pet', t('msg.pet'), () => pet.object.position.clone().setY(pet.object.position.y + 0.9), 2, t('pet.name'));
    },
  });
  const bench = PROPS.find(p => p.asset === 'bench');
  if (bench) {
    const [x, z] = bench.at;
    interactions.add({
      id: 'bench',
      at: () => ({ x, z }),
      radius: 1.6,
      label: () => t('interact.bench'),
      act: () => bubbles.show('player', t('msg.bench'), () => avatar.position.clone().setY(avatar.position.y + 1.9), 3, me().name),
    });
  }
  for (const stall of STALLS) {
    const [x, z] = stall.at;
    const kind = stall.asset.split('.')[1] as 'bread' | 'honey' | 'flowers';
    interactions.add({
      id: stall.asset,
      at: () => ({ x, z: z + 1.2 }),
      radius: 2.0,
      label: () => t('interact.stall'),
      act: () => bubbles.show(stall.asset, t(`msg.stall.${kind}`), above(x, z, 2.6), 4, t(`stall.${kind}`)),
    });
  }

  game.on(event => {
    if (event.type === 'tree.shaken') {
      const index = ORCHARD.findIndex((_, i) => orchardTreeId(i) === event.treeId);
      if (index >= 0) world.setOrchardFruit(index, false);
      if (event.playerId === playerId) hud.toast(t('msg.shake', { qty: event.qty, item: t(`item.${event.item}`) }));
    }
    if (event.type === 'quest.updated' && event.questId === 'tour') {
      const tour = game.state.quests.find(q => q.id === 'tour');
      const last = tour?.visited[tour.visited.length - 1];
      if (last) hud.toast(t('quest.visited', { place: t(`place.${last as 'beach' | 'orchard' | 'market'}`) }));
      if (event.done) hud.toast(t('quest.tour.done', { coins: event.reward }));
    }
  });

  /** The tour request completes itself as the player walks into each place. */
  const checkTour = () => {
    const tour = game.state.quests.find(q => q.id === 'tour');
    if (!tour || tour.done) return;
    for (const place of TOUR_PLACES) {
      if (tour.visited.includes(place.id)) continue;
      if (Math.hypot(player.x - place.at[0], player.z - place.at[1]) > place.radius) continue;
      commitMove();
      game.dispatch({ type: 'place.visit', placeId: place.id }, localActor);
    }
  };

  const saveNow = () => {
    commitMove();
    if (saveDirty) void save('resume');
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveNow();
  });
  window.addEventListener('pagehide', saveNow);

  const dev = import.meta.env.DEV
    ? createDevPanel(uiRoot, game, {
        getCameraMode: () => rig.mode,
        setCameraMode: (mode: CameraMode) => setMap(mode === 'overview'),
        isClockPaused: () => clockPaused,
        setClockPaused: paused => {
          clockPaused = paused;
          updatePause();
        },
        onNewIsland: () => {
          window.removeEventListener('pagehide', saveNow);
          saveDirty = false;
          void saving.then(deleteGame).then(() => location.reload());
        },
      })
    : null;

  // Signs are painted with the web fonts; repaint once they have loaded.
  void document.fonts?.ready.then(() => world.repaintSigns());

  let last = performance.now();
  let elapsed = 0;
  let moveTimer = 0, saveTimer = 0, tourTimer = 0, mapTimer = 1;
  renderer.setAnimationLoop(now => {
    const dtMs = Math.min(250, now - last);
    last = now;
    const dt = dtMs / 1000;
    elapsed += dt;
    driver.update(dtMs);

    // Input: the backpack takes over while it is open.
    const frame = input.poll();
    if (bag.isOpen) {
      if (frame.toggleBag || frame.escape) bag.close();
    } else {
      if (frame.toggleBag) {
        bag.open();
        hud.setPrompt(null);
      }
      if (frame.toggleMap || (frame.escape && rig.mode === 'overview')) setMap(rig.mode !== 'overview');
      if (frame.slot !== null) game.dispatch({ type: 'inventory.select', slot: frame.slot }, localActor);
      if (frame.slotStep !== 0) game.dispatch({ type: 'inventory.select', slot: (me().activeSlot + frame.slotStep + HOTBAR_SIZE) % HOTBAR_SIZE }, localActor);
      rig.yaw += frame.turn * CAMERA_TURN_SPEED * dt;
    }
    const playing = !bag.isOpen;
    player.update(dt, playing ? frame : null, rig.yaw, season);
    if (player.takeDirty()) moveDirty = true;
    pet.update(dt, { x: player.x, z: player.z, y: avatar.position.y, facing: player.facing });

    const target = playing ? interactions.nearest(player.x, player.z, player.facing) : null;
    hud.setPrompt(target ? target.label() : null);
    if (target && frame.action && playing) target.act();

    moveTimer += dt;
    if (moveTimer >= MOVE_COMMIT_S) {
      moveTimer = 0;
      commitMove();
    }
    tourTimer += dt;
    if (tourTimer >= TOUR_CHECK_S) {
      tourTimer = 0;
      checkTour();
    }
    saveTimer += dt;
    if (saveTimer >= RESUME_SAVE_S) {
      saveTimer = 0;
      saveNow();
    }

    world.update(dt, elapsed, reducedMotion);
    weatherFx.update(dt, elapsed, { camera: rig.camera, night: atmosphere.night, cameraYaw: rig.yaw, cloudColor: atmosphere.cloudColor, particles: true, reducedMotion });
    atmosphere.update(dt, weatherFx.flash);
    world.sea.setTint(atmosphere.waterTint);
    rig.update(dt);
    atmosphere.setViewDistance(rig.currentDistance);
    bubbles.update(dt, rig.camera, viewW, viewH);
    mapTimer += dt;
    if (mapTimer >= 0.1) {
      mapTimer = 0;
      hud.drawMinimap({ season, night: atmosphere.night > 0.5, player: { x: player.x, z: player.z, facing: player.facing }, pet: { x: pet.object.position.x, z: pet.object.position.z } });
    }
    post.render(dt);
    dev?.frame(dtMs);
  });

  if (import.meta.env.DEV) Object.assign(window, { __game: game, __assets: assets, __rig: rig, __scene: scene, __renderer: renderer, __player: player, __pet: pet, __save: saveNow });
}

void start().catch(error => {
  console.error(error);
  showFatal(t('app.webglError'));
});
