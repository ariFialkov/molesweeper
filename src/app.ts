import * as THREE from 'three';
import { Sfx } from './audio/sfx';
import { ITEM_LABEL, LAYOUTS, type AmmoDef, type ItemType, type Layout } from './engine/config';
import { Game, formatFactor, formatMoney, type ShotResult } from './engine/game';
import { AimInput, type Pull } from './input/aim';
import { Effects } from './scene/effects';
import { disposeObject } from './scene/items';
import { SceneManager } from './scene/scene';
import { Slingshot } from './scene/slingshot';
import { ease } from './scene/tween';
import { Yard } from './scene/yard';
import { Hud } from './ui/hud';
import { Wallet } from './ui/wallet';

const ITEM_EMOJI: Record<ItemType, string> = {
  nothing: '🕳️',
  mole: '🐹',
  groundhog: '🦫',
  treasure: '💎',
  aqueduct: '🏛️',
  oil: '🛢️',
};

/** ?seed=<hex> replays a specific backyard (the round number shown under the prize). */
function seedFromUrl(): number | undefined {
  const raw = new URLSearchParams(location.search).get('seed');
  if (!raw) return undefined;
  const v = parseInt(raw, 16);
  return Number.isFinite(v) ? v >>> 0 : undefined;
}

export class App {
  private sm: SceneManager;
  private hud: Hud;
  private sfx = new Sfx();
  private wallet = new Wallet();
  private effects: Effects;
  private slingshot: Slingshot;
  private aim: AimInput;
  private game: Game | null = null;
  private yard: Yard | null = null;
  private busy = false;
  private targetIndex = -1;
  private targetPoint = new THREE.Vector3();
  private reticle: THREE.Mesh;
  private reticleMat: THREE.MeshBasicMaterial;
  private trajectory: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private bestFactor = 1;

