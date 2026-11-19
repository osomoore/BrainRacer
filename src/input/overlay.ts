/** F2 debug overlay (DOM). */
import type { PlayerInput } from '../core/types';
import type { PadSnapshot } from './mapping';

export function formatDebug(pads: Map<number, PadSnapshot>, players: (PlayerInput | null)[]): string {
  const f = (n: number) => n.toFixed(2);
  const lines: string[] = ['INPUT DEBUG (F2 to hide)'];
  if (pads.size === 0) lines.push('No gamepads connected (press a button on a pad)');
  for (const [i, p] of pads) {
    lines.push(`pad ${i}: ${p.id} [mapping=${p.mapping || 'none'}]`);
    lines.push('  axes: ' + p.axes.map((a, k) => `${k}:${f(a)}`).join(' '));
    lines.push('  btns: ' + p.buttons.map((b, k) => `${k}:${b.pressed ? '#' : ''}${f(b.value)}`).join(' '));
  }
  players.forEach((inp, i) => {
    if (!inp) { lines.push(`P${i + 1}: (unassigned)`); return; }
    lines.push(
      `P${i + 1}: steer ${f(inp.steer)} thr ${f(inp.throttle)} brk ${f(inp.brake)} ans ${inp.answer ?? '-'} ` +
      `ok ${+inp.confirm} back ${+inp.back} pause ${+inp.pause} nav ${inp.navX},${inp.navY}`,
    );
  });
  return lines.join('\n');
}

export class DebugOverlay {
  private el: HTMLDivElement | null = null;
  visible = false;

  toggle(): void {
    this.visible = !this.visible;
    if (this.visible && !this.el) {
      const el = document.createElement('div');
      el.style.cssText =
        'position:fixed;top:0;left:0;z-index:99999;padding:8px;max-width:90vw;pointer-events:none;' +
        'font:12px/1.35 monospace;color:#0f0;background:rgba(0,0,0,0.7);white-space:pre-wrap;';
      document.body.appendChild(el);
      this.el = el;
    }
    if (this.el) this.el.style.display = this.visible ? 'block' : 'none';
  }

  update(text: () => string): void {
    if (this.visible && this.el) this.el.textContent = text();
  }
}
