/**
 * Pager: "<  Page 1 / 3  >" with two tap targets. Hidden when there is a single page.
 *
 *   const pager = new Pager(scene, { x, y, pages: 3, onChange: (page) => rebuildCards(page) });
 *   group.set([...cards, ...pager.buttons]);   // arrows are focusable (they are disabled while hidden)
 *   pager.go(+1); pager.setPages(n); pager.page; pager.destroy();
 */
import Phaser from 'phaser';
import { Button } from './Button';
import { clampPage } from './paging';
import { COLORS, makeText } from './style';
import { WS_UI } from '../config';

export interface PagerOpts { x: number; y: number; pages: number; page?: number; onChange: (page: number) => void; gap?: number }

export class Pager {
  readonly prev: Button;
  readonly next: Button;
  readonly buttons: Button[];
  private readonly label: Phaser.GameObjects.Text;
  private pages: number;
  page: number;

  constructor(scene: Phaser.Scene, private readonly o: PagerOpts) {
    const s = WS_UI.tapMin;
    const gap = o.gap ?? 150;
    this.pages = o.pages;
    this.page = clampPage(o.page ?? 0, o.pages);
    this.prev = new Button(scene, { x: o.x - gap - s / 2, y: o.y, w: s, h: s, label: '<', fontSize: 64, color: COLORS.yellow, onClick: () => this.go(-1) });
    this.next = new Button(scene, { x: o.x + gap + s / 2, y: o.y, w: s, h: s, label: '>', fontSize: 64, color: COLORS.yellow, onClick: () => this.go(1) });
    this.label = makeText(scene, o.x, o.y, '', { size: 44, color: COLORS.ink, bold: true });
    this.buttons = [this.prev, this.next];
    this.refresh();
  }

  go(delta: number): void {
    const p = clampPage(this.page + delta, this.pages);
    if (p === this.page) return;
    this.page = p;
    this.refresh();
    this.o.onChange(p);
  }

  setPages(n: number, page = this.page): void {
    this.pages = Math.max(1, n);
    this.page = clampPage(page, this.pages);
    this.refresh();
  }

  get count(): number { return this.pages; }

  private refresh(): void {
    const show = this.pages > 1;
    this.label.setText(`${this.page + 1} / ${this.pages}`).setVisible(show);
    this.prev.setVisible(show).setEnabled(show && this.page > 0);
    this.next.setVisible(show).setEnabled(show && this.page < this.pages - 1);
  }

  destroy(): void {
    this.prev.destroy(); this.next.destroy(); this.label.destroy();
  }
}
