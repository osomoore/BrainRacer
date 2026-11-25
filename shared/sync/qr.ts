/** Small byte-mode QR encoder (ISO/IEC 18004), error correction level M.
 * Supports versions 1–6, sufficient for family join URLs. Matrix rows are booleans
 * where true means a dark module. A four-module quiet zone is left to the renderer.
 */
const SPECS = [
  { data: 16, ecc: 10, blocks: 1 },
  { data: 28, ecc: 16, blocks: 1 },
  { data: 44, ecc: 26, blocks: 1 },
  { data: 32, ecc: 18, blocks: 2 },
  { data: 43, ecc: 24, blocks: 2 },
  { data: 27, ecc: 16, blocks: 4 },
];

function append(bits: number[], value: number, count: number): void {
  for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function divisor(degree: number): number[] {
  const result = Array(degree).fill(0) as number[];
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 2);
  }
  return result;
}

function remainder(data: number[], degree: number): number[] {
  const gen = divisor(degree), result = Array(degree).fill(0) as number[];
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift(); result.push(0);
    for (let i = 0; i < degree; i++) result[i] ^= gfMultiply(gen[i], factor);
  }
  return result;
}

function codewords(bytes: Uint8Array, version: number): number[] {
  const spec = SPECS[version - 1];
  const dataCapacity = spec.data * spec.blocks;
  const bits: number[] = [];
  append(bits, 4, 4); append(bits, bytes.length, 8);
  for (const b of bytes) append(bits, b, 8);
  const max = dataCapacity * 8;
  for (let i = 0; i < Math.min(4, max - bits.length); i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((n, b) => (n << 1) | b, 0));
  for (let pad = 0; data.length < dataCapacity; pad++) data.push(pad % 2 === 0 ? 0xec : 0x11);

  const blocks: number[][] = [];
  for (let offset = 0; offset < dataCapacity; offset += spec.data) {
    const block = data.slice(offset, offset + spec.data);
    blocks.push(block.concat(remainder(block, spec.ecc)));
  }
  const result: number[] = [];
  for (let i = 0; i < spec.data + spec.ecc; i++) for (const block of blocks) result.push(block[i]);
  return result;
}

function bch(value: number, polynomial: number): number {
  const degree = 31 - Math.clz32(polynomial);
  while (value !== 0 && 31 - Math.clz32(value) >= degree) value ^= polynomial << ((31 - Math.clz32(value)) - degree);
  return value;
}

function formatBits(mask: number): number {
  const data = mask; // ECC M is encoded as 00 in the two high format bits.
  return ((data << 10) | bch(data << 10, 0x537)) ^ 0x5412;
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return (x * y) % 2 + (x * y) % 3 === 0;
    case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
    default: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
  }
}

function matrixFor(words: number[], version: number, mask: number): boolean[][] {
  const size = version * 4 + 17;
  const grid = Array.from({ length: size }, () => Array(size).fill(false) as boolean[]);
  const fixed = Array.from({ length: size }, () => Array(size).fill(false) as boolean[]);
  const set = (x: number, y: number, value: boolean) => { grid[y][x] = value; fixed[y][x] = true; };
  const finder = (cx: number, cy: number) => {
    for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && y >= 0 && x < size && y < size) set(x, y, dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)));
    }
  };
  finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const align = version === 1 ? [] : [6, size - 7];
  for (const y of align) for (const x of align) {
    if (fixed[y][x]) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  // Reserve and place format information.
  const fmt = formatBits(mask);
  const bit = (i: number) => ((fmt >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true);

  const data: number[] = [];
  for (const w of words) for (let i = 7; i >= 0; i--) data.push((w >>> i) & 1);
  let at = 0, upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right--;
    for (let vert = 0; vert < size; vert++) {
      const y = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (!fixed[y][x]) { grid[y][x] = ((data[at++] ?? 0) !== 0) !== maskBit(mask, x, y); }
      }
    }
    upward = !upward;
  }
  return grid;
}

function penalty(grid: boolean[][]): number {
  const n = grid.length;
  let score = 0;
  const scan = (line: boolean[]) => {
    let run = 0;
    let previous: boolean | undefined;
    for (const dark of line) {
      run = dark === previous ? run + 1 : 1;
      if (run === 5) score += 3;
      if (run > 5) score++;
      previous = dark;
    }
    const bits = line.map(dark => dark ? '1' : '0').join('');
    for (let i = 0; i + 11 <= bits.length; i++) {
      const sequence = bits.slice(i, i + 11);
      if (sequence === '10111010000' || sequence === '00001011101') score += 40;
    }
  };
  for (let i = 0; i < n; i++) {
    scan(grid[i]);
    scan(grid.map(row => row[i]));
  }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) if (grid[y][x] === grid[y][x+1] && grid[y][x] === grid[y+1][x] && grid[y][x] === grid[y+1][x+1]) score += 3;
  const dark = grid.flat().filter(Boolean).length;
  score += Math.floor(Math.abs(dark * 100 / (n*n) - 50) / 5) * 10;
  return score;
}

export function encodeQr(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const version = SPECS.findIndex(spec => bytes.length <= spec.data * spec.blocks - 2) + 1;
  if (!version) throw new RangeError('QR byte payload exceeds version 6 capacity');
  const words = codewords(bytes, version);
  let best = matrixFor(words, version, 0), bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) { const candidate = matrixFor(words, version, mask); const score = penalty(candidate); if (score < bestScore) { best = candidate; bestScore = score; } }
  return best;
}
