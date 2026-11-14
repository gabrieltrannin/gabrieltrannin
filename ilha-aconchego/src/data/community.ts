import type { ItemId } from './items';
import type { NpcId } from './villagers';

/**
 * Village requests (the notice board) and community projects (docs/GAME_DESIGN.md, "Vila e amizades").
 * Projects open new places and shops when the island gathers what they need.
 */
export const PROJECT_IDS = ['bridge', 'museum', 'seeds'] as const;
export type ProjectId = (typeof PROJECT_IDS)[number];

export interface ProjectDef {
  id: ProjectId;
  /** Who leads it (and writes the thank-you letter). */
  npc: NpcId;
  needs: readonly { item: ItemId; qty: number }[];
  coins: number;
}

export const PROJECTS: readonly ProjectDef[] = [
  { id: 'bridge', npc: 'lino', needs: [{ item: 'res.wood', qty: 40 }, { item: 'res.stone', qty: 20 }], coins: 1500 },
  { id: 'museum', npc: 'celeste', needs: [{ item: 'res.stone', qty: 30 }, { item: 'res.copper', qty: 8 }, { item: 'res.fossil', qty: 1 }], coins: 2000 },
  { id: 'seeds', npc: 'flora', needs: [{ item: 'res.wood', qty: 25 }, { item: 'supply.fertilizer', qty: 5 }], coins: 1200 },
];
export const isProjectId = (v: unknown): v is ProjectId => typeof v === 'string' && (PROJECT_IDS as readonly string[]).includes(v);

/** The first request of the game (docs: "a Lumi pede 3 morangos; ao entregar, 300 moedas"). */
export const FIRST_REQUEST = { npc: 'lumi' as NpcId, item: 'crop.strawberry' as ItemId, qty: 3, reward: 300 };
export const MAX_REQUESTS = 3;
export const REQUEST_DAYS = 4;

/** What the museum keeps: one of each fish, bug and the fossils. */
export const MUSEUM_KINDS = ['fish', 'bug'] as const;
export const MUSEUM_EXTRA: readonly ItemId[] = ['res.fossil'];
