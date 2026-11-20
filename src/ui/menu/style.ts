import Phaser from 'phaser';
import { carArt } from '../../art/loadoutKeys';
import { UNLOCK_GUIDES, UNLOCK_VEHICLES } from '../../config/collectibles';
import type { CarKind, ControllerFamily, GuideKind, InputDevice } from '../../core/types';

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
  const key = carArt(kind);
  if (scene.textures.exists(key)) {
    const art = scene.add.image(0, 0, key);
    if (kind !== 'dino' && kind !== 'kart') {
      const { length, width } = UNLOCK_VEHICLES[kind].spec;
      art.setDisplaySize(length, width);
    }
    c.add(art);
  }
  else {
    const w = kind === 'dino' ? 72 : 60, h = kind === 'dino' ? 40 : 36;
    c.add(scene.add.rectangle(0, 0, w, h, kind === 'dino' ? 0x2ecc40 : 0xff3b30).setStrokeStyle(3, 0x000000));
    c.add(scene.add.rectangle(w * 0.15, 0, w * 0.3, h * 0.6, 0xffffff, 0.6));
  }
  return c.setScale(scale);
}

export function carName(kind: CarKind): string {
  if (kind === 'dino') return 'Dino-Car';
  if (kind === 'kart') return 'Red Kart';
  return UNLOCK_VEHICLES[kind].name;
}

export function guideName(kind: GuideKind): string {
  if (kind === 'dino') return 'Flying Dino';
  if (kind === 'star') return 'Twinkle Star';
  return UNLOCK_GUIDES[kind].name;
}

export function deviceLabel(d: InputDevice, family?: ControllerFamily): string {
  if (d.type === 'gamepad') {
    if (family === 'nintendo') return 'Switch Pro Controller';
    if (family === 'xbox') return 'Xbox Controller';
    return `\u{1F3AE} Controller ${d.index + 1}`;
  }
  return d.layout === 'left' ? '⌨ WASD' : '⌨ Arrows';
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
