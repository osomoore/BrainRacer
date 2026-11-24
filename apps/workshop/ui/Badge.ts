/**
 * Button-prompt badge: a small round (letter) or pill (key name) marker such as "A", "B", "Space".
 *
 *   makeBadge(scene, 'A', x, y)                         -> GameObject centered at x,y
 *   promptBadge(scene, ctx.input, 'confirm', x, y)      -> badge for the pane's input, or null on touch (hidden)
 */
import Phaser from 'phaser';
import type { PaneAction, PaneInput } from '../core/runtime';
import { COLORS, circleTexture, makeText, roundedOriginY, roundedTexture } from './style';
import { promptLabel } from './input';

const D = 52;

export function makeBadge(scene: Phaser.Scene, label: string, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const fill = label === 'A' ? COLORS.green : label === 'B' ? COLORS.red : COLORS.yellow;
  const txtColor = label === 'A' || label === 'B' ? COLORS.paper : COLORS.ink;
  const t = makeText(scene, 0, 0, label, { size: 28, color: txtColor, small: true });
  if (label.length <= 1) {
    c.add(scene.add.image(0, 0, circleTexture(scene, D, fill)));
  } else {
    const w = Math.max(D, Math.ceil(t.width) + 28);
    c.add(scene.add.image(0, 0, roundedTexture(scene, w, D, fill, { radius: D / 2, shadow: 0, strokeW: 5, gloss: false })).setOrigin(0.5, roundedOriginY(D, 0)));
  }
  c.add(t);
  return c;
}

export function promptBadge(scene: Phaser.Scene, input: PaneInput, action: PaneAction, x: number, y: number): Phaser.GameObjects.Container | null {
  const label = promptLabel(input, action);
  return label ? makeBadge(scene, label, x, y) : null;
}
