/**
 * Phaser-free "armed" tracking for question-break answers. At break start (and on each new question)
 * every answer input that is already down is marked "must release"; it only counts again after it was
 * released once, so a held gas button (A / W / stick) can never slip through as an answer.
 */
import type { AnswerSlot } from '../core/types';

export type AnswerDir = 'up' | 'left' | 'right' | 'down';
/** Keys: `dir:<d>` for direction inputs, `slot:<n>` for face buttons / number keys. */
export type ArmKey = `dir:${AnswerDir}` | `slot:${AnswerSlot}`;

export interface HeldInput {
  steer: number;
  throttle: number;
  brake: number;
}

/** Analog threshold above which a direction counts as held. */
export const HELD_THRESHOLD = 0.3;

/**
 * Every answer input that looks held this frame. Gas (throttle) is held by W, stick/pad A or RT, so it
 * blocks both the up direction and the A slot (3). `navRecent` = directions whose nav edge repeated
 * lately (D-pad / stick up/down aren't visible as analog values, only as auto-repeating edges).
 */
export function heldKeys(inp: HeldInput, navRecent: readonly AnswerDir[] = []): Set<ArmKey> {
  const s = new Set<ArmKey>();
  if (inp.throttle > HELD_THRESHOLD) { s.add('dir:up'); s.add('slot:3'); }
  if (inp.brake > HELD_THRESHOLD) s.add('dir:down');
  if (inp.steer < -HELD_THRESHOLD) s.add('dir:left');
  if (inp.steer > HELD_THRESHOLD) s.add('dir:right');
  for (const d of navRecent) s.add(`dir:${d}`);
  return s;
}

export class AnswerArming {
  private mustRelease = new Set<ArmKey>();

  /** New break / new question: everything currently down must be released first. */
  snapshot(held: ReadonlySet<ArmKey>): void {
    this.mustRelease = new Set(held);
  }

  /** Call every frame with what is down now; released inputs become armed. */
  update(held: ReadonlySet<ArmKey>): void {
    for (const k of this.mustRelease) if (!held.has(k)) this.mustRelease.delete(k);
  }

  isArmed(key: ArmKey): boolean {
    return !this.mustRelease.has(key);
  }

  /** A direction answer fires once, then needs a release before it can fire again (no nav auto-repeat). */
  consume(key: ArmKey): void {
    this.mustRelease.add(key);
  }
}

/**
 * D-pad / stick up-down only show up as nav edges that auto-repeat (first repeat after a long delay, then
 * fast). A direction counts as held until its expected next repeat is overdue.
 */
export class NavHoldTracker {
  private until: Record<AnswerDir, number> = { up: -Infinity, left: -Infinity, right: -Infinity, down: -Infinity };

  constructor(private firstSec: number, private repeatSec: number) {}

  /** Record a nav edge; returns true if it looks like an auto-repeat of an already-held direction. */
  note(dir: AnswerDir | null, now: number): boolean {
    if (!dir) return false;
    const repeating = now <= this.until[dir];
    this.until[dir] = now + (repeating ? this.repeatSec : this.firstSec);
    return repeating;
  }

  recent(now: number): AnswerDir[] {
    return (Object.keys(this.until) as AnswerDir[]).filter((d) => now <= this.until[d]);
  }
}