  private get tw() {
    return this.sm.tweens;
  }

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement) {
    this.sm = new SceneManager(canvas);
    this.effects = new Effects(this.sm, this.sfx);
    this.slingshot = new Slingshot(this.sm.camera, this.sm.tweens);
    this.sm.scene.add(this.sm.camera);

    this.reticleMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthWrite: false });
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 4, 1), this.reticleMat);
    this.reticle.rotation.x = -Math.PI / 2;
    this.reticle.position.y = 0.2;
    this.reticle.visible = false;
    this.reticle.renderOrder = 5;
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), this.reticleMat);
    this.reticle.add(dot);
    this.sm.scene.add(this.reticle);

    this.trajectory = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }), 16);
    this.trajectory.visible = false;
    this.trajectory.frustumCulled = false;
    this.sm.scene.add(this.trajectory);

    this.hud = new Hud(
      hudRoot,
      {
        onStart: (ammo) => this.startRound(ammo),
        onCashOut: () => this.cashOut(),
        onToggleSound: () => {
          this.sfx.unlock();
          this.sfx.setMuted(!this.sfx.muted);
          return !this.sfx.muted;
        },
        onResetWallet: () => {
          this.wallet.reset();
          this.hud.setBalance(this.wallet.balance);
          this.hud.showLobby(this.wallet.balance);
        },
      },
      !this.sfx.muted,
    );
    this.hud.setBalance(this.wallet.balance);

    this.aim = new AimInput(canvas, {
      onStart: () => this.onAimStart(),
      onMove: (p) => this.onAimMove(p),
      onRelease: (p) => this.onAimRelease(p),
      onCancel: () => this.onAimCancel(),
    });
    window.addEventListener('pointerdown', () => this.sfx.unlock(), { once: true });
    window.addEventListener('keydown', () => this.sfx.unlock(), { once: true });

    this.sm.onUpdate((dt) => {
      this.slingshot.update(dt);
      this.yard?.update(dt);
    });

    // a first yard just for the lobby backdrop
    this.showLobbyYard();
    this.hud.showLobby(this.wallet.balance);
    this.sm.start();
  }

  private pickLayout(): Layout {
    return window.innerHeight > window.innerWidth ? LAYOUTS.portrait : LAYOUTS.landscape;
  }

  private showLobbyYard() {
    const preview = new Game({ layout: this.pickLayout(), ammo: { id: 'firecracker', name: '', bet: 0, blurb: '', emoji: '' } });
    this.buildYard(preview);
  }

  private buildYard(game: Game) {
    if (this.yard) this.yard.dispose();
    this.effects.clear();
    this.yard = new Yard(game.board);
    this.sm.scene.add(this.yard.group);
    this.sm.fitTo(this.yard.bounds);
  }

  private startRound(ammo: AmmoDef) {
    if (!this.wallet.canAfford(ammo.bet)) return;
    this.sfx.unlock();
    this.sfx.click();
    this.wallet.debit(ammo.bet);
    this.hud.setBalance(this.wallet.balance);
    this.game = new Game({ layout: this.pickLayout(), ammo, seed: seedFromUrl() });
    this.bestFactor = 1;
    this.buildYard(this.game);
    this.slingshot.setAmmo(ammo.id);
    this.hud.showRound(this.roundView());
    this.aim.enabled = true;
    this.busy = false;
  }

  private roundView() {
    const g = this.game!;
    return { total: g.displayedTotal, shots: g.shots, mines: g.minesLeft, canCashOut: g.canCashOut, bet: g.bet, ammo: g.ammo, seed: g.seed };
  }

  // ---------- aiming ----------

  private onAimStart() {
    if (!this.game || this.busy) return;
    this.sfx.stretch();
  }

  /** Free aim: the pull maps to a continuous impact point on the lawn, clamped to the board. */
  private computeTarget(p: Pull) {
    const y = this.yard!;
    const b = y.bounds;
    const cx = (b.minX + b.maxX) / 2;
    const w = b.maxX - b.minX;
    const d = b.maxZ - b.minZ;
    const tx = cx - p.dx * (w / 2 + 0.25);
    const tz = b.maxZ - 0.3 - Math.max(0, p.dy) * (d + 0.2) * 1.03;
    this.targetPoint.set(tx, 0.2, tz);
    y.clampToBoard(this.targetPoint);
    this.targetIndex = y.cellFromPoint(this.targetPoint.x, this.targetPoint.z, 0.6);
  }

  private onAimMove(p: Pull) {
    if (!this.game || !this.yard || this.busy) return;
    this.slingshot.setPull(p.dx, p.dy, p.amount);
    if (p.amount < 0.08) {
      this.reticle.visible = false;
      this.trajectory.visible = false;
      return;
    }
    this.computeTarget(p);
    this.reticle.visible = true;
    this.trajectory.visible = true;
    this.reticle.position.set(this.targetPoint.x, 0.2, this.targetPoint.z);
    this.reticle.rotation.z += 0.02;
    this.drawTrajectory();
  }

  private drawTrajectory() {
    const p0 = this.slingshot.pouchWorldPosition();
    const p2 = this.targetPoint;
    const n = this.trajectory.count;
    for (let k = 0; k < n; k++) {
      const t = (k + 1) / (n + 1);
      const p = this.arcPoint(p0, p2, t);
      this.dummy.position.copy(p);
      const s = 0.6 + t * 0.6;
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.trajectory.setMatrixAt(k, this.dummy.matrix);
    }
    this.trajectory.instanceMatrix.needsUpdate = true;
  }

  private arcPoint(p0: THREE.Vector3, p2: THREE.Vector3, t: number): THREE.Vector3 {
    const dist = p0.distanceTo(p2);
    const p1 = p0.clone().add(p2).multiplyScalar(0.5);
    // a gentle lob: the apex sits between the pouch and the ground, never above the camera
    p1.y = (p0.y + p2.y) / 2 + 0.6 + dist * 0.05;
    const a = p0.clone().multiplyScalar((1 - t) * (1 - t));
    const b = p1.clone().multiplyScalar(2 * (1 - t) * t);
    const c = p2.clone().multiplyScalar(t * t);
    return a.add(b).add(c);
  }

  private onAimCancel() {
    this.slingshot.release();
    this.reticle.visible = false;
    this.trajectory.visible = false;
  }

  private onAimRelease(p: Pull) {
    if (!this.game || !this.yard || this.busy) {
      this.onAimCancel();
      return;
    }
    this.computeTarget(p);
    const i = this.targetIndex;
    const impact = this.targetPoint.clone();
    this.onAimCancel();
    if (i < 0) return;
    void this.fire(i, impact);
  }

  // ---------- firing ----------

  /** Fire at a square. `impact` is where the shot actually lands (defaults to the square's centre). */
  async fire(index: number, impact?: THREE.Vector3) {
    if (!this.game || !this.yard || this.busy || this.game.isOver) return;
    const g = this.game;
    const yard = this.yard;
    this.busy = true;
    this.aim.enabled = false;
    this.sfx.launch();
    this.slingshot.hideAmmo();

    const projectile = this.slingshot.spawnProjectile();
    this.sm.scene.add(projectile);
    const p0 = this.slingshot.pouchWorldPosition();
    const p2 = (impact ?? yard.cellPosition(index)).clone().setY(0.25);
    if (g.cellKind(index) !== 'dirt') p2.y = 0.7;
    const dist = p0.distanceTo(p2);
    const duration = 0.42 + dist * 0.035;
    const isRocket = g.ammo.id === 'icbm';
    if (isRocket) this.sfx.whistle(duration);
    const prev = p0.clone();
    await this.sm.tweens.run(
      duration,
      (t) => {
        const p = this.arcPoint(p0, p2, t);
        if (isRocket) {
          const dir = p.clone().sub(prev);
          if (dir.lengthSq() > 1e-8) projectile.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
          prev.copy(p);
        } else {
          projectile.rotation.x += 0.25;
          projectile.rotation.z += 0.18;
        }
        projectile.position.copy(p);
      },
      ease.linear,
    );
    projectile.removeFromParent();
    disposeObject(projectile);

    const result = g.fire(index);
    await this.handleResult(result, p2);

    this.slingshot.reload();
    this.busy = false;
    if (!g.isOver) this.aim.enabled = true;
  }

  private async handleResult(res: ShotResult, impact: THREE.Vector3) {
    const g = this.game!;
    const yard = this.yard!;
    const hit = impact.clone().setY(0.2);
    switch (res.kind) {
      case 'dead':
        this.effects.burnMark(yard, res.index, g.ammo.id);
        this.hud.toast(res.cell === 'tree' ? '🌳 Ouch, the tree. Nothing under it.' : '🪨 Solid rock. Nothing under it.', 'info', 1.6);
        return;
      case 'already':
        this.effects.dud(hit);
        return;
      case 'mine': {
        this.effects.impact(g.ammo.id, hit);
        await this.effects.mineExplosion(yard, res.index);
        this.hud.updateRound(this.roundView());
        this.sfx.lose();
        this.hud.setBalance(this.wallet.balance);
        this.hud.showResult({ kind: 'bust', amount: 0, bet: g.bet, shots: g.shots, best: this.bestFactor }, () => this.backToLobby());
        return;
      }
      case 'safe': {
        this.effects.impact(g.ammo.id, hit);
        await this.effects.openCrater(yard, res.index, null);
        if (res.cascade.length) void this.effects.autoOpen(yard, res.cascade);
        // the mines-left counter only drops once the flags are actually planted
        this.hud.updateRound({ ...this.roundView(), mines: g.minesLeft + res.flagged.length });
        if (res.flagged.length) {
          void this.tw
            .delay(0.35)
            .then(() => this.effects.flagMines(yard, res.flagged))
            .then(() => this.hud.updateRound(this.roundView()));
        }
        this.bestFactor = Math.max(this.bestFactor, res.factor);
        void this.effects.revealItem(yard, res.index, res.item, res.gain, res.factor, g.ammo.id, g.shots, res.shown ? res.number : null, res.oilMultiplier);
        this.toastFor(res);
        if (res.autoCashout) {
          await this.sm.tweens.delay(1.2);
          this.hud.toast('🏡 Backyard cleared! Paying out.', 'win');
          this.finishCashout();
        }
        return;
      }
    }
  }

  private toastFor(res: Extract<ShotResult, { kind: 'safe' }>) {
    const em = ITEM_EMOJI[res.item];
    switch (res.item) {
      case 'nothing':
        this.hud.toast(`${em} Nothing here. Safe, but free info only.`, 'info', 1.8);
        break;
      case 'aqueduct':
        this.hud.toast(`${em} ${ITEM_LABEL[res.item]}! Prize ${formatFactor(res.factor)} → ${formatMoney(res.totalAfter)}`, 'win', 3);
        break;
      case 'oil':
        this.hud.toast(`${em} OIL SEEP ×${res.oilMultiplier}! Prize → ${formatMoney(res.totalAfter)}`, 'win', 5);
        break;
      default:
        this.hud.toast(`${em} ${ITEM_LABEL[res.item]}! +${formatMoney(res.gain)}`, 'win');
    }
    if (res.cascade.length) this.hud.toast(`🔎 ${res.cascade.length} square${res.cascade.length === 1 ? '' : 's'} proven safe, opened for free.`, 'info', 2.2);
    if (res.flagged.length) this.hud.toast(`🚩 ${res.flagged.length} mine${res.flagged.length === 1 ? '' : 's'} proven and defused.`, 'info', 2.2);
  }

  private cashOut() {
    if (!this.game || !this.game.canCashOut || this.busy) return;
    this.game.cashOut();
    this.finishCashout();
  }

  private finishCashout() {
    const g = this.game!;
    this.aim.enabled = false;
    const paid = g.payout;
    this.wallet.credit(paid);
    this.hud.setBalance(this.wallet.balance);
    this.sfx.cashout();
    this.hud.updateRound(this.roundView());
    this.hud.showResult({ kind: 'cashout', amount: paid, bet: g.bet, shots: g.shots, best: this.bestFactor }, () => this.backToLobby());
  }

  private backToLobby() {
    this.game = null;
    this.aim.enabled = false;
    this.showLobbyYard();
    this.hud.showLobby(this.wallet.balance);
  }
}
