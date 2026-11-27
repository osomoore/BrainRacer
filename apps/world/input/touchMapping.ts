/** Phaser-free touch mapping: pointer events -> PlayerControls. Tested in touchMapping.test.ts. */
import type { PlayerControls } from '../core/runtime';

export type ButtonId = 'a' | 'b' | 'x' | 'y';

export interface TouchLayout {
  width: number;
  stickZone: number;
  stickRadius: number;
  deadZone: number;
  stickMargin: number;
  buttonCenter: { x: number; y: number };
  buttonOffset: number;
  buttonRadius: number;
  hitScale: number;
}

export interface ButtonSpec { id: ButtonId; x: number; y: number; r: number }

/** Xbox-style diamond: Y top, A bottom, X left, B right. */
export function buttonSpecs(l: Pick<TouchLayout, 'buttonCenter' | 'buttonOffset' | 'buttonRadius'>): ButtonSpec[] {
  const { x, y } = l.buttonCenter;
  const o = l.buttonOffset;
  const r = l.buttonRadius;
  return [
    { id: 'y', x, y: y - o, r },
    { id: 'a', x, y: y + o, r },
    { id: 'x', x: x - o, y, r },
    { id: 'b', x: x + o, y, r },
  ];
}

/** Touch mode: exactly one player and (a phone, or the `?touch=1` override; `?touch=0` forces off). */
export function touchModeWanted(search: string, mobile: boolean, playerCount: number): boolean {
  if (playerCount !== 1) return false;
  const v = new URLSearchParams(search).get('touch');
  if (v === '0' || v === 'false') return false;
  if (v === '1' || v === 'true') return true;
  return mobile;
}

/** Stick vector (pixels from the base, screen y down) -> -1..1 with dead zone, clamped to the unit disc. */
export function stickVector(dx: number, dy: number, radius: number, deadZone: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len === 0 || radius <= 0) return { x: 0, y: 0 };
  const m = Math.min(1, len / radius);
  if (m <= deadZone) return { x: 0, y: 0 };
  const s = (m - deadZone) / (1 - deadZone);
  return { x: (dx / len) * s, y: (dy / len) * s };
}

const BUTTONS: ButtonId[] = ['a', 'b', 'x', 'y'];

export class TouchState {
  readonly buttons: ButtonSpec[];
  /** Pointer id driving the stick, if any, plus the floating base and clamped knob offset (px). */
  stickPointer: number | null = null;
  base = { x: 0, y: 0 };
  knob = { x: 0, y: 0 };
  readonly held: Record<ButtonId, boolean> = { a: false, b: false, x: false, y: false };
  private readonly buttonPointers = new Map<number, ButtonId>();
  private readonly edges: Record<ButtonId, boolean> = { a: false, b: false, x: false, y: false };

  constructor(private readonly layout: TouchLayout) { this.buttons = buttonSpecs(layout); }

  /** Returns what the pointer was assigned to. */
  down(id: number, x: number, y: number): 'stick' | 'button' | null {
    if (this.stickPointer === id || this.buttonPointers.has(id)) return null;
    const hit = this.hitButton(x, y);
    if (hit) {
      this.buttonPointers.set(id, hit);
      if (!this.held[hit]) this.edges[hit] = true;
      this.refreshHeld();
      return 'button';
    }
    const l = this.layout;
    if (this.stickPointer === null && x < l.width * l.stickZone) {
      const m = l.stickMargin + l.stickRadius;
      this.stickPointer = id;
      this.base = { x: Math.max(m, x), y };
      this.knob = { x: 0, y: 0 };
      this.move(id, x, y);
      return 'stick';
    }
    return null;
  }

  move(id: number, x: number, y: number): void {
    if (id !== this.stickPointer) return;
    let dx = x - this.base.x;
    let dy = y - this.base.y;
    const len = Math.hypot(dx, dy);
    if (len > this.layout.stickRadius) {
      dx = (dx / len) * this.layout.stickRadius;
      dy = (dy / len) * this.layout.stickRadius;
    }
    this.knob = { x: dx, y: dy };
  }

  up(id: number): void {
    if (id === this.stickPointer) {
      this.stickPointer = null;
      this.knob = { x: 0, y: 0 };
    }
    if (this.buttonPointers.delete(id)) this.refreshHeld();
  }

  cancelAll(): void {
    this.stickPointer = null;
    this.knob = { x: 0, y: 0 };
    this.buttonPointers.clear();
    this.refreshHeld();
  }

  /** Controls for this frame. Pressed flags are edge-triggered: each tap reports once, then clears. */
  frame(): PlayerControls {
    const v = this.stickPointer === null
      ? { x: 0, y: 0 }
      : stickVector(this.knob.x, this.knob.y, this.layout.stickRadius, this.layout.deadZone);
    const pressed = { a: this.edges.a, b: this.edges.b, x: this.edges.x, y: this.edges.y, menu: false };
    for (const b of BUTTONS) this.edges[b] = false;
    return { x: v.x, y: v.y, throttle: Math.max(0, -v.y), brake: Math.max(0, v.y), pressed };
  }

  private hitButton(x: number, y: number): ButtonId | null {
    for (const b of this.buttons) {
      const r = b.r * this.layout.hitScale;
      if ((x - b.x) ** 2 + (y - b.y) ** 2 <= r * r) return b.id;
    }
    return null;
  }

  private refreshHeld(): void {
    for (const b of BUTTONS) this.held[b] = false;
    for (const b of this.buttonPointers.values()) this.held[b] = true;
  }
}
