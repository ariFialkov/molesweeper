import * as THREE from 'three';

export interface BurstOptions {
  position: THREE.Vector3;
  count: number;
  colors: number[];
  /** min / max speed */
  speed: [number, number];
  /** direction bias (unit-ish) and spread 0..1 (1 = full sphere) */
  direction?: THREE.Vector3;
  spread?: number;
  gravity?: number;
  life?: [number, number];
  size?: [number, number];
  /** flat confetti-like flakes */
  flat?: boolean;
  drag?: number;
  fade?: boolean;
  /** how much a particle swells over its life (1 = doubles) */
  grow?: number;
}

interface Particle {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  drag: number;
  flat: boolean;
  fade: boolean;
  grow: number;
  color: THREE.Color;
}

/** A single instanced particle pool for dirt, sparks, flak, confetti and debris. */
export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private particles: Particle[] = [];
  private dummy = new THREE.Object3D();
  private capacity: number;
  private tmpColor = new THREE.Color();

  constructor(scene: THREE.Scene, capacity = 900, geo: THREE.BufferGeometry = new THREE.BoxGeometry(1, 1, 1), mat: THREE.Material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.05 })) {
    this.capacity = capacity;
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    for (let i = 0; i < capacity; i++) {
      this.particles.push({
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        spin: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 0.1,
        gravity: 9,
        drag: 0,
        flat: false,
        fade: true,
        grow: 0,
        color: new THREE.Color(),
      });
    }
  }

  burst(o: BurstOptions) {
    const dir = (o.direction ?? new THREE.Vector3(0, 1, 0)).clone().normalize();
    const spread = o.spread ?? 1;
    let spawned = 0;
    for (let i = 0; i < this.capacity && spawned < o.count; i++) {
      const p = this.particles[i]!;
      if (p.alive) continue;
      p.alive = true;
      p.pos.copy(o.position);
      const rnd = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      const v = dir
        .clone()
        .multiplyScalar(1 - spread)
        .add(rnd.multiplyScalar(spread))
        .normalize();
      const speed = o.speed[0] + Math.random() * (o.speed[1] - o.speed[0]);
      p.vel.copy(v.multiplyScalar(speed));
      p.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      p.spin.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
      const life = o.life ?? [0.5, 1.2];
      p.maxLife = life[0] + Math.random() * (life[1] - life[0]);
      p.life = p.maxLife;
      const size = o.size ?? [0.05, 0.12];
      p.size = size[0] + Math.random() * (size[1] - size[0]);
      p.gravity = o.gravity ?? 9;
      p.drag = o.drag ?? 0;
      p.flat = o.flat ?? false;
      p.fade = o.fade ?? true;
      p.grow = o.grow ?? 0;
      p.color.setHex(o.colors[Math.floor(Math.random() * o.colors.length)]!);
      spawned++;
    }
  }

  update(dt: number) {
    let count = 0;
    for (let i = 0; i < this.capacity; i++) {
      const p = this.particles[i]!;
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vel.y -= p.gravity * dt;
      if (p.drag > 0) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.02 && p.vel.y < 0) {
        p.pos.y = 0.02;
        p.vel.y *= -0.3;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
      }
      p.rot.x += p.spin.x * dt;
      p.rot.y += p.spin.y * dt;
      p.rot.z += p.spin.z * dt;
      const k = p.fade ? Math.min(1, p.life / (p.maxLife * 0.35)) : 1;
      const age = 1 - p.life / p.maxLife;
      const s = p.size * k * (1 + p.grow * age);
      this.dummy.position.copy(p.pos);
      this.dummy.rotation.copy(p.rot);
      if (p.flat) this.dummy.scale.set(s * 1.6, s * 0.15, s);
      else this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(count, this.dummy.matrix);
      this.tmpColor.copy(p.color);
      this.mesh.setColorAt(count, this.tmpColor);
      count++;
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    for (const p of this.particles) p.alive = false;
    this.mesh.count = 0;
  }
}
