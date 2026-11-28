/**
 * Device-aware menu input: every pad (by index) and every keyboard layout is its OWN device, so two players can
 * use menus at the same time (Adventure Workshop split screen). Pure mapping functions are tested; `createDeviceInput`
 * wires them to the browser. `createMenuInput` (menuInput.ts) stays the merged reader for the launcher.
 *
 * Layouts:
 *  - KB1: WASD move, Space confirm, Q / Escape back, Tab menu, 1 top face.
 *  - KB2: arrows move, Enter confirm, Backspace back, Right Shift menu, 0 top face.
 *  - Pad: d-pad / left stick move, A confirm, B back, Start menu, Y top face.
 * Admin chord: a pad holding LT + RT while pressing Start, or F9 on the keyboard.
 * Typing: letters (not the layout's own move keys, unless Shift is held) become `text` events; Enter also yields
 * text "\n" (submit) next to its confirm action so a text screen can treat it as "done".
 */
import { MENU_STICK_THRESHOLD, type MenuPadSnapshot } from './menuInput';
import { resolvePadMap } from './padMaps';

export type DeviceAction = 'left' | 'right' | 'up' | 'down' | 'confirm' | 'back' | 'menu' | 'topFace';

export type DeviceId =
  | { kind: 'pad'; index: number }
  | { kind: 'kb'; layout: 1 | 2 }
  | { kind: 'touch' };

export type DeviceEvent =
  | { type: 'action'; device: DeviceId; action: DeviceAction }
  | { type: 'text'; device: DeviceId; text: string }
  | { type: 'admin' };

export function deviceKey(d: DeviceId): string {
  return d.kind === 'pad' ? `pad${d.index}` : d.kind === 'kb' ? `kb${d.layout}` : 'touch';
}

export function sameDevice(a: DeviceId, b: DeviceId): boolean { return deviceKey(a) === deviceKey(b); }

/** Keyboard codes per layout. */
export const KB_LAYOUT_KEYS: Readonly<Record<1 | 2, Readonly<Record<string, DeviceAction>>>> = {
  1: {
    KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
    Space: 'confirm', KeyQ: 'back', Escape: 'back', Tab: 'menu', Digit1: 'topFace',
  },
  2: {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    Enter: 'confirm', NumpadEnter: 'confirm', Backspace: 'back', ShiftRight: 'menu', Digit0: 'topFace',
  },
};

export const ADMIN_KEY = 'F9';

/** Which layout owns a key code (null = none). KB1 and KB2 share no codes. */
export function keyLayout(code: string): 1 | 2 | null {
  if (code in KB_LAYOUT_KEYS[1]) return 1;
  if (code in KB_LAYOUT_KEYS[2]) return 2;
  return null;
}

export function keyAction(code: string): { layout: 1 | 2; action: DeviceAction } | null {
  const layout = keyLayout(code);
  return layout ? { layout, action: KB_LAYOUT_KEYS[layout][code] } : null;
}

/** Text typed by a key press: a single letter (any language) or null. Move keys type only with Shift held. */
export function keyText(code: string, key: string, shift: boolean): string | null {
  if (!/^\p{L}$/u.test(key)) return null;
  const moveKey = code in KB_LAYOUT_KEYS[1] || code in KB_LAYOUT_KEYS[2];
  if (moveKey && !shift) return null;
  return key;
}

/** Pad state helpers (pure). */
function buttonOf(s: MenuPadSnapshot, i: number): boolean { return !!s.buttons[i]?.pressed; }

function padDir(s: MenuPadSnapshot): { x: number; y: number } {
  const m = resolvePadMap(s.id, s.mapping);
  const ax = s.axes[m.axisX] ?? 0;
  const ay = s.axes[m.axisY] ?? 0;
  const dx = (buttonOf(s, m.dRight) ? 1 : 0) - (buttonOf(s, m.dLeft) ? 1 : 0);
  const dy = (buttonOf(s, m.dDown) ? 1 : 0) - (buttonOf(s, m.dUp) ? 1 : 0);
  return {
    x: dx || (Math.abs(ax) >= MENU_STICK_THRESHOLD ? Math.sign(ax) : 0),
    y: dy || (Math.abs(ay) >= MENU_STICK_THRESHOLD ? Math.sign(ay) : 0),
  };
}

