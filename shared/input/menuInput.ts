/**
 * Minimal menu input for pages without Brain Racer's full input stack (launcher, Adventure Workshop
 * menus): any controller or keyboard can move / confirm / go back.
 *
 * `padActions` / `keyActions` are pure (tested). `createMenuInput` wires them to the browser:
 * call `poll()` once per animation frame and act on the returned list.
 */
import { resolvePadMap } from './padMaps';

export type MenuAction = 'left' | 'right' | 'up' | 'down' | 'confirm' | 'back';

export interface MenuPadSnapshot {
  id: string;
  mapping: string;
  axes: readonly number[];
  buttons: readonly { pressed: boolean }[];
}

/** Stick past this counts as a direction. */
export const MENU_STICK_THRESHOLD = 0.5;

/** Direction held on a pad (d-pad wins over stick). */
function padDir(s: MenuPadSnapshot): { x: number; y: number } {
  const m = resolvePadMap(s.id, s.mapping);
  const b = (i: number) => !!s.buttons[i]?.pressed;
  const ax = s.axes[m.axisX] ?? 0;
  const ay = s.axes[m.axisY] ?? 0;
  const dx = (b(m.dRight) ? 1 : 0) - (b(m.dLeft) ? 1 : 0);
  const dy = (b(m.dDown) ? 1 : 0) - (b(m.dUp) ? 1 : 0);
  return {
    x: dx || (Math.abs(ax) >= MENU_STICK_THRESHOLD ? Math.sign(ax) : 0),
    y: dy || (Math.abs(ay) >= MENU_STICK_THRESHOLD ? Math.sign(ay) : 0),
  };
}

/** Edge-triggered actions for one pad between two snapshots (no auto-repeat). */
export function padActions(now: MenuPadSnapshot, prev: MenuPadSnapshot | null): MenuAction[] {
  const m = resolvePadMap(now.id, now.mapping);
  const out: MenuAction[] = [];
  const d = padDir(now);
  const p = prev ? padDir(prev) : { x: 0, y: 0 };
  if (d.x !== 0 && d.x !== p.x) out.push(d.x < 0 ? 'left' : 'right');
  if (d.y !== 0 && d.y !== p.y) out.push(d.y < 0 ? 'up' : 'down');
  const edge = (i: number) => !!now.buttons[i]?.pressed && !prev?.buttons[i]?.pressed;
  if (edge(m.a) || edge(m.start)) out.push('confirm');
  if (edge(m.b)) out.push('back');
  return out;
}

/** Keyboard codes (both Brain Racer layouts: WASD/Space and arrows/Enter; Backspace/Escape = back). */
export const MENU_KEYS: Readonly<Record<string, MenuAction>> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm',
  Backspace: 'back', Escape: 'back',
};

export function keyActions(code: string): MenuAction | null {
  return MENU_KEYS[code] ?? null;
}

export interface MenuInput {
  /** Actions since the last poll, in order. */
  poll(): MenuAction[];
  /** True once any controller has been seen this page. */
  hasPad(): boolean;
  dispose(): void;
}

export function createMenuInput(target: Window = window): MenuInput {
  const queued: MenuAction[] = [];
  const prev = new Map<number, MenuPadSnapshot>();
  let seenPad = false;

  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = keyActions(e.code);
    if (!a) return;
    e.preventDefault();
    queued.push(a);
  };
  target.addEventListener('keydown', onKey);

  return {
    poll() {
      const out = queued.splice(0);
      let pads: (Gamepad | null)[] = [];
      try { pads = Array.from(navigator.getGamepads?.() ?? []); } catch { /* ignore */ }
      const live = new Set<number>();
      for (const g of pads) {
        if (!g || !g.connected) continue;
        seenPad = true;
        live.add(g.index);
        const snap: MenuPadSnapshot = {
          id: g.id, mapping: g.mapping, axes: Array.from(g.axes),
          buttons: g.buttons.map((b) => ({ pressed: b.pressed })),
        };
        // First sight of a pad: record only, so a button still held from the previous page doesn't fire.
        if (prev.has(g.index)) out.push(...padActions(snap, prev.get(g.index)!));
        prev.set(g.index, snap);
      }
      for (const i of [...prev.keys()]) if (!live.has(i)) prev.delete(i);
      return out;
    },
    hasPad: () => seenPad,
    dispose() { target.removeEventListener('keydown', onKey); },
  };
}
