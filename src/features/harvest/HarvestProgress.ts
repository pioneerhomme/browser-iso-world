export const HITS_REQUIRED = 3;

export class HarvestProgress {
  private hits = new Map<string, number>();

  private key(x: number, y: number): string {
    return `${x}|${y}`;
  }

  hit(x: number, y: number): number {
    const k = this.key(x, y);
    const n = (this.hits.get(k) ?? 0) + 1;
    this.hits.set(k, n);
    return n;
  }

  clear(x: number, y: number): void {
    this.hits.delete(this.key(x, y));
  }
}