import type { Appearance } from './appearance';
import type { SeasonId } from './calendar';
import type { ItemId, ItemKind } from './items';
import { BENTO_SPOT, type XZ } from './map';
import { HOUSE_SPOTS, houseDoor, MUSEUM_DOOR, NOTICE_BOARD, SEED_SHOP_COUNTER, WELL, BRIDGE_SIGN } from './village';

/**
 * The 12 villagers (docs/GAME_DESIGN.md, "Moradores"): animals with clothes, each with a house,
 * a daily routine (with a rainy-day version), a personality, gift tastes and a birthday.
 * Lumi, Pipo, Celeste and Bento come from the design document; the other eight are new.
 */

export const NPC_IDS = ['lumi', 'pipo', 'celeste', 'bento', 'flora', 'dudu', 'margo', 'tico', 'juca', 'lino', 'perola', 'nico'] as const;
export type NpcId = (typeof NPC_IDS)[number];
export const isNpcId = (v: unknown): v is NpcId => typeof v === 'string' && (NPC_IDS as readonly string[]).includes(v);

export type Species = 'fox' | 'otter' | 'owl' | 'badger' | 'rabbit' | 'bear' | 'sheep' | 'dog' | 'frog' | 'turtle' | 'cat' | 'squirrel';
/** Personality groups share their everyday lines (see i18n dialogue). */
export type Personality = 'cheerful' | 'sweet' | 'serious' | 'dreamy';
export type Extra = 'apron' | 'mailbag' | 'glasses' | 'scarf' | 'beret' | 'hardhat' | 'bandana';

/** Where villagers can be. Places marked `vendor` are behind a shop counter. */
export const PLACES = {
  'stall.bread': [7.2, -1.5],
  'stall.honey': [10.3, -1.5],
  'stall.flowers': [13.4, -1.5],
  forge: BENTO_SPOT,
  seeds: [SEED_SHOP_COUNTER[0], SEED_SHOP_COUNTER[1] - 0.8],
  pier: [10.0, 21.0],
  pond: [11.0, 10.6],
  pondNorth: [12.4, 9.1],
  bench: [1.5, 10.5],
  lawn: [-1.6, 9.6],
  tables: [7.9, 5.2],
  tables2: [12.6, 5.4],
  plaza: [10.3, 2.8],
  orchard: [-8.7, -8.0],
  orchard2: [-1.1, -8.0],
  hives: [4.3, -9.4],
  beach: [4.0, 15.6],
  beachWest: [-4.0, 15.9],
  farm: [-3.0, 6.4],
  grass: [-8.5, 8.4],
  mailbox: [-9.8, -0.4],
  villagePlaza: [29.2, -2.4],
  board: [NOTICE_BOARD[0] + 0.2, NOTICE_BOARD[1] + 0.9],
  well: [WELL[0] + 0.9, WELL[1] + 0.4],
  museum: [MUSEUM_DOOR[0], MUSEUM_DOOR[1] + 0.5],
  bridgeSign: [BRIDGE_SIGN[0] + 0.6, BRIDGE_SIGN[1] + 0.5],
  villageLawn: [36.2, 4.4],
  lookout: [43.0, 0.4],
  wood: [34.5, -23.0],
  woodGrove: [31.2, -22.0],
} as const satisfies Record<string, XZ>;
export type PlaceId = keyof typeof PLACES | 'home';

/** One step of a routine: from this minute of the day on, be at this place. */
export type Routine = readonly (readonly [minute: number, place: PlaceId])[];

export interface GiftTastes {
  love: readonly ItemId[];
  like: readonly (ItemId | ItemKind)[];
  dislike: readonly (ItemId | ItemKind)[];
}

export interface VillagerDef {
  id: NpcId;
  name: string;
  /** For words like "obrigada/obrigado" in their lines. */
  gender: 'f' | 'm';
  /** What they send by mail when the friendship grows. */
  present: ItemId;
  species: Species;
  personality: Personality;
  /** Their job, shown in the friendship screen (i18n key `npc.job.<id>`). */
  look: Appearance;
  extra?: Extra;
  /** Fur, feathers or skin color of the head features (ears, tail, snout). */
  fur: string;
  muzzle: string;
  routine: Routine;
  /** Routine on rainy and stormy days (missing = same as usual). */
  rain?: Routine;
  /** Shop they run: open while they stand at it. */
  shop?: 'bread' | 'honey' | 'flowers' | 'seeds' | 'smithy';
  gifts: GiftTastes;
  birthday: { season: SeasonId; day: number };
  /** Pitch of their babble (1 = middle). */
  pitch: number;
  /** Icon for lists (emoji). */
  icon: string;
  /** Things to ask for on the notice board. */
  asks: readonly ItemId[];
}

