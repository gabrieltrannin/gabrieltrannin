/** Six skills that grow with use (docs/GAME_DESIGN.md, "Talentos e progressão"). */
export const SKILLS = ['farming', 'fishing', 'mining', 'cooking', 'crafting', 'charisma'] as const;
export type SkillId = (typeof SKILLS)[number];

export const MAX_SKILL_LEVEL = 10;
/** Total experience needed to reach each level (index = level). */
export const SKILL_XP: readonly number[] = [0, 60, 160, 320, 540, 820, 1160, 1560, 2040, 2600, 3240];

export function skillLevel(xp: number): number {
  let level = 0;
  while (level < MAX_SKILL_LEVEL && xp >= SKILL_XP[level + 1]!) level++;
  return level;
}

/** Experience for each action. */
export const XP = {
  till: 1,
  plant: 2,
  water: 1,
  fishCatch: 12,
  mine: 6,
  chop: 4,
  cook: 14,
  craft: 12,
  feed: 3,
  pet: 5,
  collectAnimal: 4,
  bug: 8,
  machine: 6,
} as const;
