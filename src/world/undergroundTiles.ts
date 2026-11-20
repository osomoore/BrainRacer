import { ROAD_E, ROAD_N, ROAD_S, ROAD_W, Tile, type WorldData } from '../core/types';
import { isUndergroundLava } from './gen/underground';

export function undergroundTileIndex(world: WorldData, index: number): number {
  switch (world.tiles[index]) {
    case Tile.Water: return isUndergroundLava(world, index % world.widthTiles, Math.floor(index / world.widthTiles)) ? 5 : 0;
    case Tile.Road: return 6 + (world.roadMask[index] & 15);
    case Tile.Building: return 2;
    default: return 1;
  }
}

const box = (c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color; c.fillRect(x, y, w, h);
};

function rock(c: CanvasRenderingContext2D, s: number, wall: boolean): void {
  box(c, wall ? '#100f24' : '#26213a', 0, 0, s, s);
  for (let i = 0; i < 22; i++) {
    const x = (i * 53 + 17) % s, y = (i * 67 + 9) % s, r = 6 + (i * 113 % 20);
    c.fillStyle = wall ? ['#171530', '#121128', '#1c1936'][i % 3] : ['#2a243e', '#241f37', '#2c2540'][i % 3];
    for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) {
      c.beginPath(); c.moveTo(x + dx - r, y + dy); c.lineTo(x + dx - r / 2, y + dy - r / 2);
      c.lineTo(x + dx + r, y + dy - r / 3); c.lineTo(x + dx + r / 3, y + dy + r / 2); c.closePath(); c.fill();
    }
  }
  if (!wall) for (let i = 0; i < 90; i++) {
    box(c, i % 3 ? '#211d35' : '#392e48', (i * 59 + 13) % s, (i * 79 + 43) % s, 2, 1);
  }
}

function lava(c: CanvasRenderingContext2D, s: number): void {
  box(c, '#e75b36', 0, 0, s, s);
  for (let i = 0; i < 9; i++) {
    const x = i * s / 8;
    for (const dx of [-s, 0, s]) {
      c.strokeStyle = ['#bd3c3e', '#fa8b42', '#ffab4f', '#ff7440'][i % 4];
      c.lineWidth = [9, 6, 3][i % 3];
      c.beginPath();
      for (let y = 0; y <= s; y += 4) {
        const xx = dx + x + Math.sin(y / s * Math.PI * 2 + (i % 8) * 1.7) * 5;
        if (y) c.lineTo(xx, y); else c.moveTo(xx, y);
      }
      c.stroke();
    }
  }
}

function road(c: CanvasRenderingContext2D, s: number, mask: number): void {
  box(c, '#20314b', 0, 0, s, s);
  for (let i = 0; i < 68; i++) {
    const x = (i * 83 + 5) % s, y = (i * 31 + 37) % s;
    box(c, i % 2 ? '#223751' : '#1d2d43', x, y, 3, 2);
  }
  // Every two-tile road has a single glowing boundary on either side. At intersections the mask
  // leaves the join clear, so the two lane surfaces read as one circuit from either camera.
  for (const [side, angle] of [[ROAD_N, 0], [ROAD_E, Math.PI / 2], [ROAD_S, Math.PI], [ROAD_W, -Math.PI / 2]]) {
    if (mask & side) continue;
    c.save(); c.translate(s / 2, s / 2); c.rotate(angle); c.translate(-s / 2, -s / 2);
    box(c, '#101c32', 0, 0, s, 6);
    const bloom = c.createLinearGradient(0, 5, 0, 26);
    bloom.addColorStop(0, 'rgba(37,239,255,.45)'); bloom.addColorStop(1, 'rgba(37,239,255,0)');
    c.fillStyle = bloom; c.fillRect(0, 5, s, 21);
    for (let x = 4; x < s; x += 32) {
      box(c, '#28e5ee', x, 6, 24, 3);
      box(c, '#beffff', x, 7, 24, 1);
      box(c, '#b7eaff', x + 9, 12, 6, 2);
    }
    c.restore();
  }
}

export function undergroundTileSource(size: number): (index: number) => HTMLCanvasElement {
  return index => {
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const c = canvas.getContext('2d')!;
    if (index >= 6) road(c, size, index - 6);
    else if (index === 5) lava(c, size);
    else if (index === 2) box(c, '#323343', 0, 0, size, size);
    else rock(c, size, index === 0);
    return canvas;
  };
}
