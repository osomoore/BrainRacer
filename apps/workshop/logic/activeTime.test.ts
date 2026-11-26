import { describe, expect, it } from 'vitest';
import { ActiveChallengeAttribution, createActiveTimeTracker, eligibleActiveChallenge } from './activeTime';
import { engine } from './index';

describe('active challenge time tracker', () => {
  it('keeps a challenge selected through a station visit, pauses in the picker, and resumes on return', () => {
    let time = 0;
    const tracker = createActiveTimeTracker(() => time);
    const selections = new Map<string, string>();
    const attribution = new ActiveChallengeAttribution(tracker, selections);
    const progress = engine.refreshBoard('race', engine.newProgress('race'));
    const selected = progress.active.find(id => eligibleActiveChallenge(progress, id));
    expect(eligibleActiveChallenge(progress, selected)).toBe(selected);
    attribution.select('profile', 'race', selected);
    const state = { profileId: 'profile', workshop: 'race', admin: false, visible: true, active: true, progress };
    attribution.sync({ ...state, screen: 'board' });
    time += 1200;
    attribution.sync({ ...state, screen: 'station' });
    time += 800;
    attribution.sync({ ...state, screen: 'board' });
    attribution.sync({ ...state, screen: 'run' });
    time += 5000;
    expect(tracker.flush(`profile|race|${selected}`)).toBe(2000);
    const returned = new ActiveChallengeAttribution(tracker, selections);
    returned.sync({ ...state, screen: 'room' });
    time += 300;
    returned.sync({ ...state, screen: 'pickWorkshop' });
    time += 5000;
    returned.sync({ ...state, screen: 'room' });
    time += 200;
    returned.sync({ ...state, screen: 'pickWorkshop' });
    expect(tracker.flush(`profile|race|${selected}`)).toBe(500);
  });

  it('attributes time to the newly selected challenge and rejects stale board selections', () => {
    let time = 0;
    const tracker = createActiveTimeTracker(() => time);
    const attribution = new ActiveChallengeAttribution(tracker);
    const progress = engine.refreshBoard('race', engine.newProgress('race'));
    const a = progress.active.find(id => eligibleActiveChallenge(progress, id));
    const b = progress.active.find(id => id !== a && eligibleActiveChallenge(progress, id));
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    if (!a || !b) throw new Error('fixture needs two eligible learning challenges');
    const state = { profileId: 'profile', workshop: 'race', admin: false, visible: true, active: true, screen: 'board', progress };
    attribution.select('profile', 'race', a);
    attribution.sync(state);
    time += 400;
    attribution.select('profile', 'race', b);
    attribution.sync(state);
    time += 900;
    tracker.pause();
    expect(tracker.flush(`profile|race|${a}`)).toBe(400);
    expect(tracker.flush(`profile|race|${b}`)).toBe(900);
    expect(eligibleActiveChallenge({ ...progress, active: [b] }, a)).toBeUndefined();
  });

  it('accumulates across pause and resume, keeping IDs separate', () => {
    let time = 0;
    const tracker = createActiveTimeTracker(() => time);
    tracker.resume('a');
    time += 1200;
    tracker.pause();
    time += 9000;
    tracker.resume('a');
    time += 800;
    tracker.pause();
    tracker.resume('b');
    time += 500;
    tracker.pause();
    expect(tracker.flush('a')).toBe(2000);
    expect(tracker.flush('b')).toBe(500);
  });

  it('flushes a running interval and continues without double counting', () => {
    let time = 0;
    const tracker = createActiveTimeTracker(() => time);
    tracker.resume('a');
    time = 400;
    expect(tracker.flush('a')).toBe(400);
    time = 700;
    expect(tracker.flush('a')).toBe(300);
    tracker.pause();
    expect(tracker.flush('a')).toBe(0);
  });

  it('tracks concurrent IDs independently', () => {
    let time = 0;
    const tracker = createActiveTimeTracker(() => time);
    tracker.resume('left');
    time += 100;
    tracker.resume('right');
    time += 350;
    tracker.pause('left');
    time += 50;
    expect(tracker.flush('left')).toBe(450);
    expect(tracker.flush('right')).toBe(400);
    tracker.pause();
    expect(tracker.flush('right')).toBe(0);
  });

  it('caps each returned flush at 60 minutes and discards excess', () => {
    let time = 0;
    const tracker = createActiveTimeTracker(() => time);
    tracker.resume('a');
    time = 4_000_000;
    expect(tracker.flush('a')).toBe(3_600_000);
    time += 100;
    tracker.pause();
    expect(tracker.flush('a')).toBe(100);
    tracker.resume('a');
    time += 300;
    tracker.pause();
    expect(tracker.flush('a')).toBe(300);
  });

  it('returns integer milliseconds from a fractional clock', () => {
    let time = 0.25;
    const tracker = createActiveTimeTracker(() => time);
    tracker.resume('a');
    time = 17.9;
    tracker.pause('a');
    expect(tracker.flush('a')).toBe(17);
    expect(Number.isSafeInteger(tracker.flush('a'))).toBe(true);
  });
});
