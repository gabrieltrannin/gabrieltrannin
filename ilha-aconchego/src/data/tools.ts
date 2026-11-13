import type { ItemId } from './items';

/** The six tools and their four levels (docs/GAME_DESIGN.md, "Talentos e progressão"). */
export const TOOLS = ['hoe', 'wateringCan', 'axe', 'pickaxe', 'fishingRod', 'bugNet'] as const;
export type ToolId = (typeof TOOLS)[number];
export const toolItem = (tool: ToolId): ItemId => `tool.${tool}`;
export function toolOfItem(item: ItemId | null | undefined): ToolId | null {
  if (!item || !item.startsWith('tool.')) return null;
  return item.slice(5) as ToolId;
}

/** 1 copper, 2 silver, 3 gold, 4 crystal. */
export const TOOL_LEVELS = ['copper', 'silver', 'gold', 'crystal'] as const;
export const MAX_TOOL_LEVEL = 4;

/** Energy each use costs at copper level; every level above saves one point (never below 1). */
export const TOOL_ENERGY: Record<ToolId, number> = { hoe: 3, wateringCan: 2, axe: 4, pickaxe: 4, fishingRod: 3, bugNet: 2 };
export const toolEnergy = (tool: ToolId, level: number): number => Math.max(1, TOOL_ENERGY[tool] - (level - 1));

/**
 * Farm tiles a hoe or watering can reaches at each level: the tile in front, then the whole row of
 * three, then a 3 x 3 square, then the whole bed.
 */
export type ToolArea = 'tile' | 'row' | 'square' | 'bed';
export const TOOL_AREA: readonly ToolArea[] = ['tile', 'tile', 'row', 'square', 'bed'];

/** What Bento asks to take a tool to the next level (index = level it reaches). */
export const UPGRADE_COST: readonly ({ coins: number; item: ItemId; qty: number } | null)[] = [
  null,
  null,
  { coins: 600, item: 'res.copper', qty: 5 },
  { coins: 1500, item: 'res.silver', qty: 5 },
  { coins: 4000, item: 'res.gold', qty: 5 },
];
