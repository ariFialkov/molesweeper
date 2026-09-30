import { STARTING_BALANCE } from '../engine/config';

const KEY = 'molesweeper.balance';

/** Play-money wallet kept in localStorage. */
export class Wallet {
  balance: number;

  constructor() {
    let v = STARTING_BALANCE;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw !== null && !Number.isNaN(Number(raw))) v = Number(raw);
    } catch {
      /* ignore */
    }
    this.balance = v;
  }

  private save() {
    try {
      localStorage.setItem(KEY, String(this.balance));
    } catch {
      /* ignore */
    }
  }

  canAfford(amount: number) {
    return this.balance + 1e-9 >= amount;
  }

  debit(amount: number) {
    this.balance = Math.round((this.balance - amount) * 100) / 100;
    this.save();
  }

  credit(amount: number) {
    this.balance = Math.round((this.balance + amount) * 100) / 100;
    this.save();
  }

  reset() {
    this.balance = STARTING_BALANCE;
    this.save();
  }
}