const look = (a: Partial<Appearance>): Appearance => ({
  species: 'human', skin: '#F8D9C0', eyes: 'round', eyeColor: '#2A1E1E', mouth: 'smile', blush: true, hairStyle: 'short', hairColor: '#8B5A3C',
  outfit: 'tshirt', topColor: '#F6EBD9', bottomColor: '#3E5C8A', shoes: '#5A3B2E', accessory: 'none', ...a,
});

export const VILLAGERS: readonly VillagerDef[] = [
  {
    id: 'lumi', gender: 'f', present: 'dish.bread', name: 'Lumi', species: 'fox', personality: 'cheerful', icon: '🦊', pitch: 1.25,
    fur: '#E8833A', muzzle: '#FFF4E6', extra: 'apron',
    look: look({ skin: '#E8833A', hairColor: '#E8833A', eyes: 'sparkle', eyeColor: '#5A3B22', outfit: 'dress', topColor: '#F27BA5', bottomColor: '#F6EBD9', shoes: '#7A4E2C' }),
    routine: [[360, 'home'], [450, 'stall.bread'], [1020, 'tables'], [1140, 'villagePlaza'], [1260, 'home']],
    shop: 'bread',
    gifts: { love: ['dish.blackberryPie', 'dish.strawberryPie', 'crop.strawberry'], like: ['crop.wheat', 'animal.egg', 'animal.milk', 'dish.bread', 'dish.pancakes'], dislike: ['res.stone', 'fish'] },
    birthday: { season: 'spring', day: 9 },
    asks: ['crop.strawberry', 'crop.wheat', 'animal.egg', 'animal.milk', 'animal.honey'],
  },
  {
    id: 'pipo', gender: 'm', present: 'fish.sardine', name: 'Pipo', species: 'otter', personality: 'dreamy', icon: '🦦', pitch: 0.9,
    fur: '#8A6142', muzzle: '#E8D6BE', extra: 'bandana',
    look: look({ skin: '#8A6142', hairColor: '#8A6142', eyes: 'sleepy', outfit: 'overalls', topColor: '#F2C14E', bottomColor: '#3E7A8A', accessory: 'beanie' }),
    routine: [[360, 'pier'], [720, 'pond'], [960, 'pier'], [1200, 'home']],
    rain: [[360, 'pier'], [1260, 'home']],
    gifts: { love: ['fish.moonfish', 'fish.goldfish', 'dish.grilledFish'], like: ['fish', 'animal.egg', 'dish.popcorn'], dislike: ['crop.kale', 'res.hay'] },
    birthday: { season: 'summer', day: 4 },
    asks: ['fish.sardine', 'fish.crab', 'fish.seabass', 'fish.lambari'],
  },
  {
    id: 'celeste', gender: 'f', present: 'res.fossil', name: 'Celeste', species: 'owl', personality: 'serious', icon: '🦉', pitch: 1.1,
    fur: '#B8A27A', muzzle: '#F2E6CF', extra: 'glasses',
    look: look({ skin: '#B8A27A', hairColor: '#B8A27A', eyes: 'round', eyeColor: '#C98A1E', mouth: 'calm', outfit: 'hoodie', topColor: '#7C4DA6', bottomColor: '#4A3A5E', blush: false }),
    routine: [[360, 'home'], [480, 'museum'], [1080, 'well'], [1200, 'pondNorth'], [1380, 'home']],
    rain: [[360, 'home'], [480, 'museum'], [1260, 'home']],
    gifts: { love: ['res.fossil', 'res.crystal', 'bug.beetle'], like: ['bug', 'res.gold', 'dish.honeyCake', 'artisan.yarn'], dislike: ['res.hay', 'crop.corn'] },
    birthday: { season: 'autumn', day: 21 },
    asks: ['res.fossil', 'bug.butterfly', 'res.copper', 'bug.ladybug'],
  },
  {
    id: 'bento', gender: 'm', present: 'res.copper', name: 'Bento', species: 'badger', personality: 'serious', icon: '🦡', pitch: 0.7,
    fur: '#7D7A80', muzzle: '#F4F1EA', extra: 'apron',
    look: look({ skin: '#7D7A80', hairColor: '#3B393E', eyes: 'dot', mouth: 'smile', outfit: 'tshirt', topColor: '#8A5A3C', bottomColor: '#3B393E', blush: false }),
    routine: [[360, 'home'], [420, 'forge'], [1080, 'tables2'], [1200, 'home']],
    shop: 'smithy',
    gifts: { love: ['res.crystal', 'res.gold', 'dish.kaleStew'], like: ['res.copper', 'res.silver', 'artisan.cheese', 'dish.popcorn', 'dish.bread'], dislike: ['bug', 'flower.rose'] },
    birthday: { season: 'winter', day: 7 },
    asks: ['res.copper', 'res.stone', 'res.wood', 'res.silver'],
  },
  {
    id: 'flora', gender: 'f', present: 'seed.carrot', name: 'Flora', species: 'rabbit', personality: 'cheerful', icon: '🐰', pitch: 1.4,
    fur: '#F4EEE6', muzzle: '#FFFFFF', extra: 'scarf',
    look: look({ skin: '#F4EEE6', hairColor: '#F4EEE6', eyes: 'happy', eyeColor: '#B0446A', outfit: 'overalls', topColor: '#FFD166', bottomColor: '#5E9C42', accessory: 'flowerCrown' }),
    routine: [[360, 'home'], [450, 'seeds'], [1020, 'farm'], [1110, 'villageLawn'], [1230, 'home']],
    shop: 'seeds',
    gifts: { love: ['flower.sunflower', 'crop.carrot', 'dish.salad'], like: ['crop', 'flower', 'supply.fertilizer'], dislike: ['fish', 'res.stone'] },
    birthday: { season: 'spring', day: 18 },
    asks: ['crop.carrot', 'crop.lettuce', 'crop.tomato', 'crop.pumpkin', 'crop.cabbage', 'crop.kale'],
  },
  {
    id: 'dudu', gender: 'm', present: 'animal.honey', name: 'Dudu', species: 'bear', personality: 'sweet', icon: '🐻', pitch: 0.75,
    fur: '#7B5236', muzzle: '#E3C49A', extra: 'scarf',
    look: look({ skin: '#7B5236', hairColor: '#7B5236', eyes: 'sleepy', outfit: 'tshirt', topColor: '#F2B33D', bottomColor: '#6B4F3F' }),
    routine: [[360, 'home'], [390, 'hives'], [540, 'stall.honey'], [1020, 'bench'], [1140, 'home']],
    rain: [[360, 'home'], [540, 'stall.honey'], [1080, 'home']],
    shop: 'honey',
    gifts: { love: ['animal.honey', 'dish.honeyCake', 'dish.pancakes'], like: ['fruit', 'dish', 'bug.bee'], dislike: ['res.copper', 'crop.lettuce'] },
    birthday: { season: 'summer', day: 22 },
    asks: ['animal.honey', 'fruit.peach', 'fruit.apple', 'animal.milk'],
  },
  {
    id: 'margo', gender: 'f', present: 'flower.tulip', name: 'Margô', species: 'sheep', personality: 'sweet', icon: '🐑', pitch: 1.15,
    fur: '#F7F3EA', muzzle: '#4A4040', extra: 'beret',
    look: look({ skin: '#4A4040', hairColor: '#F7F3EA', hairStyle: 'bob', eyes: 'round', eyeColor: '#2A1E1E', outfit: 'dress', topColor: '#B892FF', bottomColor: '#F6EBD9' }),
    routine: [[360, 'home'], [480, 'stall.flowers'], [960, 'villagePlaza'], [1140, 'home']],
    rain: [[360, 'home'], [480, 'stall.flowers'], [960, 'museum'], [1140, 'home']],
    shop: 'flowers',
    gifts: { love: ['flower.rose', 'artisan.yarn', 'artisan.juice'], like: ['flower', 'fruit', 'dish.strawberryPie'], dislike: ['fish', 'res.wood'] },
    birthday: { season: 'spring', day: 27 },
    asks: ['animal.wool', 'fruit.cherry', 'crop.strawberry', 'artisan.yarn'],
  },
  {
    id: 'tico', gender: 'm', present: 'dish.omelet', name: 'Tico', species: 'dog', personality: 'cheerful', icon: '🐶', pitch: 1.05,
    fur: '#D9A86C', muzzle: '#FFF4E6', extra: 'mailbag',
    look: look({ skin: '#D9A86C', hairColor: '#8A5A3C', eyes: 'sparkle', outfit: 'tshirt', topColor: '#5B8DD9', bottomColor: '#2E3A5A', accessory: 'beanie' }),
    routine: [[360, 'home'], [420, 'mailbox'], [480, 'villagePlaza'], [600, 'plaza'], [720, 'pier'], [840, 'farm'], [960, 'board'], [1080, 'tables'], [1200, 'home']],
    gifts: { love: ['dish.omelet', 'dish.cheeseToast'], like: ['dish', 'crop.corn', 'animal.egg'], dislike: ['bug', 'crop.kale'] },
    birthday: { season: 'autumn', day: 3 },
    asks: ['animal.egg', 'crop.corn', 'dish.bread'],
  },
  {
    id: 'juca', gender: 'm', present: 'bug.firefly', name: 'Juca', species: 'frog', personality: 'dreamy', icon: '🐸', pitch: 0.85,
    fur: '#7CB35A', muzzle: '#E6F2C8',
    look: look({ skin: '#7CB35A', hairColor: '#7CB35A', eyes: 'happy', mouth: 'laugh', outfit: 'tshirt', topColor: '#E5484D', bottomColor: '#3E5C8A', accessory: 'strawHat', blush: false }),
    routine: [[360, 'home'], [540, 'pond'], [780, 'lawn'], [1020, 'pondNorth'], [1320, 'home']],
    rain: [[360, 'pond'], [1320, 'home']],
    gifts: { love: ['bug.firefly', 'dish.popcorn', 'bug.snail'], like: ['bug', 'fish', 'flower'], dislike: ['res.crystal', 'dish.salad'] },
    birthday: { season: 'summer', day: 13 },
    asks: ['bug.snail', 'bug.firefly', 'fish.carp', 'fish.tilapia'],
  },
  {
    id: 'lino', gender: 'm', present: 'res.wood', name: 'Lino', species: 'turtle', personality: 'serious', icon: '🐢', pitch: 0.65,
    fur: '#9BAA6A', muzzle: '#D9E2B0', extra: 'hardhat',
    look: look({ skin: '#9BAA6A', hairColor: '#9BAA6A', eyes: 'dot', mouth: 'calm', outfit: 'overalls', topColor: '#F6EBD9', bottomColor: '#B07A4A', blush: false }),
    routine: [[360, 'home'], [480, 'board'], [720, 'bridgeSign'], [1020, 'villagePlaza'], [1140, 'home']],
    rain: [[360, 'home'], [480, 'board'], [960, 'home']],
    gifts: { love: ['dish.pumpkinSoup', 'crop.cabbage', 'res.wood'], like: ['resource', 'crop', 'dish.bread'], dislike: ['dish.popcorn', 'bug'] },
    birthday: { season: 'winter', day: 15 },
    asks: ['res.wood', 'res.stone', 'crop.pumpkin', 'crop.cabbage'],
  },
  {
    id: 'perola', gender: 'f', present: 'flower.daisy', name: 'Pérola', species: 'cat', personality: 'sweet', icon: '🐱', pitch: 1.3,
    fur: '#A6A1B2', muzzle: '#F4F1EA', extra: 'beret',
    look: look({ skin: '#A6A1B2', hairColor: '#6E6A7A', eyes: 'sparkle', eyeColor: '#3E8A6A', outfit: 'dress', topColor: '#3E5C8A', bottomColor: '#F6EBD9', accessory: 'bow' }),
    routine: [[360, 'home'], [540, 'lawn'], [720, 'orchard'], [960, 'beach'], [1140, 'villageLawn'], [1260, 'home']],
    rain: [[360, 'home'], [600, 'museum'], [1080, 'home']],
    gifts: { love: ['bug.butterfly', 'flower.tulip', 'artisan.cheese'], like: ['flower', 'fruit', 'fish.sardine', 'animal.milk'], dislike: ['res.stone', 'res.hay'] },
    birthday: { season: 'autumn', day: 12 },
    asks: ['bug.butterfly', 'animal.milk', 'fish.sardine', 'fruit.orange'],
  },
  {
    id: 'nico', gender: 'm', present: 'fruit.cherry', name: 'Nico', species: 'squirrel', personality: 'cheerful', icon: '🐿️', pitch: 1.45,
    fur: '#C46A2E', muzzle: '#F6E3C4',
    look: look({ skin: '#C46A2E', hairColor: '#C46A2E', eyes: 'happy', mouth: 'cat', outfit: 'hoodie', topColor: '#5E9C42', bottomColor: '#6B4F3F', accessory: 'sprout' }),
    routine: [[360, 'orchard2'], [660, 'plaza'], [840, 'grass'], [1020, 'wood'], [1170, 'home']],
    rain: [[360, 'home'], [660, 'museum'], [1020, 'home']],
    gifts: { love: ['crop.corn', 'dish.popcorn', 'fruit.cherry'], like: ['fruit', 'res.wood', 'crop.wheat'], dislike: ['dish.salad', 'crop.lettuce'] },
    birthday: { season: 'winter', day: 25 },
    asks: ['crop.corn', 'fruit.apple', 'res.wood', 'crop.wheat'],
  },
];

export const villager = (id: NpcId): VillagerDef => VILLAGERS.find(v => v.id === id)!;
export const homeOf = (id: NpcId): XZ => houseDoor(HOUSE_SPOTS.find(h => h.npc === id)!);

/** Friendship: 100 points per heart, 10 hearts. */
export const HEART_POINTS = 100;
export const MAX_HEARTS = 10;
export const FRIEND_POINTS = { talk: 20, love: 80, like: 45, neutral: 20, dislike: -20, request: 100, birthdayBonus: 2 } as const;
export const hearts = (points: number): number => Math.min(MAX_HEARTS, Math.floor(points / HEART_POINTS));
