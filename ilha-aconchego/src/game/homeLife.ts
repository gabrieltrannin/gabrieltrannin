import * as THREE from 'three';
import type { AssetRegistry } from '../assets/registry';
import { absoluteDay } from '../core/clock';
import { decorColliders, decorList } from '../core/decor';
import type { Game } from '../core/game';
import { eatEnergy } from '../core/rules';
import type { Actor, PlayerState } from '../core/types';
import { isPresent } from '../core/villagers';
import { APPEARANCE_OPTIONS, BASE_ACCESSORIES, BASE_OUTFITS, BOTTOM_COLORS, SHOE_COLORS, TOP_COLORS, type Appearance } from '../data/appearance';
import { SALON_PRICE } from '../data/clothing';
import { DECOR, isDecorItem, type DecorUse, type StationId } from '../data/decor';
import { EMOTE_ICONS, type EmoteId } from '../data/emotes';
import { DOOR_REACH, DOOR_SPOT, FLOORS, stairsOn, STAIRS_REACH, STAIRS_ON, stairsSpot, type FloorId } from '../data/house';
import { HOUSE_DOOR, BED_REACH } from '../data/map';
import { DIG_REACH, PLAYER_STALL_SPOT, SNIFF_RANGE, visitorsFor } from '../data/rating';
import { VILLAGERS } from '../data/villagers';
import { fill, lines, t, type MessageKey } from '../i18n';
import type { CameraRig } from '../render/camera';
import { dressPet } from '../render/petWear';
import type { PostFx } from '../render/postfx';
import { restyleAvatar } from '../render/avatar';
import { openLookEditor } from '../ui/creator';
import { DecorMode } from '../ui/decorMode';
import type { Bubbles } from '../ui/bubbles';
import type { PanelHost } from '../ui/panels';
import { buildColliders, walkableHeight, type Collider } from '../world/collision';
import { Interior } from '../world/interior';
import { heightAt } from '../world/terrain';
import { Visitors } from '../world/visitors';
import type { World } from '../world/world';
import { Interactions } from './interactions';
import type { Pet } from './pet';
import type { PlayerController } from './playerController';

export interface HomeLifeContext {
  game: Game;
  actor: Actor;
  assets: AssetRegistry;
  scene: THREE.Scene;
  post: PostFx;
  rig: CameraRig;
  player: PlayerController;
  pet: Pet;
  avatar: THREE.Group;
  world: World;
  interactions: Interactions;
  panels: PanelHost;
  bubbles: Bubbles;
  uiRoot: HTMLElement;
  canvas: HTMLCanvasElement;
  setInputEnabled(on: boolean): void;
  setPrompt(text: string | null): void;
  toast(text: string): void;
  errorText(error: string): string;
  commitMove(): void;
  /** Goes to bed (the fade, the save and the new day). */
  sleep(): void;
}

/** The camera comes closer inside the house. */
const INSIDE_ZOOM = 0.78;

const pick = <T>(list: readonly T[]): T | undefined => list[Math.floor(Math.random() * list.length)];

/**
 * Stage 5 glue between the game state and the scene: the house's inside (its own scene), the furniture
 * that does something (bed, mirror, wardrobe, stations, seats), the island's decorations as obstacles,
 * the market stall, the pet sniffing out finds, the visitors, emotes and the look editors.
 */
