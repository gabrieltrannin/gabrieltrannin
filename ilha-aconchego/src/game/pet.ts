import type * as THREE from 'three';
import { walkableHeight, type GroundFn } from '../world/collision';

/** How far behind (and to the side of) the player the pet likes to stay. */
const BEHIND = 1.1;
const SIDE = 0.55;
const TELEPORT = 8;

/**
 * The companion bunny: hops after the player and stays a little behind. It does not collide with
 * props (it squeezes past them), but it never leaves walkable ground; if it falls too far behind,
 * it pops back next to the player.
 */
export class Pet {
  private hop = 0;
  private happy = 0;
  /** Where the ground is (the island, or the floor inside the house). */
  ground: GroundFn = walkableHeight;
  /** A spot to run to and sniff (a hidden find), instead of following. */
  sniff: { x: number; z: number } | null = null;

  constructor(readonly object: THREE.Object3D, x: number, z: number) {
    object.position.set(x, walkableHeight(x, z) ?? 1.4, z);
  }

  /** Puts the pet next to the player at once (going in or out of the house). */
  place(x: number, z: number): void {
    this.object.position.set(x - 0.8, this.ground(x - 0.8, z - 0.6) ?? this.ground(x, z) ?? this.object.position.y, z - 0.6);
  }

  /** Little jump of joy (after a pat). */
  cheer(): void {
    this.happy = 0.8;
  }

  update(dt: number, player: { x: number; z: number; y: number; facing: number }): void {
    let goalX = player.x - Math.sin(player.facing) * BEHIND + Math.cos(player.facing) * SIDE;
    let goalZ = player.z - Math.cos(player.facing) * BEHIND - Math.sin(player.facing) * SIDE;
    if (this.sniff) {
      goalX = this.sniff.x - 0.45;
      goalZ = this.sniff.z + 0.2;
    }
    const p = this.object.position;
    const dx = goalX - p.x, dz = goalZ - p.z, d = Math.hypot(dx, dz);
    let moving = false;
    if (d > TELEPORT) {
      p.x = goalX;
      p.z = goalZ;
    } else if (d > 0.15) {
      const stepLength = Math.min(d, dt * (2 + d * 2));
      const nx = p.x + (dx / d) * stepLength, nz = p.z + (dz / d) * stepLength;
      const here = this.ground(p.x, p.z), there = this.ground(nx, nz);
      if (there !== null && (here === null || Math.abs(there - here) < 0.4)) {
        p.x = nx;
        p.z = nz;
        moving = true;
      } else if (d > 3) {
        p.x = goalX;
        p.z = goalZ;
      }
      this.object.rotation.y = Math.atan2(dx, dz);
    }
    this.happy = Math.max(0, this.happy - dt);
    this.hop += dt * (moving ? 7 : 0) + (this.happy > 0 ? dt * 10 : 0);
    const ground = this.ground(p.x, p.z) ?? player.y;
    // Sniffing at a find: little hops on the spot.
    const digging = this.sniff && d <= 0.2;
    p.y = ground + (moving || this.happy > 0 ? Math.abs(Math.sin(this.hop)) * 0.22 : digging ? Math.abs(Math.sin(this.hop * 2)) * 0.08 : 0);
    if (digging) this.hop += dt * 6;
  }
}