export interface PadResult { actions: DeviceAction[]; admin: boolean }

/**
 * Edge-triggered result for one pad. `prev === null` (first sight) yields nothing, so a button still held from
 * the previous page does not fire. LT + RT held while Start is pressed is the admin chord (Start then is not 'menu').
 */
export function padDeviceActions(now: MenuPadSnapshot, prev: MenuPadSnapshot | null): PadResult {
  const out: PadResult = { actions: [], admin: false };
  if (!prev) return out;
  const m = resolvePadMap(now.id, now.mapping);
  const d = padDir(now);
  const p = padDir(prev);
  if (d.x !== 0 && d.x !== p.x) out.actions.push(d.x < 0 ? 'left' : 'right');
  if (d.y !== 0 && d.y !== p.y) out.actions.push(d.y < 0 ? 'up' : 'down');
  const edge = (i: number) => buttonOf(now, i) && !buttonOf(prev, i);
  if (edge(m.a)) out.actions.push('confirm');
  if (edge(m.b)) out.actions.push('back');
  if (edge(m.y)) out.actions.push('topFace');
  if (edge(m.start)) {
    if (buttonOf(now, m.lt) && buttonOf(now, m.rt)) out.admin = true;
    else out.actions.push('menu');
  }
  return out;
}

export interface DeviceInput {
  /** Events since the last poll, in order. */
  poll(): DeviceEvent[];
  /** Connected pad indexes seen on the last poll. */
  pads(): number[];
  dispose(): void;
}

export function createDeviceInput(target: Window = window): DeviceInput {
  const queued: DeviceEvent[] = [];
  const prev = new Map<number, MenuPadSnapshot>();
  let live: number[] = [];

  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === ADMIN_KEY) { e.preventDefault(); if (!e.repeat) queued.push({ type: 'admin' }); return; }
    const ka = keyAction(e.code);
    const text = keyText(e.code, e.key, e.shiftKey);
    if (!ka && text === null) return;
    // Tab / Space / arrows must not scroll or move browser focus.
    if (ka || text !== null) e.preventDefault();
    if (e.repeat) return;
    const device: DeviceId = { kind: 'kb', layout: ka?.layout ?? 2 };
    if (text !== null) queued.push({ type: 'text', device, text });
    else if (ka) {
      queued.push({ type: 'action', device: { kind: 'kb', layout: ka.layout }, action: ka.action });
      if (e.code === 'Enter' || e.code === 'NumpadEnter') queued.push({ type: 'text', device: { kind: 'kb', layout: 2 }, text: '\n' });
    }
  };
  target.addEventListener('keydown', onKey);

  return {
    poll() {
      const out = queued.splice(0);
      let pads: (Gamepad | null)[] = [];
      try { pads = Array.from(navigator.getGamepads?.() ?? []); } catch { /* ignore */ }
      const seen = new Set<number>();
      for (const g of pads) {
        if (!g || !g.connected) continue;
        seen.add(g.index);
        const snap: MenuPadSnapshot = {
          id: g.id, mapping: g.mapping, axes: Array.from(g.axes),
          buttons: g.buttons.map((b) => ({ pressed: b.pressed })),
        };
        const r = padDeviceActions(snap, prev.get(g.index) ?? null);
        const device: DeviceId = { kind: 'pad', index: g.index };
        for (const action of r.actions) out.push({ type: 'action', device, action });
        if (r.admin) out.push({ type: 'admin' });
        prev.set(g.index, snap);
      }
      for (const i of [...prev.keys()]) if (!seen.has(i)) prev.delete(i);
      live = [...seen];
      return out;
    },
    pads: () => live,
    dispose() { target.removeEventListener('keydown', onKey); },
  };
}
