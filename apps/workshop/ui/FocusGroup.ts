/**
 * FocusGroup: keeps one focused Button among a set, moves focus spatially (focusNav) on pad / keyboard actions,
 * activates it on 'confirm', follows the mouse hover. The focus ring is hidden on touch.
 *
 *   const group = new FocusGroup({ audio: ctx.audio, touch: ctx.input.touch, wrap: false, onEdge: (dir) => ... });
 *   group.set([btnA, btnB]); group.focusFirst();
 *   // in update(): for (const a of ctx.input.poll()) if (!group.handle(a)) { ...handle 'back' / 'menu' yourself }
 *
 * handle() returns true when the action was a move / confirm it consumed. `onEdge(dir)` fires when a move found
 * nothing (e.g. flip a page on left / right). Call destroy() in the screen's destroy().
 */
import type { PaneAction, WorkshopAudio } from '../core/runtime';
import type { Button } from './Button';
import { firstEnabled, moveFocus, type FocusDir } from './focusNav';

export interface FocusGroupOpts {
  audio?: WorkshopAudio;
  touch?: boolean;
  wrap?: boolean;
  onEdge?: (dir: FocusDir) => void;
}

export class FocusGroup {
  private items: Button[] = [];
  private index = -1;

  constructor(private readonly o: FocusGroupOpts = {}) {}

  set(buttons: readonly Button[]): this {
    this.items.forEach((b) => b.off('hover'));
    this.items = [...buttons];
    this.items.forEach((b) => b.on('hover', () => this.focus(b)));
    this.index = -1;
    return this;
  }

  add(b: Button): this { return this.set([...this.items, b]); }

  get focused(): Button | undefined { return this.items[this.index]; }

  focus(b: Button | number | undefined): void {
    const i = typeof b === 'number' ? b : b ? this.items.indexOf(b) : -1;
    if (i === this.index) return;
    this.items.forEach((x, k) => x.setFocused(k === i && !this.o.touch));
    this.index = i;
  }

  focusFirst(): void { this.focus(firstEnabled(this.items.map((b) => b.rect()))); }

  handle(action: PaneAction): boolean {
    if (action === 'confirm') {
      const b = this.focused;
      if (!b || !b.isEnabled) return true;
      this.o.audio?.sfx('select');
      b.pulse();
      b.activate();
      return true;
    }
    if (action === 'left' || action === 'right' || action === 'up' || action === 'down') {
      if (this.index < 0) { this.focusFirst(); return true; }
      const rects = this.items.map((b) => b.rect());
      const next = moveFocus(rects, this.index, action, this.o.wrap ?? false);
      if (next === this.index) { this.o.onEdge?.(action); return true; }
      this.o.audio?.sfx('click');
      this.focus(next);
      return true;
    }
    return false;
  }

  destroy(): void {
    this.items.forEach((b) => b.off('hover'));
    this.items = [];
    this.index = -1;
  }
}
