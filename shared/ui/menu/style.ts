import Phaser from 'phaser';

export const FONT_HEAD = 'Arial Black, Arial, sans-serif';
export const FONT_BODY = 'Arial, "Segoe UI Emoji", "Segoe UI Symbol", sans-serif';
export const MIN_TEXT = 40;
export const MENU = { navy: 0x14213d, navyHex: '#14213d', panel: 0x1d2f5a, white: '#ffffff', yellow: '#ffd43b', dim: '#c9d6ff' } as const;
export const hexNum = (c: string) => parseInt(c.replace('#', ''), 16);
export interface BigTextOpts { font?: string; stroke?: number; strokeColor?: string; shadow?: boolean; origin?: [number, number]; bold?: boolean; wrap?: number }
export function bigText(scene: Phaser.Scene, x: number, y: number, text: string, size = 48, color: string = MENU.white, o: BigTextOpts = {}): Phaser.GameObjects.Text {
  const px = Math.max(size, MIN_TEXT);
  const t = scene.add.text(x, y, text, { fontFamily: o.font ?? FONT_BODY, fontStyle: o.bold === false ? 'normal' : 'bold', fontSize: `${px}px`, color,
    stroke: o.strokeColor ?? MENU.navyHex, strokeThickness: o.stroke ?? Math.max(6, Math.round(px / 8)), align: 'center', wordWrap: o.wrap ? { width: o.wrap } : undefined });
  if (o.shadow !== false) t.setShadow(0, Math.round(px / 14) + 2, '#000000', 4, true, true);
  const [ox, oy] = o.origin ?? [0.5, 0.5]; return t.setOrigin(ox, oy);
}
export function arrowShape(scene: Phaser.Scene, color: number, size = 30): Phaser.GameObjects.Graphics { return drawArrow(scene.add.graphics(), color, size); }
export function drawArrow(g: Phaser.GameObjects.Graphics, color: number, size = 30): Phaser.GameObjects.Graphics {
  g.clear(); g.fillStyle(color, 1).lineStyle(5, 0xffffff, 1); g.beginPath(); g.moveTo(-size / 2, -size); g.lineTo(size, 0); g.lineTo(-size / 2, size); g.closePath(); g.fillPath(); g.strokePath(); return g;
}
export interface Selectable { setSelected(selected: boolean, color?: number): void }

/** Shared Join-screen frame styling; callers supply the Graphics object and state. */
export function drawJoinPanelFrame(g: Phaser.GameObjects.Graphics, w: number, h: number, color: number, joined: boolean, ready: boolean): void {
  g.clear();
  if (ready) for (let i = 3; i >= 1; i--) g.fillStyle(color, 0.16).fillRoundedRect(-w / 2 - i * 8, -h / 2 - i * 8, w + i * 16, h + i * 16, 40 + i * 8);
  g.fillStyle(ready ? 0x1d5a3c : joined ? 0x22407a : 0x14213d, joined ? 0.94 : 0.6).fillRoundedRect(-w / 2, -h / 2, w, h, 40);
  g.lineStyle(joined ? 10 : 6, color, joined ? 1 : 0.45).strokeRoundedRect(-w / 2, -h / 2, w, h, 40);
}
