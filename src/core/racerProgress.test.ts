import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLECTIBLES, UNLOCK_GUIDE_IDS, WORLD_REWARDS, worldRewards } from '../config/collectibles';
import { RACE_MAPS } from './progression';
import {
  awardRacers, deleteRacerProgress, loadAllProgress, loadRacerProgress, racerProgressOf, updateRacerProgress, planAwards, racerLoadouts, rewardPool, STARTER_CARS, STARTER_GUIDES, setRacerOverride, teamMaps, teamNextMap,
  type RacerProgress,
} from './racerProgress';
import { Rng } from './rng';

const fresh = (): RacerProgress => ({ worlds: [], items: [], overrides: {} });

describe('world rewards table', () => {
  it('gives every world cars and a buddy, and every collectible exactly one world', () => {
    for (const map of RACE_MAPS) {
      expect(WORLD_REWARDS[map].cars.length, map).toBeGreaterThan(0);
      expect(UNLOCK_GUIDE_IDS, map).toContain(WORLD_REWARDS[map].buddy);
    }
    const all = RACE_MAPS.flatMap(worldRewards);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...COLLECTIBLES].sort());
  });
});

describe('per-racer progress', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('a brand-new profile has only City and the starter cars and buddies', () => {
    // Other profiles have progress and admin overrides; none of it reaches a new profile.
    updateRacerProgress('robin', p => ({ ...p, worlds: ['industrial'], items: ['taxi', 'owl'] }));
    setRacerOverride('robin', 'farm', true);
    const fresh1 = racerProgressOf(loadAllProgress(), 'brand-new');
    expect(fresh1).toEqual(fresh());
    expect(racerLoadouts(fresh1, false)).toEqual({ cars: [...STARTER_CARS], guides: [...STARTER_GUIDES] });
    expect(STARTER_CARS).toEqual(['dino', 'kart']);
    expect(teamMaps([fresh1], false)).toEqual(['city']);
    expect(racerProgressOf({}, undefined)).toEqual(fresh());
  });

  it('Kim playing alone does not unlock anything for Robin or Sam', () => {
    const [r] = awardRacers('city', 3, ['kim'], false, new Rng(1));
    expect(r.world).toBe('industrial');
    expect(worldRewards('city')).toContain(r.reward);
    const all = loadAllProgress();
    expect(all.kim!.worlds).toEqual(['industrial']);
    expect('robin' in all).toBe(false);
    expect('sam' in all).toBe(false);
  });

  it('gives nothing to a player without a profile (quick race) and saves nothing for them', () => {
    expect(awardRacers('city', 3, [undefined], false, new Rng(1))).toEqual([{}]);
    expect(loadAllProgress()).toEqual({});
  });

  it('needs three goals and gives nothing in admin mode', () => {
    expect(awardRacers('city', 2, ['robin'], false, new Rng(1))).toEqual([{ racer: 'robin' }]);
    expect(awardRacers('city', 3, ['robin'], true, new Rng(1))).toEqual([{ racer: 'robin' }]);
  });

  it('gives two racers different items when possible', () => {
    for (let seed = 0; seed < 30; seed++) {
      const { rewards } = planAwards('harbor', 3, [{ racer: 'robin', progress: fresh() }, { racer: 'sam', progress: fresh() }], false, new Rng(seed));
      expect(rewards[0].reward).not.toBe(rewards[1].reward);
    }
  });

  it('gives the one remaining item to the racer who needs it and something else to the other', () => {
    const cars = WORLD_REWARDS.harbor.cars;
    const robin: RacerProgress = { ...fresh(), items: [...cars, 'rocket'] };          // only the Fairy left
    const sam: RacerProgress = { ...fresh(), items: ['rocket'] };              // everything left
    for (let seed = 0; seed < 20; seed++) {
      const { rewards } = planAwards('harbor', 3, [{ racer: 'robin', progress: robin }, { racer: 'sam', progress: sam }], false, new Rng(seed));
      expect(rewards[0].reward).toBe('fairy');
      expect(rewards[1].reward).not.toBe('fairy');
    }
  });

  it('gives the same item only when it is the last one for both', () => {
    const cars = WORLD_REWARDS.harbor.cars;
    const p: RacerProgress = { ...fresh(), items: [...cars, 'rocket'] };
    const { rewards } = planAwards('harbor', 3, [{ racer: 'robin', progress: p }, { racer: 'sam', progress: p }], false, new Rng(3));
    expect(rewards.map(r => r.reward)).toEqual(['fairy', 'fairy']);
  });

  it('defers the guaranteed buddy for one racer when both hit it at once, then gives it next race', () => {
    const cars = WORLD_REWARDS.harbor.cars;
    const atThreshold = (): RacerProgress => ({ ...fresh(), items: [cars[0], cars[1]] });
    for (let seed = 0; seed < 20; seed++) {
      const team = [{ racer: 'robin' as const, progress: atThreshold() }, { racer: 'sam' as const, progress: atThreshold() }];
      const { rewards, progress } = planAwards('harbor', 3, team, false, new Rng(seed));
      const got = rewards.map(r => r.reward);
      expect(got.filter(r => r === 'fairy').length).toBe(1);
      const di = got.indexOf('fairy') === 0 ? 1 : 0;
      expect(cars.slice(2)).toContain(got[di]);
      expect(rewards[di].rewardPool).not.toContain('fairy');
      const deferred = team[di].racer;
      const again = planAwards('harbor', 3, [{ racer: deferred, progress: progress[deferred]! }], false, new Rng(seed + 100));
      expect(again.rewards[0].reward).toBe('fairy');
    }
  });

  it('gives both the buddy at threshold when it is the only item left for both', () => {
    const cars = WORLD_REWARDS.harbor.cars;
    const p: RacerProgress = { ...fresh(), items: [...cars] };
    for (let seed = 0; seed < 10; seed++) {
      const { rewards } = planAwards('harbor', 3, [{ racer: 'robin', progress: p }, { racer: 'sam', progress: p }], false, new Rng(seed));
      expect(rewards.map(r => r.reward)).toEqual(['fairy', 'fairy']);
    }
  });

  it('stops giving items once a world is complete, and keeps unlocking worlds', () => {
    const p: RacerProgress = { ...fresh(), items: worldRewards('city') };
    const { rewards } = planAwards('city', 3, [{ racer: 'robin', progress: p }], false, new Rng(1));
    expect(rewards[0]).toEqual({ racer: 'robin', world: 'industrial' });
  });

  it('collects every item of a world by replaying it, with the buddy after at most two cars in a row', () => {
    for (let i = 0; i < 10; i++) awardRacers('farm', 3, ['sam'], false, new Rng(i));
    const items = loadAllProgress().sam!.items;
    expect([...items].sort()).toEqual([...worldRewards('farm')].sort());
    expect(items.indexOf('bumblebee')).toBeLessThan(3);
  });

  it('respects admin overrides per racer', () => {
    setRacerOverride('robin', 'taxi', false);
    setRacerOverride('robin', 'sky', true);
    const robin = loadAllProgress().robin!;
    expect(rewardPool(robin, 'city')).not.toContain('taxi');
    expect(racerLoadouts(robin, false).cars).not.toContain('taxi');
    expect(teamMaps([robin], false)).toEqual(['city', 'sky']);
    expect(teamMaps([racerProgressOf(loadAllProgress(), 'kim')], false)).toEqual(['city']);
    setRacerOverride('robin', 'taxi', true);
    expect(racerLoadouts(loadAllProgress().robin!, false).cars).toContain('taxi');
  });

  it('lets a team pick any world either racer has, and the newcomer earns it on completion', () => {
    const sam: RacerProgress = { ...fresh(), worlds: ['industrial', 'harbor', 'underground', 'farm'] };
    const kim = fresh();
    expect(teamMaps([sam, kim], false)).toContain('farm');
    expect(teamNextMap('farm', [sam, kim], false)).toBe('farm');
    const { progress, rewards } = planAwards('farm', 3, [{ racer: 'sam', progress: sam }, { racer: 'kim', progress: kim }], false, new Rng(2));
    expect(progress.kim!.worlds).toEqual(['farm', 'sky']);
    expect(progress.sam!.worlds).toContain('sky');
    expect(rewards.map(r => r.world)).toEqual(['sky', 'sky']);
  });

  it('keeps custom racer progress, empty for unknown ids, and deletes it', () => {
    expect(loadRacerProgress('u1')).toEqual(fresh());
    expect(racerProgressOf({}, 'u7')).toEqual(fresh());
    updateRacerProgress('u1', p => ({ ...p, worlds: ['industrial'], items: ['taxi'] }));
    setRacerOverride('u1', 'farm', true);
    expect(loadRacerProgress('u1')).toEqual({ worlds: ['industrial'], items: ['taxi'], overrides: { farm: true } });
    expect(JSON.parse(store.get('brainracer.racers.v1')!).u1.worlds).toEqual(['industrial']);
    awardRacers('industrial', 3, ['u1', 'u2'], false, new Rng(1));
    expect(loadRacerProgress('u2').worlds.length).toBeGreaterThan(0);
    deleteRacerProgress('u1');
    expect('u1' in loadAllProgress()).toBe(false);
    deleteRacerProgress('robin');
    expect('robin' in loadAllProgress()).toBe(false);
  });
});
