import type { XZ } from '../data/map';
import { BRIDGE_EDGE, PATH_EDGES, PATH_NODES } from '../data/paths';

/**
 * Shortest walks on the villagers' path network (Dijkstra; the network has about 70 points).
 * Returns the points to walk through, from `from` to `to`, including both ends.
 */
export function findPath(from: XZ, to: XZ, opts: { bridge: boolean }): XZ[] {
  const ids = Object.keys(PATH_NODES);
  const dist = (a: XZ, b: XZ) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const nearest = (p: XZ) => ids.reduce((best, id) => (dist(PATH_NODES[id]!, p) < dist(PATH_NODES[best]!, p) ? id : best), ids[0]!);
  const start = nearest(from), goal = nearest(to);
  if (start === goal || dist(from, to) < dist(from, PATH_NODES[start]!) + 0.5) return [from, to];

  const adjacency = new Map<string, string[]>();
  for (const [a, b] of PATH_EDGES) {
    if (!opts.bridge && ((a === BRIDGE_EDGE[0] && b === BRIDGE_EDGE[1]) || (a === BRIDGE_EDGE[1] && b === BRIDGE_EDGE[0]))) continue;
    (adjacency.get(a) ?? adjacency.set(a, []).get(a)!).push(b);
    (adjacency.get(b) ?? adjacency.set(b, []).get(b)!).push(a);
  }
  const best = new Map<string, number>([[start, 0]]);
  const prev = new Map<string, string>();
  const open = new Set([start]);
  while (open.size) {
    let current = '';
    let currentD = Infinity;
    for (const id of open) {
      const d = best.get(id)!;
      if (d < currentD) {
        currentD = d;
        current = id;
      }
    }
    open.delete(current);
    if (current === goal) break;
    for (const next of adjacency.get(current) ?? []) {
      const d = currentD + dist(PATH_NODES[current]!, PATH_NODES[next]!);
      if (d < (best.get(next) ?? Infinity)) {
        best.set(next, d);
        prev.set(next, current);
        open.add(next);
      }
    }
  }
  if (!best.has(goal)) return [from, to];
  const route: XZ[] = [];
  for (let id: string | undefined = goal; id; id = prev.get(id)) route.unshift(PATH_NODES[id]!);
  return [from, ...route, to];
}
