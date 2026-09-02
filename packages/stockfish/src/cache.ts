export class LruCache<K, V> {
  private readonly values = new Map<K, V>();

  constructor(private readonly capacity: number) {
    if (capacity < 1) throw new Error("LRU cache capacity must be positive.");
  }

  get(key: K): V | undefined {
    const value = this.values.get(key);
    if (value === undefined) return undefined;
    this.values.delete(key);
    this.values.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    this.values.delete(key);
    this.values.set(key, value);
    const oldest = this.values.keys().next().value as K | undefined;
    if (this.values.size > this.capacity && oldest !== undefined) this.values.delete(oldest);
  }

  clear(): void {
    this.values.clear();
  }
}

export function engineCacheKey(
  fen: string,
  version: string,
  depth: number,
  multiPv: number,
  searchMoves: readonly string[] = [],
  historyMoves: readonly string[] = [],
): string {
  return `${version}\u0000${depth}\u0000${multiPv}\u0000${searchMoves.join(",")}\u0000${historyMoves.join(" ")}\u0000${fen}`;
}
