import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import type { Music } from '../audio/music';
import { absoluteDay } from '../core/clock';
import { festivalActive, festivalToday } from '../core/explore';
import type { Game } from '../core/game';
import { eatEnergy } from '../core/rules';
import type { Actor, AwayPlace, PlayerState } from '../core/types';
import { FESTIVAL_CENTER } from '../data/festivals';
import { isElevatorFloor, MINE_DOOR, MINE_DOOR_REACH, MINE_START, MINE_START_REACH, ROCK_REACH } from '../data/mine';
import { CREATURE_HITS, FORAGE_REACH, GRASS_REACH, HOME_BOAT, NODE_REACH, PUZZLE_REACH, REGIONS, WIND_REACH, type RegionId } from '../data/regions';
import { t, type MessageKey } from '../i18n';
import type { CameraRig } from '../render/camera';
import type { Bubbles } from '../ui/bubbles';
import { FestivalGame } from '../ui/festivalGames';
import type { LoadingScreen } from '../ui/loading';
import type { PanelHost } from '../ui/panels';
import { buildMineFloor, type MineView } from '../world/mineScene';
import { buildRegion, type RegionView } from '../world/regionScene';
import type { World } from '../world/world';
import type { AwaySpace, HomeLife } from './homeLife';
import { Interactions } from './interactions';
import type { Pet } from './pet';
import type { PlayerController } from './playerController';

export interface ExploreContext {
  game: Game;
  actor: Actor;
  assets: AssetRegistry;
  player: PlayerController;
  pet: Pet;
  avatar: THREE.Object3D;
  rig: CameraRig;
  world: World;
  home: HomeLife;
  interactions: Interactions;
  panels: PanelHost;
  bubbles: Bubbles;
  loading: LoadingScreen;
  music: Music;
  uiRoot: HTMLElement;
  toast(text: string): void;
  errorText(error: string): string;
  commitMove(): void;
  setInputEnabled(on: boolean): void;
}

const REGION_ICON: Record<RegionId, string> = { beach: '⛵', forest: '⛵', volcano: '⛵', clouds: '🎈' };
const dirOf = (dx: number, dz: number): 'n' | 's' | 'e' | 'w' => (Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'e' : 'w') : dz > 0 ? 's' : 'n');

/**
 * Stage 6 glue between the game state and the scenes away from home: the boat and the mine's cave on
 * the island, the regions and mine floors (their E actions, wind currents, creatures and bubbles), the
 * festival in the square, and which music plays.
 */
