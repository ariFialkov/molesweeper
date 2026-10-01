import * as THREE from 'three';
import type { AmmoId } from '../engine/config';
import { bandageTexture } from './text';

const std = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function eyes(group: THREE.Group, y: number, z: number, spread: number, r = 0.035) {
  const eyeMat = std(0x111111, { roughness: 0.3 });
  const geo = new THREE.SphereGeometry(r, 10, 10);
  group.add(mesh(geo, eyeMat, -spread, y, z), mesh(geo, eyeMat, spread, y, z));
}

/** Cute mole: dark brown, pink nose, little paws. Origin at the feet. */
export function makeMole(): THREE.Group {
  const g = new THREE.Group();
  const body = std(0x5a3a22);
  g.add(mesh(new THREE.SphereGeometry(0.22, 18, 14), body, 0, 0.22, 0));
  const head = mesh(new THREE.SphereGeometry(0.16, 18, 14), body, 0, 0.42, 0.06);
  head.scale.set(1, 0.9, 1.1);
  g.add(head);
  g.add(mesh(new THREE.SphereGeometry(0.05, 12, 12), std(0xff8fb0, { roughness: 0.4 }), 0, 0.42, 0.22));
  eyes(g, 0.48, 0.17, 0.07, 0.03);
  const paw = new THREE.SphereGeometry(0.06, 10, 10);
  const pawMat = std(0xe8b898);
  g.add(mesh(paw, pawMat, -0.16, 0.2, 0.14), mesh(paw, pawMat, 0.16, 0.2, 0.14));
  return g;
}

/** Groundhog: bigger, golden brown, buck teeth, standing tall. */
export function makeGroundhog(): THREE.Group {
  const g = new THREE.Group();
  const fur = std(0x9c6a34);
  const belly = std(0xd8b27a);
  const body = mesh(new THREE.CapsuleGeometry(0.2, 0.3, 6, 14), fur, 0, 0.36, 0);
  g.add(body);
  const tummy = mesh(new THREE.SphereGeometry(0.15, 14, 12), belly, 0, 0.3, 0.1);
  tummy.scale.set(1, 1.4, 0.6);
  g.add(tummy);
  const head = mesh(new THREE.SphereGeometry(0.17, 18, 14), fur, 0, 0.7, 0.04);
  g.add(head);
  const ear = new THREE.SphereGeometry(0.05, 10, 10);
  g.add(mesh(ear, fur, -0.13, 0.82, 0), mesh(ear, fur, 0.13, 0.82, 0));
  g.add(mesh(new THREE.SphereGeometry(0.04, 10, 10), std(0x2a1a10), 0, 0.68, 0.2));
  eyes(g, 0.75, 0.15, 0.07);
  const tooth = new THREE.BoxGeometry(0.03, 0.06, 0.02);
  const toothMat = std(0xffffff, { roughness: 0.3 });
  g.add(mesh(tooth, toothMat, -0.02, 0.6, 0.19), mesh(tooth, toothMat, 0.02, 0.6, 0.19));
  const arm = new THREE.CapsuleGeometry(0.045, 0.12, 4, 8);
  const l = mesh(arm, fur, -0.2, 0.45, 0.1);
  l.rotation.z = 0.6;
  const r = mesh(arm, fur, 0.2, 0.45, 0.1);
  r.rotation.z = -0.6;
  g.add(l, r);
  return g;
}

/** Treasure chest with an open lid and a pile of coins. */
export function makeTreasure(): THREE.Group {
  const g = new THREE.Group();
  const wood = std(0x7a4a22);
  const gold = std(0xffc63a, { metalness: 0.7, roughness: 0.3 });
  const base = mesh(new THREE.BoxGeometry(0.5, 0.28, 0.34), wood, 0, 0.14, 0);
  g.add(base);
  const lid = new THREE.Group();
  lid.position.set(0, 0.28, -0.17);
  const lidMesh = mesh(new THREE.BoxGeometry(0.5, 0.16, 0.34), wood, 0, 0.08, 0.17);
  lid.add(lidMesh);
  lid.rotation.x = -1.9;
  g.add(lid);
  const bandGeo = new THREE.BoxGeometry(0.52, 0.06, 0.36);
  g.add(mesh(bandGeo, gold, 0, 0.12, 0), mesh(bandGeo, gold, 0, 0.24, 0));
  const coin = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12);
  for (let i = 0; i < 9; i++) {
    const c = mesh(coin, gold, (Math.random() - 0.5) * 0.36, 0.29 + Math.random() * 0.1, (Math.random() - 0.5) * 0.2);
    c.rotation.set(Math.random() * 0.6, Math.random() * 3, Math.random() * 0.6);
    g.add(c);
  }
  const gem = mesh(new THREE.OctahedronGeometry(0.07), std(0x4ad0ff, { metalness: 0.3, roughness: 0.2, emissive: 0x2288cc, emissiveIntensity: 0.4 }), 0.05, 0.4, 0.02);
  g.add(gem);
  return g;
}

