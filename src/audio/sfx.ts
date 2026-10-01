/** All sound effects are synthesized with the Web Audio API: no asset files, works offline. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('molesweeper.muted') === '1';
    } catch {
      /* ignore */
    }
  }

  /** Must be called from a user gesture. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.02);
    try {
      localStorage.setItem('molesweeper.muted', m ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  private get t() {
    return this.ctx!.currentTime;
  }

  private noise(duration: number): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  private env(gain: GainNode, peak: number, attack: number, decay: number, start = 0) {
    const t = this.t + start;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private tone(freq: number, type: OscillatorType, peak: number, attack: number, decay: number, start = 0, slideTo?: number) {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, this.t + start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, this.t + start + attack + decay);
    this.env(g, peak, attack, decay, start);
    o.connect(g).connect(this.master);
    o.start(this.t + start);
    o.stop(this.t + start + attack + decay + 0.05);
  }

  private burst(peak: number, decay: number, filterFreq: number, start = 0, q = 0.7) {
    if (!this.ctx || !this.master) return;
    const n = this.noise(decay + 0.1);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, peak, 0.005, decay, start);
    n.connect(f).connect(g).connect(this.master);
    n.start(this.t + start);
    n.stop(this.t + start + decay + 0.1);
  }

  stretch() {
    this.tone(180, 'sawtooth', 0.04, 0.05, 0.15, 0, 260);
  }

  launch() {
    this.tone(320, 'triangle', 0.12, 0.01, 0.12, 0, 90);
    this.burst(0.08, 0.25, 2500);
  }

  whistle(duration: number) {
    this.tone(1400, 'sine', 0.05, 0.05, duration, 0, 700);
  }

  /** small firecracker */
  pop() {
    this.burst(0.5, 0.12, 6000);
    this.tone(900, 'square', 0.15, 0.005, 0.08, 0, 200);
    for (let i = 0; i < 5; i++) this.burst(0.18, 0.05, 8000, 0.05 + i * 0.045);
  }

  /** grenade */
  flak() {
    this.burst(0.7, 0.35, 1800);
    this.tone(120, 'sine', 0.5, 0.005, 0.3, 0, 40);
    this.burst(0.25, 0.5, 600, 0.08);
  }

  /** ICBM */
  nuke() {
    this.tone(60, 'sine', 0.9, 0.01, 1.1, 0, 25);
    this.burst(0.8, 0.9, 900);
    this.burst(0.4, 1.6, 300, 0.2);
  }

  /** mine: the big one */
  kaboom() {
    this.tone(50, 'sine', 1, 0.01, 1.6, 0, 20);
    this.burst(1, 1.2, 1200);
    this.burst(0.5, 2.2, 250, 0.3);
    this.tone(400, 'sawtooth', 0.2, 0.01, 0.4, 0, 60);
  }

  dirt() {
    this.burst(0.2, 0.3, 500, 0.05, 0.3);
  }

  thud() {
    this.tone(90, 'sine', 0.35, 0.005, 0.18, 0, 45);
    this.burst(0.15, 0.12, 400);
  }

  coin(n = 0) {
    const base = 880 * Math.pow(2, (n % 5) / 12);
    this.tone(base, 'square', 0.12, 0.005, 0.18);
    this.tone(base * 1.5, 'square', 0.1, 0.01, 0.28, 0.06);
  }

  squeak() {
    this.tone(1200, 'sine', 0.12, 0.02, 0.12, 0, 1700);
    this.tone(1500, 'sine', 0.1, 0.02, 0.15, 0.13, 1100);
  }

  fanfare() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, 'triangle', 0.18, 0.01, 0.35, i * 0.1));
  }

  jackpot() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => {
      this.tone(f, 'square', 0.12, 0.01, 0.3, i * 0.09);
      this.tone(f / 2, 'triangle', 0.1, 0.01, 0.3, i * 0.09);
    });
  }

  /** ~2.4s disco jingle */
  disco() {
    if (!this.ctx) return;
    const bpm = 128;
    const beat = 60 / bpm;
    const bass = [98, 98, 131, 98, 110, 110, 147, 110];
    bass.forEach((f, i) => this.tone(f, 'sawtooth', 0.14, 0.01, beat * 0.5, i * beat * 0.5));
    const lead = [
      [392, 0],
      [440, 0.5],
      [494, 1],
      [587, 1.5],
      [494, 2],
      [440, 2.5],
      [392, 3],
      [587, 3.5],
    ];
    lead.forEach(([f, b]) => this.tone(f!, 'square', 0.08, 0.01, beat * 0.45, b! * beat));
    for (let i = 0; i < 8; i++) this.burst(0.1, 0.06, 9000, i * beat * 0.5 + beat * 0.25, 2);
    for (let i = 0; i < 4; i++) this.tone(70, 'sine', 0.35, 0.005, 0.15, i * beat, 35);
  }

  sizzle() {
    this.burst(0.25, 0.7, 3500, 0, 0.5);
  }

  click() {
    this.tone(600, 'square', 0.06, 0.003, 0.05);
  }

  cashout() {
    const notes = [659, 784, 988, 1319];
    notes.forEach((f, i) => this.tone(f, 'triangle', 0.16, 0.01, 0.4, i * 0.08));
    this.burst(0.1, 0.3, 4000, 0.3);
  }

  lose() {
    this.tone(220, 'sawtooth', 0.15, 0.05, 0.6, 0.3, 110);
    this.tone(180, 'sawtooth', 0.12, 0.05, 0.8, 0.6, 70);
  }
}
