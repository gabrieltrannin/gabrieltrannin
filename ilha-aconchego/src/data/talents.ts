import { MAX_SKILL_LEVEL, SKILLS, type SkillId } from './skills';

/**
 * Stage 5: the talent tree (docs/GAME_DESIGN.md, "Árvore de talentos com uma escolha a cada nível").
 * Each level of each skill offers two talents; the player keeps one. A talent adds `value` to one
 * modifier, and the rules read the sum (core/talents.ts). The text is i18n `talent.<mod>` with {value}.
 */

export type TalentMod =
  // Cultivo
  | 'seedBack' | 'extraCrop' | 'growFast' | 'quality' | 'farmEnergy' | 'cropPrice' | 'animalLove'
  // Pesca
  | 'fishZone' | 'fishRare' | 'fishDouble' | 'fishPrice' | 'castEnergy'
  // Mineração
  | 'oreBonus' | 'fossil' | 'gem' | 'mineEnergy' | 'woodBonus' | 'orePrice'
  // Cozinha
  | 'cookExtra' | 'dishEnergy' | 'dishPrice' | 'kitchenSave'
  // Ofícios
  | 'craftSave' | 'machineFast' | 'artisanPrice' | 'stallChance' | 'stallPrice'
  // Carisma
  | 'friendTalk' | 'giftBonus' | 'shopDiscount' | 'sellBonus' | 'requestBonus' | 'petFind';

export interface Talent {
  id: string;
  skill: SkillId;
  level: number;
  mod: TalentMod;
  value: number;
}

type Row = readonly [readonly [TalentMod, number], readonly [TalentMod, number]];

/** Two choices per level, from level 1 to 10. Values are percentages, except energy, `petFind` (spots) and `fishZone` (points). */
const TREE: Record<SkillId, readonly Row[]> = {
  farming: [
    [['seedBack', 10], ['growFast', 5]],
    [['quality', 5], ['farmEnergy', 1]],
    [['extraCrop', 8], ['animalLove', 15]],
    [['cropPrice', 5], ['seedBack', 10]],
    [['growFast', 5], ['quality', 5]],
    [['farmEnergy', 1], ['extraCrop', 8]],
    [['animalLove', 15], ['cropPrice', 5]],
    [['seedBack', 15], ['growFast', 5]],
    [['quality', 8], ['extraCrop', 10]],
    [['cropPrice', 10], ['growFast', 10]],
  ],
  fishing: [
    [['fishZone', 5], ['fishPrice', 5]],
    [['fishRare', 15], ['castEnergy', 1]],
    [['fishDouble', 5], ['fishZone', 5]],
    [['fishPrice', 5], ['fishRare', 15]],
    [['castEnergy', 1], ['fishDouble', 5]],
    [['fishZone', 8], ['fishPrice', 8]],
    [['fishRare', 20], ['fishDouble', 5]],
    [['castEnergy', 1], ['fishZone', 8]],
    [['fishDouble', 8], ['fishPrice', 10]],
    [['fishRare', 25], ['fishZone', 10]],
  ],
  mining: [
    [['oreBonus', 8], ['woodBonus', 10]],
    [['mineEnergy', 1], ['fossil', 3]],
    [['gem', 10], ['orePrice', 5]],
    [['woodBonus', 10], ['oreBonus', 8]],
    [['fossil', 3], ['mineEnergy', 1]],
    [['orePrice', 8], ['gem', 10]],
    [['oreBonus', 10], ['woodBonus', 15]],
    [['mineEnergy', 1], ['fossil', 4]],
    [['gem', 15], ['oreBonus', 10]],
    [['orePrice', 10], ['fossil', 5]],
  ],
  cooking: [
    [['cookExtra', 8], ['dishEnergy', 8]],
    [['dishPrice', 5], ['kitchenSave', 8]],
    [['dishEnergy', 8], ['cookExtra', 8]],
    [['kitchenSave', 8], ['dishPrice', 5]],
    [['cookExtra', 10], ['dishEnergy', 10]],
    [['dishPrice', 8], ['kitchenSave', 10]],
    [['dishEnergy', 10], ['cookExtra', 10]],
    [['kitchenSave', 10], ['dishPrice', 8]],
    [['cookExtra', 12], ['dishEnergy', 12]],
    [['dishPrice', 10], ['kitchenSave', 12]],
  ],
  crafting: [
    [['craftSave', 8], ['machineFast', 5]],
    [['artisanPrice', 5], ['stallChance', 10]],
    [['stallPrice', 5], ['craftSave', 8]],
    [['machineFast', 5], ['artisanPrice', 5]],
    [['stallChance', 10], ['stallPrice', 5]],
    [['craftSave', 10], ['machineFast', 8]],
    [['artisanPrice', 8], ['stallChance', 10]],
    [['stallPrice', 8], ['craftSave', 10]],
    [['machineFast', 10], ['artisanPrice', 10]],
    [['stallChance', 15], ['stallPrice', 10]],
  ],
  charisma: [
    [['friendTalk', 10], ['giftBonus', 10]],
    [['shopDiscount', 5], ['sellBonus', 3]],
    [['requestBonus', 10], ['petFind', 1]],
    [['giftBonus', 10], ['friendTalk', 10]],
    [['sellBonus', 3], ['shopDiscount', 5]],
    [['petFind', 1], ['requestBonus', 15]],
    [['friendTalk', 15], ['giftBonus', 15]],
    [['shopDiscount', 5], ['sellBonus', 4]],
    [['requestBonus', 15], ['petFind', 1]],
    [['giftBonus', 20], ['friendTalk', 20]],
  ],
};

export const TALENTS: readonly Talent[] = SKILLS.flatMap(skill =>
  TREE[skill].slice(0, MAX_SKILL_LEVEL).flatMap((row, i) => row.map(([mod, value], pick) => ({ id: `${skill}.${i + 1}.${pick}`, skill, level: i + 1, mod, value }))),
);
export const talentById = (id: unknown): Talent | undefined => TALENTS.find(t => t.id === id);
export const talentsAt = (skill: SkillId, level: number): Talent[] => TALENTS.filter(t => t.skill === skill && t.level === level);

/** Modifiers measured in whole points (not percent). */
export const FLAT_MODS: ReadonlySet<TalentMod> = new Set(['farmEnergy', 'castEnergy', 'mineEnergy', 'petFind', 'fishZone']);
