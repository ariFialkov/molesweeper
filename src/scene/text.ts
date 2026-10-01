import * as THREE from 'three';

const numberCache = new Map<string, THREE.Texture>();

/** A number (or an unreadable "?") pressed into the dirt: darker, softly edged, like a discoloured indent. */
export function numberTexture(n: number | '?'): THREE.Texture {
  const key = String(n);
  const cached = numberCache.get(key);
  if (cached) return cached;
  const unreadable = n === '?';
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.font = `900 ${size * 0.7}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // soft halo of darker earth
  const text = String(n);
  const alpha = unreadable ? 0.8 : 1;
  ctx.font = `900 ${size * 0.78}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  // dark pressed shadow below, lighter dry-earth face on top: reads as an indent in the soil
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.07;
  ctx.strokeStyle = `rgba(30, 16, 6, ${0.9 * alpha})`;
  ctx.strokeText(text, size / 2, size * 0.56);
  ctx.fillStyle = `rgba(30, 16, 6, ${0.9 * alpha})`;
  ctx.fillText(text, size / 2 + size * 0.02, size * 0.58);
  ctx.fillStyle = unreadable ? `rgba(196, 160, 118, ${alpha})` : `rgba(236, 204, 156, ${alpha})`;
  ctx.fillText(text, size / 2, size * 0.54);
  if (unreadable) {
    // crumbled dirt over the mark
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(120, 85, 50, 0.85)' : 'rgba(70, 45, 22, 0.85)';
      const x = size * (0.3 + Math.random() * 0.4);
      const y = size * (0.2 + Math.random() * 0.6);
      const w = size * (0.025 + Math.random() * 0.05);
      ctx.fillRect(x, y, w, w * 0.6);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  numberCache.set(key, tex);
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

let bandageTex: THREE.Texture | null = null;
export function bandageTexture(): THREE.Texture {
  if (bandageTex) return bandageTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e9e2cf';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(120,100,70,0.6)';
  ctx.lineWidth = 3;
  for (let i = -64; i < 128; i += 12) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 40, 64);
    ctx.stroke();
  }
  bandageTex = new THREE.CanvasTexture(c);
  bandageTex.colorSpace = THREE.SRGBColorSpace;
  bandageTex.wrapS = bandageTex.wrapT = THREE.RepeatWrapping;
  bandageTex.repeat.set(2, 3);
  return bandageTex;
}
