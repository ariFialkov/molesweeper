import * as THREE from 'three';
import type { Board } from '../engine/board';
import type { Layout } from '../engine/config';
import { mulberry32 } from '../engine/rng';
import { disposeObject, makeFlag, makeMine, makeRock, makeTree } from './items';
import { GridOverlay } from './overlay';
import { numberTexture } from './text';
import { grassTexture, lawnTexture, woodTexture } from './textures';

export const PITCH = 1.0;

export interface TileView {
  index: number;
  position: THREE.Vector3;
  crater: THREE.Mesh | null;
  rim: THREE.Mesh | null;
  decal: THREE.Mesh | null;
  item: THREE.Object3D | null;
  revealed: boolean;
}

interface Picket {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  flying: boolean;
}

/** The backyard for one round: a mowed lawn that *is* the board, a translucent grid over it, props, fence. */
export class Yard {
  readonly group = new THREE.Group();
  readonly layout: Layout;
  readonly tiles: TileView[] = [];
  readonly props = new Map<number, THREE.Group>();
  readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  readonly overlay: GridOverlay;
  private lawnMat: THREE.MeshStandardMaterial;
  private groundMat: THREE.MeshStandardMaterial;
  private pickets: THREE.InstancedMesh;
  private picketData: Picket[] = [];
  private picketsFlying = false;
  private dummy = new THREE.Object3D();
  private scorched = false;

  constructor(board: Board) {
    this.layout = board.layout;
    const { cols, rows } = this.layout;
    const rng = mulberry32(board.seed ^ 0x9e3779b9);
    const halfW = ((cols - 1) * PITCH) / 2;
    const halfD = ((rows - 1) * PITCH) / 2;
    this.bounds = { minX: -halfW - PITCH / 2, maxX: halfW + PITCH / 2, minZ: -halfD - PITCH / 2, maxZ: halfD + PITCH / 2 };

    // surrounding grass
    this.groundMat = new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    // the board itself: a mowed checkerboard, one checker per square
    this.lawnMat = new THREE.MeshStandardMaterial({ map: lawnTexture(cols, rows), roughness: 1, metalness: 0 });
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(cols * PITCH, rows * PITCH), this.lawnMat);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = 0.012;
    lawn.receiveShadow = true;
    this.group.add(lawn);

    // digital grid overlay
    this.overlay = new GridOverlay(this.layout, PITCH, board.kind);
    this.group.add(this.overlay.mesh);

    // squares + props
    for (let i = 0; i < board.n; i++) {
      const pos = this.cellPosition(i);
      this.tiles.push({ index: i, position: pos, crater: null, rim: null, decal: null, item: null, revealed: false });
      if (board.kind[i] !== 'dirt') {
        const prop = board.kind[i] === 'tree' ? makeTree(rng) : makeRock(rng);
        prop.position.set(pos.x, 0.01, pos.z);
        this.group.add(prop);
        this.props.set(i, prop);
      }
    }

