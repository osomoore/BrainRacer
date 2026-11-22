/**
 * LetterGrid: on-screen A-Z keys + SPACE / DELETE / DONE as Buttons (all >= 120 px, tap or pad or keyboard).
 * Wide panes use 13 columns, tall panes 7. `x` is the horizontal CENTER, `y` the top of the grid.
 *
 *   const grid = new LetterGrid(scene, { x: w / 2, y: 380, layout: ctx.layout, onKey: (k) => ... });
 *   group.set(grid.buttons);      // k is { type: 'add', ch } | { type: 'delete' } | { type: 'done' }
 *   grid.height                    // total height in px
 */
import Phaser from 'phaser';
import { WS_UI } from '../config';
import { Button } from './Button';
import { buildLetterKeys } from './letterGrid';
import { COLORS } from './style';

export type LetterKey = { type: 'add'; ch: string } | { type: 'delete' } | { type: 'done' };

export interface LetterGridOpts { x: number; y: number; layout: 'wide' | 'tall'; onKey: (k: LetterKey) => void }

export class LetterGrid {
  readonly buttons: Button[] = [];
  readonly height: number;

  constructor(scene: Phaser.Scene, o: LetterGridOpts) {
    const cols = o.layout === 'wide' ? 13 : 7;
    const gap = o.layout === 'wide' ? 12 : 10;
    const key = WS_UI.tapMin;
    const rowsDef = buildLetterKeys(cols);
    const rows = Math.max(...rowsDef.map((k) => k.row)) + 1;
    const totalW = cols * key + (cols - 1) * gap;
    const left = o.x - totalW / 2;
    this.height = rows * key + (rows - 1) * gap;
    for (const k of rowsDef) {
      const w = k.span * key + (k.span - 1) * gap;
      const cx = left + k.col * (key + gap) + w / 2;
      const cy = o.y + k.row * (key + gap) + key / 2;
      const color = k.kind === 'done' ? COLORS.green : k.kind === 'delete' ? 0xff9f43 : k.kind === 'space' ? 0x9bd7ff : COLORS.paper;
      const label = k.kind === 'delete' ? 'DELETE' : k.label;
      const b = new Button(scene, {
        x: cx, y: cy, w, h: key, label, color,
        fontSize: k.kind === 'letter' ? 64 : 48,
        onClick: () => o.onKey(k.kind === 'letter' ? { type: 'add', ch: k.label } : k.kind === 'space' ? { type: 'add', ch: ' ' } : k.kind === 'delete' ? { type: 'delete' } : { type: 'done' }),
      });
      this.buttons.push(b);
    }
  }

  /** The DONE button (focus it after typing from a keyboard, etc.). */
  get done(): Button { return this.buttons[this.buttons.length - 1]; }

  destroy(): void { this.buttons.forEach((b) => b.destroy()); this.buttons.length = 0; }
}