export function createExplore(ctx: ExploreContext) {
  const { game, actor, player } = ctx;
  const me = (): PlayerState => game.state.players[actor.id]!;
  const away = new Interactions();
  let region: RegionView | null = null;
  let mine: MineView | null = null;
  let glide: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  const festivalGame = new FestivalGame(ctx.uiRoot, () => ctx.setInputEnabled(true));

  const send = (cmd: Parameters<Game['dispatch']>[0]): boolean => {
    ctx.commitMove();
    const r = game.dispatch(cmd, actor);
    if (!r.ok) ctx.toast(ctx.errorText(r.error));
    return r.ok;
  };
  const sync = () => {
    region?.sync(game.state, me().explore.chests);
    mine?.sync(game.state, me().explore.chests);
    ctx.home.rebuildColliders();
  };

  // ---------- Travelling (with the loading screen) ----------
  const travel = (text: string, icon: string, cmd: Parameters<Game['dispatch']>[0]) => {
    ctx.panels.close();
    ctx.setInputEnabled(false);
    void ctx.loading.run(text, icon, () => {
      if (send(cmd)) ctx.home.syncSpace(true);
    }).then(() => ctx.setInputEnabled(true));
  };
  const goRegion = (id: RegionId) => travel(t('loading.to', { place: t(`region.${id}` as MessageKey) }), REGION_ICON[id], { type: 'travel.go', region: id });
  const goHome = () => travel(t('loading.home', { place: t('hud.island', { name: game.state.island.name }) }), '⛵', { type: 'travel.home' });
  const goFloor = (floor: number, cmd: Parameters<Game['dispatch']>[0]) => travel(t('loading.mine', { floor }), '🪜', cmd);

  // On the home island: the boat at the pier and the cave in the west cliff.
  ctx.interactions.add({ id: 'boat', at: () => ({ x: HOME_BOAT[0] + 0.55, z: HOME_BOAT[1] - 0.2 }), radius: 1.9, label: () => t('act.boat'), act: () => ctx.panels.openBoat(goRegion) });
  ctx.interactions.add({ id: 'mine-door', at: () => ({ x: MINE_DOOR[0], z: MINE_DOOR[1] }), radius: MINE_DOOR_REACH, label: () => t('act.mineEnter'), act: () => goFloor(1, { type: 'mine.enter' }) });
  // The festival game, at the stand in the square.
  const playFestival = () => {
    const f = festivalActive(game.state);
    if (!f) return ctx.toast(t('game.closed'));
    if (me().explore.festivals.includes(`${f.id}:${game.state.time.year}`)) return ctx.toast(t('game.already'));
    ctx.setInputEnabled(false);
    festivalGame.open(f, score => {
      if (send({ type: 'festival.play', score })) ctx.toast(t('msg.festivalDone', { score, coins: score * 25 + 100 }));
    });
  };
  ctx.interactions.add({
    id: 'festival', at: () => ({ x: 8.4, z: 2.3 }), radius: 2.2,
    enabled: () => !!festivalActive(game.state),
    label: () => t('act.festival', { game: t(`game.${festivalActive(game.state)!.game}` as MessageKey) }),
    act: playFestival,
  });

  // ---------- Building a place away ----------
  function enter(place: AwayPlace): AwaySpace {
    away.clear();
    region = null;
    mine = null;
    if (place.kind === 'region') {
      const view = buildRegion(ctx.assets, place.id);
      region = view;
      addRegionActions(place.id, view);
      view.sync(game.state, me().explore.chests);
      ctx.music.setTheme(REGIONS[place.id].music);
      return { scene: view.scene, ground: view.ground, colliders: () => view.colliders(game.state), zoom: 1 };
    }
    const view = buildMineFloor(ctx.assets, game.state.seed, place.floor, absoluteDay(game.state.time));
    mine = view;
    addMineActions(place.floor, view);
    view.sync(game.state, me().explore.chests);
    ctx.music.setTheme('mine');
    ctx.toast(t('msg.mineFloor', { floor: place.floor }));
    return { scene: view.scene, ground: view.ground, colliders: () => view.colliders(game.state), zoom: 0.85 };
  }
  ctx.home.setAwayHandler(enter);

  function addRegionActions(id: RegionId, view: RegionView): void {
    const def = REGIONS[id];
    const taken = (key: string) => game.state.explore.taken.includes(key);
    away.add({ id: 'boat', at: () => ({ x: def.boat[0], z: def.boat[1] - 2 }), radius: 2.4, label: () => t('act.boatHome'), act: goHome });
    def.forage.forEach((f, i) => away.add({ id: `forage-${i}`, at: () => ({ x: f.at[0], z: f.at[1] }), radius: FORAGE_REACH, enabled: () => !taken(`forage:${id}:${i}`), label: () => t('act.forage'), act: () => void send({ type: 'explore.forage', spot: i }) }));
    def.nodes.forEach((n, i) => away.add({ id: `node-${i}`, at: () => ({ x: n.at[0], z: n.at[1] }), radius: NODE_REACH, enabled: () => !taken(`node:${id}:${i}`), label: () => t('act.node'), act: () => void send({ type: 'explore.node', node: i }) }));
    def.grass.forEach((g, i) => away.add({ id: `grass-${i}`, at: () => ({ x: g[0], z: g[1] }), radius: GRASS_REACH, enabled: () => !taken(`grass:${id}:${i}`), label: () => t('act.grass'), act: () => void send({ type: 'explore.grass', clump: i }) }));
    const sign = def.props.find(p => p.asset === 'region.sign');
    if (sign) away.add({ id: 'sign', at: () => ({ x: sign.at[0], z: sign.at[1] }), radius: 1.6, label: () => t('act.sign'), act: () => ctx.bubbles.show('sign', t(`region.sign.${id}` as MessageKey), () => new THREE.Vector3(sign.at[0], 1.5, sign.at[1]), 5) });
    const puzzle = def.puzzle;
    const solved = () => game.state.explore.puzzles[id]?.solved ?? false;
    if (puzzle.kind === 'push') {
      puzzle.blocks.forEach((_, i) => away.add({
        id: `block-${i}`, radius: PUZZLE_REACH, enabled: () => !solved(), label: () => t('act.push'),
        at: () => {
          const [x, z] = game.state.explore.puzzles[id]?.blocks[i] ?? puzzle.blocks[i]!;
          return { x: x + 0.5, z: z + 0.5 };
        },
        act: () => {
          const [x, z] = game.state.explore.puzzles[id]?.blocks[i] ?? puzzle.blocks[i]!;
          void send({ type: 'puzzle.push', block: i, dir: dirOf(x + 0.5 - player.x, z + 0.5 - player.z) });
        },
      }));
      // A lever to start over if a block gets stuck.
      const [bx, bz] = [puzzle.bounds.x0 - 0.2, puzzle.bounds.z1 + 0.2];
      away.add({ id: 'reset', at: () => ({ x: bx, z: bz }), radius: 1.3, enabled: () => !solved(), label: () => t('act.reset'), act: () => void send({ type: 'puzzle.reset' }) });
    }
    if (puzzle.kind === 'switches') puzzle.switches.forEach((s, i) => away.add({ id: `switch-${i}`, at: () => ({ x: s[0], z: s[1] }), radius: PUZZLE_REACH, enabled: () => !solved(), label: () => t('act.switch'), act: () => void send({ type: 'puzzle.press', index: i }) }));
    if (puzzle.kind === 'bells') puzzle.bells.forEach((b, i) => away.add({ id: `bell-${i}`, at: () => ({ x: b[0], z: b[1] }), radius: PUZZLE_REACH, enabled: () => !(game.state.explore.puzzles[id]?.pressed.includes(i) ?? false), label: () => t('act.bell'), act: () => void send({ type: 'puzzle.press', index: i }) }));
    away.add({ id: 'chest', at: () => ({ x: puzzle.chest[0], z: puzzle.chest[1] }), radius: PUZZLE_REACH + 0.3, enabled: () => solved() && !me().explore.chests.includes(id), label: () => t('act.chest'), act: () => void send({ type: 'puzzle.chest' }) });
    // Wind currents: step on a pad and the wind carries you to the other end.
    def.winds.forEach((w, i) => {
      for (const [from, to] of [[w.a, w.b], [w.b, w.a]] as const) {
        away.add({
          id: `wind-${i}-${from[0]}`, at: () => ({ x: from[0], z: from[1] }), radius: WIND_REACH + 0.4,
          enabled: () => !w.needs || solved(), label: () => t('act.wind'),
          act: () => {
            glide = { from: new THREE.Vector3(player.x, 0, player.z), to: new THREE.Vector3(to[0], 0, to[1]), t: 0 };
          },
        });
      }
    });
    void view;
  }

  function addMineActions(floor: number, view: MineView): void {
    const f = view.floor;
    const broken = () => game.state.explore.mine[String(floor)] ?? [];
    away.add({ id: 'rope', at: () => ({ x: MINE_START[0] - 1.2, z: MINE_START[1] + 0.7 }), radius: MINE_START_REACH, label: () => t('act.mineExit'), act: () => travel(t('loading.mineOut'), '☀️', { type: 'mine.exit' }) });
    if (isElevatorFloor(floor) && me().explore.deepest >= 5) {
      away.add({
        id: 'elevator', at: () => ({ x: MINE_START[0] + 1.1, z: MINE_START[1] + 0.9 }), radius: MINE_START_REACH + 0.3, label: () => t('act.mineElevator'),
        act: () => ctx.panels.openElevator(floor, to => goFloor(to, { type: 'mine.elevator', floor: to }), () => travel(t('loading.mineOut'), '☀️', { type: 'mine.exit' })),
      });
    }
    f.rocks.forEach((r, i) => away.add({ id: `rock-${i}`, at: () => ({ x: r.x + 0.5, z: r.z + 0.5 }), radius: ROCK_REACH, enabled: () => !broken().includes(i), label: () => t('act.mineRock'), act: () => void send({ type: 'mine.break', rock: i }) }));
    const ladder = f.rocks[f.ladder];
    if (ladder) away.add({ id: 'ladder', at: () => ({ x: ladder.x + 0.5, z: ladder.z + 0.5 }), radius: ROCK_REACH, enabled: () => broken().includes(f.ladder), label: () => t('act.mineDown'), act: () => goFloor(floor + 1, { type: 'mine.down' }) });
    if (f.treasure) away.add({ id: 'treasure', at: () => ({ x: f.treasure![0] + 0.5, z: f.treasure![1] + 0.5 }), radius: ROCK_REACH, enabled: () => !me().explore.chests.includes('mine'), label: () => t('act.mineTreasure'), act: () => void send({ type: 'mine.treasure' }) });
  }

  // ---------- Bubbles for the creatures ----------
  const creaturesHere = () => region?.creatures ?? mine?.creatures ?? null;
  const blowBubbles = (id: string, at: THREE.Vector3) => {
    const layer = creaturesHere();
    if (!layer) return;
    player.playEmote('happy', 0.6);
    ctx.bubbles.show(`bubbles-${id}`, '🫧', () => at.clone().setY(at.y + 1.0), 0.8);
    if (layer.hit(id) >= CREATURE_HITS && send({ type: 'creature.calm', id })) ctx.toast(t('msg.calmed'));
  };

  // ---------- Keeping up with the game ----------
  game.on(event => {
    if ('playerId' in event && event.playerId !== actor.id) return;
    switch (event.type) {
      case 'explore.changed':
      case 'puzzle.changed':
      case 'chest.opened':
      case 'creature.calmed':
      case 'mine.broken':
      case 'options.changed':
        sync();
        break;
      case 'puzzle.solved':
        sync();
        ctx.toast(t('msg.puzzleSolved'));
        break;
      case 'puzzle.pressed':
        if (!event.correct) ctx.toast(t('msg.puzzleWrong'));
        break;
      case 'mine.broken':
        break;
      case 'grass.searched':
        ctx.toast(event.caught && event.item.startsWith('bug.') ? t('msg.grassBug', { item: t(`item.${event.item}`) }) : event.caught ? '' : t('msg.grassBugAway'));
        break;
      case 'player.fainted':
        ctx.toast(t('msg.fainted'));
        ctx.home.syncSpace(true);
        break;
      case 'travel':
        if (event.first && event.region) ctx.toast(t('msg.newRegion', { region: t(`region.${event.region}` as MessageKey) }));
        break;
      case 'festival.done':
        if (event.prize) ctx.toast(t('msg.festivalPrize', { item: t(`item.${event.prize}`) }));
        break;
      case 'day.started':
      case 'date.changed': {
        const f = festivalToday(game.state);
        ctx.world.setFestival(f?.id ?? null);
        if (f && event.type === 'day.started') window.setTimeout(() => ctx.toast(t('msg.festivalToday', { festival: t(`festival.${f.id}` as MessageKey) })), 2500);
        if (me().away === null) ctx.home.syncSpace();
        break;
      }
    }
    if (event.type === 'mine.broken' && event.ladder) ctx.toast(t('msg.ladder'));
    if (event.type === 'mine.floor' && event.first && event.floor % 5 === 0) ctx.toast(t('msg.mineElevator', { floor: event.floor }));
    // The bubble wand found at the mine's entrance: say what it is for.
    if (event.type === 'item.gained' && event.item === 'gear.wand') window.setTimeout(() => ctx.toast(t('msg.wand')), 1200);
  });
  ctx.world.setFestival(festivalToday(game.state)?.id ?? null);

  let bumpCooldown = 0;
  return {
    festivalGame,
    playFestival,
    openBoat: () => ctx.panels.openBoat(goRegion),
    get isAway(): boolean {
      return !!me().away;
    },
    get gliding(): boolean {
      return !!glide;
    },
    /** Name of where you are, for the minimap card. */
    label(): string | null {
      const a = me().away;
      if (!a) return null;
      return a.kind === 'region' ? t(`region.${a.id}` as MessageKey) : t('hud.mine', { floor: a.floor });
    },
    /** What E does away from home. */
    resolve(): { label: string; run: () => void } | null {
      const near = away.nearest(player.x, player.z, player.facing);
      // The bubble wand works on a creature close by.
      const layer = creaturesHere();
      const c = layer && me().inventory.some(s => s?.item === 'gear.wand') && !game.state.options.peaceful ? layer.nearest(player.x, player.z, 1.9) : null;
      if (c) {
        // Only when the creature is in front and closer than the rock, chest or forage spot you face,
        // so a creature wandering by does not steal the E from what you came to do.
        const dx = c.at.x - player.x, dz = c.at.z - player.z, d = Math.hypot(dx, dz);
        const ahead = d < 0.9 || (dx * Math.sin(player.facing) + dz * Math.cos(player.facing)) / d > Math.cos(1.3);
        const target = near?.at();
        const closer = !target || d + 0.2 < Math.hypot(target.x - player.x, target.z - player.z);
        if (ahead && closer) return { label: t('act.calm'), run: () => blowBubbles(c.id, c.at) };
      }
      if (near) return { label: near.label(), run: () => near.act() };
      const slot = me().activeSlot;
      const item = me().inventory[slot]?.item;
      if (item && eatEnergy(me(), item) > 0) return { label: t('act.eat', { item: t(`item.${item}`), energy: eatEnergy(me(), item) }), run: () => void send({ type: 'item.eat', slot }) };
      return null;
    },
    update(dt: number, elapsed: number, night: number): void {
      // Music: the place you are in; the festival in the square; quieter at night at home.
      if (!me().away) {
        const f = festivalActive(game.state);
        const nearSquare = Math.hypot(player.x - FESTIVAL_CENTER[0], player.z - FESTIVAL_CENTER[1]) < 12;
        ctx.music.setTheme(me().inside ? 'house' : f && nearSquare ? 'festival' : night > 0.5 ? 'night' : 'home');
        return;
      }
      region?.update(dt, elapsed);
      if (mine) mine.lantern.position.set(player.x, 1.8, player.z);
      // Gliding on a wind current.
      if (glide) {
        glide.t = Math.min(1, glide.t + dt / 1.3);
        const k = glide.t;
        const x = glide.from.x + (glide.to.x - glide.from.x) * k, z = glide.from.z + (glide.to.z - glide.from.z) * k;
        player.teleport(x, z, Math.atan2(glide.to.x - glide.from.x, glide.to.z - glide.from.z));
        ctx.avatar.position.y = Math.sin(k * Math.PI) * 2.2;
        if (glide.t >= 1) {
          glide = null;
          ctx.commitMove();
        }
        return;
      }
      // Creatures move and sometimes bump into you.
      bumpCooldown = Math.max(0, bumpCooldown - dt);
      const layer = creaturesHere();
      if (!layer || game.state.options.peaceful) return;
      const bumped = layer.update(dt, { x: player.x, z: player.z });
      if (bumped && bumpCooldown <= 0) {
        bumpCooldown = 1.2;
        ctx.commitMove();
        const r = game.dispatch({ type: 'creature.bump', id: bumped }, actor);
        if (r.ok && !r.events.some(e => e.type === 'player.fainted')) {
          ctx.toast(t('msg.bumped'));
          player.playEmote('surprised', 0.8);
        }
      }
    },
  };
}

export type Explore = ReturnType<typeof createExplore>;
