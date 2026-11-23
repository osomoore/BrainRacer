/**
 * Dino Lab scene kit: a baked ramp (slope up to a plateau) for climbing scenes (rocks, icy hill, ...).
 * `Ramp` bakes one texture sized to the slope, places it on the ground and answers `y(x)` / `angle` so the
 * dino can be walked along the surface with a tween (cosmetic: the result is decided elsewhere).
 */
import type Phaser from 'phaser';
import type { Act } from './act';
import { INK, darken, def, image, lighten, oval, type G } from './paint';

export type RampKind = 'rock' | 'ice' | 'dirt';
const FILL: Record<RampKind, string> = { rock: '#a7a1b4', ice: '#cfeaff', dirt: '#a8744a' };

export class Ramp {
  readonly img: Phaser.GameObjects.Image;
  /** Surface angle (radians, positive = rising to the right). */
  readonly angle: number;
  constructor(private a: Act, readonly kind: RampKind, readonly x0: number, readonly slopeW: number, readonly height: number, readonly plateauW: number) {
    const q = (n: number): number => Math.max(16, Math.round(n / 16) * 16);
    const sw = q(slopeW), pw = q(plateauW), h = q(height);
    const key = `ramp:${kind}:${sw}:${pw}:${h}`;
    const W = sw + pw + 24, H = h + 40;
    const fill = FILL[kind];
    def(key, W, H, 0, 0, (g: G) => {
      g.beginPath(); g.moveTo(8, H - 4); g.lineTo(8 + sw, 20); g.lineTo(8 + sw + pw, 20); g.lineTo(8 + sw + pw, H - 4); g.closePath();
      g.fillStyle = fill; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
      g.save(); g.clip();
      const n = Math.max(3, Math.round(sw / 150));
      for (let i = 0; i < n * 2; i++) {
        const t = (i + 0.5) / (n * 2), bx = 8 + sw * t, by = H - 4 - (H - 24) * t;
        oval(g, bx + 40, by + 70, 60 + (i % 3) * 14, 36, darken(fill, 0.06 + (i % 2) * 0.05), 3);
        oval(g, bx + 20, by + 10, 22, 8, lighten(fill, 0.35), 0);
      }
      g.strokeStyle = darken(fill, 0.3); g.lineWidth = 4;
      for (let i = 0; i < 5; i++) { const x = 40 + ((i * 197) % (sw + pw - 60)); g.beginPath(); g.moveTo(x, H - 60); g.lineTo(x + 18, H - 30); g.lineTo(x + 2, H - 8); g.stroke(); }
      g.restore();
    });
    this.img = image(a.scene, key, x0 - 8, a.gy - height - 20, 1);
    a.world.add(this.img);
    this.angle = Math.atan2(height, slopeW);
  }
  /** Surface y at world x. */
  y(x: number): number {
    const t = Math.max(0, Math.min(1, (x - this.x0) / this.slopeW));
    return this.a.gy - this.height * t;
  }
  get topY(): number { return this.a.gy - this.height; }
  get topX(): number { return this.x0 + this.slopeW; }
  /** Walk the dino along the slope to x (tween), pitched with the slope. Anim keeps playing. */
  climbTo(x: number, ms: number, pitch = 0.9, ease = 'Linear'): Promise<void> {
    const r = this.a.root, x0 = r.x;
    const t = { v: 0 };
    return this.a.tw({
      targets: t, v: 1, duration: ms, ease,
      onUpdate: () => {
        const nx = x0 + (x - x0) * t.v;
        r.x = nx; r.y = this.y(nx);
        const onSlope = nx > this.x0 && nx < this.topX;
        r.rotation = onSlope ? -this.angle * pitch : 0;
      },
    });
  }
}