/** A puddle left by a geyser: shimmering blue water (aqueduct) or thick glossy oil. */
export function makePuddle(oil: boolean): THREE.Group {
  const g = new THREE.Group();
  const mat = oil
    ? new THREE.MeshStandardMaterial({ color: 0x07070a, roughness: 0.08, metalness: 0.75, transparent: true, opacity: 0.97 })
    : new THREE.MeshStandardMaterial({ color: 0x3aa8ff, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.88, emissive: 0x1a5aa0, emissiveIntensity: 0.35 });
  const puddle = mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.05, 28), mat, 0, 0.025, 0);
  puddle.name = 'puddle';
  g.add(puddle);
  const ringMat = new THREE.MeshBasicMaterial({ color: oil ? 0x3a3a44 : 0xd8f1ff, transparent: true, opacity: 0.5, depthWrite: false });
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.12, 28), ringMat.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.055;
    ring.name = `ripple${i}`;
    g.add(ring);
  }
  return g;
}

/** Spiky naval-style mine. */
export function makeMine(): THREE.Group {
  const g = new THREE.Group();
  const black = std(0x1b1b1f, { roughness: 0.5, metalness: 0.4 });
  g.add(mesh(new THREE.SphereGeometry(0.22, 16, 12), black, 0, 0.24, 0));
  const spike = new THREE.ConeGeometry(0.04, 0.12, 6);
  const dirs = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [0, 0, -1],
    [0.7, 0.7, 0],
    [-0.7, 0.7, 0],
    [0, 0.7, 0.7],
    [0, 0.7, -0.7],
  ];
  for (const d of dirs) {
    const v = new THREE.Vector3(d[0]!, d[1]!, d[2]!).normalize();
    const s = mesh(spike, black);
    s.position.copy(v.clone().multiplyScalar(0.26)).add(new THREE.Vector3(0, 0.24, 0));
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    g.add(s);
  }
  const light = mesh(new THREE.SphereGeometry(0.05, 10, 10), std(0xff2222, { emissive: 0xff0000, emissiveIntensity: 2 }), 0, 0.47, 0);
  light.name = 'blink';
  g.add(light);
  return g;
}

/** Little red warning flag planted on a defused mine. */
export function makeFlag(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 6), std(0xdddddd, { metalness: 0.5, roughness: 0.4 }), 0, 0.35, 0));
  const cloth = mesh(new THREE.BoxGeometry(0.26, 0.16, 0.01), std(0xe63946, { roughness: 0.8 }), 0.13, 0.6, 0);
  cloth.name = 'cloth';
  g.add(cloth);
  const skull = mesh(new THREE.SphereGeometry(0.035, 8, 8), std(0xffffff), 0.13, 0.6, 0.008);
  g.add(skull);
  return g;
}

/** Coffin (lid separate so it can fly off). */
export function makeCoffin(): { group: THREE.Group; lid: THREE.Mesh; box: THREE.Mesh } {
  const group = new THREE.Group();
  const wood = std(0x4a2f1c, { roughness: 0.9 });
  const box = mesh(new THREE.BoxGeometry(0.34, 0.2, 0.7), wood, 0, 0.1, 0);
  const lid = mesh(new THREE.BoxGeometry(0.36, 0.06, 0.72), std(0x5d3b22), 0, 0.23, 0);
  const cross = std(0xd8d0c0);
  lid.add(mesh(new THREE.BoxGeometry(0.05, 0.02, 0.3), cross, 0, 0.04, 0.02));
  lid.add(mesh(new THREE.BoxGeometry(0.18, 0.02, 0.05), cross, 0, 0.04, -0.06));
  group.add(box, lid);
  return { group, lid, box };
}

/** Mummy: a wrapped body with a few segments so it can flop around. */
export function makeMummy(): THREE.Group {
  const g = new THREE.Group();
  const wrap = new THREE.MeshStandardMaterial({ map: bandageTexture(), roughness: 0.9 });
  const torso = mesh(new THREE.CapsuleGeometry(0.11, 0.3, 4, 10), wrap, 0, 0.35, 0);
  torso.name = 'torso';
  const head = mesh(new THREE.SphereGeometry(0.1, 12, 10), wrap, 0, 0.62, 0);
  const eyeMat = std(0x111111);
  head.add(mesh(new THREE.SphereGeometry(0.02, 6, 6), eyeMat, -0.035, 0.02, 0.09), mesh(new THREE.SphereGeometry(0.02, 6, 6), eyeMat, 0.035, 0.02, 0.09));
  const limb = new THREE.CapsuleGeometry(0.04, 0.22, 4, 8);
  const la = mesh(limb, wrap, -0.15, 0.4, 0.05);
  const ra = mesh(limb, wrap, 0.15, 0.4, 0.05);
  const ll = mesh(limb, wrap, -0.06, 0.1, 0);
  const rl = mesh(limb, wrap, 0.06, 0.1, 0);
  la.name = ra.name = ll.name = rl.name = 'limb';
  la.rotation.z = 0.9;
  ra.rotation.z = -0.9;
  g.add(torso, head, la, ra, ll, rl);
  return g;
}

