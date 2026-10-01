import * as THREE from 'three';
import type { Sfx } from '../audio/sfx';
import { ITEM_LABEL, type AmmoId, type ItemType } from '../engine/config';
import { formatFactor, formatMoney } from '../engine/game';
import { disposeObject, makeCoffin, makeGroundhog, makeMine, makeMole, makeMummy, makePuddle, makeTreasure } from './items';
import type { SceneManager } from './scene';
import { burnTexture, makeLabel } from './text';
import { ease } from './tween';
import type { Yard } from './yard';

const DIRT = [0x6b4423, 0x8a5a33, 0x4e3218, 0xa0754a];
const SPARKS = [0xfff3a0, 0xffd23f, 0xff9f1c, 0xffffff];
const FIRE = [0xff6b00, 0xffb300, 0xff3d00, 0xffe066];
const SMOKE = [0x4a4a4a, 0x2f2f2f, 0x6b6b6b];
const GRASS = [0x5fae4a, 0x3f8a33, 0x7cc95e];
const CONFETTI = [0xff4d6d, 0xffd23f, 0x3bceac, 0x0ead69, 0x4d96ff, 0xc77dff, 0xffffff];
const WATER = [0x3aa8ff, 0x8fd3ff, 0xd8f1ff, 0xffffff];
const OIL = [0x07070a, 0x151518, 0x26262c, 0x0b0b10];
const WOOD = [0x5d3b22, 0x7a4a2a, 0x3e2614];

function setOpacity(obj: THREE.Object3D, opacity: number) {
  obj.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) {
      mat.transparent = true;
      mat.opacity = opacity;
      mat.depthWrite = opacity > 0.5;
    }
  });
}

export class Effects {
  constructor(
    private sm: SceneManager,
    private sfx: Sfx,
  ) {}

  private get scene() {
    return this.sm.scene;
  }
  private get tw() {
    return this.sm.tweens;
  }
  private get particles() {
    return this.sm.particles;
  }

