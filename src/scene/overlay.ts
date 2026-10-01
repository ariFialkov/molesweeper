import * as THREE from 'three';
import type { Layout } from '../engine/config';

export type OverlayState = 'hidden' | 'revealed' | 'dead' | 'flagged' | 'scorched';

/**
 * The translucent "digital" grid drawn over the lawn: glowing rounded outlines for
 * squares still in play, dimmed for opened ones, dashed for trees & rocks.
 */
export class GridOverlay {
  readonly mesh: THREE.Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private states: OverlayState[];
  private cell = 128;
  private pulse = 0;

  constructor(
    private layout: Layout,
    pitch: number,
    kinds: ('dirt' | 'tree' | 'rock')[],
  ) {
    const { cols, rows } = layout;
    this.canvas = document.createElement('canvas');
    this.canvas.width = cols * this.cell;
    this.canvas.height = rows * this.cell;
    this.ctx = this.canvas.getContext('2d')!;
    this.states = kinds.map((k) => (k === 'dirt' ? 'hidden' : 'dead'));
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    const mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, opacity: 1 });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(cols * pitch, rows * pitch), mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.03;
    this.mesh.renderOrder = 1;
    this.redraw();
  }

  setState(i: number, s: OverlayState) {
    this.states[i] = s;
    this.redraw();
  }

  scorch() {
    this.states = this.states.map((s) => (s === 'dead' ? s : 'scorched'));
    this.redraw();
  }

  /** gentle breathing of the hidden outlines */
  update(dt: number) {
    this.pulse += dt;
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = 0.86 + Math.sin(this.pulse * 1.8) * 0.1;
  }

  private redraw() {
    const { cols, rows } = this.layout;
    const ctx = this.ctx;
    const c = this.cell;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const inset = 7;
    const radius = 18;
    for (let r = 0; r < rows; r++) {
      for (let q = 0; q < cols; q++) {
        const s = this.states[r * cols + q]!;
        const x = q * c + inset;
        const y = r * c + inset;
        const w = c - inset * 2;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, w, w, radius);
        ctx.setLineDash([]);
        switch (s) {
          case 'hidden':
            ctx.shadowColor = 'rgba(190, 255, 240, 0.9)';
            ctx.shadowBlur = 14;
            ctx.fillStyle = 'rgba(255,255,255,0.07)';
            ctx.fill();
            ctx.lineWidth = 5;
            ctx.strokeStyle = 'rgba(255,255,255,0.78)';
            ctx.stroke();
            break;
          case 'revealed':
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(255,255,255,0.22)';
            ctx.stroke();
            break;
          case 'dead':
            ctx.setLineDash([10, 10]);
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(255,255,255,0.22)';
            ctx.stroke();
            break;
          case 'flagged':
            ctx.shadowColor = 'rgba(255, 80, 80, 0.9)';
            ctx.shadowBlur = 12;
            ctx.fillStyle = 'rgba(255,60,60,0.12)';
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(255,110,110,0.8)';
            ctx.stroke();
            break;
          case 'scorched':
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(255,120,80,0.35)';
            ctx.stroke();
            break;
        }
        ctx.restore();
      }
    }
    this.tex.needsUpdate = true;
  }
}
