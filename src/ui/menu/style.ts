import Phaser from 'phaser';
import { TEX } from '../../core/assetKeys';
import type { CarKind, InputDevice } from '../../core/types';

export const FONT_HEAD = 'Arial Black, Arial, sans-serif';
export const FONT_BODY = 'Arial, "Segoe UI Emoji", "Segoe UI Symbol", sans-serif';
export const MIN_TEXT = 40;

export const MENU = {
  navy: 0x14213d,
  navyHex: '#14213d',
  panel: 0x1d2f5a,
  white: '#ffffff',
  yellow: '#ffd43b',
  dim: '#c9d6ff',
} as const;

export const hexNum = (c: string) => parseInt(c.replace('#', ''), 16);

export interface BigTextOpts {
  font?: string;
  stroke?: number;
  strokeColor?: string;
  shadow?: boolean;
  origin?: [number, number];
  bold?: boolean;
  wrap?: number;
}

/** Big, outlined, drop-shadowed text. Size is clamped to MIN_TEXT. */
export function bigText(
  scene: Phaser.Scene, x: number, y: number, text: string, size = 48, color: string = MENU.white, o: BigTextOpts = {},
): Phaser.GameObjects.Text {
  const px = Math.max(size, MIN_TEXT);
  const t = scene.add.text(x, y, text, {
    fontFamily: o.font ?? FONT_BODY,
    fontStyle: o.bold === false ? 'normal' : 'bold',
    fontSize: `${px}px`,
    color,
    stroke: o.strokeColor ?? MENU.navyHex,
    strokeThickness: o.stroke ?? Math.max(6, Math.round(px / 8)),
    align: 'center',
    wordWrap: o.wrap ? { width: o.wrap } : undefined,
  });
  if (o.shadow !== false) t.setShadow(0, Math.round(px / 14) + 2, '#000000', 4, true, true);
  const [ox, oy] = o.origin ?? [0.5, 0.5];
  return t.setOrigin(ox, oy);
}

/** Car picture (texture if the art package has landed, else a simple colored shape). Faces +x. */
export function carPreview(scene: Phaser.Scene, kind: CarKind, x: number, y: number, scale: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const key = kind === 'dino' ? TEX.carDino : TEX.carKart;
  if (scene.textures.exists(key)) c.add(scene.add.image(0, 0, key));
  else {
    const w = kind === 'dino' ? 72 : 60, h = kind === 'dino' ? 40 : 36;
    c.add(scene.add.rectangle(0, 0, w, h, kind === 'dino' ? 0x2ecc40 : 0xff3b30).setStrokeStyle(3, 0x000000));
    c.add(scene.add.rectangle(w * 0.15, 0, w * 0.3, h * 0.6, 0xffffff, 0.6));
  }
  return c.setScale(scale);
}

export function carName(kind: CarKind): string { return kind === 'dino' ? 'Dino-Car' : 'Red Kart'; }

export function deviceLabel(d: InputDevice): string {
  if (d.type === 'gamepad') return `\u{1F3AE} Controller ${d.index + 1}`;
  return d.layout === 'left' ? '⌨ WASD' : '⌨ Arrows';
}

/** Round green "A" button badge (drawn, no font symbol needed). */
export function aBadge(scene: Phaser.Scene, x: number, y: number, size = 56): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x2ecc40, 1).fillCircle(0, 0, size / 2);
  g.lineStyle(5, 0xffffff, 1).strokeCircle(0, 0, size / 2);
  c.add(g);
  c.add(bigText(scene, 0, 1, 'A', Math.max(MIN_TEXT, size * 0.75), '#ffffff', { stroke: 4, shadow: false }));
  return c;
}

/** Triangle pointing +x, in the given color, with an outline. */
export function arrowShape(scene: Phaser.Scene, color: number, size = 30): Phaser.GameObjects.Graphics {
  return drawArrow(scene.add.graphics(), color, size);
}

export function drawArrow(g: Phaser.GameObjects.Graphics, color: number, size = 30): Phaser.GameObjects.Graphics {
  g.clear();
  g.fillStyle(color, 1).lineStyle(5, 0xffffff, 1);
  g.beginPath(); g.moveTo(-size / 2, -size); g.lineTo(size, 0); g.lineTo(-size / 2, size); g.closePath();
  g.fillPath(); g.strokePath();
  return g;
}

export interface Selectable {
  setSelected(selected: boolean, color?: number): void;
}
