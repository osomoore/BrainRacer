/** Pure chunk bookkeeping used by the terrain renderer. */
export interface ChunkCoord { x: number; y: number }
export interface ChunkRequest extends ChunkCoord { distance: number; heading: number; dx?: number; dy?: number; visible?: boolean }

export function chunkKey(x: number, y: number): string {
  return `${Math.floor(x)},${Math.floor(y)}`;
}

/** Small LRU whose get operation promotes an entry to most-recently-used. */
export class LruCache<T> {
  private readonly entries = new Map<string, T>();
  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity must be a positive integer');
  }
  get(key: string): T | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }
  set(key: string, value: T, pinned: ReadonlySet<string> = new Set()): T | undefined {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size <= this.capacity) return undefined;
    const oldest = [...this.entries.keys()].find((candidate) => candidate === key || !pinned.has(candidate));
    if (oldest === undefined) {
      const rejected = this.entries.get(key);
      this.entries.delete(key);
      return rejected;
    }
    const evicted = this.entries.get(oldest);
    this.entries.delete(oldest);
    return evicted;
  }
  has(key: string): boolean { return this.entries.has(key); }
  delete(key: string): boolean { return this.entries.delete(key); }
  clear(): void { this.entries.clear(); }
  get size(): number { return this.entries.size; }
}

/** Sort nearer chunks first, with a modest preference for chunks in front of travel. */
export function prioritizeChunks(requests: readonly ChunkRequest[]): ChunkRequest[] {
  return [...requests].sort((a, b) => Number(b.visible) - Number(a.visible) || rank(a) - rank(b)
    || a.y - b.y || a.x - b.x);
}

function rank(request: ChunkRequest): number {
  const ahead = Math.cos(request.heading);
  const front = (request.dx ?? request.x) * ahead + (request.dy ?? request.y) * Math.sin(request.heading);
  // Heading only breaks near ties; it must not make a distant prefetch outrank visible terrain.
  return request.distance - (front > 0 ? 0.12 : 0);
}
