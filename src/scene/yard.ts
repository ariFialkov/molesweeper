import * as THREE from 'three';
import type { Board } from '../engine/board';
import type { Layout } from '../engine/config';
import { mulberry32 } from '../engine/rng';
import { disposeObject, makeRock, makeTree } from './items';
import { numberTexture } from './text';
import { dirtTexture, grassTexture, woodTexture } from './textures';

export const PITCH = 1.0;
export const TILE = 0.86;

export interface TileView {
  index: number;
  mound: THREE.Mesh;
  baseColor: THREE.Color;
  crater: THREE.Mesh | null;
  rim: THREE.Mesh | null;
  decal: THREE.Mesh | null;
  item: THREE.Object3D | null;
  revealed: boolean;
}

interface Picket {
  base: THREE.Matrix4;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  flying: boolean;
}

/** The 3D backyard: grass, dirt tiles, trees & rocks, fence and decor for one round. */
export class Yard {
  readonly group = new THREE.Group();
  readonly layout: Layout;
  readonly tiles: TileView[] = [];
  readonly props = new Map<number, THREE.Group>();
  readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
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

    // grass
    const grassMat = new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), grassMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    // a bed of darker soil under the grid so the tiles read as one game board
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x5b3d24, roughness: 1 });
    const bed = new THREE.Mesh(new THREE.BoxGeometry(cols * PITCH + 0.5, 0.08, rows * PITCH + 0.5), bedMat);
    bed.position.y = 0.04;
    bed.receiveShadow = true;
    this.group.add(bed);
    // board edge (wooden garden border)
    const borderMat = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.9 });
    const bw = cols * PITCH + 0.7;
    const bd = rows * PITCH + 0.7;
    const edgeGeoX = new THREE.BoxGeometry(bw, 0.16, 0.12);
    const edgeGeoZ = new THREE.BoxGeometry(0.12, 0.16, bd);
    for (const z of [-bd / 2 + 0.06, bd / 2 - 0.06]) {
      const e = new THREE.Mesh(edgeGeoX, borderMat);
      e.position.set(0, 0.08, z);
      e.castShadow = true;
      e.receiveShadow = true;
      this.group.add(e);
    }
    for (const x of [-bw / 2 + 0.06, bw / 2 - 0.06]) {
      const e = new THREE.Mesh(edgeGeoZ, borderMat);
      e.position.set(x, 0.08, 0);
      e.castShadow = true;
      e.receiveShadow = true;
      this.group.add(e);
    }

    // tiles
    const moundGeo = new THREE.BoxGeometry(TILE, 0.18, TILE, 1, 1, 1);
    const dirtTex = dirtTexture();
    for (let i = 0; i < board.n; i++) {
      const pos = this.cellPosition(i);
      if (board.kind[i] !== 'dirt') {
        const prop = board.kind[i] === 'tree' ? makeTree(rng) : makeRock(rng);
        prop.position.copy(pos);
        prop.position.y = 0.08;
        this.group.add(prop);
        this.props.set(i, prop);
        // a flat grass patch on the bed so the dead square reads as untouched lawn
        const patch = new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.06, TILE), grassMat);
        patch.position.copy(pos);
        patch.position.y = 0.09;
        patch.receiveShadow = true;
        this.group.add(patch);
        this.tiles.push({ index: i, mound: patch, baseColor: new THREE.Color(0xffffff), crater: null, rim: null, decal: null, item: null, revealed: false });
        continue;
      }
      const shade = 0.9 + rng() * 0.2;
      const color = new THREE.Color(0xe0aa72).multiplyScalar(shade);
      const mat = new THREE.MeshStandardMaterial({ map: dirtTex, color, roughness: 0.95 });
      const mound = new THREE.Mesh(moundGeo, mat);
      mound.position.copy(pos);
      mound.position.y = 0.09 + 0.09;
      mound.rotation.y = (rng() - 0.5) * 0.06;
      mound.castShadow = true;
      mound.receiveShadow = true;
      this.group.add(mound);
      this.tiles.push({ index: i, mound, baseColor: color, crater: null, rim: null, decal: null, item: null, revealed: false });
    }

    // picket fence
    const fenceMargin = 1.35;
    const fx0 = this.bounds.minX - fenceMargin;
    const fx1 = this.bounds.maxX + fenceMargin;
    const fz0 = this.bounds.minZ - fenceMargin;
    const fz1 = this.bounds.maxZ + fenceMargin;
    const picketGeo = new THREE.BoxGeometry(0.12, 0.7, 0.04);
    const picketMat = new THREE.MeshStandardMaterial({ map: woodTexture(), color: 0xf1e7d0, roughness: 0.9 });
    const positions: { x: number; z: number; ry: number }[] = [];
    const step = 0.28;
    for (let x = fx0; x <= fx1 + 1e-6; x += step) positions.push({ x, z: fz0, ry: 0 });
    for (let z = fz0 + step; z <= fz1 + 1e-6; z += step) {
      positions.push({ x: fx0, z, ry: Math.PI / 2 });
      positions.push({ x: fx1, z, ry: Math.PI / 2 });
    }
    // leave the front open in the middle so the slingshot view is clear
    for (let x = fx0; x <= fx1 + 1e-6; x += step) if (Math.abs(x) > 1.2) positions.push({ x, z: fz1, ry: 0 });
    this.pickets = new THREE.InstancedMesh(picketGeo, picketMat, positions.length);
    this.pickets.castShadow = true;
    this.pickets.receiveShadow = true;
    positions.forEach((p, i) => {
      this.dummy.position.set(p.x, 0.35, p.z);
      this.dummy.rotation.set(0, p.ry, 0);
      this.dummy.updateMatrix();
      this.pickets.setMatrixAt(i, this.dummy.matrix);
      this.picketData.push({
        base: this.dummy.matrix.clone(),
        pos: new THREE.Vector3(p.x, 0.35, p.z),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(0, p.ry, 0),
        spin: new THREE.Vector3(),
        flying: false,
      });
    });
    this.group.add(this.pickets);
    // rails
    const railMat = new THREE.MeshStandardMaterial({ color: 0xe3d6b8, roughness: 0.9 });
    const railW = fx1 - fx0;
    const railD = fz1 - fz0;
    for (const y of [0.22, 0.48]) {
      const back = new THREE.Mesh(new THREE.BoxGeometry(railW, 0.05, 0.03), railMat);
      back.position.set((fx0 + fx1) / 2, y, fz0);
      this.group.add(back);
      for (const x of [fx0, fx1]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, railD), railMat);
        side.position.set(x, y, (fz0 + fz1) / 2);
        this.group.add(side);
      }
      for (const sx of [-1, 1]) {
        const len = (railW - 2.4) / 2;
        const front = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.03), railMat);
        front.position.set(sx * (1.2 + len / 2), y, fz1);
        this.group.add(front);
      }
    }

    // decor: bushes at the corners, a shed at the back, a path in front
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x3f8f3c, roughness: 1 });
    const bushGeo = new THREE.SphereGeometry(0.45, 12, 10);
    for (const [x, z] of [
      [fx0 - 0.7, fz0 - 0.5],
      [fx1 + 0.7, fz0 - 0.5],
      [fx0 - 0.8, fz1 + 0.4],
      [fx1 + 0.8, fz1 + 0.4],
      [fx0 - 0.6, 0],
      [fx1 + 0.6, 0.5],
    ]) {
      const b = new THREE.Mesh(bushGeo, bushMat);
      b.position.set(x!, 0.3, z!);
      b.scale.set(1 + rng() * 0.4, 0.8 + rng() * 0.3, 1 + rng() * 0.4);
      b.castShadow = true;
      this.group.add(b);
    }
    const shed = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xc94f3d, roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: 0.9 });
    const walls = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 1.6), wallMat);
    walls.position.y = 0.8;
    walls.castShadow = true;
    shed.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 0.9, 4), roofMat);
    roof.position.y = 2.05;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.62);
    roof.castShadow = true;
    shed.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.05), new THREE.MeshStandardMaterial({ color: 0x5b3a22 }));
    door.position.set(0.4, 0.5, 0.82);
    shed.add(door);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.05), new THREE.MeshStandardMaterial({ color: 0xa9dcff, emissive: 0x335577, emissiveIntensity: 0.3 }));
    win.position.set(-0.6, 0.95, 0.82);
    shed.add(win);
    shed.position.set(-0.6, 0, fz0 - 2.2);
    this.group.add(shed);
    const treeRng = mulberry32(board.seed ^ 0x51ed27);
    for (const [x, z] of [
      [fx1 + 2.2, fz0 - 1.8],
      [fx0 - 2.6, fz0 - 1.2],
      [fx1 + 2.8, fz1 - 1],
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
    return new THREE.Vector3((c - (cols - 1) / 2) * PITCH, 0.18, (r - (rows - 1) / 2) * PITCH);
  }

  /** Nearest cell to a point on the ground, or -1 if outside the board (with a little slack). */
  cellFromPoint(x: number, z: number, slack = 0.35): number {
    const { cols, rows } = this.layout;
    if (x < this.bounds.minX - slack || x > this.bounds.maxX + slack) return -1;
    if (z < this.bounds.minZ - slack || z > this.bounds.maxZ + slack) return -1;
    const c = Math.round(x / PITCH + (cols - 1) / 2);
    const r = Math.round(z / PITCH + (rows - 1) / 2);
    const cc = Math.max(0, Math.min(cols - 1, c));
    const rr = Math.max(0, Math.min(rows - 1, r));
    return rr * cols + cc;
  }

  tile(i: number): TileView {
    return this.tiles[i]!;
  }

  /** Turn a mound into a crater. Returns the crater so the caller can animate it. */
  makeCrater(i: number, big = false): TileView {
    const t = this.tiles[i]!;
    if (t.revealed) return t;
    t.revealed = true;
    t.mound.visible = false;
    const radius = big ? 0.6 : 0.4;
    const craterMat = new THREE.MeshStandardMaterial({ color: big ? 0x1e1410 : 0x4a2f1a, roughness: 1 });
    const crater = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.7, radius, 0.12, 20), craterMat);
    crater.position.copy(t.mound.position);
    crater.position.y = 0.06;
    crater.receiveShadow = true;
    this.group.add(crater);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.07, 8, 24), new THREE.MeshStandardMaterial({ color: big ? 0x2a1a10 : 0x7a5535, roughness: 1 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.copy(t.mound.position);
    rim.position.y = 0.12;
    rim.scale.set(1, 1, 0.6);
    rim.castShadow = true;
    this.group.add(rim);
    t.crater = crater;
    t.rim = rim;
    return t;
  }

  setNumber(i: number, n: number) {
    const t = this.tiles[i]!;
    if (n <= 0 || t.decal) return;
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshStandardMaterial({ map: numberTexture(n), transparent: true, roughness: 1, depthWrite: false }),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.copy(t.mound.position);
    decal.position.y = 0.135;
    decal.renderOrder = 2;
    this.group.add(decal);
    t.decal = decal;
  }

  placeItem(i: number, obj: THREE.Object3D) {
    const t = this.tiles[i]!;
    obj.position.copy(t.mound.position);
    obj.position.y = 0.1;
    this.group.add(obj);
    t.item = obj;
  }

  /** The whole yard is wrecked: soil scorched, mounds tilted, pickets launched. */
  scorch(center: THREE.Vector3) {
    if (this.scorched) return;
    this.scorched = true;
    for (const t of this.tiles) {
      const mat = t.mound.material as THREE.MeshStandardMaterial;
      mat.color.multiplyScalar(0.45);
      if (t.mound.visible && !t.revealed) {
        t.mound.rotation.x += (Math.random() - 0.5) * 0.35;
        t.mound.rotation.z += (Math.random() - 0.5) * 0.35;
        t.mound.position.y += Math.random() * 0.06;
      }
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
