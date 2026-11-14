import type { AnimalKind } from '../data/animals';
import type { Appearance } from '../data/appearance';
import type { FarmCropId } from '../data/crops';
import type { FruitId } from '../data/defaults';
import type { FishSpot } from '../data/fish';
import type { BuffId, ItemId, Quality } from '../data/items';
import type { MachineKind } from '../data/recipes';
import type { SkillId } from '../data/skills';
import type { ToolId } from '../data/tools';
import type { WeatherId } from '../data/weather';
import type { ProjectId } from '../data/community';
import type { NpcId } from '../data/villagers';

/** Position in the calendar plus the time of day. Plain data, safe to save and send over the network. */
export interface GameTime {
  year: number;
  /** 0 = spring, 1 = summer, 2 = autumn, 3 = winter. */
  seasonIndex: number;
  /** Day of the season, 1 to 28. */
  day: number;
  /** Minutes since midnight of the game day (06:00 = 360, 02:00 of the next morning = 1560). */
  minuteOfDay: number;
  /** True once the clock reaches 02:00; nothing advances until someone sleeps. */
  dayEnded: boolean;
}

/**
 * Who sends a command. The same roles are used by the multiplayer server (stage 7):
 * - system: the clock, the server, scripted events
 * - host: owner of the island
 * - resident: friend who lives on a shared island
 * - visitor: friend visiting by boat, with limited permissions
 */
export type Role = 'system' | 'host' | 'resident' | 'visitor';

export interface Actor {
  id: string;
  role: Role;
}

/** Position on the ground plane plus the direction the character faces (radians around the vertical axis). */
export interface Placement2D {
  x: number;
  z: number;
  facing: number;
}

export interface ItemStack {
  item: ItemId;
  qty: number;
  /** Quality of crops (1 silver, 2 gold). Left out for common items. */
  q?: Quality;
}

/** 24 slots; null is an empty slot. The first 8 are the item bar. */
export type Inventory = (ItemStack | null)[];

export interface PlayerState {
  id: string;
  name: string;
  appearance: Appearance;
  position: Placement2D;
  coins: number;
  energy: number;
  inventory: Inventory;
  /** Selected slot of the item bar (0 to 7). */
  activeSlot: number;
  /** 1 copper, 2 silver, 3 gold, 4 crystal. */
  toolLevels: Record<ToolId, number>;
  /** Experience of each skill (the level comes from data/skills). */
  skills: Record<SkillId, number>;
  /** Bonus from today's meal, cleared when a new day starts. */
  buff: BuffId | null;
  /** A fish on the line, rolled when the line is cast. */
  fishing: { item: ItemId; spot: FishSpot } | null;
  /** Friendship with each villager (every player has their own). */
  friends: Record<NpcId, FriendState>;
  /** Letters in the mailbox, newest last. */
  mail: MailItem[];
  mailSeq: number;
}

export type GiftReaction = 'love' | 'like' | 'neutral' | 'dislike';

export interface FriendState {
  /** 100 points per heart, 0 to 1000. */
  points: number;
  /** absoluteDay of the last chat and the last gift (once a day each). */
  talkedDay: number;
  giftDay: number;
  /** Gifts already given and what they thought of them (shown in the friendship screen). */
  known: Partial<Record<ItemId, GiftReaction>>;
  lastGift: { item: ItemId; day: number } | null;
  /** Highest special scene seen (2, 4, 6, 8, 10 hearts). */
  scene: number;
  /** Highest heart level that already brought a letter with a present. */
  mailedTier: number;
}

export interface MailItem {
  id: number;
  from: NpcId | 'island';
  /** i18n key of the letter text, with its placeholders. */
  key: string;
  params: Record<string, string | number>;
  item?: ItemId;
  qty?: number;
  taken: boolean;
  read: boolean;
  day: number;
}

/** A request pinned on the village notice board. */
export interface RequestState {
  id: number;
  npc: NpcId;
  item: ItemId;
  qty: number;
  reward: number;
  /** Last day it can be delivered (-1 = no limit). */
  until: number;
  done: boolean;
}

export interface ProjectState {
  given: Partial<Record<ItemId, number>>;
  coins: number;
  done: boolean;
}

/** One planting spot of the farm. */
export interface PlotState {
  tilled: boolean;
  crop: FarmCropId | null;
  /** Watered days the crop has grown. */
  growth: number;
  ripe: boolean;
  /** Watered today (by hand, rain or a sprinkler). */
  watered: boolean;
  fertilizer: 'fertilizer' | 'growth' | null;
  /** A sprinkler stands here and waters the tiles around it every morning. */
  sprinkler: boolean;
}

export interface AnimalState {
  id: string;
  kind: AnimalKind;
  name: string;
  friendship: number;
  fedToday: boolean;
  pettedToday: boolean;
  /** A product is waiting to be picked up. */
  ready: boolean;
  /** absoluteDay of the last product (sheep give wool every other day). */
  lastProduct: number;
}

export interface MachineState {
  kind: MachineKind;
  /** What is being made, and when it is ready (absolute game minute). */
  output: ItemId | null;
  readyAt: number;
}

export type OreId = 'stone' | 'copper' | 'silver' | 'gold' | 'crystal';

/** First request: visit the beach, the orchard and the market. Stage 4 brings the villagers' requests. */
export interface QuestState {
  id: 'tour';
  visited: string[];
  done: boolean;
}

export interface IslandState {
  name: string;
  nativeFruit: FruitId;
}

/** The whole game state. Only `applyCommand` may change it. */
export interface GameState {
  /** Save format version, bumped when the shape changes. */
  version: number;
  /** Seed the island was created with. */
  seed: number;
  /** Current state of the deterministic random generator. */
  rng: number;
  time: GameTime;
  /** Weather of the current day. Rolled when a new day starts. */
  weather: WeatherId;
  island: IslandState;
  players: Record<string, PlayerState>;
  quests: QuestState[];
  /** Fruit trees that were shaken, by tree id: the day number (absoluteDay) of the last shake. */
  trees: Record<string, { shakenDay: number }>;
  /** Tomorrow's weather, rolled a day ahead so it can be shown. */
  forecast: WeatherId;
  /** Farm tiles that are not plain soil, by tile id. */
  plots: Record<string, PlotState>;
  animals: AnimalState[];
  /** Machines set down on the machine pads, by pad index. */
  machines: Record<string, MachineState>;
  /** Rocks for the pickaxe: what each holds today (null = broken) and when it comes back. */
  nodes: Record<string, { ore: OreId | null; back: number }>;
  /** Stumps, tall grass patches and beehives: absoluteDay when each is ready again (missing = ready). */
  stumps: Record<string, number>;
  grass: Record<string, number>;
  hives: Record<string, number>;
  /** What each player put in the shipping bin today (paid when the next day starts). */
  shipping: Record<string, ItemStack[]>;
  greenhouse: boolean;
  /** Notice board requests (stage 4). */
  requests: RequestState[];
  requestSeq: number;
  /** Community projects and what was given so far. */
  projects: Record<ProjectId, ProjectState>;
  /** Fish, bugs and fossils donated to the museum. */
  museum: ItemId[];
}
