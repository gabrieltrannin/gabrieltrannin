import * as THREE from 'three';
import type { SeasonId } from '../data/calendar';
import type { InputFrame } from '../input/input';
import { animateAvatar, poseAvatar } from '../render/avatar';
import { step, walkableHeight, type Collider, type GroundFn } from '../world/collision';

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
  /** Walking speed multiplier (today's "Passos ligeiros" bonus). */
  speedFactor = 1;
  private phase = 0;
  private moveBlend = 0;
  private runBlend = 0;
  private time = 0;
  private dirty = false;
  /** Where the ground is: the island, or the floor inside the house. */
  private ground: GroundFn = walkableHeight;
  /** A pose held for a while (emotes and photo poses), with the time it started. */
  emote: { id: string; time: number; until: number } | null = null;

  constructor(
    readonly object: THREE.Object3D,
    private colliders: readonly Collider[],
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

  /** Swaps the obstacles (for example when the greenhouse door opens). */
  setColliders(colliders: readonly Collider[]): void {
    this.colliders = colliders;
  }

  /** Walks on another ground (inside the house) with its own obstacles. */
  setGround(ground: GroundFn, colliders: readonly Collider[]): void {
    this.ground = ground;
    this.colliders = colliders;
  }

  /** Plays an emote pose for a few seconds (or until moving, when `seconds` is Infinity: photo poses). */
  playEmote(id: string, seconds = 2.4): void {
    this.emote = { id, time: this.time, until: this.time + seconds };
  }

  /** Puts the character somewhere at once (waking up at the door, for example). */
  teleport(x: number, z: number, facing: number): void {
    this.object.position.set(x, this.ground(x, z) ?? this.object.position.y, z);
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
      let remaining = (running ? RUN_SPEED : WALK_SPEED) * this.speedFactor * amount * dt;
      while (remaining > 1e-4) {
        const d = Math.min(MAX_SUBSTEP, remaining);
        remaining -= d;
        const r = step(this.object.position.x, this.object.position.z, this.object.position.x + (mx / len) * d, this.object.position.z + (mz / len) * d, this.colliders, season, this.ground, this.ground);
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
    const ground = this.ground(this.object.position.x, this.object.position.z);
    if (ground !== null) this.object.position.y += (ground - this.object.position.y) * Math.min(1, dt * 18);
    this.object.rotation.y = this.facing;
    if (this.emote && (moving || this.time > this.emote.until)) this.emote = null;
    animateAvatar(this.object, this.phase, this.moveBlend, this.runBlend, this.time);
    if (this.emote) poseAvatar(this.object, this.emote.id, this.time - this.emote.time);
  }
}
