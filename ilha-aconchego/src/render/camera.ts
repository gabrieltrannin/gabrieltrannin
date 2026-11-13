import * as THREE from 'three';

/** From docs/GAME_DESIGN.md: high, tilted "diorama" camera. */
export const CAMERA_PITCH_DEG = 52;
export const CAMERA_FOV_DEG = 30;

/**
 * Orbit-style rig around a target point. Stage 1 adds the follow mode, smoothing and drag to rotate;
 * for now it frames a ground area so the whole test island is visible.
 */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.5, 600);
  readonly target = new THREE.Vector3();
  yaw = 0;
  pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEG);
  distance = 50;

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /** Picks a distance that fits a ground area of `width` x `depth` units on screen, with a margin. */
  frameArea(width: number, depth: number, margin = 1.08): void {
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const byDepth = (depth * Math.sin(this.pitch)) / (2 * tanHalf);
    const byWidth = width / (2 * tanHalf * this.camera.aspect);
    this.distance = Math.max(byDepth, byWidth) * margin;
  }

  update(): void {
    const horizontal = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * horizontal,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * horizontal,
    );
    this.camera.lookAt(this.target);
  }
}
