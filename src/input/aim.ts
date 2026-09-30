/**
 * Slingshot input: press (or click) anywhere, drag to pull, release to fire.
 * dx/dy are the pull in -1..1 relative to a comfortable pull radius; amount is the pull length 0..1.
 */
export interface Pull {
  dx: number;
  dy: number;
  amount: number;
}

export interface AimHandlers {
  onStart: () => void;
  onMove: (pull: Pull) => void;
  onRelease: (pull: Pull) => void;
  onCancel: () => void;
}

export const DEAD_ZONE = 0.08;

export class AimInput {
  enabled = false;
  private pointerId: number | null = null;
  private x0 = 0;
  private y0 = 0;
  private last: Pull = { dx: 0, dy: 0, amount: 0 };

  constructor(
    private el: HTMLElement,
    private handlers: AimHandlers,
  ) {
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onCancel);
    window.addEventListener('blur', this.onCancel);
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get active() {
    return this.pointerId !== null;
  }

  private radius() {
    return Math.max(90, Math.min(window.innerWidth, window.innerHeight) * 0.32);
  }

  private onDown = (e: PointerEvent) => {
    if (!this.enabled || this.pointerId !== null) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.x0 = e.clientX;
    this.y0 = e.clientY;
    this.last = { dx: 0, dy: 0, amount: 0 };
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.handlers.onStart();
  };

  private compute(e: PointerEvent): Pull {
    const r = this.radius();
    const dx = Math.max(-1, Math.min(1, (e.clientX - this.x0) / r));
    const dy = Math.max(-1, Math.min(1, (e.clientY - this.y0) / r));
    return { dx, dy, amount: Math.min(1, Math.hypot(dx, dy)) };
  }

  private onMove = (e: PointerEvent) => {
    if (this.pointerId !== e.pointerId) return;
    e.preventDefault();
    this.last = this.compute(e);
    this.handlers.onMove(this.last);
  };

  private onUp = (e: PointerEvent) => {
    if (this.pointerId !== e.pointerId) return;
    this.pointerId = null;
    const pull = this.compute(e);
    if (pull.amount < DEAD_ZONE) this.handlers.onCancel();
    else this.handlers.onRelease(pull);
  };

  private onCancel = () => {
    if (this.pointerId === null) return;
    this.pointerId = null;
    this.handlers.onCancel();
  };
}
