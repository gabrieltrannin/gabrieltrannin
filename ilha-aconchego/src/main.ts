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
import { DEFAULT_PLAYER } from './data/defaults';
import { HOTBAR_SIZE } from './data/items';
import { LEVELS, MAILBOX, ORCHARD, orchardTreeId, OVERVIEW, PLAYER_START, PROPS, TOUR_PLACES, TREE_REACH } from './data/map';
import { FishingSession } from './game/fishing';
import { Interactions } from './game/interactions';
import { createIslandActions } from './game/islandActions';
import { createConversations } from './game/conversations';
import { areaAt } from './data/areas';
import { VILLAGERS, villager, type NpcId } from './data/villagers';
import { DialogueBox } from './ui/dialogue';
import { Pet } from './game/pet';
import { PlayerController } from './game/playerController';
import { t, type MessageKey } from './i18n';
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
import { itemName } from './ui/itemText';
import { createPanels } from './ui/panels';
import { createTouchControls } from './ui/touchControls';
import { BugSystem } from './world/bugs';
import { buildColliders } from './world/collision';
import { heightAt } from './world/terrain';
import { buildWorld } from './world/world';
import { createHomeLife } from './game/homeLife';
import { createExplore } from './game/explore';
import { Music } from './audio/music';
import { LoadingScreen } from './ui/loading';
import { outdoorTileFree, placementError } from './core/decor';
import { PhotoMode } from './ui/photoMode';
import { EmoteWheel } from './ui/emoteWheel';
import { isDecorItem } from './data/decor';
import { WEARABLE, DYES } from './data/clothing';
import { BOOKS, recipeById } from './data/recipes';
import { ITEMS } from './data/items';
import { formatDate } from './ui/format';

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
  // Farm, animals, rocks and the other things that follow the game state.
  world.syncState(game.state);
  const STATE_EVENTS = new Set(['farm.changed', 'world.changed', 'animals.changed', 'day.started', 'date.changed', 'npc.arrived']);
  game.on(event => {
    if (STATE_EVENTS.has(event.type)) world.syncState(game.state);
    if (event.type === 'farm.watered') world.farm.splash(event.tiles);
  });
  game.on(event => {
    if (event.type !== 'player.moved' && event.type !== 'inventory.changed') syncLook();
    if (event.type === 'day.started' || event.type === 'date.changed') syncOrchard();
  });

  // The player's character and the pet.
  const avatar = buildAvatar(me().appearance);
  avatar.name = 'player';
  scene.add(avatar);
  const colliders = buildColliders({ greenhouseFixed: game.state.greenhouse, bridgeFixed: game.state.projects.bridge.done });
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
    onToggleMap: () => {
      if (!home.inside) setMap(rig.mode !== 'overview');
    },
    onRating: () => panels.openRating(),
    tools: [
      { icon: '🛋️', label: t('hud.decorate'), run: () => openDecor() },
      { icon: '😊', label: t('hud.emote'), run: () => emotes.toggle() },
      { icon: '📷', label: t('hud.photo'), run: () => photo.open() },
    ],
  });
  const bag = createInventoryPanel(uiRoot, {
    getInventory: () => me().inventory,
    getPlayer: me,
    onMove: (from, to) => game.dispatch({ type: 'inventory.move', from, to }, localActor),
    onEat: slot => {
      const r = game.dispatch({ type: 'item.eat', slot }, localActor);
      if (!r.ok) hud.toast(errorText(r.error));
    },
    onClose: () => bag.close(),
    tabs: [
      { label: `💗 ${t('bag.friends')}`, run: () => (bag.close(), panels.openFriends()) },
      { label: `📅 ${t('bag.calendar')}`, run: () => (bag.close(), panels.openCalendar()) },
      { label: `🏅 ${t('bag.profile')}`, run: () => (bag.close(), panels.openProfile()) },
      { label: `🌳 ${t('bag.talents')}`, run: () => (bag.close(), panels.openTalents()) },
      { label: `📖 ${t('bag.catalog')}`, run: () => (bag.close(), panels.openCatalog()) },
      { label: `⭐ ${t('bag.rating')}`, run: () => (bag.close(), panels.openRating()) },
      { label: `🛋️ ${t('bag.decorate')}`, run: () => (bag.close(), openDecor()) },
      { label: `⚙️ ${t('bag.options')}`, run: () => (bag.close(), panels.openOptions({ get enabled() { return music.enabled; }, set: on => music.setEnabled(on) })) },
    ],
    uses: slot => {
      const item = me().inventory[slot]?.item;
      if (!item) return [];
      const act = (cmd: Parameters<typeof game.dispatch>[0], ok?: string) => () => {
        const r = game.dispatch(cmd, localActor);
        hud.toast(r.ok ? ok ?? '' : errorText(r.error));
        bag.refresh();
      };
      if (isDecorItem(item)) return [{ label: t('use.place'), run: () => (bag.close(), openDecor(slot)) }];
      if (WEARABLE[item]) return [{ label: t('use.wardrobe'), run: act({ type: 'wardrobe.store', slot }, t('msg.stored', { item: t(`item.${item}`) })) }];
      if (DYES[item]) return [{ label: t('use.dye'), run: act({ type: 'wardrobe.dye', slot }, t('msg.dyed')) }];
      if (BOOKS[item]) return [{ label: t('use.read'), run: act({ type: 'book.read', slot }) }];
      if (ITEMS[item].kind === 'petwear') return [{ label: t('use.pet'), run: act({ type: 'pet.dress', slot }, t('msg.petDressed')) }];
      return [];
    },
  });
  game.on(event => {
    if ((event.type === 'inventory.changed' || event.type === 'player.changed') && bag.isOpen) bag.refresh();
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

  const ERROR_TEXT: Partial<Record<CommandError, MessageKey>> = {
    too_far: 'msg.tooFar', inventory_full: 'msg.inventoryFull', tired: 'msg.tired', no_money: 'msg.noMoney', missing: 'msg.missing',
    not_tilled: 'msg.notTilled', occupied: 'msg.occupied', wrong_season: 'msg.wrongSeason', not_ready: 'msg.nothingToHarvest', no_tool: 'msg.noTool', already: 'msg.already', closed: 'msg.closed',
  };
  const errorText = (error: string | undefined): string => t(ERROR_TEXT[error as CommandError] ?? 'msg.notAvailable');

  // Things to act on with E / Ação.
  const interactions = new Interactions();
  /** Goes to bed: a new day starts and the game is saved. Inside, you wake up in the house. */
  const sleep = () => {
    commitMove();
    const r = game.dispatch({ type: 'sleep' }, localActor);
    if (!r.ok) return hud.toast(errorText(r.error));
    sleepFade.hidden = false;
    sleepFade.classList.remove('sleep-fade--out');
    if (!me().inside) {
      player.teleport(PLAYER_START.x, PLAYER_START.z, PLAYER_START.facing);
      moveDirty = true;
      commitMove();
    }
    rig.snap();
    void save('sleep').then(ok => hud.toast(ok ? t('msg.saved') : t('msg.saveFailed')));
    window.setTimeout(() => sleepFade.classList.add('sleep-fade--out'), 900);
    window.setTimeout(() => (sleepFade.hidden = true), 1700);
  };
  const mailbox = PROPS.find(p => p.asset === 'mailbox');
  if (mailbox) {
    const [x, z] = mailbox.at;
    interactions.add({
      id: 'mailbox',
      at: () => ({ x, z }),
      radius: 1.6,
      label: () => t('interact.mail'),
      act: () => panels.openMail(),
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
  // Stage 3: windows, bugs, fishing and the context action of E / Ação.
  const panels = createPanels(uiRoot, game, localActor, text => hud.toast(text), errorText);
  const bugs = new BugSystem(assets);
  scene.add(bugs.root);
  const fishing = new FishingSession(
    scene, uiRoot, game, localActor,
    () => avatar.position.clone().add(new THREE.Vector3(Math.sin(player.facing) * 0.35, 1.05, Math.cos(player.facing) * 0.35)),
    text => hud.toast(text),
    on => (on ? bubbles.show('bite', '❗', () => avatar.position.clone().setY(avatar.position.y + 2.0), 1.3) : bubbles.hide('bite')),
  );
  const actions = createIslandActions({
    game, actor: localActor, player, world, bubbles, panels, bugs, fishing, interactions,
    toast: text => hud.toast(text), errorText, commitMove,
  });

  // Messages for what happened (the windows show their own).
  game.on(event => {
    if ('playerId' in event && event.playerId !== playerId) return;
    if (event.type === 'item.gained' && !panels.isOpen && !fishing.active && event.qty > 0) hud.toast(`+${event.qty} ${itemName({ item: event.item, q: event.q || undefined })}`);
    if (event.type === 'skill.up') hud.toast(t('skill.levelUp', { skill: t(`skill.${event.skill}`), level: event.level }));
    if (event.type === 'shipping.paid') hud.toast(t('msg.paid', { coins: event.coins.toLocaleString('pt-BR') }));
    if (event.type === 'ate') {
      hud.toast(t('msg.ate', { item: t(`item.${event.item}`), energy: event.energy }));
      if (event.buff) hud.toast(t('msg.buff', { buff: t(`buff.${event.buff}`) }));
    }
    if (event.type === 'tool.upgraded') hud.toast(t('msg.upgraded', { tool: t(`item.tool.${event.tool}`), level: t(`tool.level.${event.level}` as MessageKey) }));
    if (event.type === 'farm.rained') hud.toast(t('msg.rainWatered'));
    if (event.type === 'farm.withered') hud.toast(t('msg.withered'));
    // Stage 5 news.
    if (event.type === 'achievement') hud.toast(t('msg.achievement', { name: t(`ach.${event.id}` as MessageKey) }));
    if (event.type === 'stall.sold') hud.toast(t('msg.stallSold', { item: t(`item.${event.item}`), coins: event.coins }));
    if (event.type === 'recipe.learned') hud.toast(t('msg.recipeLearned', { item: t(`item.${recipeById(event.recipe)!.result}`) }));
    if (event.type === 'experiment.failed') hud.toast(event.known ? t('msg.experimentKnown', { item: t(`item.${recipeById(event.known)!.result}`) }) : t('msg.experimentFailed'));
    if (event.type === 'pet.found') hud.toast(t('msg.petFound', { qty: event.qty, item: t(`item.${event.item}`) }));
    if (event.type === 'photo.saved') hud.toast(t('msg.photoTaken'));
    if (event.type === 'skill.up') hud.toast(t('msg.talentReady', { skill: t(`skill.${event.skill}`) }));
    if (event.type === 'project.done') hud.toast(t('msg.projectDone', { project: t(`project.${event.project}` as MessageKey) }));
    if (event.type === 'stars.up') hud.toast(t('msg.starsUp', { stars: event.stars }));
    if (event.type === 'npc.arrived') {
      hud.toast(t('msg.arrived', { name: villager(event.npc).name }));
      world.villagers.sync(game.state, true);
    }
    if (event.type === 'npc.heart') {
      const v = villager(event.npc);
      hud.toast(t('msg.heartUp', { name: v.name, hearts: event.hearts }));
      showHearts(event.npc);
    }
    if (event.type === 'day.started' && me().mail.some(m => !m.read)) window.setTimeout(() => hud.toast(t('msg.newMail')), 1800);
  });
  const showHearts = (npc: NpcId) => {
    const at = world.villagers.positionOf(npc);
    if (at) bubbles.show(`hearts-${npc}`, '💗', () => at.clone().setY(at.y + 2.1), 1.8);
  };

  // Villagers: they walk to their next place when the clock or the weather change, and jump there on a new day.
  let lastMinute = game.state.time.minuteOfDay;
  world.villagers.sync(game.state, true);
  game.on(event => {
    if (event.type === 'day.started' || event.type === 'date.changed') world.villagers.sync(game.state, true);
    if (event.type === 'time.changed') {
      const jump = Math.abs(game.state.time.minuteOfDay - lastMinute) > 40;
      world.villagers.sync(game.state, jump);
    }
    if (event.type === 'weather.changed' || event.type === 'project.done') world.villagers.sync(game.state);
    lastMinute = game.state.time.minuteOfDay;
  });
  const dialogue = new DialogueBox(uiRoot);
  createConversations({
    game, actor: localActor, player, agents: world.villagers, dialogue, panels, interactions,
    toast: text => hud.toast(text), errorText, commitMove, hearts: npc => showHearts(npc),
    openSalon: () => void home.openLook('salon'),
    playFestival: () => explore.playFestival(),
    openBoat: () => explore.openBoat(),
  });

  // Stage 5: the house, decorating, emotes and the photo mode.
  const home = createHomeLife({
    game, actor: localActor, assets, scene, post, rig, player, pet, avatar, world, interactions, panels, bubbles, uiRoot, canvas,
    setInputEnabled: on => (input.enabled = on), setPrompt: text => hud.setPrompt(text), toast: text => hud.toast(text), errorText, commitMove, sleep,
  });
  const openDecor = (slot?: number) => {
    if (me().away) return hud.toast(t('msg.decorAway'));
    setMap(false);
    home.decorMode.open(slot);
  };
  // Stage 6: music, the loading screen, the regions, the mines and the festivals.
  const music = new Music();
  const loading = new LoadingScreen(uiRoot);
  const explore = createExplore({
    game, actor: localActor, assets, player, pet, avatar, rig, world, home, interactions, panels, bubbles, loading, music, uiRoot,
    toast: text => hud.toast(text), errorText, commitMove, setInputEnabled: on => (input.enabled = on),
  });
  const emotes = new EmoteWheel(uiRoot, id => home.emote(id));
  const photo = new PhotoMode({
    uiRoot, canvas,
    getZoom: () => rig.followScale,
    setZoom: z => (rig.followScale = z),
    setPose: pose => (pose ? player.playEmote(pose, Infinity) : (player.emote = null)),
    caption: () => `${t('hud.island', { name: game.state.island.name })} · ${formatDate(game.state.time)}`,
    onShot: () => game.dispatch({ type: 'photo.taken' }, localActor),
    onOpen: () => {
      setMap(false);
      uiRoot.classList.add('is-photo');
    },
    onClose: () => uiRoot.classList.remove('is-photo'),
  });

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
  let currentArea = areaAt(player.x, player.z);
  rig.setOverview({ x: currentArea.x, y: LEVELS.main.top, z: currentArea.z, width: currentArea.width, depth: currentArea.depth });
  atmosphere.setFocus(currentArea.x, currentArea.z);
  // A little sparkle over the mailbox when letters are waiting.
  const mailFlag = assets.create('marker.ready');
  mailFlag.position.set(MAILBOX[0], 3, MAILBOX[1]);
  scene.add(mailFlag);
  renderer.setAnimationLoop(now => {
    const dtMs = Math.min(250, now - last);
    last = now;
    const dt = dtMs / 1000;
    elapsed += dt;
    driver.update(dtMs);

    // Input: the backpack or a window takes over while open; fishing holds the character still.
    const frame = input.poll();
    if (photo.active) {
      photo.update(frame);
      rig.yaw += frame.turn * CAMERA_TURN_SPEED * dt;
    } else if (emotes.isOpen) {
      if (frame.slot !== null) emotes.choose(frame.slot);
      else if (frame.escape || frame.emote) emotes.close();
    } else if (home.decorMode.active && !bag.isOpen && !panels.isOpen) {
      home.decorMode.update(frame);
      rig.yaw += frame.turn * CAMERA_TURN_SPEED * dt;
    } else if (dialogue.isOpen) {
      if (frame.escape) dialogue.close();
      else if (frame.slot !== null) dialogue.choose(frame.slot);
      else if (frame.action) dialogue.advance();
    } else if (panels.isOpen) {
      if (frame.escape || frame.toggleBag) panels.close();
    } else if (bag.isOpen) {
      if (frame.toggleBag || frame.escape) bag.close();
    } else if (fishing.active) {
      rig.yaw += frame.turn * CAMERA_TURN_SPEED * dt;
    } else {
      if (frame.toggleBag) {
        bag.open();
        hud.setPrompt(null);
      }
      if (!home.inside && (frame.toggleMap || (frame.escape && rig.mode === 'overview'))) setMap(rig.mode !== 'overview');
      if (frame.decorate) openDecor();
      if (frame.emote) emotes.toggle();
      if (frame.photo) photo.open();
      if (frame.slot !== null) game.dispatch({ type: 'inventory.select', slot: frame.slot }, localActor);
      if (frame.slotStep !== 0) game.dispatch({ type: 'inventory.select', slot: (me().activeSlot + frame.slotStep + HOTBAR_SIZE) % HOTBAR_SIZE }, localActor);
      rig.yaw += frame.turn * CAMERA_TURN_SPEED * dt;
    }
    const playing = !bag.isOpen && !panels.isOpen && !fishing.active && !dialogue.isOpen && !photo.active && !emotes.isOpen && !explore.gliding && !explore.festivalGame.isOpen;
    const onIsland = !home.inside && !explore.isAway;
    player.speedFactor = me().buff === 'speed' ? 1.2 : 1;
    player.update(dt, playing ? frame : null, rig.yaw, season);
    if (player.takeDirty()) moveDirty = true;
    pet.update(dt, { x: player.x, z: player.z, y: avatar.position.y, facing: player.facing });

    dialogue.update(dt);
    if (fishing.active) hud.setPrompt(fishing.update(dt, elapsed, bag.isOpen || panels.isOpen ? null : frame));
    else if (dialogue.isOpen || photo.active) hud.setPrompt(null);
    else if (home.decorMode.active) {
      // Decoration mode writes its own prompt.
    } else {
      const action = playing ? (explore.isAway ? explore.resolve() : home.inside ? home.resolveIndoor() : actions.resolve()) : null;
      hud.setPrompt(action ? action.label : null);
      if (action && frame.action && playing) {
        // Panels (board, museum, shops) check distance with the position in the game state.
        commitMove();
        action.run();
      }
    }
    if (onIsland) bugs.update(dt, elapsed, season, game.state.time.minuteOfDay, game.state.weather);
    home.update(dt, elapsed);
    explore.update(dt, elapsed, atmosphere.night);

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
    if (onIsland) weatherFx.update(dt, elapsed, { camera: rig.camera, night: atmosphere.night, cameraYaw: rig.yaw, cloudColor: atmosphere.cloudColor, particles: true, reducedMotion, center: currentArea });
    else if (home.inside) home.interior.setNight(atmosphere.night);
    atmosphere.update(dt, weatherFx.flash);
    world.sea.setTint(atmosphere.waterTint);
    rig.update(dt);
    atmosphere.setViewDistance(rig.currentDistance);
    bubbles.update(dt, rig.camera, viewW, viewH);
    mapTimer += dt;
    if (mapTimer >= 0.1) {
      mapTimer = 0;
      const area = !onIsland ? currentArea : areaAt(player.x, player.z);
      if (area !== currentArea) {
        currentArea = area;
        rig.setOverview({ x: area.x, y: LEVELS.main.top, z: area.z, width: area.width, depth: area.depth });
        atmosphere.setFocus(area.x, area.z);
      }
      const villagersOut = VILLAGERS.map(v => world.villagers.positionOf(v.id)).filter((p): p is THREE.Vector3 => !!p).map(p => ({ x: p.x, z: p.z }));
      hud.setInside(explore.label() ?? home.floorName());
      if (onIsland) hud.drawMinimap({ season, night: atmosphere.night > 0.5, player: { x: player.x, z: player.z, facing: player.facing }, pet: { x: pet.object.position.x, z: pet.object.position.z }, area, villagers: villagersOut });
      mailFlag.visible = me().mail.some(m => !m.read || (m.item && !m.taken));
      mailFlag.position.y = heightAt(MAILBOX[0], MAILBOX[1]) + 1.75 + Math.sin(elapsed * 3) * 0.06;
    }
    post.render(dt);
    photo.afterRender();
    dev?.frame(dtMs);
  });

  if (import.meta.env.DEV) Object.assign(window, { __explore: explore, __music: music, __decorRules: { placementError, outdoorTileFree }, __home: home, __photo: photo, __emotes: emotes, __game: game, __assets: assets, __rig: rig, __scene: scene, __renderer: renderer, __player: player, __pet: pet, __save: saveNow, __world: world, __fishing: fishing });
}

void start().catch(error => {
  console.error(error);
  showFatal(t('app.webglError'));
});