export function makeTree(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const trunk = std(0x6b4423, { roughness: 0.95 });
  const pine = rng() < 0.5;
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.5, 8), trunk, 0, 0.25, 0));
  if (pine) {
    const leaf = std(0x2f7d3a, { roughness: 0.9 });
    const leaf2 = std(0x3c9448, { roughness: 0.9 });
    g.add(mesh(new THREE.ConeGeometry(0.42, 0.6, 9), leaf, 0, 0.6, 0));
    g.add(mesh(new THREE.ConeGeometry(0.34, 0.55, 9), leaf2, 0, 0.92, 0));
    g.add(mesh(new THREE.ConeGeometry(0.24, 0.5, 9), leaf, 0, 1.22, 0));
  } else {
    const leaf = std(0x4caf50, { roughness: 0.9 });
    const leaf2 = std(0x66bb6a, { roughness: 0.9 });
    g.add(mesh(new THREE.SphereGeometry(0.36, 12, 10), leaf, 0, 0.75, 0));
    g.add(mesh(new THREE.SphereGeometry(0.28, 12, 10), leaf2, 0.22, 0.95, 0.1));
    g.add(mesh(new THREE.SphereGeometry(0.26, 12, 10), leaf2, -0.2, 0.98, -0.08));
  }
  g.rotation.y = rng() * Math.PI * 2;
  const s = 0.85 + rng() * 0.3;
  g.scale.set(s, s, s);
  return g;
}

export function makeRock(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const stone = std(0x8d8d8d, { roughness: 1, flatShading: true });
  const big = mesh(new THREE.IcosahedronGeometry(0.34, 0), stone, 0, 0.22, 0);
  big.scale.set(1.1, 0.7, 0.9);
  big.rotation.set(rng() * 3, rng() * 3, rng() * 3);
  g.add(big);
  const small = mesh(new THREE.IcosahedronGeometry(0.16, 0), std(0x9c9c9c, { roughness: 1, flatShading: true }), 0.28, 0.1, 0.18);
  small.rotation.set(rng() * 3, rng() * 3, rng() * 3);
  g.add(small);
  return g;
}

/** Ammo held in the slingshot pouch / flying through the air. */
export function makeAmmo(id: AmmoId): THREE.Group {
  const g = new THREE.Group();
  switch (id) {
    case 'firecracker': {
      const body = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 10), std(0xd62828, { roughness: 0.5 }));
      body.rotation.z = 0.4;
      g.add(body);
      g.add(mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 10), std(0xf7d94c), 0, 0.05, 0).rotateZ(0.4));
      const fuse = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 5), std(0x333333), -0.04, 0.12, 0);
      fuse.rotation.z = 0.9;
      g.add(fuse);
      const spark = mesh(new THREE.SphereGeometry(0.02, 6, 6), std(0xffee88, { emissive: 0xffaa00, emissiveIntensity: 3 }), -0.07, 0.15, 0);
      spark.name = 'spark';
      g.add(spark);
      break;
    }
    case 'grenade': {
      const olive = std(0x4b5d2a, { roughness: 0.6 });
      const body = mesh(new THREE.SphereGeometry(0.1, 12, 10), olive);
      body.scale.set(1, 1.2, 1);
      g.add(body);
      g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8), std(0x888888, { metalness: 0.6, roughness: 0.4 }), 0, 0.13, 0));
      const lever = mesh(new THREE.BoxGeometry(0.02, 0.12, 0.03), std(0xaaaaaa, { metalness: 0.6 }), 0.05, 0.1, 0);
      lever.rotation.z = -0.3;
      g.add(lever);
      break;
    }
    case 'icbm': {
      const white = std(0xf0f0f0, { roughness: 0.4 });
      const red = std(0xd62828, { roughness: 0.4 });
      g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 10), white));
      g.add(mesh(new THREE.ConeGeometry(0.05, 0.1, 10), red, 0, 0.16, 0));
      const fin = new THREE.BoxGeometry(0.02, 0.07, 0.06);
      for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        const f = mesh(fin, red, Math.sin(a) * 0.06, -0.09, Math.cos(a) * 0.06);
        f.rotation.y = a;
        g.add(f);
      }
      const flame = mesh(new THREE.ConeGeometry(0.035, 0.12, 8), std(0xffa322, { emissive: 0xff6600, emissiveIntensity: 2 }), 0, -0.17, 0);
      flame.rotation.x = Math.PI;
      flame.name = 'flame';
      g.add(flame);
      break;
    }
    case 'disco': {
      const mirror = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.15, flatShading: true });
      g.add(mesh(new THREE.IcosahedronGeometry(0.11, 1), mirror));
      const fuse = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 5), std(0x333333), 0, 0.14, 0);
      g.add(fuse);
      const spark = mesh(new THREE.SphereGeometry(0.02, 6, 6), std(0xff66ff, { emissive: 0xff33ff, emissiveIntensity: 3 }), 0, 0.18, 0);
      spark.name = 'spark';
      g.add(spark);
      break;
    }
  }
  return g;
}

export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) mat.dispose();
  });
}
