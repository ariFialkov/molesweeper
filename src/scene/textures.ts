import * as THREE from 'three';

function noiseCanvas(size: number, base: [number, number, number], variance: number, speckles: number, speckleColors: string[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = (Math.random() - 0.5) * variance;
    img.data[i * 4] = Math.max(0, Math.min(255, base[0] + v));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, base[1] + v));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, base[2] + v));
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < speckles; i++) {
    ctx.fillStyle = speckleColors[Math.floor(Math.random() * speckleColors.length)]!;
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 1 + Math.random() * 3;
    ctx.fillRect(x, y, w, w * (0.5 + Math.random()));
  }
  return c;
}

let grass: THREE.Texture | null = null;
export function grassTexture(): THREE.Texture {
  if (grass) return grass;
  const c = noiseCanvas(256, [96, 160, 70], 40, 1800, ['#5fae4a', '#3f8a33', '#7cc95e', '#4c9a3c']);
  grass = new THREE.CanvasTexture(c);
  grass.colorSpace = THREE.SRGBColorSpace;
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(24, 24);
  grass.anisotropy = 4;
  return grass;
}

let dirt: THREE.Texture | null = null;
export function dirtTexture(): THREE.Texture {
  if (dirt) return dirt;
  const c = noiseCanvas(128, [176, 128, 82], 40, 420, ['#8a5e36', '#c9a070', '#6e4a2a', '#d9b585']);
  dirt = new THREE.CanvasTexture(c);
  dirt.colorSpace = THREE.SRGBColorSpace;
  dirt.wrapS = dirt.wrapT = THREE.RepeatWrapping;
  dirt.anisotropy = 4;
  return dirt;
}

let wood: THREE.Texture | null = null;
export function woodTexture(): THREE.Texture {
  if (wood) return wood;
  const c = noiseCanvas(64, [226, 214, 190], 30, 120, ['#cbbb9a', '#e9dfc7', '#b8a684']);
  wood = new THREE.CanvasTexture(c);
  wood.colorSpace = THREE.SRGBColorSpace;
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  return wood;
}
