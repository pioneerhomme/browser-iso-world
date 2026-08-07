import { ItemId } from '../../core/types';

export class Inventory {
  private counts = new Map<ItemId, number>();

  constructor(initial: Partial<Record<ItemId, number>> = {}) {
    for (const key of Object.keys(initial)) {
      const item = key as ItemId;
      const amount = initial[item];

      if (amount) {
        this.counts.set(item, amount);
      }
    }
  }

  get(item: ItemId): number {
    return this.counts.get(item) ?? 0;
  }

  add(item: ItemId, amount = 1): void {
    this.counts.set(item, this.get(item) + amount);
  }

  remove(item: ItemId, amount = 1): boolean {
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
}