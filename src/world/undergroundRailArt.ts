import type Phaser from 'phaser';
import { block, glow, undergroundTexture } from './undergroundArt';

export const RAIL_COLORS = [
  { name: 'cyan', rgb: '46,224,246', mid: '#47dfef', hot: '#c7faff', edge: '#32778e', shadow: '#254a68' },
  { name: 'violet', rgb: '230,99,255', mid: '#e181ff', hot: '#ffe6ff', edge: '#8c4aab', shadow: '#502763' },
] as const;

type Palette = typeof RAIL_COLORS[number];
type Part = 'engine' | 'ore' | 'tail';

/** The rail cars face +x. Leave transparent room for their glow. */
export function mineTrainPart(scene: Phaser.Scene, part: Part, color: Palette): string {
  return undergroundTexture(scene, `mine_${part}_${color.name}`, 180, 144, c => {
    const engine = part === 'engine';
    const nose = engine ? 139 : 127;
    const rear = engine ? 40 : 52;
    glow(c, 90, 72, 70, color.rgb, .27);
    // Raised chassis, four rail wheels, and the shaded box around the cab or hopper.
    block(c, '#100e24', rear - 2, 45, nose - rear + 4, 55);
    for (const x of [rear + 11, nose - 23]) for (const y of [46, 91]) {
      block(c, '#0e1026', x - 3, y - 4, 19, 14);
      block(c, '#737397', x, y, 13, 6);
    }
    block(c, color.shadow, rear, 48, nose - rear, 48);
    block(c, '#242746', rear + 4, 52, nose - rear - 8, 40);
    for (const y of [49, 92]) {
      block(c, color.edge, rear + 4, y, nose - rear - 8, 3);
      block(c, color.mid, rear + 8, y, nose - rear - 16, 2);
      block(c, color.hot, rear + 17, y, 13, 1);
    }
    if (engine) {
      block(c, '#17223c', 48, 56, 22, 32);
      for (let x = 52; x <= 63; x += 5) block(c, '#687996', x, 60, 2, 23);
      block(c, '#434871', 74, 55, 34, 34);
      block(c, color.edge, 100, 58, 10, 28);
      block(c, color.hot, 104, 59, 3, 26);
      block(c, '#212b45', 111, 59, 20, 26);
      for (const y of [58, 86]) {
        glow(c, 138, y, 30, '179,244,255', .68);
        block(c, '#e2ffff', 136, y - 3, 4, 6);
      }
      block(c, '#596582', 139, 65, 8, 14);
      return;
    }
    // A little open hopper with angular ore and lit capacity markers.
    block(c, '#12192b', 58, 58, 63, 28);
    for (const [x, y, size] of [[70, 71, 11], [86, 64, 8], [100, 77, 12], [113, 65, 6], [81, 80, 8]]) {
      c.beginPath(); c.moveTo(x - size, y); c.lineTo(x - 2, y - size * .65);
      c.lineTo(x + size, y - 2); c.lineTo(x + 2, y + size * .5); c.closePath();
      c.fillStyle = color.edge; c.fill();
      c.beginPath(); c.moveTo(x - size, y); c.lineTo(x - 2, y - size * .65);
      c.lineTo(x + 2, y + 1); c.closePath(); c.fillStyle = color.mid; c.fill();
    }
    for (const y of [58, 82]) {
      block(c, part === 'tail' ? '#ff888c' : color.hot, 53, y, 3, 5);
      if (part === 'tail') glow(c, 52, y + 2, 18, '255,97,116', .58);
    }
  });
}