export function createHomeLife(ctx: HomeLifeContext) {
  const { game, actor, player, pet, rig, world } = ctx;
  const me = (): PlayerState => game.state.players[actor.id]!;
  const interior = new Interior(ctx.assets);
  const indoor = new Interactions();
  const visitors = new Visitors();
  ctx.scene.add(visitors.root);
  let current = '';
  const revealed = new Set<number>();
  let sniffTimer = 0;

  const send = (cmd: Parameters<Game['dispatch']>[0]): boolean => {
    ctx.commitMove();
    const r = game.dispatch(cmd, actor);
    if (!r.ok) ctx.toast(ctx.errorText(r.error));
    return r.ok;
  };
  const above = (o: THREE.Object3D, h: number) => () => o.position.clone().setY(o.position.y + h);

  // ---------- Obstacles and where the player is ----------
  const outdoorColliders = (): Collider[] => [
    ...buildColliders({ greenhouseFixed: game.state.greenhouse, bridgeFixed: game.state.projects.bridge.done, tents: game.state.arrived, homeLevel: me().home.level }),
    ...decorColliders(game.state.decor),
  ];
  const floorDecor = () => (me().inside ? me().home.floors[me().inside!] ?? [] : []);

  function rebuildColliders(): void {
    if (me().inside) player.setGround(interior.ground, decorColliders(floorDecor()));
    else player.setGround(walkableHeight, outdoorColliders());
  }

  /** Moves the character (and the pet) between the island and the floors of the house. */
  function syncSpace(force = false): void {
    const p = me();
    const key = p.inside ? `${p.inside}|${p.home.level}` : 'island';
    if (key === current && !force) return;
    current = key;
    decorMode.close();
    if (p.inside) {
      interior.build(p.home.level, p.inside);
      interior.syncDecor(floorDecor());
      interior.scene.add(ctx.avatar, pet.object);
      ctx.post.setScene(interior.scene);
      pet.ground = interior.ground;
      rig.followScale = INSIDE_ZOOM;
    } else {
      ctx.scene.add(ctx.avatar, pet.object);
      ctx.post.setScene(ctx.scene);
      pet.ground = walkableHeight;
      rig.followScale = 1;
    }
    rebuildColliders();
    player.teleport(p.position.x, p.position.z, p.position.facing);
    pet.place(p.position.x, p.position.z);
    rig.snap();
    syncUseSpots();
  }

  // ---------- Furniture that does something ----------
  const useLabel = (use: DecorUse, station?: StationId): string => {
    switch (use) {
      case 'bed': return t('act.sleepBed');
      case 'mirror': return t('act.mirror');
      case 'wardrobe': return t('act.wardrobe');
      case 'sit': return t('act.sit');
      case 'station': return t('act.station', { station: t(`station.${station}` as MessageKey) });
    }
  };
  const useDecor = (use: DecorUse, station?: StationId) => {
    ctx.commitMove();
    switch (use) {
      case 'bed': return ctx.sleep();
      case 'mirror': return void openLook('mirror');
      case 'wardrobe': return ctx.panels.openWardrobe(() => {
        ctx.panels.close();
        void openLook('wardrobe');
      });
      case 'station': return ctx.panels.openStation(station!);
      case 'sit': return ctx.bubbles.show('player', t('msg.sit'), above(ctx.avatar, 1.9), 2.5, me().name);
    }
  };
  let useIds: string[] = [];
  /** Registers an E action for each bed, mirror, wardrobe, station and seat where the player is. */
  function syncUseSpots(): void {
    for (const id of useIds) {
      ctx.interactions.remove(id);
      indoor.remove(id);
    }
    useIds = [];
    const inside = !!me().inside;
    const list = inside ? floorDecor() : game.state.decor;
    for (const d of list) {
      if (!isDecorItem(d.item)) continue;
      const def = DECOR[d.item] as { use?: DecorUse; station?: StationId; w: number; d: number };
      if (!def.use) continue;
      const w = d.rot % 2 ? def.d : def.w, dd = d.rot % 2 ? def.w : def.d;
      const id = `use-${d.id}`;
      const target = inside ? indoor : ctx.interactions;
      target.add({ id, at: () => ({ x: d.x + w / 2, z: d.z + dd / 2 }), radius: Math.max(w, dd) / 2 + 1.0, label: () => useLabel(def.use!, def.station), act: () => useDecor(def.use!, def.station) });
      useIds.push(id);
    }
  }

  // ---------- Fixed spots: the front door, the stairs, the stall ----------
  ctx.interactions.add({
    id: 'house', at: () => ({ x: HOUSE_DOOR[0], z: HOUSE_DOOR[1] }), radius: BED_REACH, label: () => t('act.enterHome'),
    act: () => {
      if (send({ type: 'home.enter' })) syncSpace();
    },
  });
  indoor.add({
    id: 'door', at: () => ({ x: DOOR_SPOT[0], z: DOOR_SPOT[1] }), radius: DOOR_REACH + 0.4, enabled: () => me().inside === 'ground', label: () => t('act.exitHome'),
    act: () => {
      if (send({ type: 'home.exit' })) syncSpace();
    },
  });
  for (const floor of FLOORS) {
    for (const s of STAIRS_ON[floor]) {
      const [x, z] = stairsSpot(s);
      const up = s.to === 'upper' || (s.to === 'ground' && floor === 'basement');
      indoor.add({
        id: `stairs-${floor}-${s.to}`, at: () => ({ x, z }), radius: STAIRS_REACH,
        enabled: () => me().inside === floor && stairsOn(me().home.level, floor).some(x => x.to === s.to),
        label: () => t(up ? 'act.stairsUp' : 'act.stairsDown'),
        act: () => {
          if (send({ type: 'home.stairs', to: s.to })) syncSpace();
        },
      });
    }
  }
  ctx.interactions.add({ id: 'player-stall', at: () => ({ x: PLAYER_STALL_SPOT[0], z: PLAYER_STALL_SPOT[1] }), radius: 1.8, label: () => t('act.stall'), act: () => ctx.panels.openStall() });
  ctx.interactions.add({
    id: 'visitor', radius: 2.2, label: () => t('act.visitor'),
    at: () => visitors.nearest(player.x, player.z, 3)?.at ?? { x: 9999, z: 9999 },
    act: () => {
      const v = visitors.nearest(player.x, player.z, 3);
      if (v) ctx.bubbles.show('visitor', pick(lines('visitor.hello')) ?? '', () => v.at.clone().setY(v.at.y + 2.0), 3.5, '🧳');
    },
  });

  // ---------- The pet's finds ----------
  let digIds: string[] = [];
  function syncDigSpots(): void {
    for (const id of digIds) ctx.interactions.remove(id);
    digIds = [];
    for (const h of game.state.hidden) {
      if (!revealed.has(h.id)) continue;
      const id = `dig-${h.id}`;
      ctx.interactions.add({
        id, at: () => ({ x: h.x, z: h.z }), radius: DIG_REACH, label: () => t('act.dig'),
        act: () => {
          if (send({ type: 'pet.dig', id: h.id })) {
            pet.cheer();
            pet.sniff = null;
          }
        },
      });
      digIds.push(id);
    }
    world.syncHidden(game.state.hidden, revealed);
  }

  // ---------- Look editors: mirror (face and hair), wardrobe (clothes), salon (everything but clothes) ----------
  async function openLook(via: 'mirror' | 'wardrobe' | 'salon'): Promise<void> {
    const p = me();
    const w = p.wardrobe;
    const options = {
      ...APPEARANCE_OPTIONS,
      outfit: [...BASE_OUTFITS, ...w.outfits],
      accessory: [...BASE_ACCESSORIES, ...w.accessories],
      topColor: [...TOP_COLORS, ...w.colors],
      bottomColor: [...BOTTOM_COLORS, ...w.colors],
      shoes: [...SHOE_COLORS, ...w.colors],
    };
    const tabs = via === 'mirror' ? (['face', 'hair'] as const) : via === 'wardrobe' ? (['clothes', 'accessory'] as const) : (['body', 'face', 'hair'] as const);
    ctx.setInputEnabled(false);
    const result = await openLookEditor(ctx.uiRoot, {
      title: t(`look.${via}.title`),
      subtitle: t(`look.${via}.subtitle`, { price: SALON_PRICE }),
      confirm: t(`look.${via}.confirm`, { price: SALON_PRICE }),
      start: p.appearance,
      tabs,
      options,
    });
    ctx.setInputEnabled(true);
    if (!result || (Object.keys(result) as (keyof Appearance)[]).every(k => result[k] === p.appearance[k])) return;
    if (send({ type: 'look.change', via, appearance: result })) ctx.toast(t('msg.lookChanged'));
  }

  // ---------- Emotes ----------
  function emote(id: EmoteId): void {
    player.playEmote(id);
    ctx.bubbles.show('emote', EMOTE_ICONS[id], above(ctx.avatar, 2.1), 1.6);
    // The nearest villager (close enough to see it) answers.
    let npc: (typeof VILLAGERS)[number]['id'] | undefined;
    let best = 4.5;
    if (!me().inside) {
      for (const v of VILLAGERS) {
        if (!isPresent(game.state, v.id)) continue;
        const at = world.villagers.positionOf(v.id);
        const d = at ? Math.hypot(at.x - player.x, at.z - player.z) : Infinity;
        if (d < best) {
          best = d;
          npc = v.id;
        }
      }
    }
    ctx.commitMove();
    const r = game.dispatch(npc ? { type: 'emote', emote: id, npc } : { type: 'emote', emote: id }, actor);
    if (r.ok && npc) {
      const at = world.villagers.positionOf(npc);
      const points = r.events.find(e => e.type === 'emoted')?.type === 'emoted' ? (r.events.find(e => e.type === 'emoted') as { points: number }).points : 0;
      if (at) ctx.bubbles.show(`emote-${npc}`, fill(pick(lines(points > 0 ? 'emote.reply' : 'emote.again')) ?? '', { player: me().name }), () => at.clone().setY(at.y + 2.1), 2.4, VILLAGERS.find(v => v.id === npc)!.name);
    }
  }

  // ---------- Decoration mode ----------
  const decorMode = new DecorMode({
    game, actor, assets: ctx.assets, uiRoot: ctx.uiRoot, canvas: ctx.canvas,
    camera: () => rig.camera,
    parent: () => (me().inside ? interior.scene : ctx.scene),
    height: (x, z) => (me().inside ? 0 : heightAt(x, z)),
    player: () => ({ x: player.x, z: player.z, facing: player.facing }),
    toast: ctx.toast, errorText: ctx.errorText, setPrompt: ctx.setPrompt, commitMove: ctx.commitMove,
    onClose: () => undefined,
  });

  // ---------- Keeping up with the game ----------
  game.on(event => {
    if ('playerId' in event && event.playerId !== actor.id) return;
    switch (event.type) {
      case 'decor.changed':
        if (event.space === 'island') world.decor.sync(game.state.decor);
        else interior.syncDecor(floorDecor());
        rebuildColliders();
        syncUseSpots();
        decorMode.refreshPicker();
        break;
      case 'home.changed':
        syncSpace();
        break;
      case 'home.upgraded':
        world.setHomeLevel(event.level);
        syncSpace(true);
        break;
      case 'world.changed':
      case 'npc.arrived':
        if (!me().inside) rebuildColliders();
        break;
      case 'inventory.changed':
        decorMode.refreshPicker();
        break;
      case 'hidden.changed':
        for (const id of [...revealed]) if (!game.state.hidden.some(h => h.id === id)) revealed.delete(id);
        syncDigSpots();
        break;
      case 'pet.changed':
        dressPet(pet.object, me().pet.accessory);
        break;
      case 'player.look':
        restyleAvatar(ctx.avatar, me().appearance);
        break;
      case 'day.started':
      case 'stars.up':
        visitors.sync(visitorsFor(game.state.stars), absoluteDay(game.state.time));
        break;
    }
  });

  // First frame: the right space, the house's size outside, the pet's accessory, today's visitors.
  world.setHomeLevel(me().home.level);
  dressPet(pet.object, me().pet.accessory);
  visitors.sync(visitorsFor(game.state.stars), absoluteDay(game.state.time));
  syncSpace(true);
  syncDigSpots();

  return {
    interior,
    decorMode,
    get inside(): boolean {
      return !!me().inside;
    },
    syncSpace,
    rebuildColliders,
    openLook,
    emote,
    /** What E does inside the house. */
    resolveIndoor(): { label: string; run: () => void } | null {
      const near = indoor.nearest(player.x, player.z, player.facing);
      if (near) return { label: near.label(), run: () => near.act() };
      const slot = me().activeSlot;
      const item = me().inventory[slot]?.item;
      if (item && eatEnergy(me(), item) > 0) return { label: t('act.eat', { item: t(`item.${item}`), energy: eatEnergy(me(), item) }), run: () => void send({ type: 'item.eat', slot }) };
      return null;
    },
    /** Floor name for the HUD while inside. */
    floorName(): string | null {
      const f: FloorId | null = me().inside;
      return f ? t(`floor.${f}`) : null;
    },
    update(dt: number, elapsed: number): void {
      if (me().inside) {
        pet.sniff = null;
        return;
      }
      visitors.update(dt, elapsed);
      sniffTimer += dt;
      if (sniffTimer < 0.3) return;
      sniffTimer = 0;
      // The pet notices finds near the player and runs to sniff the closest one.
      let nearest: { id: number; x: number; z: number; d: number } | null = null;
      for (const h of game.state.hidden) {
        const d = Math.hypot(h.x - player.x, h.z - player.z);
        if (d < SNIFF_RANGE && (!nearest || d < nearest.d)) nearest = { id: h.id, x: h.x, z: h.z, d };
      }
      if (nearest && !revealed.has(nearest.id)) {
        revealed.add(nearest.id);
        ctx.toast(t('msg.petSniff'));
        ctx.bubbles.show('pet-sniff', '❗', above(pet.object, 1.0), 1.6);
        syncDigSpots();
      }
      pet.sniff = nearest && revealed.has(nearest.id) ? { x: nearest.x, z: nearest.z } : null;
    },
  };
}

export type HomeLife = ReturnType<typeof createHomeLife>;
export { decorList };
