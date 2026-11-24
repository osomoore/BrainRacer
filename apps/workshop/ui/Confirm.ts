/**
 * Confirm: a simple modal Yes / No. Dims and swallows taps on everything behind it.
 *
 *   const c = new Confirm(scene, { cx: w / 2, cy: h / 2, w: Math.min(w - 80, 900), text: 'Start over?',
 *                                  yes: 'Yes', no: 'No', defaultYes: false, audio: ctx.audio, touch: ctx.input.touch,
 *                                  onYes: () => ..., onNo: () => ... });
 *   // in update(): if (c.open) { for (const a of ctx.input.poll()) c.handle(a); return; }
 *
 * Left / right moves, confirm picks, back = No. It closes (destroys itself) before calling onYes / onNo.
 */
import Phaser from 'phaser';
import type { PaneAction, WorkshopAudio } from '../core/runtime';
import { WS_UI } from '../config';
import { Button } from './Button';
import { FocusGroup } from './FocusGroup';
import { COLORS, makeText, roundedOriginY, roundedTexture } from './style';

export interface ConfirmOpts {
  cx: number; cy: number; w: number;
  text: string; yes?: string; no?: string;
  defaultYes?: boolean;
  /** One centred button (label = `yes`, default 'OK'); confirm and back both close it, calling onYes. */
  single?: boolean;
  onYes: () => void; onNo?: () => void;
  audio?: WorkshopAudio; touch?: boolean;
  depth?: number;
}

export class Confirm {
  open = true;
  private readonly objs: Phaser.GameObjects.GameObject[] = [];
  private readonly group: FocusGroup;
  private onNo?: () => void;

  constructor(scene: Phaser.Scene, o: ConfirmOpts) {
    this.onNo = o.onNo;
    const depth = o.depth ?? 500;
    const h = 460;
    const dim = scene.add.rectangle(o.cx, o.cy, 4000, 4000, 0x000000, 0.6).setDepth(depth).setInteractive();
    const panel = scene.add.image(o.cx, o.cy, roundedTexture(scene, o.w, h, COLORS.paper, { radius: 40 })).setOrigin(0.5, roundedOriginY(h)).setDepth(depth + 1);
    const text = makeText(scene, o.cx, o.cy - 100, o.text, { size: 56, wrap: o.w - 80 }).setDepth(depth + 2);
    const bw = Math.min(360, (o.w - 120) / 2);
    const yes = new Button(scene, { x: o.single ? o.cx : o.cx - bw / 2 - 20, y: o.cy + 110, w: bw, h: WS_UI.tapMin + 20, label: o.yes ?? (o.single ? 'OK' : 'Yes'), color: COLORS.green, onClick: () => this.close(o.onYes) });
    const no = o.single ? undefined : new Button(scene, { x: o.cx + bw / 2 + 20, y: o.cy + 110, w: bw, h: WS_UI.tapMin + 20, label: o.no ?? 'No', color: COLORS.red, textColor: COLORS.paper, onClick: () => this.close(o.onNo) });
    yes.setDepth(depth + 2); no?.setDepth(depth + 2);
    this.objs.push(dim, panel, text, yes);
    if (no) this.objs.push(no);
    if (o.single) this.onNo = o.onYes;
    this.group = new FocusGroup({ audio: o.audio, touch: o.touch });
    this.group.set(no ? [yes, no] : [yes]);
    this.group.focus(o.defaultYes || !no ? yes : no);
  }

  handle(a: PaneAction): void {
    if (!this.open) return;
    if (a === 'back') { this.close(this.onNo); return; }
    this.group.handle(a);
  }

  private close(then?: () => void): void {
    if (!this.open) return;
    this.destroy();
    then?.();
  }

  destroy(): void {
    this.open = false;
    this.group.destroy();
    this.objs.forEach((o) => o.destroy());
    this.objs.length = 0;
  }
}
