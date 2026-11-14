import * as THREE from 'three';
import { findPath } from '../core/pathfinding';
import type { GameState } from '../core/types';
import { villagerSpot } from '../core/villagers';
import type { XZ } from '../data/map';
import { VILLAGERS, type NpcId, type PlaceId } from '../data/villagers';
import { animateAvatar } from '../render/avatar';
import { buildVillager } from '../render/villager';
import { heightAt } from './terrain';

const SPEED = 1.7;
/** Places where the villager stands behind a counter, facing the customers (south). */
const COUNTERS = new Set<PlaceId>(['stall.bread', 'stall.honey', 'stall.flowers', 'seeds', 'forge']);

interface Agent {
  id: NpcId;
  object: THREE.Group;
  place: PlaceId | null;
  path: XZ[];
  step: number;
  phase: number;
  move: number;
  inside: boolean;
  talking: THREE.Vector3 | null;
  idleFacing: number;
}

/**
 * The villagers walking around: each follows their routine (by the clock and the weather), walks the
 * path network to the next place, goes inside when home, and turns to face the player while talking.
 */
export class VillagerAgents {
  readonly root = new THREE.Group();
  private readonly agents = new Map<NpcId, Agent>();

  constructor() {
    this.root.name = 'villagers';
    for (const def of VILLAGERS) {
      const object = buildVillager(def);
      this.root.add(object);
      this.agents.set(def.id, { id: def.id, object, place: null, path: [], step: 0, phase: Math.random() * 6, move: 0, inside: false, talking: null, idleFacing: 0 });
    }
  }

  /**
   * Updates where everyone is heading. `teleport` puts them straight there (new day, time jumps,
   * loading the game); otherwise they walk.
   */
  sync(state: Readonly<GameState>, teleport = false): void {
    const bridge = state.projects.bridge.done;
    for (const agent of this.agents.values()) {
      const spot = villagerSpot(state, agent.id);
      if (!teleport && spot.place === agent.place) continue;
      agent.place = spot.place;
      const target = spot.at;
      const o = agent.object;
      if (teleport) {
        o.position.set(target[0], heightAt(target[0], target[1]), target[1]);
        agent.path = [];
        agent.inside = spot.place === 'home';
      } else {
        // Leaving home: step out of the door first.
        if (agent.inside) {
          agent.inside = false;
          o.position.set(o.position.x, heightAt(o.position.x, o.position.z), o.position.z);
        }
        agent.path = findPath([o.position.x, o.position.z], target, { bridge });
        agent.step = 1;
      }
      agent.idleFacing = COUNTERS.has(spot.place) ? 0 : (agent.id.length * 1.3) % (Math.PI * 2) - Math.PI / 2;
      o.visible = !agent.inside;
    }
  }

  /** Where a villager stands right now, or null when they are inside their house. */
  positionOf(id: NpcId): THREE.Vector3 | null {
    const agent = this.agents.get(id)!;
    return agent.inside ? null : agent.object.position;
  }

  /** Stops a villager and turns them toward the player (null lets them walk on). */
  setTalking(id: NpcId, toward: THREE.Vector3 | null): void {
    const agent = this.agents.get(id);
    if (agent) agent.talking = toward ? toward.clone() : null;
  }

  update(dt: number, elapsed: number): void {
    for (const agent of this.agents.values()) {
      const o = agent.object;
      let moving = false;
      if (agent.talking) {
        this.turn(agent, Math.atan2(agent.talking.x - o.position.x, agent.talking.z - o.position.z), dt);
      } else if (agent.step > 0 && agent.step < agent.path.length) {
        const [tx, tz] = agent.path[agent.step]!;
        const dx = tx - o.position.x, dz = tz - o.position.z, d = Math.hypot(dx, dz);
        if (d < 0.05) agent.step++;
        else {
          const move = Math.min(d, SPEED * dt);
          o.position.x += (dx / d) * move;
          o.position.z += (dz / d) * move;
          this.turn(agent, Math.atan2(dx, dz), dt);
          moving = true;
        }
        if (agent.step >= agent.path.length) {
          agent.step = 0;
          if (agent.place === 'home') {
            agent.inside = true;
            o.visible = false;
          }
        }
      } else if (!agent.inside) {
        this.turn(agent, agent.idleFacing, dt);
      }
      o.position.y = heightAt(o.position.x, o.position.z);
      agent.move += ((moving ? 1 : 0) - agent.move) * Math.min(1, dt * 8);
      if (moving) agent.phase += dt * 9;
      if (o.visible) animateAvatar(o, agent.phase, agent.move, 0, elapsed + agent.id.length);
    }
  }

  private turn(agent: Agent, target: number, dt: number): void {
    const o = agent.object;
    const diff = Math.atan2(Math.sin(target - o.rotation.y), Math.cos(target - o.rotation.y));
    o.rotation.y += diff * Math.min(1, dt * 8);
  }
}
