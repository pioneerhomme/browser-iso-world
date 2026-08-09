export class Inventory {
  private counts = new Map<string, number>();

  constructor(initial: Partial<Record<string, number>> = {}) {
    for (const key of Object.keys(initial)) {
      const amount = initial[key];
      if (amount) {
        this.counts.set(key, amount);
      }
    }
  }

  get(item: string): number {
    return this.counts.get(item) ?? 0;
  }

  add(item: string, amount = 1): void {
    this.counts.set(item, this.get(item) + amount);
  }

  remove(item: string, amount = 1): boolean {
    const current = this.get(item);

    if (current < amount) {
      return false;
    }

    const next = current - amount;

    if (next <= 0) {
      this.counts.delete(item);
    } else {
      this.counts.set(item, next);
    }

    return true;
  }

  serialize(): Partial<Record<string, number>> {
    const out: Partial<Record<string, number>> = {};
    this.counts.forEach((amount, item) => {
      out[item] = amount;
    });
    return out;
  }
}