  /** glowing sphere that expands and fades */
  private fireball(pos: THREE.Vector3, size: number, color: number, duration: number, rise = 0) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat);
    m.position.copy(pos);
    m.scale.setScalar(0.01);
    this.scene.add(m);
    void this.tw
      .run(
        duration,
        (t) => {
          m.scale.setScalar(size * (0.3 + 0.7 * t));
          m.position.y = pos.y + rise * t;
          mat.opacity = 0.95 * (1 - t);
        },
        ease.outCubic,
      )
      .then(() => {
        m.removeFromParent();
        disposeObject(m);
      });
  }

  private smokePuffs(pos: THREE.Vector3, count: number, size: number, life: number, dark = false) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: dark ? 0x333333 : 0x8a8a8a, transparent: true, opacity: 0.8, roughness: 1 });
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat);
      const off = new THREE.Vector3((Math.random() - 0.5) * size, Math.random() * size * 0.5, (Math.random() - 0.5) * size);
      m.position.copy(pos).add(off);
      const s0 = size * (0.3 + Math.random() * 0.4);
      m.scale.setScalar(0.01);
      this.scene.add(m);
      const drift = new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6);
      void this.tw
        .run(life + Math.random() * life * 0.5, (t) => {
          m.scale.setScalar(s0 * (0.4 + t * 1.4));
          m.position.addScaledVector(drift, 0.016);
          mat.opacity = 0.8 * (1 - t * t);
        })
        .then(() => {
          m.removeFromParent();
          disposeObject(m);
        });
    }
  }

  floatingText(pos: THREE.Vector3, text: string, opts: { sub?: string; color?: string; size?: number; duration?: number } = {}) {
    const label = makeLabel({ text, sub: opts.sub, color: opts.color, size: opts.size ?? 0.8 });
    label.position.copy(pos).add(new THREE.Vector3(0, 0.9, 0));
    this.scene.add(label);
    const mat = label.material as THREE.SpriteMaterial;
    const s = label.scale.clone();
    void this.tw
      .run(opts.duration ?? 1.8, (t) => {
        label.position.y = pos.y + 0.9 + t * 1.2;
        const k = t < 0.15 ? ease.outBack(t / 0.15) : 1;
        label.scale.copy(s).multiplyScalar(k);
        mat.opacity = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      })
      .then(() => {
        label.removeFromParent();
        mat.map?.dispose();
        mat.dispose();
      });
  }

  /** Ammo-specific impact visuals at a world position. Not the dirt: that is openCrater's job. */
  impact(ammo: AmmoId, pos: THREE.Vector3) {
    const p = pos.clone().add(new THREE.Vector3(0, 0.15, 0));
    switch (ammo) {
      case 'firecracker':
        this.sfx.pop();
        this.fireball(p, 0.35, 0xfff1a8, 0.25);
        this.particles.burst({ position: p, count: 60, colors: SPARKS, speed: [2, 6], spread: 1, gravity: 6, life: [0.25, 0.7], size: [0.03, 0.06] });
        this.smokePuffs(p, 3, 0.35, 0.8);
        this.sm.addShake(0.05);
        break;
      case 'grenade':
        this.sfx.flak();
        this.fireball(p, 0.7, 0xffc266, 0.3);
        this.particles.burst({ position: p, count: 90, colors: [...FIRE, ...SMOKE], speed: [5, 11], direction: new THREE.Vector3(0, 1, 0), spread: 0.45, gravity: 12, life: [0.5, 1.1], size: [0.05, 0.11] });
        this.smokePuffs(p, 6, 0.6, 1.2);
        this.sm.addShake(0.12);
        break;
      case 'icbm':
        this.sfx.nuke();
        this.fireball(p, 1.2, 0xff8c1a, 0.5);
        this.fireball(p.clone().add(new THREE.Vector3(0, 0.3, 0)), 0.8, 0xfff0b0, 0.3);
        this.mushroomCloud(p);
        this.particles.burst({ position: p, count: 110, colors: FIRE, speed: [3, 9], spread: 0.8, gravity: 5, life: [0.5, 1.2], size: [0.06, 0.14] });
        this.sm.addShake(0.3);
        break;
      case 'disco':
        this.sfx.pop();
        this.sfx.disco();
        this.fireball(p, 0.5, 0xff8de0, 0.3);
        this.particles.burst({ position: p, count: 180, colors: CONFETTI, speed: [3, 8], direction: new THREE.Vector3(0, 1, 0), spread: 0.6, gravity: 3.5, drag: 1.4, life: [1.5, 2.8], size: [0.07, 0.12], flat: true, fade: true });
        this.discoLights(2.6);
        this.sm.addShake(0.06);
        break;
    }
  }

  private mushroomCloud(pos: THREE.Vector3) {
    const capMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff4500, emissiveIntensity: 1.2, transparent: true, opacity: 0.95, roughness: 1 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), capMat);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, transparent: true, opacity: 0.85, roughness: 1 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 1, 12), stemMat);
    cap.position.copy(pos);
    stem.position.copy(pos);
    this.scene.add(cap, stem);
    void this.tw
      .run(
        2.2,
        (t) => {
          const h = 0.3 + t * 2.4;
          stem.scale.set(0.6 + t * 0.4, h, 0.6 + t * 0.4);
          stem.position.y = pos.y + h / 2;
          cap.position.y = pos.y + h + 0.2;
          const r = 0.4 + t * 0.9;
          cap.scale.set(r, r * 0.7, r);
          capMat.emissiveIntensity = 1.2 * (1 - t);
          capMat.color.setHex(0xff7a1a).lerp(new THREE.Color(0x555555), Math.min(1, t * 1.4));
          if (t > 0.6) {
            capMat.opacity = 0.95 * (1 - (t - 0.6) / 0.4);
            stemMat.opacity = 0.85 * (1 - (t - 0.6) / 0.4);
          }
        },
        ease.outCubic,
      )
      .then(() => {
        cap.removeFromParent();
        stem.removeFromParent();
        disposeObject(cap);
        disposeObject(stem);
      });
    this.smokePuffs(pos, 8, 0.9, 2, true);
  }

  private discoLights(duration: number) {
    const hemi = this.sm.hemi;
    const sun = this.sm.sun;
    const baseHemi = hemi.color.clone();
    const baseSun = sun.color.clone();
    const palette = [0xff3b8d, 0x3bf0ff, 0xffe600, 0x9d4dff, 0x2eff7a];
    this.tw.loop((_dt, elapsed) => {
      if (elapsed > duration) {
        hemi.color.copy(baseHemi);
        sun.color.copy(baseSun);
        return false;
      }
      const i = Math.floor(elapsed * 6) % palette.length;
      hemi.color.setHex(palette[i]!).lerp(baseHemi, 0.35);
      sun.color.setHex(palette[(i + 2) % palette.length]!).lerp(baseSun, 0.5);
      return true;
    });
  }

  /** Blow the square open: turf and soil fly, a crater appears, then the number (if any) fades in. */
  async openCrater(yard: Yard, index: number, number: number | null, big = false): Promise<void> {
    const pos = yard.cellPosition(index);
    this.sfx.dirt();
    this.particles.burst({ position: pos, count: big ? 160 : 70, colors: DIRT, speed: big ? [4, 12] : [2, 6], direction: new THREE.Vector3(0, 1, 0), spread: 0.55, gravity: 14, life: [0.5, 1.3], size: big ? [0.06, 0.16] : [0.04, 0.11] });
    this.particles.burst({ position: pos, count: big ? 60 : 30, colors: GRASS, speed: [2, 5], direction: new THREE.Vector3(0, 1, 0), spread: 0.7, gravity: 10, life: [0.5, 1.1], size: [0.05, 0.1], flat: true });
    await this.tw.delay(0.08);
    yard.makeCrater(index, big);
    const view = yard.tile(index);
    const crater = view.crater!;
    const rim = view.rim!;
    const s = rim.scale.clone();
    crater.scale.setScalar(0.01);
    rim.scale.setScalar(0.01);
    void this.tw.run(
      0.35,
      (k) => {
        crater.scale.setScalar(k);
        rim.scale.set(s.x * k, s.y * k, s.z * k);
      },
      ease.outBack,
    );
    if (number !== null) this.showNumber(yard, index, number);
  }

  /** Fade the pressed-in number into the crater floor. */
  showNumber(yard: Yard, index: number, number: number) {
    const decal = yard.setNumber(index, number);
    if (!decal) return;
    const mat = decal.material as THREE.MeshStandardMaterial;
    void this.tw.run(0.6, (k) => (mat.opacity = Math.max(mat.opacity, k)));
  }

  /** Squares the numbers proved safe: opened for free, one after another. */
  async autoOpen(yard: Yard, cells: { index: number; number: number; shown: boolean; grave: boolean }[]): Promise<void> {
    for (const c of cells) {
      void this.openCrater(yard, c.index, c.shown ? c.number : null);
      if (c.grave) void this.tw.delay(0.3).then(() => this.graveSequence(yard, c.index));
      await this.tw.delay(0.07);
    }
  }

  /** Squares the numbers proved to be mines: dug up, defused, flagged. */
  async flagMines(yard: Yard, cells: number[]): Promise<void> {
    for (const i of cells) {
      const pos = yard.cellPosition(i);
      this.particles.burst({ position: pos, count: 40, colors: DIRT, speed: [1.5, 4], direction: new THREE.Vector3(0, 1, 0), spread: 0.6, gravity: 12, life: [0.4, 0.9], size: [0.04, 0.09] });
      const { mine, flag } = yard.flagMine(i);
      mine.position.y = -0.35;
      flag.scale.set(1, 0.01, 1);
      this.sfx.click();
      void this.tw
        .run(0.4, (k) => (mine.position.y = -0.35 + 0.43 * k), ease.outBack)
        .then(() => {
          this.sfx.coin(4);
          return this.tw.run(0.3, (k) => flag.scale.set(1, k, 1), ease.outBack);
        });
      const blink = mine.getObjectByName('blink') as THREE.Mesh | undefined;
      if (blink) (blink.material as THREE.MeshStandardMaterial).color.setHex(0x44ff66);
      if (blink) (blink.material as THREE.MeshStandardMaterial).emissive.setHex(0x22cc44);
      const cloth = flag.getObjectByName('cloth') as THREE.Mesh | undefined;
      if (cloth) {
        this.tw.loop((_dt, el) => {
          if (!cloth.parent) return false;
          cloth.rotation.y = Math.sin(el * 5) * 0.25;
          return true;
        });
      }
      this.floatingText(pos, 'Defused', { color: '#ff9b9b', size: 0.5, duration: 1.4 });
      await this.tw.delay(0.12);
    }
  }

  /**
   * Pop the item out of the crater with a bounce and a floating prize. After a while the prize
   * leaves again (moles burrow, chests sink, pumps run dry) and, if this square is readable,
   * the number it was hiding fades into the crater floor.
   */
  async revealItem(yard: Yard, index: number, item: ItemType, gain: number, factor: number, ammo: AmmoId, shotNumber: number, numberAfter: number | null, oilMultiplier = 0): Promise<void> {
    const pos = yard.cellPosition(index);
    let obj: THREE.Group | null = null;
    switch (item) {
      case 'mole':
        obj = makeMole();
        break;
      case 'groundhog':
        obj = makeGroundhog();
        break;
      case 'treasure':
        obj = makeTreasure();
        break;
      case 'aqueduct':
      case 'oil': {
        const oil = item === 'oil';
        await this.geyser(pos, oil);
        obj = makePuddle(oil);
        break;
      }
      case 'grave':
        await this.graveSequence(yard, index);
        if (numberAfter !== null) this.showNumber(yard, index, numberAfter);
        return;
      case 'nothing':
        this.floatingText(pos, 'Nothing', { color: '#d8d0c0', size: 0.5, duration: 1.2 });
        if (numberAfter !== null) this.showNumber(yard, index, numberAfter);
        return;
    }
    yard.placeItem(index, obj);
    const puddle = item === 'aqueduct' || item === 'oil';
    obj.scale.setScalar(0.01);
    obj.position.y = puddle ? 0.1 : -0.3;
    if (item === 'mole' || item === 'groundhog') this.sfx.squeak();
    if (item === 'treasure') this.sfx.fanfare();
    if (item === 'aqueduct') this.sfx.coin(2);
    if (item === 'oil') this.sfx.jackpot();
    const finalY = 0.1;
    const o = obj;
    void this.tw.run(
      puddle ? 0.7 : 0.45,
      (k) => {
        o.scale.setScalar(k);
        if (!puddle) o.position.y = -0.3 + (finalY + 0.3) * k;
      },
      puddle ? ease.outCubic : ease.outBack,
    );
    const label =
      item === 'oil' ? `×${oilMultiplier}` : item === 'aqueduct' ? `${formatFactor(factor)}` : `+${formatMoney(gain)}`;
    const sub =
      item === 'aqueduct' || item === 'oil' ? `${ITEM_LABEL[item]} · +${formatMoney(gain)}` : ITEM_LABEL[item];
    this.floatingText(pos, label, { sub, color: item === 'oil' ? '#7cf5ff' : item === 'aqueduct' ? '#8fd3ff' : item === 'treasure' ? '#ffd84d' : '#ffe58a' });
    this.sfx.coin(shotNumber);

    // ambient item behaviour
    if (puddle) {
      const oil = item === 'oil';
      const ripples = [0, 1, 2].map((i) => o.getObjectByName(`ripple${i}`) as THREE.Mesh);
      this.tw.loop((_dt, el) => {
        if (!o.parent) return false;
        ripples.forEach((r, i) => {
          const t = ((el * (oil ? 0.35 : 0.6) + i / 3) % 1);
          r.scale.setScalar(0.3 + t * 2.6);
          (r.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - t);
        });
        if (oil && Math.random() < 0.08) {
          this.particles.burst({ position: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.1, (Math.random() - 0.5) * 0.4)), count: 2, colors: OIL, speed: [0.6, 1.4], direction: new THREE.Vector3(0, 1, 0), spread: 0.3, gravity: 9, life: [0.3, 0.6], size: [0.04, 0.08] });
        }
        return true;
      });
    }
    if (item === 'treasure') {
      this.particles.burst({ position: pos.clone().add(new THREE.Vector3(0, 0.4, 0)), count: 40, colors: [0xffd23f, 0xfff3a0, 0xffffff], speed: [1.5, 4], spread: 0.8, gravity: 5, life: [0.5, 1.2], size: [0.03, 0.07] });
    }
    let linger = 2.6;
    if (ammo === 'disco' && (item === 'mole' || item === 'groundhog')) {
      await this.tw.delay(0.45);
      this.dance(o, 2.4);
      linger = 2.6;
    }
    if (item === 'aqueduct') linger = 3.2;
    if (item === 'oil') linger = 5;
    await this.tw.delay(linger);
    await this.leave(yard, index, o, item);
    if (numberAfter !== null) this.showNumber(yard, index, numberAfter);
  }

  /** A column of water or oil erupts from the crater, hangs, then rains down. */
  private async geyser(pos: THREE.Vector3, oil: boolean): Promise<void> {
    const colors = oil ? OIL : WATER;
    const height = oil ? 3.4 : 2.8;
    const jetMat = new THREE.MeshStandardMaterial({
      color: oil ? 0x0a0a0e : 0x6cc3ff,
      roughness: oil ? 0.1 : 0.2,
      metalness: oil ? 0.6 : 0.1,
      transparent: true,
      opacity: oil ? 0.95 : 0.7,
      emissive: oil ? 0x000000 : 0x1a5aa0,
      emissiveIntensity: 0.3,
    });
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 1, 14, 1, true), jetMat);
    jet.position.copy(pos);
    this.scene.add(jet);
    if (oil) this.sfx.nuke();
    else this.sfx.flak();
    this.sm.addShake(oil ? 0.25 : 0.12);
    const duration = oil ? 2.2 : 1.7;
    let emitted = 0;
    await this.tw.run(duration, (t, dt) => {
      // rise fast, hold, collapse
      const h = t < 0.25 ? ease.outCubic(t / 0.25) : t < 0.7 ? 1 : 1 - ease.inQuad((t - 0.7) / 0.3);
      const H = Math.max(0.01, h * height);
      jet.scale.set(1 + Math.sin(t * 40) * 0.08, H, 1 + Math.cos(t * 37) * 0.08);
      jet.position.y = pos.y + H / 2;
      jetMat.opacity = (oil ? 0.95 : 0.7) * Math.min(1, h * 1.5);
      emitted += dt;
      if (emitted > 0.03 && t < 0.72) {
        emitted = 0;
        this.particles.burst({
          position: pos.clone().add(new THREE.Vector3(0, H, 0)),
          count: oil ? 6 : 8,
          colors,
          speed: oil ? [1, 3.5] : [1.5, 4.5],
          direction: new THREE.Vector3(0, 1, 0),
          spread: 0.7,
          gravity: oil ? 9 : 12,
          life: [0.6, 1.3],
          size: oil ? [0.07, 0.14] : [0.04, 0.09],
          fade: true,
        });
      }
    });
    jet.removeFromParent();
    disposeObject(jet);
    // the splash-down
    this.particles.burst({ position: pos.clone().add(new THREE.Vector3(0, 0.2, 0)), count: oil ? 50 : 60, colors, speed: [1, 3], direction: new THREE.Vector3(0, 1, 0), spread: 0.9, gravity: 12, life: [0.3, 0.8], size: oil ? [0.05, 0.1] : [0.03, 0.07] });
    this.sfx.dirt();
  }

  /** The prize goes back where it came from. */
  private async leave(yard: Yard, index: number, obj: THREE.Group, item: ItemType): Promise<void> {
    const pos = yard.cellPosition(index);
    const y0 = obj.position.y;
    if (item === 'mole' || item === 'groundhog') {
      this.sfx.squeak();
      // a little look around, then dive
      await this.tw.run(0.35, (k) => (obj.rotation.y = Math.sin(k * Math.PI * 2) * 0.6));
      this.sfx.dirt();
      this.particles.burst({ position: pos, count: 18, colors: DIRT, speed: [1, 3], direction: new THREE.Vector3(0, 1, 0), spread: 0.7, gravity: 12, life: [0.3, 0.7], size: [0.03, 0.07] });
      await this.tw.run(
        0.35,
        (k) => {
          obj.position.y = y0 - 0.9 * k;
          obj.scale.set(1 + k * 0.2, 1 - k * 0.3, 1 + k * 0.2);
        },
        ease.inQuad,
      );
    } else if (item === 'aqueduct' || item === 'oil') {
      // the puddle soaks into the ground
      await this.tw.run(0.9, (k) => {
        obj.scale.set(1 - k * 0.9, 1 - k, 1 - k * 0.9);
        setOpacity(obj, 1 - k);
      });
    } else {
      // the chest sinks back into the ground
      this.sfx.thud();
      this.particles.burst({ position: pos, count: 14, colors: DIRT, speed: [0.8, 2], direction: new THREE.Vector3(0, 1, 0), spread: 0.8, gravity: 12, life: [0.3, 0.6], size: [0.03, 0.06] });
      await this.tw.run(0.6, (k) => (obj.position.y = y0 - 0.9 * k), ease.inQuad);
    }
    yard.clearItem(index);
  }

  /** The mole gets down. */
  dance(obj: THREE.Object3D, duration: number) {
    const baseY = obj.position.y;
    this.tw.loop((_dt, el) => {
      if (!obj.parent) return false;
      if (el > duration) {
        obj.rotation.set(0, 0, 0);
        obj.position.y = baseY;
        obj.scale.setScalar(1);
        return false;
      }
      const beat = el * (128 / 60) * Math.PI;
      obj.position.y = baseY + Math.abs(Math.sin(beat)) * 0.25;
      obj.rotation.y = Math.sin(beat / 2) * 0.9;
      obj.rotation.z = Math.sin(beat) * 0.25;
      obj.scale.set(1 + Math.sin(beat) * 0.1, 1 - Math.sin(beat) * 0.1, 1 + Math.sin(beat) * 0.1);
      return true;
    });
  }

  /** Mine: it pops up, blinks, and takes the yard with it. */
  async mineExplosion(yard: Yard, index: number): Promise<void> {
    const pos = yard.cellPosition(index);
    await this.openCrater(yard, index, null);
    const mine = makeMine();
    yard.placeItem(index, mine);
    mine.scale.setScalar(0.01);
    this.sfx.squeak();
    await this.tw.run(0.3, (k) => mine.scale.setScalar(k), ease.outBack);
    const blink = mine.getObjectByName('blink') as THREE.Mesh | undefined;
    for (let i = 0; i < 3; i++) {
      if (blink) blink.visible = false;
      this.sfx.click();
      await this.tw.delay(0.12);
      if (blink) blink.visible = true;
      await this.tw.delay(0.12);
    }
    mine.removeFromParent();
    disposeObject(mine);
    this.sfx.kaboom();
    this.sm.addShake(0.9);
    const p = pos.clone().add(new THREE.Vector3(0, 0.3, 0));
    this.fireball(p, 2.4, 0xff9a1a, 0.7, 0.4);
    this.fireball(p, 1.4, 0xfff0b0, 0.4, 0.2);
    this.particles.burst({ position: p, count: 220, colors: [...FIRE, ...DIRT], speed: [5, 16], spread: 0.8, gravity: 12, life: [0.7, 1.8], size: [0.06, 0.18] });
    this.particles.burst({ position: p, count: 120, colors: WOOD, speed: [4, 12], spread: 0.9, gravity: 12, life: [1, 2.2], size: [0.08, 0.2], flat: true });
    this.smokePuffs(p, 14, 1.4, 2.6, true);
    yard.scorch(pos);
    const t = yard.tile(index);
    if (t.crater) (t.crater.material as THREE.MeshStandardMaterial).color.setHex(0x120c08);
    await this.tw.delay(0.9);
  }

  /** Coffin bursts, mummy flies, lands in a heap and fades. */
  private async graveSequence(yard: Yard, index: number): Promise<void> {
    const pos = yard.cellPosition(index);
    const { group, lid, box } = makeCoffin();
    yard.placeItem(index, group);
    group.position.y = -0.25;
    this.sfx.spooky();
    await this.tw.run(0.5, (k) => (group.position.y = -0.25 + 0.35 * k), ease.outCubic);
    await this.tw.delay(0.25);
    // lid flies off, box splinters
    this.sfx.flak();
    this.sm.addShake(0.15);
    this.particles.burst({ position: pos.clone().add(new THREE.Vector3(0, 0.3, 0)), count: 70, colors: WOOD, speed: [3, 8], direction: new THREE.Vector3(0, 1, 0), spread: 0.6, gravity: 12, life: [0.8, 1.6], size: [0.05, 0.14], flat: true });
    this.smokePuffs(pos, 4, 0.6, 1);
    box.visible = false;
    const lidVel = new THREE.Vector3((Math.random() - 0.5) * 3, 7, (Math.random() - 0.5) * 3);
    const lidSpin = new THREE.Vector3(6, 2, 4);
    this.tw.loop((dt) => {
      lidVel.y -= 14 * dt;
      lid.position.addScaledVector(lidVel, dt);
      lid.rotation.x += lidSpin.x * dt;
      lid.rotation.z += lidSpin.z * dt;
      if (lid.position.y < -0.05) {
        lid.position.y = -0.05;
        return false;
      }
      return true;
    });
    const mummy = makeMummy();
    mummy.position.copy(pos).setY(0.05);
    this.scene.add(mummy);
    const vel = new THREE.Vector3((Math.random() - 0.5) * 2.5, 8.5 + Math.random() * 1.5, (Math.random() - 0.5) * 2.5);
    const spin = new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 8);
    const limbs = mummy.children.filter((c) => c.name === 'limb');
    let landed = false;
    let bounces = 0;
    await new Promise<void>((resolve) => {
      this.tw.loop((dt, el) => {
        if (!landed) {
          vel.y -= 16 * dt;
          mummy.position.addScaledVector(vel, dt);
          mummy.rotation.x += spin.x * dt;
          mummy.rotation.y += spin.y * dt;
          mummy.rotation.z += spin.z * dt;
          limbs.forEach((l, i) => (l.rotation.x = Math.sin(el * 14 + i) * 1.2));
          if (mummy.position.y < 0.15 && vel.y < 0) {
            bounces++;
            this.sfx.thud();
            this.particles.burst({ position: mummy.position.clone(), count: 15, colors: DIRT, speed: [1, 3], spread: 0.7, gravity: 12, life: [0.3, 0.7], size: [0.03, 0.07] });
            if (bounces >= 2) {
              landed = true;
              mummy.position.y = 0.15;
              mummy.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.6, mummy.rotation.y, (Math.random() - 0.5) * 0.5);
              limbs.forEach((l) => (l.rotation.x = (Math.random() - 0.5) * 1.5));
              resolve();
              return false;
            }
            vel.y = Math.abs(vel.y) * 0.35;
            vel.x *= 0.5;
            vel.z *= 0.5;
            spin.multiplyScalar(0.4);
          }
        }
        return true;
      });
    });
    this.floatingText(pos, 'Secret grave', { sub: "we're just gonna ignore this one · +$0.00", color: '#cfd8dc', size: 0.7, duration: 3 });
    await this.tw.delay(1.6);
    await this.tw.run(1.2, (k) => {
      setOpacity(mummy, 1 - k);
      setOpacity(lid, 1 - k);
    });
    mummy.removeFromParent();
    disposeObject(mummy);
    group.removeFromParent();
    disposeObject(group);
  }

  /** A scorch mark on a tree or rock near the impact point, fading away. */
  burnMark(yard: Yard, index: number, ammo: AmmoId) {
    const prop = yard.props.get(index);
    const pos = yard.cellPosition(index);
    const hit = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.4 + Math.random() * 0.5, 0.25));
    this.impact(ammo, hit);
    if (!prop) return;
    const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: burnTexture(), transparent: true, opacity: 0.95, depthWrite: false }));
    mark.scale.setScalar(0.45);
    mark.position.copy(hit).add(new THREE.Vector3(0, 0, 0.12));
    this.scene.add(mark);
    this.smokePuffs(hit, 3, 0.3, 1.4, true);
    this.sfx.sizzle();
    const mat = mark.material;
    void this.tw.run(2.6, (k) => (mat.opacity = 0.95 * (1 - k * k))).then(() => {
      mark.removeFromParent();
      mat.dispose();
    });
    // the prop flinches
    const s = prop.scale.clone();
    void this.tw.run(0.5, (k) => {
      const w = Math.sin(k * Math.PI * 3) * (1 - k) * 0.08;
      prop.scale.set(s.x * (1 + w), s.y * (1 - w), s.z * (1 + w));
    });
  }

  /** A dud on an already open square. */
  dud(pos: THREE.Vector3) {
    this.sfx.thud();
    this.particles.burst({ position: pos, count: 12, colors: DIRT, speed: [1, 2.5], spread: 0.8, gravity: 12, life: [0.3, 0.6], size: [0.03, 0.06] });
  }

  clear() {
    this.particles.clear();
  }
}
