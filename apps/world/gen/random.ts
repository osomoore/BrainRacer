/** Stable 32-bit hash for deriving independent generation choices from a seed and coordinates. */
export function hash(seed: number, ...parts: (number | string)[]): number {
  let h = (seed >>> 0) ^ 0x811c9dc5;
  const feed = (value: number): void => {
    let n = value >>> 0;
    for (let i = 0; i < 4; i++) {
      h = Math.imul(h ^ (n & 0xff), 0x01000193) >>> 0;
      n >>>= 8;
    }
  };
  for (const part of parts) {
    if (typeof part === 'number') {
      feed(0x4e); // N
      feed(Number.isFinite(part) ? Math.trunc(part) : 0);
    } else {
      feed(0x53); // S
      for (let i = 0; i < part.length; i++) h = Math.imul(h ^ part.charCodeAt(i), 0x01000193) >>> 0;
      h = Math.imul(h ^ 0xff, 0x01000193) >>> 0;
    }
  }
  return h >>> 0;
}

export function hash01(seed: number, ...parts: (number | string)[]): number {
  return hash(seed, ...parts) / 0x1_0000_0000;
}
