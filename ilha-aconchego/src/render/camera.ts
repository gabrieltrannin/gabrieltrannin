import * as THREE from 'three';

/** From docs/GAME_DESIGN.md: high, tilted "diorama" camera. */
export const CAMERA_PITCH_DEG = 52;
export const CAMERA_FOV_DEG = 30;
/** Distance to the followed target, at the default field of view. */
const FOLLOW_DISTANCE = 21;

export type CameraMode = 'follow' | 'overview';

export interface OverviewArea {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
}

/**
 * Diorama camera with two modes: following a target, or showing the whole island.
 * Switching modes, and moving the target, blend smoothly. Dragging rotates around the vertical axis.
 */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.5, 600);
  yaw = 0;
  pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEG);
  mode: CameraMode = 'overview';
  private followTarget: THREE.Object3D | null = null;
  private readonly look = new THREE.Vector3();
  private readonly goalLook = new THREE.Vector3();
  private distance = 50;
  private goalDistance = 50;
  private overview: OverviewArea = { x: 0, y: 0, z: 0, width: 40, depth: 32 };
  private dragging = false;
  private lastX = 0;
  /** Seconds since the last drag, for the "rotate when idle" option. */
  idleTime = 0;
  autoRotate = false;

  get currentDistance(): number {
    return this.distance;
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
  }

  setFollowTarget(object: THREE.Object3D | null): void {
    this.followTarget = object;
  }

  setOverview(area: OverviewArea): void {
    this.overview = area;
  }

  setFov(degrees: number): void {
    this.camera.fov = degrees;
    this.camera.updateProjectionMatrix();
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /** Lets the player drag horizontally on `element` to turn the camera. Returns a function that detaches it. */
  attachDrag(element: HTMLElement): () => void {
    const down = (e: PointerEvent) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.idleTime = 0;
      element.setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.yaw -= (e.clientX - this.lastX) * 0.007;
      this.lastX = e.clientX;
    };
    const up = () => {
      this.dragging = false;
      this.idleTime = 0;
    };
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    return () => {
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
    };
  }

  private computeGoals(): void {
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    if (this.mode === 'follow' && this.followTarget) {
      const p = this.followTarget.position;
      this.goalLook.set(p.x, p.y + 0.6, p.z);
      const fovFactor = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV_DEG) / 2) / tanHalf;
      this.goalDistance = FOLLOW_DISTANCE * fovFactor * Math.max(1, 1.1 / this.camera.aspect) ** 0.6;
    } else {
      const o = this.overview;
      this.goalLook.set(o.x, o.y, o.z);
      const byDepth = (o.depth * Math.sin(this.pitch)) / (2 * tanHalf);
      const byWidth = o.width / (2 * tanHalf * this.camera.aspect);
      this.goalDistance = Math.max(byDepth, byWidth) * 1.05;
    }
  }

  /** Jumps straight to the goal (first frame). */
  snap(): void {
    this.computeGoals();
    this.look.copy(this.goalLook);
    this.distance = this.goalDistance;
    this.place();
  }

  update(dt: number): void {
    if (!this.dragging) this.idleTime += dt;
    if (this.autoRotate && !this.dragging && this.idleTime > 2.5) this.yaw += dt * 0.05;
    this.computeGoals();
    const k = 1 - Math.exp(-dt * 3);
    this.look.lerp(this.goalLook, k);
    this.distance += (this.goalDistance - this.distance) * k;
    this.place();
  }

  private place(): void {
    const horizontal = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.look.x + Math.sin(this.yaw) * horizontal,
      this.look.y + Math.sin(this.pitch) * this.distance,
      this.look.z + Math.cos(this.yaw) * horizontal,
    );
    this.camera.lookAt(this.look);
  }
}
