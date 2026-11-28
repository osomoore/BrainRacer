/** Phaser-free card state machine for the Lab yes/no card and the pause card (tested in cards.test.ts). */

export const PAUSE_OPTIONS = ['resume', 'home', 'quests', 'buddy', 'exit'] as const;
export type PauseOption = typeof PAUSE_OPTIONS[number];

export type CardState = { kind: 'closed' } | { kind: 'lab' } | { kind: 'pause'; sel: number } | { kind: 'quests'; sel: number } | { kind: 'buddy'; sel: number };

export type CardEvent =
  | { type: 'press'; button: 'a' | 'b' | 'y' | 'menu' }
  /** Stick moved up (-1) or down (+1) past the threshold (edge). */
  | { type: 'nav'; dir: -1 | 1 }
  | { type: 'tap'; target: 'yes' | 'no' | 'back' | PauseOption };

/** What the module must do after the step. */
export type CardAction = 'lab' | 'home' | 'exit' | 'resume' | 'cancel' | null;

export const CLOSED: CardState = { kind: 'closed' };

function choosePause(option: PauseOption, sel: number): { state: CardState; action: CardAction } {
  if (option === 'quests') return { state: { kind: 'quests', sel }, action: null };
  if (option === 'buddy') return { state: { kind: 'buddy', sel }, action: null };
  return { state: CLOSED, action: option };
}

export function stepCard(state: CardState, ev: CardEvent): { state: CardState; action: CardAction } {
  const stay = { state, action: null as CardAction };
  switch (state.kind) {
    case 'closed':
      if (ev.type !== 'press') return stay;
      if (ev.button === 'y') return { state: { kind: 'lab' }, action: null };
      if (ev.button === 'menu') return { state: { kind: 'pause', sel: 0 }, action: null };
      return stay;
    case 'lab':
      if (ev.type === 'press') {
        if (ev.button === 'a') return { state: CLOSED, action: 'lab' };
        if (ev.button === 'b' || ev.button === 'y' || ev.button === 'menu') return { state: CLOSED, action: 'cancel' };
      } else if (ev.type === 'tap') {
        if (ev.target === 'yes') return { state: CLOSED, action: 'lab' };
        if (ev.target === 'no') return { state: CLOSED, action: 'cancel' };
      }
      return stay;
    case 'pause': {
      if (ev.type === 'nav') {
        const sel = Math.min(PAUSE_OPTIONS.length - 1, Math.max(0, state.sel + ev.dir));
        return { state: { kind: 'pause', sel }, action: null };
      }
      if (ev.type === 'press') {
        if (ev.button === 'a') return choosePause(PAUSE_OPTIONS[state.sel], state.sel);
        if (ev.button === 'b' || ev.button === 'menu') return { state: CLOSED, action: 'resume' };
      } else if (ev.type === 'tap' && ev.target !== 'yes' && ev.target !== 'no' && ev.target !== 'back') {
        return choosePause(ev.target, PAUSE_OPTIONS.indexOf(ev.target));
      }
      return stay;
    }
    case 'quests':
    case 'buddy':
      if ((ev.type === 'press' && (ev.button === 'a' || ev.button === 'b' || ev.button === 'menu'))
        || (ev.type === 'tap' && ev.target === 'back')) return { state: { kind: 'pause', sel: state.sel }, action: null };
      return stay;
  }
}

/** Edge detector for stick navigation: fires once when |v| passes `hi`, re-arms when it falls below `lo`. */
export class StickNav {
  private armed = true;
  step(v: number, hi: number, lo: number): -1 | 0 | 1 {
    if (Math.abs(v) < lo) { this.armed = true; return 0; }
    if (this.armed && Math.abs(v) >= hi) { this.armed = false; return v < 0 ? -1 : 1; }
    return 0;
  }
}
