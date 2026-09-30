/** Tiny frame-driven tween/timer system so every effect runs on the render clock. */
export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inQuad: (t: number) => t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  outBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

interface TweenEntry {
  elapsed: number;
  duration: number;
  ease: Ease;
  onUpdate: (t: number, dt: number) => void;
  onComplete?: () => void;
  done: boolean;
}

export class Tweens {
  private list: TweenEntry[] = [];

  /** Runs onUpdate(t) with eased t in [0,1] for `duration` seconds. Resolves when finished. */
  run(duration: number, onUpdate: (t: number, dt: number) => void, easing: Ease = ease.linear): Promise<void> {
    return new Promise((resolve) => {
      this.list.push({ elapsed: 0, duration, ease: easing, onUpdate, onComplete: resolve, done: false });
    });
  }

  /** A per-frame updater that lives until it returns false. */
  loop(onUpdate: (dt: number, elapsed: number) => boolean): void {
    let elapsed = 0;
    this.list.push({
      elapsed: 0,
      duration: Infinity,
      ease: ease.linear,
      onUpdate: (_t, dt) => {
        elapsed += dt;
        if (!onUpdate(dt, elapsed)) entry.done = true;
      },
      done: false,
    });
    const entry = this.list[this.list.length - 1]!;
  }

  delay(seconds: number): Promise<void> {
    return this.run(seconds, () => {});
  }

  update(dt: number) {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const e = list[i]!;
      if (e.done) continue;
      e.elapsed += dt;
      if (e.duration === Infinity) {
        e.onUpdate(0, dt);
        continue;
      }
      const t = Math.min(1, e.elapsed / e.duration);
      e.onUpdate(e.ease(t), dt);
      if (t >= 1) {
        e.done = true;
        e.onComplete?.();
      }
    }
    this.list = list.filter((e) => !e.done);
  }

  clear() {
    this.list = [];
  }
}
