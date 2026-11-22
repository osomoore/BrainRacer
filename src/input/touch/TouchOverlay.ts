/** DOM overlay with on-screen buttons. Tracks which buttons are held (multitouch, sliding between buttons). */
import type { TouchLayout } from '../../core/types';
import { TOUCH_CFG } from '../config';
import { TOUCH_BUTTONS, emptyTouchState, type TouchButton, type TouchState } from './touchMap';

const ICON: Record<TouchButton, string> = {
  left: '<path d="M68 14 24 50l44 36z" fill="#fff"/>',
  right: '<path d="M32 14l44 36-44 36z" fill="#fff"/>',
  up: '<path d="M14 68 50 24l36 44z" fill="#fff"/>',
  down: '<path d="M14 32l36 44 36-44z" fill="#fff"/>',
  brake: '<rect x="24" y="24" width="52" height="52" rx="10" fill="#fff"/>',
  pause: '<rect x="26" y="20" width="16" height="60" rx="4" fill="#fff"/><rect x="58" y="20" width="16" height="60" rx="4" fill="#fff"/>',
  reset: '<path d="M50 18a32 32 0 1 1-30 21" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round"/><path d="M50 2v34L24 19z" fill="#fff"/>',
  a: '<text x="50" y="68" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="60" text-anchor="middle" fill="#fff">A</text>',
  b: '<text x="50" y="68" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="60" text-anchor="middle" fill="#fff">B</text>',
};
const COLOR: Record<TouchButton, string> = {
  left: '#1e6fff', right: '#1e6fff', up: '#1e6fff', down: '#1e6fff', brake: '#e5342b',
  pause: '#3b4a6b', reset: '#8a5cf6', a: '#1fae4b', b: '#e5342b',
};

const CSS = `
.bt-touch{position:fixed;inset:0;z-index:50;pointer-events:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;
  -webkit-tap-highlight-color:transparent;touch-action:none;display:none}
.bt-touch.on{display:block}
.bt-b{position:absolute;pointer-events:auto;touch-action:none;border-radius:22%;opacity:${TOUCH_CFG.alpha};
  border:.6vh solid rgba(255,255,255,.9);box-shadow:0 .6vh 0 rgba(0,0,0,.35);display:none;box-sizing:border-box;
  width:var(--s);height:var(--s);background:var(--c);left:var(--x);bottom:var(--y)}
.bt-b.top{bottom:auto;top:var(--y)}
.bt-b.rt{left:auto;right:var(--x)}
.bt-b.show{display:block}
.bt-b svg{width:100%;height:100%;display:block;pointer-events:none}
.bt-b.down{opacity:.95;transform:scale(.94);filter:brightness(1.25)}
`;

interface Spot { size: number; x: number; y: number; corner: 'bl' | 'br' | 'tr' }

const sb = TOUCH_CFG.steerBtnVh, pd = TOUCH_CFG.padBtnVh, ac = TOUCH_CFG.actionBtnVh, sm = TOUCH_CFG.smallBtnVh;
/** Offsets (vh) from the corner, per layout. Shared buttons (left/right) move between layouts. */
const SPOTS: Record<TouchLayout, Partial<Record<TouchButton, Spot>>> = {
  none: {},
  race: {
    left: { size: sb, x: 0, y: 0, corner: 'bl' },
    // Left thumb steers left, right thumb steers right; brake (rarely needed with auto-gas) sits above ▶.
    right: { size: sb, x: 0, y: 0, corner: 'br' },
    brake: { size: TOUCH_CFG.brakeBtnVh, x: (sb - TOUCH_CFG.brakeBtnVh) / 2, y: sb + 3, corner: 'br' },
    pause: { size: sm, x: 0, y: 0, corner: 'tr' },
    reset: { size: sm, x: sm + 3, y: 0, corner: 'tr' },
  },
  menu: {
    left: { size: pd, x: 0, y: pd + 1, corner: 'bl' },
    right: { size: pd, x: 2 * pd + 2, y: pd + 1, corner: 'bl' },
    up: { size: pd, x: pd + 1, y: 2 * pd + 2, corner: 'bl' },
    down: { size: pd, x: pd + 1, y: 0, corner: 'bl' },
    a: { size: ac, x: 0, y: 4, corner: 'br' },
    b: { size: ac * 0.8, x: ac + 3, y: 0, corner: 'br' },
  },
};

