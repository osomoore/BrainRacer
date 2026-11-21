import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLECTIBLES, UNLOCK_GUIDE_IDS, WORLD_REWARDS, worldRewards } from '../config/collectibles';
import { RACE_MAPS } from './progression';
import {
  awardRacers, loadAllProgress, migrateLegacy, planAwards, racerLoadouts, rewardPool, setRacerOverride, teamMaps, teamNextMap,
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

  it('copies legacy shared unlocks to Abe and Gideon; Helen starts fresh', () => {
    store.set('brainracer.unlocks.v1', JSON.stringify(['taxi', 'comet']));
    store.set('brainracer.content.v1', JSON.stringify({ worlds: ['industrial'], overrides: { farm: true } }));
    const all = loadAllProgress();
    expect(all.abe).toEqual({ worlds: ['industrial'], items: ['taxi', 'bombBuddy'], overrides: { farm: true } });
    expect(all.gideon).toEqual(all.abe);
    expect(all.helen).toEqual(fresh());
    expect(migrateLegacy(undefined, undefined).abe).toEqual(fresh());
    expect(JSON.parse(store.get('brainracer.racers.v1')!).abe.items).toEqual(['taxi', 'bombBuddy']);
  });

  it('Helen playing alone does not unlock anything for Abe or Gideon', () => {
    const [r] = awardRacers('city', 3, ['helen'], false, new Rng(1));
    expect(r.world).toBe('industrial');
    expect(worldRewards('city')).toContain(r.reward);
    const all = loadAllProgress();
    expect(all.helen.worlds).toEqual(['industrial']);
    expect(all.abe).toEqual(fresh());
    expect(all.gideon).toEqual(fresh());
  });

  it('needs three goals and gives nothing in admin mode', () => {
    expect(awardRacers('city', 2, ['abe'], false, new Rng(1))).toEqual([{ racer: 'abe' }]);
    expect(awardRacers('city', 3, ['abe'], true, new Rng(1))).toEqual([{ racer: 'abe' }]);
  });

  it('gives two racers different items when possible', () => {
    for (let seed = 0; seed < 30; seed++) {
      const { rewards } = planAwards('harbor', 3, [{ racer: 'abe', progress: fresh() }, { racer: 'gideon', progress: fresh() }], false, new Rng(seed));
      expect(rewards[0].reward).not.toBe(rewards[1].reward);
    }
  });

  it('gives the one remaining item to the racer who needs it and something else to the other', () => {
    const cars = WORLD_REWARDS.harbor.cars;
    const abe: RacerProgress = { ...fresh(), items: [...cars, 'rocket'] };          // only the Fairy left
    const gideon: RacerProgress = { ...fresh(), items: ['rocket'] };              // everything left
    for (let seed = 0; seed < 20; seed++) {
      const { rewards } = planAwards('harbor', 3, [{ racer: 'abe', progress: abe }, { racer: 'gideon', progress: gideon }], false, new Rng(seed));
      expect(rewards[0].reward).toBe('fairy');
      expect(rewards[1].reward).not.toBe('fairy');
    }
  });

  it('gives the same item only when it is the last one for both', () => {
    const cars = WORLD_REWARDS.harbor.cars;
    const p: RacerProgress = { ...fresh(), items: [...cars, 'rocket'] };
    const { rewards } = planAwards('harbor', 3, [{ racer: 'abe', progress: p }, { racer: 'gideon', progress: p }], false, new Rng(3));
    expect(rewards.map(r => r.reward)).toEqual(['fairy', 'fairy']);
  });

  it('stops giving items once a world is complete, and keeps unlocking worlds', () => {
    const p: RacerProgress = { ...fresh(), items: worldRewards('city') };
    const { rewards } = planAwards('city', 3, [{ racer: 'abe', progress: p }], false, new Rng(1));
    expect(rewards[0]).toEqual({ racer: 'abe', world: 'industrial' });
  });

  it('collects every item of a world by replaying it, with the buddy after at most two cars in a row', () => {
    for (let i = 0; i < 10; i++) awardRacers('farm', 3, ['gideon'], false, new Rng(i));
    const items = loadAllProgress().gideon.items;
    expect([...items].sort()).toEqual([...worldRewards('farm')].sort());
    expect(items.indexOf('bumblebee')).toBeLessThan(3);
  });

  it('respects admin overrides per racer', () => {
    setRacerOverride('abe', 'taxi', false);
    setRacerOverride('abe', 'sky', true);
    const abe = loadAllProgress().abe;
    expect(rewardPool(abe, 'city')).not.toContain('taxi');
    expect(racerLoadouts(abe, false).cars).not.toContain('taxi');
    expect(teamMaps([abe], false)).toEqual(['city', 'sky']);
    expect(teamMaps([loadAllProgress().helen], false)).toEqual(['city']);
    setRacerOverride('abe', 'taxi', true);
    expect(racerLoadouts(loadAllProgress().abe, false).cars).toContain('taxi');
  });

  it('lets a team pick any world either racer has, and the newcomer earns it on completion', () => {
    const gideon: RacerProgress = { ...fresh(), worlds: ['industrial', 'harbor', 'underground', 'farm'] };
    const helen = fresh();
    expect(teamMaps([gideon, helen], false)).toContain('farm');
    expect(teamNextMap('farm', [gideon, helen], false)).toBe('farm');
    const { progress, rewards } = planAwards('farm', 3, [{ racer: 'gideon', progress: gideon }, { racer: 'helen', progress: helen }], false, new Rng(2));
    expect(progress.helen!.worlds).toEqual(['farm', 'sky']);
    expect(progress.gideon!.worlds).toContain('sky');
    expect(rewards.map(r => r.world)).toEqual(['sky', 'sky']);
  });
});
