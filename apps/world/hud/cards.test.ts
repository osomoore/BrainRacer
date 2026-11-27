import { describe, expect, it } from 'vitest';
import { CLOSED, StickNav, stepCard, type CardEvent, type CardState } from './cards';

const run = (s: CardState, ...evs: CardEvent[]) => {
  let state = s, action: ReturnType<typeof stepCard>['action'] = null;
  for (const e of evs) ({ state, action } = stepCard(state, e));
  return { state, action };
};
const press = (button: 'a' | 'b' | 'y' | 'menu'): CardEvent => ({ type: 'press', button });

describe('lab card', () => {
  it('Y opens, A confirms', () => {
    expect(run(CLOSED, press('y')).state).toEqual({ kind: 'lab' });
    expect(run(CLOSED, press('y'), press('a'))).toEqual({ state: CLOSED, action: 'lab' });
  });
  it('B, Y, menu and tap no cancel', () => {
    for (const e of [press('b'), press('y'), press('menu'), { type: 'tap', target: 'no' } as CardEvent]) {
      expect(run(CLOSED, press('y'), e)).toEqual({ state: CLOSED, action: 'cancel' });
    }
  });
  it('tap yes confirms; stray events keep it open', () => {
    expect(run(CLOSED, press('y'), { type: 'tap', target: 'yes' }).action).toBe('lab');
    expect(run(CLOSED, press('y'), { type: 'nav', dir: 1 }).state).toEqual({ kind: 'lab' });
    expect(run(CLOSED, press('y'), { type: 'tap', target: 'home' }).state).toEqual({ kind: 'lab' });
  });
});

describe('pause card', () => {
  it('menu opens on Resume; A resumes', () => {
    expect(run(CLOSED, press('menu')).state).toEqual({ kind: 'pause', sel: 0 });
    expect(run(CLOSED, press('menu'), press('a')).action).toBe('resume');
  });
  it('nav picks home / exit and clamps', () => {
    expect(run(CLOSED, press('menu'), { type: 'nav', dir: 1 }, press('a')).action).toBe('home');
    expect(run(CLOSED, press('menu'), { type: 'nav', dir: 1 }, { type: 'nav', dir: 1 }, { type: 'nav', dir: 1 }, press('a')).action).toBe('exit');
    expect(run(CLOSED, press('menu'), { type: 'nav', dir: -1 }).state).toEqual({ kind: 'pause', sel: 0 });
  });
  it('B and menu resume, taps act directly', () => {
    expect(run(CLOSED, press('menu'), press('b')).action).toBe('resume');
    expect(run(CLOSED, press('menu'), press('menu')).action).toBe('resume');
    expect(run(CLOSED, press('menu'), { type: 'tap', target: 'exit' })).toEqual({ state: CLOSED, action: 'exit' });
  });
  it('opens Quests by navigation or tap and returns to the same pause row', () => {
    const down = { type: 'nav', dir: 1 } as const;
    const quests = { kind: 'quests', sel: 2 };
    expect(run(CLOSED, press('menu'), down, down, press('a')).state).toEqual(quests);
    const paused = { kind: 'pause', sel: 0 } as const;
    const open = stepCard(paused, { type: 'tap', target: 'quests' });
    expect(open).toEqual({ state: quests, action: null });
    const selected = { state: { kind: 'pause', sel: 2 }, action: null };
    expect(stepCard(open.state, { type: 'tap', target: 'back' })).toEqual(selected);
    expect(stepCard(open.state, press('b'))).toEqual(selected);
  });
});

describe('closed', () => {
  it('ignores A, B, X-like noise', () => {
    expect(run(CLOSED, press('a'), press('b'))).toEqual({ state: CLOSED, action: null });
  });
});

describe('StickNav', () => {
  it('fires once per push and re-arms near center', () => {
    const n = new StickNav();
    expect([n.step(0.2, 0.6, 0.3), n.step(-0.9, 0.6, 0.3), n.step(-1, 0.6, 0.3), n.step(-0.4, 0.6, 0.3)]).toEqual([0, -1, 0, 0]);
    expect([n.step(0, 0.6, 0.3), n.step(0.8, 0.6, 0.3)]).toEqual([0, 1]);
  });
});
