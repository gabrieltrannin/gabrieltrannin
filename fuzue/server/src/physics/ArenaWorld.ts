import RAPIER from '@dimforge/rapier3d-compat';
import { ARENA, DT, PLAYER_RADIUS } from '@fuzue/shared';

let ready: Promise<void> | null = null;

/** Carrega o WebAssembly do Rapier uma única vez por processo. */
export function initPhysics(): Promise<void> {
  if (!ready) ready = RAPIER.init();
  return ready;
}

export interface BodyPose {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
}

/**
 * Mundo de física de uma sala de arena.
 * Guarda os corpos dos jogadores e das bolas; a sala decide a velocidade
 * de cada jogador e chama `step()` uma vez por tick.
 */
export class ArenaWorld {
  readonly world: RAPIER.World;
  private players = new Map<string, RAPIER.RigidBody>();
  readonly balls: { body: RAPIER.RigidBody; r: number; home: { x: number; z: number } }[] = [];

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: ARENA.gravity, z: 0 });
    this.world.timestep = DT;

    // Plataforma: cilindro com o topo em y = 0. Sem atrito, porque quem
    // controla a velocidade no chão é a regra de movimento compartilhada.
    const floor = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
    this.world.createCollider(RAPIER.ColliderDesc.cylinder(0.5, ARENA.radius).setFriction(0), floor);

    for (const p of ARENA.pillars) {
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, p.h / 2, p.z));
      this.world.createCollider(RAPIER.ColliderDesc.cylinder(p.h / 2, p.r).setFriction(0).setRestitution(0), body);
    }

    for (const b of ARENA.balls) {
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(b.x, b.r, b.z)
          .setLinearDamping(0.35)
          .setAngularDamping(0.35)
          .setCcdEnabled(true),
      );
      this.world.createCollider(RAPIER.ColliderDesc.ball(b.r).setDensity(0.3).setFriction(0.6).setRestitution(0.55), body);
      this.balls.push({ body, r: b.r, home: { x: b.x, z: b.z } });
    }
  }

  addPlayer(id: string, x: number, y: number, z: number): void {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .lockRotations()
        .setCcdEnabled(true),
    );
    this.world.createCollider(RAPIER.ColliderDesc.ball(PLAYER_RADIUS).setDensity(1).setFriction(0).setRestitution(0.35), body);
    this.players.set(id, body);
  }

  removePlayer(id: string): void {
    const body = this.players.get(id);
    if (body) this.world.removeRigidBody(body);
    this.players.delete(id);
  }

  pose(id: string): BodyPose | null {
    const body = this.players.get(id);
    if (!body) return null;
    const t = body.translation();
    const v = body.linvel();
    return { x: t.x, y: t.y, z: t.z, vx: v.x, vy: v.y, vz: v.z };
  }

  setVelocity(id: string, vx: number, vy: number, vz: number): void {
    this.players.get(id)?.setLinvel({ x: vx, y: vy, z: vz }, true);
  }

  teleport(id: string, x: number, y: number, z: number): void {
    const body = this.players.get(id);
    if (!body) return;
    body.setTranslation({ x, y, z }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  /** Bolas que caíram da arena voltam do céu para o lugar de origem. */
  respawnFallenBalls(): void {
    for (const b of this.balls) {
      if (b.body.translation().y < ARENA.killY) {
        b.body.setTranslation({ x: b.home.x, y: ARENA.spawnY + 3, z: b.home.z }, true);
        b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        b.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  }

  step(): void {
    this.world.step();
  }

  dispose(): void {
    this.world.free();
    this.players.clear();
  }
}