const safe = (side: string, extra: number) =>
  `calc(max(${TOUCH_CFG.edgeMarginVh}vh, env(safe-area-inset-${side})) + ${extra}vh)`;

export class TouchOverlay {
  readonly root = document.createElement('div');
  private els = new Map<TouchButton, HTMLElement>();
  private held = emptyTouchState();
  private latched = emptyTouchState();
  private pointers = new Map<number, TouchButton | null>();
  private layout: TouchLayout | null = null;

  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    this.root.className = 'bt-touch';
    this.root.setAttribute('aria-hidden', 'true');
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.root.appendChild(style);
    for (const b of TOUCH_BUTTONS) {
      const el = document.createElement('div');
      el.className = 'bt-b';
      el.dataset.btn = b;
      el.style.setProperty('--c', COLOR[b]);
      el.innerHTML = `<svg viewBox="0 0 100 100">${ICON[b]}</svg>`;
      this.els.set(b, el);
      this.root.appendChild(el);
    }
    document.body.appendChild(this.root);
    this.root.addEventListener('pointerdown', this.onDown);
    this.root.addEventListener('pointermove', this.onMove);
    this.root.addEventListener('pointerup', this.onUp);
    this.root.addEventListener('pointercancel', this.onUp);
    window.addEventListener('blur', this.releaseAll);
    this.setLayout('none');
  }

  private hit(x: number, y: number): TouchButton | null {
    for (const el of document.elementsFromPoint(x, y)) {
      const b = (el as HTMLElement).dataset?.btn as TouchButton | undefined;
      if (b && this.els.get(b)?.classList.contains('show')) return b;
    }
    return null;
  }

  private onDown = (e: PointerEvent) => {
    e.preventDefault();
    this.pointers.set(e.pointerId, this.hit(e.clientX, e.clientY));
    this.refresh();
  };
  private onMove = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return;
    const b = this.hit(e.clientX, e.clientY);
    if (b !== this.pointers.get(e.pointerId)) { this.pointers.set(e.pointerId, b); this.refresh(); }
  };
  private onUp = (e: PointerEvent) => {
    if (this.pointers.delete(e.pointerId)) this.refresh();
  };
  private releaseAll = () => { this.pointers.clear(); this.refresh(); };

  private refresh() {
    const now = new Set<TouchButton | null>(this.pointers.values());
    for (const b of TOUCH_BUTTONS) {
      const on = now.has(b);
      if (on && !this.held[b]) this.latched[b] = true;
      this.held[b] = on;
      this.els.get(b)!.classList.toggle('down', on);
    }
  }

  setLayout(layout: TouchLayout) {
    if (layout === this.layout) return;
    this.layout = layout;
    const spots = SPOTS[layout];
    for (const [b, el] of this.els) {
      const s = spots[b];
      el.classList.toggle('show', !!s);
      if (!s) continue;
      el.classList.toggle('rt', s.corner !== 'bl');
      el.classList.toggle('top', s.corner === 'tr');
      el.style.setProperty('--s', `${s.size}vh`);
      el.style.setProperty('--x', safe(s.corner === 'bl' ? 'left' : 'right', s.x));
      el.style.setProperty('--y', safe(s.corner === 'tr' ? 'top' : 'bottom', s.y));
    }
    this.releaseAll();
  }

  /** Buttons held or tapped since the last call; clears the latch. */
  take(): TouchState {
    const out = emptyTouchState();
    for (const b of TOUCH_BUTTONS) out[b] = this.held[b] || this.latched[b];
    this.latched = emptyTouchState();
    return out;
  }

  heldNow(): TouchState { return { ...this.held }; }

  setVisible(v: boolean) { this.root.classList.toggle('on', v); }
}
