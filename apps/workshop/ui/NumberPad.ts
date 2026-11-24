/**
 * NumberPad: 3 x 4 keypad (7 8 9 / 4 5 6 / 1 2 3 / DEL 0 OK), keys >= 120 px. `x` = center, `y` = top.
 *
 *   const pad = new NumberPad(scene, { x, y, onDigit: (d) => ..., onDelete: () => ..., onOk: () => ... });
 *   group.set(pad.buttons);
 */
import Phaser from 'phaser';
import { WS_UI } from '../config';
import { Button } from './Button';
import { COLORS } from './style';

export interface NumberPadOpts {
  x: number; y: number; key?: number; gap?: number;
  onDigit: (d: number) => void; onDelete: () => void; onOk: () => void;
  small?: boolean;
}

export class NumberPad {
  readonly buttons: Button[] = [];
  readonly height: number;

  constructor(scene: Phaser.Scene, o: NumberPadOpts) {
    const key = o.key ?? WS_UI.tapMin;
    const gap = o.gap ?? 14;
    this.height = 4 * key + 3 * gap;
    const defs: { label: string; color: number; fn: () => void }[] = [
      ...[7, 8, 9, 4, 5, 6, 1, 2, 3].map((d) => ({ label: String(d), color: COLORS.paper as number, fn: () => o.onDigit(d) })),
      { label: 'DEL', color: 0xff9f43, fn: o.onDelete },
      { label: '0', color: COLORS.paper, fn: () => o.onDigit(0) },
      { label: 'OK', color: COLORS.green, fn: o.onOk },
    ];
    defs.forEach((d, i) => {
      const cx = o.x + ((i % 3) - 1) * (key + gap);
      const cy = o.y + Math.floor(i / 3) * (key + gap) + key / 2;
      this.buttons.push(new Button(scene, { x: cx, y: cy, w: key, h: key, label: d.label, color: d.color, fontSize: d.label.length > 1 ? 40 : 64, onClick: d.fn, small: o.small }));
    });
  }

  destroy(): void { this.buttons.forEach((b) => b.destroy()); this.buttons.length = 0; }
}
