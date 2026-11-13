import * as THREE from 'three';
import type { SeasonId } from '../data/calendar';
import type { InputFrame } from '../input/input';
import { animateAvatar } from '../render/avatar';
import { step, walkableHeight, type Collider } from '../world/collision';

const WALK_SPEED = 3.2;
const RUN_SPEED = 5.6;
/** Longest single collision step, so fast frames cannot pass through thin obstacles. */
const MAX_SUBSTEP = 0.2;
const TURN_RATE = 12;

/**
 * Moves the player's character from input: relative to the camera, sliding along obstacles,
 * turning smoothly, with walk, run and idle animations. Reports when the position should be
 * committed to the game state (not every frame).
 */
export class PlayerController {
  facing: number;
  private phase = 0;
  private moveBlend = 0;
  private runBlend = 0;
  private time = 0;
  private dirty = false;

  constructor(
    readonly object: THREE.Object3D,
    private readonly colliders: readonly Collider[],
    start: { x: number; z: number; facing: number },
  ) {
    this.facing = start.facing;
    object.position.set(start.x, walkableHeight(start.x, start.z) ?? 1.4, start.z);
    object.rotation.y = this.facing;
  }

  get x(): number {
    return this.object.position.x;
  }

  get z(): number {
    return this.object.position.z;
  }

  /** Puts the character somewhere at once (waking up at the door, for example). */
  teleport(x: number, z: number, facing: number): void {
    this.object.position.set(x, walkableHeight(x, z) ?? this.object.position.y, z);
    this.facing = facing;
    this.object.rotation.y = facing;
    this.dirty = true;
  }

  /** True once since the last call if the character moved or turned. */
  takeDirty(): boolean {
    const d = this.dirty;
    this.dirty = false;
    return d;
  }

  update(dt: number, input: InputFrame | null, cameraYaw: number, season: SeasonId): void {
    this.time += dt;
    const amount = input ? Math.min(1, Math.hypot(input.moveX, input.moveY)) : 0;
    const moving = amount > 0.08;
    const running = moving && !!input?.run;
    if (moving && input) {
      // Camera-relative: "forward" points away from the camera.
      const mx = Math.cos(cameraYaw) * input.moveX - Math.sin(cameraYaw) * input.moveY;
      const mz = -Math.sin(cameraYaw) * input.moveX - Math.cos(cameraYaw) * input.moveY;
      const len = Math.hypot(mx, mz) || 1;
      let remaining = (running ? RUN_SPEED : WALK_SPEED) * amount * dt;
      while (remaining > 1e-4) {
        const d = Math.min(MAX_SUBSTEP, remaining);
        remaining -= d;
        const r = step(this.object.position.x, this.object.position.z, this.object.position.x + (mx / len) * d, this.object.position.z + (mz / len) * d, this.colliders, season);
        if (!r.moved) break;
        this.object.position.x = r.x;
        this.object.position.z = r.z;
        this.dirty = true;
      }
      const target = Math.atan2(mx, mz);
      const diff = Math.atan2(Math.sin(target - this.facing), Math.cos(target - this.facing));
      this.facing += diff * Math.min(1, dt * TURN_RATE);
      if (Math.abs(diff) > 0.01) this.dirty = true;
      this.phase += dt * (running ? 13 : 9) * amount;
    }
    const k = Math.min(1, dt * 10);
    this.moveBlend += ((moving ? 1 : 0) - this.moveBlend) * k;
    this.runBlend += ((running ? 1 : 0) - this.runBlend) * k;
    const ground = walkableHeight(this.object.position.x, this.object.position.z);
    if (ground !== null) this.object.position.y += (ground - this.object.position.y) * Math.min(1, dt * 18);
    this.object.rotation.y = this.facing;
    animateAvatar(this.object, this.phase, this.moveBlend, this.runBlend, this.time);
  }
}
