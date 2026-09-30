import { AMMO, ITEM_LABEL, RTP, type AmmoDef, type AmmoId } from '../engine/config';
import { formatFactor, formatMoney, type ShotPreview } from '../engine/game';

export interface RoundView {
  total: number;
  shots: number;
  mines: number;
  canCashOut: boolean;
  bet: number;
  ammo: AmmoDef;
  seed: number;
}

export interface HudHandlers {
  onStart: (ammo: AmmoDef) => void;
  onCashOut: () => void;
  onToggleSound: () => boolean;
  onResetWallet: () => void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export class Hud {
  private balanceEl: HTMLElement;
  private minesPill: HTMLElement;
  private toasts: HTMLElement;
  private aim: HTMLElement;
  private bottom: HTMLElement;
  private modalHost: HTMLElement;
  private soundBtn: HTMLButtonElement;
  private selected: AmmoId = 'firecracker';
  private prizeAmt: HTMLElement | null = null;
  private lastTotal = -1;

  constructor(
    root: HTMLElement,
    private handlers: HudHandlers,
    soundOn: boolean,
  ) {
    const top = el('div', 'topbar');
    top.append(el('div', 'logo', '🧨<span class="word">MOLESWEEPER</span> <small>3D · stepper</small>'));
    top.append(el('div', 'spacer'));
    this.minesPill = el('div', 'pill mines', '');
    this.minesPill.style.display = 'none';
    top.append(this.minesPill);
    this.balanceEl = el('div', 'pill', '');
    top.append(this.balanceEl);
    this.soundBtn = el('button', 'icon ghost', soundOn ? '🔊' : '🔇');
    this.soundBtn.title = 'Sound';
    this.soundBtn.onclick = () => {
      const on = this.handlers.onToggleSound();
      this.soundBtn.textContent = on ? '🔊' : '🔇';
    };
    top.append(this.soundBtn);
    const helpBtn = el('button', 'icon ghost', '?');
    helpBtn.title = 'How to play';
    helpBtn.onclick = () => this.showHelp();
    top.append(helpBtn);

    this.toasts = el('div', 'toasts');
    this.aim = el('div', 'aim');
    this.bottom = el('div', 'bottom');
    this.modalHost = el('div', 'modal-host');
    root.append(top, this.toasts, this.aim, this.bottom, this.modalHost);
  }

  setBalance(v: number) {
    this.balanceEl.innerHTML = `<span class="lbl">Balance</span> ${formatMoney(v)}`;
  }

  /** Ammo / bet picker between rounds. */
  showLobby(balance: number) {
    this.minesPill.style.display = 'none';
    this.hideAim();
    this.bottom.innerHTML = '';
    const lobby = el('div', 'lobby');
    lobby.append(el('h2', undefined, 'Pick your ammo · the bet buys the whole round'));
    const row = el('div', 'ammo-row');
    const cards = new Map<AmmoId, HTMLElement>();
    for (const a of AMMO) {
      const card = el('div', 'ammo clickable');
      card.innerHTML = `<div class="em">${a.emoji}</div><div class="nm">${a.name}</div><div class="bet">${formatMoney(a.bet)}</div><div class="bl">${a.blurb}</div>`;
      card.onclick = () => {
        this.selected = a.id;
        cards.forEach((c, id) => c.classList.toggle('selected', id === a.id));
        refreshStart();
      };
      cards.set(a.id, card);
      row.append(card);
    }
    lobby.append(row);
    const actions = el('div', 'actions');
    const start = el('button', undefined, 'Buy round');
    const refreshStart = () => {
      const a = AMMO.find((x) => x.id === this.selected)!;
      const ok = balance + 1e-9 >= a.bet;
      start.disabled = !ok;
      start.textContent = ok ? `Play for ${formatMoney(a.bet)}` : `Need ${formatMoney(a.bet)}`;
    };
    start.onclick = () => this.handlers.onStart(AMMO.find((x) => x.id === this.selected)!);
    actions.append(start);
    if (balance < Math.min(...AMMO.map((a) => a.bet))) {
      const reset = el('button', 'ghost', 'Top up play money');
      reset.onclick = () => this.handlers.onResetWallet();
      actions.append(reset);
    }
    lobby.append(actions);
    lobby.append(el('div', 'hint', `Drag anywhere to pull the slingshot · release to fire · RTP ${(RTP * 100).toFixed(0)}%`));
    this.bottom.append(lobby);
    cards.get(this.selected)?.classList.add('selected');
    refreshStart();
  }

  /** In-round panel: prize + cash out. */
  showRound(v: RoundView) {
    this.bottom.innerHTML = '';
    this.minesPill.style.display = '';
    this.minesPill.innerHTML = `💣 <span class="lbl">mines</span> ${v.mines}`;
    const round = el('div', 'round');
    const prize = el('div', 'prize');
    prize.innerHTML = `<div class="lbl">Prize</div><div class="amt"></div><div class="sub"></div>`;
    this.prizeAmt = prize.querySelector('.amt');
    round.append(prize);
    const cash = el('button', 'cash', 'Cash out');
    cash.onclick = () => this.handlers.onCashOut();
    round.append(cash);
    this.bottom.append(round);
    this.bottom.append(el('div', 'hint', ''));
    this.bottom.append(el('div', 'seed', `round #${v.seed.toString(16)} · ${v.ammo.name} · bet ${formatMoney(v.bet)}`));
    this.lastTotal = -1;
    this.updateRound(v);
  }

  updateRound(v: RoundView) {
    const cash = this.bottom.querySelector<HTMLButtonElement>('button.cash');
    const sub = this.bottom.querySelector<HTMLElement>('.prize .sub');
    const hint = this.bottom.querySelector<HTMLElement>('.hint');
    if (this.prizeAmt) {
      this.prizeAmt.textContent = formatMoney(v.total);
      if (this.lastTotal >= 0 && Math.abs(v.total - this.lastTotal) > 0.004) {
        this.prizeAmt.classList.remove('bump');
        void this.prizeAmt.offsetWidth;
        this.prizeAmt.classList.add('bump');
        setTimeout(() => this.prizeAmt?.classList.remove('bump'), 200);
      }
      this.lastTotal = v.total;
    }
    if (sub) sub.textContent = v.shots === 0 ? `your ${formatMoney(v.bet)} stake` : `${formatFactor(v.total / v.bet)} · ${v.shots} shot${v.shots === 1 ? '' : 's'}`;
    if (cash) {
      cash.disabled = !v.canCashOut;
      cash.textContent = v.canCashOut ? `Cash out ${formatMoney(v.total)}` : 'Cash out';
    }
    if (hint) hint.textContent = v.shots === 0 ? 'Drag to pull back the slingshot, release to fire. Numbers count the mines around a square.' : 'Riskier squares pay more. Cash out any time.';
  }

  /** Tooltip pinned above the targeted square. */
  showAim(pv: ShotPreview | null, kind: 'dirt' | 'tree' | 'rock' | 'open' | 'off', x: number, y: number) {
    this.aim.className = 'aim show';
    this.aim.style.left = `${x}px`;
    this.aim.style.top = `${y}px`;
    if (kind === 'off') {
      this.aim.className = 'aim';
      return;
    }
    if (kind === 'tree' || kind === 'rock') {
      this.aim.classList.add('dead');
      this.aim.innerHTML = `<div class="risk">${kind === 'tree' ? '🌳 Tree' : '🪨 Rock'}</div><div class="prize">Just a burn mark</div>`;
      return;
    }
    if (kind === 'open' || !pv) {
      this.aim.innerHTML = `<div class="risk">Already open</div><div class="prize">Dud</div>`;
      return;
    }
    const pct = Math.round(pv.risk * 100);
    if (pv.certainMine) {
      this.aim.classList.add('hot');
      this.aim.innerHTML = `<div class="risk">💣 100% mine</div><div class="prize">Can't fire here</div>`;
      return;
    }
    if (pv.certainSafe) {
      this.aim.classList.add('safe');
      this.aim.innerHTML = `<div class="risk">✅ 0% risk</div><div class="prize">Safe · +$0.00</div>`;
      return;
    }
    if (pv.risk >= 0.4) this.aim.classList.add('hot');
    const what = pv.item === 'aqueduct' || pv.item === 'oil' ? `${ITEM_LABEL[pv.item]} ${formatFactor(pv.factor)}` : ITEM_LABEL[pv.item];
    this.aim.innerHTML = `<div class="risk">💣 ${pct}% risk</div><div class="prize">+${formatMoney(pv.gain)} · ${what}</div>`;
  }

  hideAim() {
    this.aim.className = 'aim';
  }

  toast(text: string, kind: 'win' | 'bad' | 'grave' | 'info' = 'info', life = 2.4) {
    const t = el('div', `toast ${kind}`, text);
    t.style.setProperty('--life', `${life}s`);
    this.toasts.append(t);
    setTimeout(() => t.remove(), (life + 0.5) * 1000);
  }

  showResult(r: { kind: 'bust' | 'cashout'; amount: number; bet: number; shots: number; best: number }, onAgain: () => void) {
    const bg = el('div', 'modal-bg');
    const m = el('div', 'modal');
    if (r.kind === 'bust') {
      m.innerHTML = `<h1 class="bad">💥 KABOOM</h1><p>You hit a mine. The backyard is toast and so is your bet.</p><div class="big">-${formatMoney(r.bet)}</div>`;
    } else {
      m.innerHTML = `<h1>💰 Cashed out</h1><p>Nice. The moles live to see another day.</p><div class="big">${formatMoney(r.amount)}</div><div class="stats"><span>${formatFactor(r.amount / r.bet)}</span><span>${r.shots} shot${r.shots === 1 ? '' : 's'}</span><span>profit ${formatMoney(r.amount - r.bet)}</span></div>`;
    }
    const actions = el('div', 'actions');
    const again = el('button', undefined, 'Play again');
    again.onclick = () => {
      bg.remove();
      onAgain();
    };
    actions.append(again);
    m.append(actions);
    bg.append(m);
    this.modalHost.append(bg);
  }

  showHelp() {
    const bg = el('div', 'modal-bg');
    const m = el('div', 'modal');
    m.innerHTML = `
      <h1>How to play</h1>
      <div class="help">
        <h3>The idea</h3>
        <p>Pick your ammo (that's your bet), then slingshot it into the backyard. Every square you blow open either adds to your prize or is a mine that ends the round. Cash out whenever you like.</p>
        <h3>Reading the dirt</h3>
        <ul>
          <li>A number pressed into a crater counts the mines in the 8 squares around it, like minesweeper. Opening a 0 opens its neighbours for free.</li>
          <li>Trees and rocks are dead squares. They never hide mines and never count.</li>
          <li>Aim at a square to see its current mine risk and what it pays if it's safe. Riskier squares pay more; a square the numbers prove safe pays nothing.</li>
        </ul>
        <h3>What you can dig up</h3>
        <ul>
          <li>🐹 Mole: small prize (up to your bet)</li>
          <li>🦫 Groundhog: 1x to 4x your bet</li>
          <li>💎 Buried treasure: 5x your bet and up</li>
          <li>🏛️ Aqueduct: multiplies your whole prize x2 to x25</li>
          <li>🛢️ Oil seep: x50 and beyond. Legendary.</li>
          <li>⚰️ Secret grave: worth nothing, but worth seeing.</li>
        </ul>
        <h3>The fairness bit</h3>
        <p>Each payout is priced from the exact mine probability of the square you hit, so no amount of clever counting beats the house edge. Whatever you do, the game returns ${(RTP * 100).toFixed(0)}% on average. Reading the numbers changes how risky your ride is, not the odds.</p>
      </div>`;
    const actions = el('div', 'actions');
    const ok = el('button', undefined, 'Got it');
    ok.onclick = () => bg.remove();
    actions.append(ok);
    m.append(actions);
    bg.append(m);
    this.modalHost.append(bg);
  }
}
