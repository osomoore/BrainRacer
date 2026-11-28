import { describe, expect, it, vi } from 'vitest';
import { wordCount } from '../../workshop/logic/wording';
import { QUESTS } from '../config';
import type { WorldContext, WorldPlayer } from '../core/runtime';
import type { ReadingLevel, Traits } from '../core/types';
import { driveMovement } from '../host/drive';
import { questStarterWordProblems } from '../quests/words';
import PlayModule from './PlayModule';

vi.mock('../host/drive', () => ({ driveMovement: vi.fn(), quickSwap: vi.fn() }));
vi.mock('./homePad', () => ({ HomePadUI: class { init() {} updatePlayer() {} } }));
vi.mock('./playEffects', () => ({ PlayEffects: class { update() {} } }));

function player(kind: Traits['kind'], reading: ReadingLevel): WorldPlayer {
  return { traits: { kind }, reading, controls: { pressed: {} } } as WorldPlayer;
}

function setup(players: WorldPlayer[]) {
  const emit = vi.fn();
  const ctx = { players, time: 0, bus: { emit } } as unknown as WorldContext;
  const play = new PlayModule();
  play.init(ctx);
  return { emit, ctx, play };
}

describe('World wall banners', () => {
  it.each([
    ['starter', 'car', 'dark', 'Too dark!'],
    ['easy', 'dino', 'heat', 'Too hot!'],
    ['medium', 'car', 'heat', 'Too Hot! Cool off with a Radiator.'],
    ['hard', 'car', 'dark', 'Too Dark! Get Rally Lights.'],
    ['medium', 'dino', 'heat', 'Too Hot! Cool off with a Neck Frill.'],
    ['hard', 'dino', 'dark', 'Too Dark! Get Glow Spots.'],
  ] as const)('uses %s wording for a %s at a %s wall', (reading, kind, wall, text) => {
    const driver = player(kind, reading);
    const { emit, play } = setup([driver]);
    vi.mocked(driveMovement).mockReturnValue({ blockedWall: wall });
    play.update(1 / 60);
    expect(emit).toHaveBeenCalledExactlyOnceWith('ui:banner', { player: driver, text });
    expect(wordCount(text)).toBeLessThanOrEqual(QUESTS.wordLimit[reading]);
    if (reading === 'starter') expect(questStarterWordProblems(text)).toEqual([]);
  });

  it('shares the four-second limit across wall types independently for each player', () => {
    const first = player('car', 'starter');
    const second = player('dino', 'easy');
    const { emit, play, ctx } = setup([first, second]);
    vi.mocked(driveMovement).mockImplementation((_, driver) => {
      if (ctx.time === 0) return driver === first ? { blockedWall: 'dark' } : undefined;
      return { blockedWall: 'heat' };
    });
    play.update(1 / 60);
    ctx.time = 1;
    play.update(1 / 60);
    ctx.time = 4;
    play.update(1 / 60);
    expect(emit.mock.calls).toEqual([
      ['ui:banner', { player: first, text: 'Too dark!' }],
      ['ui:banner', { player: second, text: 'Too hot!' }],
      ['ui:banner', { player: first, text: 'Too hot!' }],
    ]);
  });
});
