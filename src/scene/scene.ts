import * as THREE from 'three';
import { Particles } from './particles';
import { Tweens } from './tween';

/** Renderer, camera, lights and the frame loop. */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly tweens = new Tweens();
  readonly particles: Particles;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private timer = new THREE.Timer();
  private shake = 0;
  private shakeTime = 0;
  private baseCamPos = new THREE.Vector3(0, 9, 9);
  private lookAt = new THREE.Vector3(0, 0, 0);
  private updaters: ((dt: number) => void)[] = [];
  private fitBox: { minX: number; maxX: number; minZ: number; maxZ: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene.background = new THREE.Color(0x9fd6f5);
    this.scene.fog = new THREE.Fog(0x9fd6f5, 26, 60);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    this.camera.position.copy(this.baseCamPos);
    this.camera.lookAt(this.lookAt);

    this.hemi = new THREE.HemisphereLight(0xcfe9ff, 0x4a6b2a, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d6, 2.2);
    this.sun.position.set(6, 12, 5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 40;
    this.sun.shadow.camera.left = -12;
    this.sun.shadow.camera.right = 12;
    this.sun.shadow.camera.top = 12;
    this.sun.shadow.camera.bottom = -12;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.particles = new Particles(this.scene);

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  onUpdate(fn: (dt: number) => void) {
    this.updaters.push(fn);
  }

  offUpdate(fn: (dt: number) => void) {
    this.updaters = this.updaters.filter((f) => f !== fn);
  }

  /** Frame the board so it fills the screen above the slingshot / HUD, on any aspect ratio. */
  fitTo(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }) {
    this.fitBox = bounds;
    this.refit();
  }

  private refit() {
    if (!this.fitBox) return;
    const b = this.fitBox;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const portrait = window.innerHeight > window.innerWidth;
    // elevation: more top-down for portrait so the long board fits
    const elev = portrait ? THREE.MathUtils.degToRad(58) : THREE.MathUtils.degToRad(50);
    const dir = new THREE.Vector3(0, Math.sin(elev), Math.cos(elev));
    this.lookAt.set(cx, 0, cz + (portrait ? 0.3 : 0.2));
    // the board plus a sliver of lawn (the fence may run under the HUD)
    const f = 0.22;
    const corners = [
      new THREE.Vector3(b.minX - f, 0, b.minZ - f),
      new THREE.Vector3(b.maxX + f, 0, b.minZ - f),
      new THREE.Vector3(b.minX - f, 0, b.maxZ + f),
      new THREE.Vector3(b.maxX + f, 0, b.maxZ + f),
      new THREE.Vector3(b.minX, 0.7, b.minZ),
      new THREE.Vector3(b.maxX, 0.7, b.minZ),
    ];
    // NDC limits: fill the screen, leaving only the top bar and the bottom panel
    const limX = 0.995;
    const topY = portrait ? 0.84 : 0.86;
    const botY = -0.66;
    let lo = 4;
    let hi = 60;
    const fits = (dist: number) => {
      this.camera.position.copy(this.lookAt).addScaledVector(dir, dist);
      this.camera.lookAt(this.lookAt);
      this.camera.updateMatrixWorld();
      for (const c of corners) {
        const p = c.clone().project(this.camera);
        if (Math.abs(p.x) > limX || p.y > topY || p.y < botY) return false;
      }
      return true;
    };
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    this.camera.position.copy(this.lookAt).addScaledVector(dir, hi);
    this.camera.lookAt(this.lookAt);
    this.baseCamPos.copy(this.camera.position);
    this.sun.target.position.set(cx, 0, cz);
    this.sun.position.set(cx + 6, 12, cz + 5);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.refit();
  }

  addShake(amount: number) {
    this.shake = Math.max(this.shake, amount);
    this.shakeTime = 0;
  }

  /** Project a world position to CSS pixels. */
  toScreen(p: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const v = p.clone().project(this.camera);
    return {
      x: ((v.x + 1) / 2) * window.innerWidth,
      y: ((1 - v.y) / 2) * window.innerHeight,
      visible: v.z < 1,
    };
  }

  start() {
    const frame = (time: number) => {
      this.timer.update(time);
      const dt = Math.min(0.05, this.timer.getDelta());
      this.tweens.update(dt);
      this.particles.update(dt);
      for (const u of this.updaters) u(dt);
      if (this.shake > 0.001) {
        this.shakeTime += dt;
        const s = this.shake * Math.exp(-this.shakeTime * 4);
        this.camera.position.set(
          this.baseCamPos.x + (Math.random() - 0.5) * s,
          this.baseCamPos.y + (Math.random() - 0.5) * s,
          this.baseCamPos.z + (Math.random() - 0.5) * s,
        );
        if (s < 0.005) {
          this.shake = 0;
          this.camera.position.copy(this.baseCamPos);
        }
      }
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