    // picket fence hugging the board
    const m = 0.6;
    const fx0 = this.bounds.minX - m;
    const fx1 = this.bounds.maxX + m;
    const fz0 = this.bounds.minZ - m;
    const fz1 = this.bounds.maxZ + m;
    const picketGeo = new THREE.BoxGeometry(0.11, 0.62, 0.04);
    const picketMat = new THREE.MeshStandardMaterial({ map: woodTexture(), color: 0xf4ead4, roughness: 0.9 });
    const positions: { x: number; z: number; ry: number }[] = [];
    const step = 0.27;
    for (let x = fx0; x <= fx1 + 1e-6; x += step) positions.push({ x, z: fz0, ry: 0 });
    for (let z = fz0 + step; z <= fz1 + 1e-6; z += step) {
      positions.push({ x: fx0, z, ry: Math.PI / 2 });
      positions.push({ x: fx1, z, ry: Math.PI / 2 });
    }
    for (let x = fx0; x <= fx1 + 1e-6; x += step) if (Math.abs(x) > 1.0) positions.push({ x, z: fz1, ry: 0 });
    this.pickets = new THREE.InstancedMesh(picketGeo, picketMat, positions.length);
    this.pickets.castShadow = true;
    positions.forEach((p, i) => {
      this.dummy.position.set(p.x, 0.31, p.z);
      this.dummy.rotation.set(0, p.ry, 0);
      this.dummy.updateMatrix();
      this.pickets.setMatrixAt(i, this.dummy.matrix);
      this.picketData.push({ pos: new THREE.Vector3(p.x, 0.31, p.z), vel: new THREE.Vector3(), rot: new THREE.Euler(0, p.ry, 0), spin: new THREE.Vector3(), flying: false });
    });
    this.group.add(this.pickets);
    const railMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 });
    const railW = fx1 - fx0;
    const railD = fz1 - fz0;
    for (const y of [0.2, 0.44]) {
      const back = new THREE.Mesh(new THREE.BoxGeometry(railW, 0.05, 0.03), railMat);
      back.position.set((fx0 + fx1) / 2, y, fz0);
      this.group.add(back);
      for (const x of [fx0, fx1]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, railD), railMat);
        side.position.set(x, y, (fz0 + fz1) / 2);
        this.group.add(side);
      }
      for (const sx of [-1, 1]) {
        const len = (railW - 2.0) / 2;
        const front = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.03), railMat);
        front.position.set(sx * (1.0 + len / 2), y, fz1);
        this.group.add(front);
      }
    }

    // decor beyond the fence (mostly off-screen, frames the edges)
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x3f8f3c, roughness: 1 });
    const bushGeo = new THREE.SphereGeometry(0.45, 12, 10);
    for (const [x, z] of [
      [fx0 - 0.6, fz0 - 0.5],
      [fx1 + 0.6, fz0 - 0.5],
      [fx0 - 0.7, fz1 + 0.3],
      [fx1 + 0.7, fz1 + 0.3],
      [fx0 - 0.6, 0],
      [fx1 + 0.6, 0.5],
    ]) {
      const b = new THREE.Mesh(bushGeo, bushMat);
      b.position.set(x!, 0.3, z!);
      b.scale.set(1 + rng() * 0.4, 0.8 + rng() * 0.3, 1 + rng() * 0.4);
      b.castShadow = true;
      this.group.add(b);
    }
    const treeRng = mulberry32(board.seed ^ 0x51ed27);
    for (const [x, z] of [
      [fx1 + 2.0, fz0 - 1.4],
      [fx0 - 2.2, fz0 - 1.0],
      [fx1 + 2.4, fz1 - 1],
      [fx0 - 2.4, fz1 - 0.5],
    ]) {
      const t = makeTree(treeRng);
      t.position.set(x!, 0, z!);
      t.scale.multiplyScalar(1.7);
      this.group.add(t);
    }
  }

  cellPosition(i: number): THREE.Vector3 {
    const { cols, rows } = this.layout;
    const r = Math.floor(i / cols);
    const c = i % cols;
    return new THREE.Vector3((c - (cols - 1) / 2) * PITCH, 0.02, (r - (rows - 1) / 2) * PITCH);
  }

  /** Nearest square to a point on the lawn, or -1 when the point is clearly off the board. */
  cellFromPoint(x: number, z: number, slack = 0.35): number {
    const { cols, rows } = this.layout;
    if (x < this.bounds.minX - slack || x > this.bounds.maxX + slack) return -1;
    if (z < this.bounds.minZ - slack || z > this.bounds.maxZ + slack) return -1;
    const c = Math.max(0, Math.min(cols - 1, Math.round(x / PITCH + (cols - 1) / 2)));
    const r = Math.max(0, Math.min(rows - 1, Math.round(z / PITCH + (rows - 1) / 2)));
    return r * cols + c;
  }

  /** Clamp a lawn point to the board so every shot lands on some square. */
  clampToBoard(p: THREE.Vector3): THREE.Vector3 {
    p.x = Math.max(this.bounds.minX + 0.08, Math.min(this.bounds.maxX - 0.08, p.x));
    p.z = Math.max(this.bounds.minZ + 0.08, Math.min(this.bounds.maxZ - 0.08, p.z));
    return p;
  }

  tile(i: number): TileView {
    return this.tiles[i]!;
  }

  /** Cut a crater into the lawn. Returns the tile so the caller can animate it. */
  makeCrater(i: number, big = false): TileView {
    const t = this.tiles[i]!;
    if (t.revealed) return t;
    t.revealed = true;
    this.overlay.setState(i, 'revealed');
    const radius = big ? 0.62 : 0.4;
    const crater = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.7, radius, 0.12, 22),
      new THREE.MeshStandardMaterial({ color: big ? 0x1e1410 : 0x4e3420, roughness: 1 }),
    );
    crater.position.set(t.position.x, 0.05, t.position.z);
    crater.receiveShadow = true;
    this.group.add(crater);
    // torn turf rim: grass on top, soil underneath
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.075, 8, 26), new THREE.MeshStandardMaterial({ color: big ? 0x2a1a10 : 0x6b4a2c, roughness: 1 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(t.position.x, 0.1, t.position.z);
    rim.scale.set(1, 1, 0.6);
    rim.castShadow = true;
    this.group.add(rim);
    t.crater = crater;
    t.rim = rim;
    return t;
  }

  /** A proven mine is dug up and defused: a small crater, the mine itself, and a flag. */
  flagMine(i: number): { mine: THREE.Group; flag: THREE.Group } {
    const t = this.tiles[i]!;
    t.revealed = true;
    this.overlay.setState(i, 'flagged');
    const crater = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.1, 18), new THREE.MeshStandardMaterial({ color: 0x4e3420, roughness: 1 }));
    crater.position.set(t.position.x, 0.05, t.position.z);
    this.group.add(crater);
    t.crater = crater;
    const mine = makeMine();
    mine.scale.setScalar(0.75);
    const flag = makeFlag();
    flag.position.set(0.22, 0, 0.1);
    mine.add(flag);
    this.placeItem(i, mine);
    return { mine, flag };
  }

  /** Press the number into the crater floor; `shown === false` presses an unreadable "?" instead. */
  setNumber(i: number, n: number, shown = true) {
    const t = this.tiles[i]!;
    if (t.decal) return;
    if (shown && n <= 0) return;
    // pressed into the front lip of the crater so whatever pops out of it never hides it
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.42),
      new THREE.MeshStandardMaterial({ map: numberTexture(shown ? n : '?'), transparent: true, roughness: 1, depthWrite: false }),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(t.position.x, 0.115, t.position.z + 0.22);
    decal.renderOrder = 2;
    this.group.add(decal);
    t.decal = decal;
  }

  placeItem(i: number, obj: THREE.Object3D) {
    const t = this.tiles[i]!;
    obj.position.set(t.position.x, 0.08, t.position.z - 0.08);
    this.group.add(obj);
    t.item = obj;
  }

  /** The whole yard is wrecked: lawn scorched, pickets launched. */
  scorch(center: THREE.Vector3) {
    if (this.scorched) return;
    this.scorched = true;
    this.lawnMat.color.setHex(0x4a4036);
    this.groundMat.color.setHex(0x5a5444);
    this.overlay.scorch();
    for (const t of this.tiles) {
      if (t.crater) (t.crater.material as THREE.MeshStandardMaterial).color.multiplyScalar(0.5);
    }
    this.picketsFlying = true;
    for (const p of this.picketData) {
      const away = p.pos.clone().sub(center);
      const d = Math.max(1, away.length());
      away.normalize();
      const power = 9 / d + 1.5;
      p.vel.set(away.x * power + (Math.random() - 0.5) * 2, 4 + Math.random() * 5, away.z * power + (Math.random() - 0.5) * 2);
      p.spin.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 12);
      p.flying = true;
    }
  }

  update(dt: number) {
    this.overlay.update(dt);
    if (!this.picketsFlying) return;
    let any = false;
    this.picketData.forEach((p, i) => {
      if (!p.flying) return;
      any = true;
      p.vel.y -= 12 * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.rot.x += p.spin.x * dt;
      p.rot.y += p.spin.y * dt;
      p.rot.z += p.spin.z * dt;
      if (p.pos.y < 0.05) {
        p.pos.y = 0.05;
        p.vel.multiplyScalar(0.3);
        p.vel.y = Math.abs(p.vel.y) * 0.4;
        p.spin.multiplyScalar(0.5);
        if (p.vel.length() < 0.4) p.flying = false;
      }
      this.dummy.position.copy(p.pos);
      this.dummy.rotation.copy(p.rot);
      this.dummy.updateMatrix();
      this.pickets.setMatrixAt(i, this.dummy.matrix);
    });
    this.pickets.instanceMatrix.needsUpdate = true;
    if (!any) this.picketsFlying = false;
  }

  dispose() {
    disposeObject(this.group);
    this.group.removeFromParent();
  }
}
