/**
 * Things the player can act on with E / the Ação button. Each one registers where it is, how close
 * the player must be and what the prompt says. Pure logic (no Three.js), so it is easy to test.
 */
export interface Interactable {
  id: string;
  /** Current position on the ground (a function, because some things move, like the pet). */
  at(): { x: number; z: number };
  /** How close the player must be. */
  radius: number;
  /** Text after "E ·", already translated. */
  label(): string;
  /** Hidden from the prompt when it returns false (e.g. a tree with no fruit left). */
  enabled?(): boolean;
  act(): void;
}

/** Anything closer than this counts even if it is a bit behind the player. */
const ALWAYS_CLOSE = 0.9;
/** Half-width of the "in front" cone, in radians (about 75°). */
const FRONT_CONE = 1.3;

export class Interactions {
  private readonly items = new Map<string, Interactable>();

  add(item: Interactable): void {
    this.items.set(item.id, item);
  }

  remove(id: string): void {
    this.items.delete(id);
  }

  /**
   * The best target for a player at (x, z) facing `facing` (0 = toward +z): within reach, in front,
   * and preferring what is closest and most straight ahead.
   */
  nearest(x: number, z: number, facing: number): Interactable | null {
    let best: Interactable | null = null;
    let bestScore = Infinity;
    const fx = Math.sin(facing), fz = Math.cos(facing);
    for (const item of this.items.values()) {
      if (item.enabled && !item.enabled()) continue;
      const p = item.at();
      const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
      if (d > item.radius) continue;
      const angle = d < 1e-6 ? 0 : Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d)));
      if (d > ALWAYS_CLOSE && angle > FRONT_CONE) continue;
      const score = d + angle * 0.8;
      if (score < bestScore) {
        bestScore = score;
        best = item;
      }
    }
    return best;
  }
}
