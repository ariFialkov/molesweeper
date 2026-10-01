import * as THREE from 'three';

const numberCache = new Map<number, THREE.Texture>();

/** A number pressed into the dirt: a darker, softly edged indent with a lit top edge. */
export function numberTexture(n: number): THREE.Texture {
  const cached = numberCache.get(n);
  if (cached) return cached;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  const text = String(n);
  ctx.font = `900 ${size * 0.72}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // soft dark halo: packed earth around the indent
  ctx.shadowColor = 'rgba(25, 12, 4, 0.9)';
  ctx.shadowBlur = size * 0.07;
  ctx.fillStyle = 'rgba(28, 14, 5, 0.95)';
  ctx.fillText(text, size / 2, size * 0.54);
  ctx.shadowBlur = 0;
  // lit upper-left edge, as the sun catches the rim of the indent
  ctx.fillStyle = 'rgba(214, 170, 120, 0.7)';
  ctx.fillText(text, size / 2 - size * 0.018, size * 0.54 - size * 0.018);
  // the indent floor itself
  ctx.fillStyle = 'rgba(24, 12, 4, 0.97)';
  ctx.fillText(text, size / 2, size * 0.54);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  numberCache.set(n, tex);
  return tex;
}

export interface LabelOptions {
  text: string;
  color?: string;
  stroke?: string;
  size?: number; // world height
  sub?: string;
}

/** A billboard label (floating "+$1.20", "MOLE!") built from a canvas. */
export function makeLabel(o: LabelOptions): THREE.Sprite {
  const c = document.createElement('canvas');
  const w = 512;
  const h = o.sub ? 256 : 160;
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const font = (px: number) => `900 ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.font = font(o.sub ? 96 : 110);
  ctx.lineWidth = 18;
  ctx.strokeStyle = o.stroke ?? 'rgba(30,15,5,0.95)';
  ctx.strokeText(o.text, w / 2, o.sub ? 70 : h / 2);
  ctx.fillStyle = o.color ?? '#ffd84d';
  ctx.fillText(o.text, w / 2, o.sub ? 70 : h / 2);
  if (o.sub) {
    ctx.font = font(56);
    ctx.lineWidth = 12;
    ctx.strokeText(o.sub, w / 2, 180);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(o.sub, w / 2, 180);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  const height = o.size ?? 0.9;
  sprite.scale.set(height * (w / h), height, 1);
  sprite.renderOrder = 20;
  return sprite;
}

let burnTex: THREE.Texture | null = null;
/** Radial scorch mark. */
export function burnTexture(): THREE.Texture {
  if (burnTex) return burnTex;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(15,8,4,0.95)');
  g.addColorStop(0.5, 'rgba(25,12,6,0.7)');
  g.addColorStop(1, 'rgba(25,12,6,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  burnTex = new THREE.CanvasTexture(c);
  burnTex.colorSpace = THREE.SRGBColorSpace;
  return burnTex;
}
