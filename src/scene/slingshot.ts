import * as THREE from 'three';
import type { AmmoId } from '../engine/config';
import { disposeObject, makeAmmo } from './items';
import { ease, type Tweens } from './tween';

function cylinderBetween(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a);
  const len = dir.length();
  mesh.position.copy(mid);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
}

/** A Y-fork slingshot held in front of the camera. */
export class Slingshot {
  readonly group = new THREE.Group();
  private pouch = new THREE.Group();
  private pouchRest = new THREE.Vector3(0, 0.22, 0.02);
  private bandL: THREE.Mesh;
  private bandR: THREE.Mesh;
  private tipL = new THREE.Vector3(-0.19, 0.4, 0);
  private tipR = new THREE.Vector3(0.19, 0.4, 0);
  private ammo: THREE.Group | null = null;
  private ammoId: AmmoId = 'firecracker';
  private pull = new THREE.Vector3();
  private time = 0;

  constructor(camera: THREE.Camera, private tweens: Tweens) {
    const wood = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.34, 10), wood);
    handle.position.set(0, 0, 0);
    this.group.add(handle);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 10), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 }));
    grip.position.set(0, -0.09, 0);
    this.group.add(grip);
    for (const s of [-1, 1]) {
      const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.32, 10), wood);
      prong.position.set(s * 0.1, 0.28, 0);
      prong.rotation.z = -s * 0.62;
      this.group.add(prong);
    }
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.6 });
    const bandGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 6);
    this.bandL = new THREE.Mesh(bandGeo, bandMat);
    this.bandR = new THREE.Mesh(bandGeo, bandMat);
    this.group.add(this.bandL, this.bandR);
    const leather = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.02), new THREE.MeshStandardMaterial({ color: 0x6b3d1e, roughness: 0.9 }));
    this.pouch.add(leather);
    this.pouch.position.copy(this.pouchRest);
    this.group.add(this.pouch);

    this.group.position.set(0, -0.62, -1.9);
    this.group.rotation.x = 0.35;
    this.group.scale.setScalar(0.6);
    camera.add(this.group);
    this.setAmmo('firecracker');
    this.updateBands();
  }

  setAmmo(id: AmmoId) {
    this.ammoId = id;
    if (this.ammo) {
      disposeObject(this.ammo);
      this.ammo.removeFromParent();
    }
    this.ammo = makeAmmo(id);
    this.ammo.scale.setScalar(0.85);
    this.ammo.position.set(0, 0.02, 0.03);
    this.pouch.add(this.ammo);
  }

  /** dx, dy in -1..1 (screen drag), amount 0..1 */
  setPull(dx: number, dy: number, amount: number) {
    this.pull.set(dx, dy, amount);
    this.pouch.position.set(this.pouchRest.x + dx * 0.16, this.pouchRest.y - dy * 0.12 - amount * 0.05, this.pouchRest.z + amount * 0.55);
    this.updateBands();
  }

  release() {
    const start = this.pouch.position.clone();
    this.tweens.run(
      0.25,
      (t) => {
        this.pouch.position.lerpVectors(start, this.pouchRest, t);
        this.updateBands();
      },
      ease.outElastic,
    );
    this.pull.set(0, 0, 0);
  }

  private updateBands() {
    cylinderBetween(this.bandL, this.tipL, this.pouch.position.clone().add(new THREE.Vector3(-0.06, 0, 0)));
    cylinderBetween(this.bandR, this.tipR, this.pouch.position.clone().add(new THREE.Vector3(0.06, 0, 0)));
  }

  pouchWorldPosition(): THREE.Vector3 {
    this.group.updateWorldMatrix(true, true);
    return this.pouch.getWorldPosition(new THREE.Vector3());
  }

  /** Hide the ammo in the pouch while a shot is in the air, and reload with a little bounce after. */
  hideAmmo() {
    if (this.ammo) this.ammo.visible = false;
  }

  reload() {
    if (!this.ammo) return;
    const a = this.ammo;
    a.visible = true;
    a.scale.setScalar(0.01);
    this.tweens.run(0.3, (t) => a.scale.setScalar(0.85 * t), ease.outBack);
  }

  /** A fresh projectile of the current ammo, in world space. */
  spawnProjectile(): THREE.Group {
    return makeAmmo(this.ammoId);
  }

  update(dt: number) {
    this.time += dt;
    if (!this.ammo) return;
    // idle bob + fuse spark flicker / rocket flame flicker
    const spark = this.ammo.getObjectByName('spark') as THREE.Mesh | undefined;
    if (spark) spark.scale.setScalar(0.8 + Math.random() * 0.6);
    const flame = this.ammo.getObjectByName('flame') as THREE.Mesh | undefined;
    if (flame) flame.scale.set(1, 0.7 + Math.random() * 0.6, 1);
    if (this.ammoId === 'disco') this.ammo.rotation.y += dt * 2;
    this.group.position.y = -0.62 + Math.sin(this.time * 1.6) * 0.008;
  }
}
