import { describe, expect, it } from 'vitest';
import { BUDDY_KINDS } from '../../../shared/buddies/catalog';
import { Rng } from '../core/rng';
import type { Challenge, WorkshopCatalog, WorkshopId, WorkshopProgress } from '../core/types';
import { createEngine } from './index';
import { FIXTURE_CATALOG as C } from './testing/fixtureCatalog';
import { hashSeed } from './util';

const catalogs: Readonly<Record<WorkshopId, WorkshopCatalog>> = { race: C, dino: { ...C, id: 'dino' } };
const engine = createEngine(catalogs);
const fresh = (id: WorkshopId = 'race') => engine.refreshBoard(id, engine.newProgress(id));
const mudChallenge = fresh().challenges['st-mud'];

function winningProgress(p: WorkshopProgress, id: string): WorkshopProgress {
  const challenge: Challenge = { ...mudChallenge, id, seed: hashSeed(id) };
  const model = { ...p.model, wheels: 'wheels.mud' };
  const bought = p.bought.includes('wheels.mud') ? p : engine.purchase('race', p, 'wheels', 'wheels.mud').progress;
  return { ...bought, model, active: [id], challenges: { ...bought.challenges, [id]: challenge } };
}

describe('buddy save and progression', () => {
  it('starts with only dino owned and selects it', () => {
    const progress = fresh();
    expect(progress.buddies).toEqual({ unlocked: ['dino'], selected: 'dino', progress: 0 });
  });

  it('preserves version-2 saves and backfills buddy state', () => {
    const progress = fresh();
    const legacy = engine.newPlayerSave('medium');
    const withProgress = { ...legacy, workshops: { race: { ...progress, buddies: undefined, wallet: 27 } } };
    const restored = engine.normalizeSave(JSON.parse(JSON.stringify(withProgress)))!;
    expect(restored.version).toBe(2);
    expect(restored.reading).toBe('medium');
    expect(restored.workshops.race).toMatchObject({
      model: progress.model,
      active: progress.active,
      wallet: 27,
      buddies: { unlocked: ['dino'], selected: 'dino', progress: 0 },
    });
  });

  it('normalizes buddy ownership by validating and deduplicating, then selects an owned buddy', () => {
    const progress = fresh();
    const raw = {
      ...engine.newPlayerSave('easy'),
      workshops: { race: { ...progress, buddies: { unlocked: ['dino', 'dino', 'bogus'], selected: 'bogus', progress: 10 } } },
    };
    const normalized = engine.normalizeSave(raw)!;
    expect(normalized.workshops.race?.buddies).toEqual({ unlocked: ['dino'], selected: 'dino', progress: 9 });
  });

  it('increments accepted first wins, unlocks without duplicates, and fills the bar when complete', () => {
    let progress = fresh();
    let wins = 0;
    const unlocked = ['dino'];
    while (progress.buddies.unlocked.length < BUDDY_KINDS.length) {
      for (let i = 0; i < 10; i++) {
        const id = `buddy-win-${wins}`;
        const prepared = winningProgress(progress, id);
        const stillLocked = BUDDY_KINDS.filter((kind) => !prepared.buddies.unlocked.includes(kind));
        const expected = i === 9 ? new Rng(prepared.challenges[id].seed).pick(stillLocked) : undefined;
        const outcome = engine.recordWin('race', prepared, id, prepared.model, wins + 1);
        expect(outcome.firstWin).toBe(true);
        if (i < 9) {
          expect(outcome.progress.buddies.progress).toBe(i + 1);
          expect(outcome.unlockedBuddy).toBeUndefined();
        } else {
          expect(outcome.unlockedBuddy).toBe(expected);
          unlocked.push(expected!);
          expect(outcome.progress.buddies.unlocked).toEqual(unlocked);
          expect(outcome.progress.buddies.progress).toBe(unlocked.length === BUDDY_KINDS.length ? 10 : 0);
        }
        progress = outcome.progress;
        wins++;
        if (progress.buddies.unlocked.length === BUDDY_KINDS.length) break;
      }
    }
    expect(progress.buddies.progress).toBe(10);
    expect(progress.buddies.unlocked).toHaveLength(BUDDY_KINDS.length);
    expect(new Set(progress.buddies.unlocked).size).toBe(progress.buddies.unlocked.length);
    expect(progress.buddies.selected).toBe('dino');
    const prepared = winningProgress(progress, 'after-full');
    const outcome = engine.recordWin('race', prepared, 'after-full', prepared.model, wins + 1);
    expect(outcome.firstWin).toBe(true);
    expect(outcome.progress.buddies).toEqual(progress.buddies);
    expect(outcome.unlockedBuddy).toBeUndefined();
  });

  it('does not count failed, invalid, or duplicate wins', () => {
    const progress = fresh();
    const challenge = progress.challenges['st-mud'];
    const bad = engine.recordWin('race', progress, challenge.id, progress.model, 1);
    expect(bad.firstWin).toBe(false);
    expect(bad.progress.buddies.progress).toBe(0);
    expect(engine.recordFail('race', progress, challenge.id).buddies.progress).toBe(0);
    const prepared = winningProgress(progress, challenge.id);
    const won = engine.recordWin('race', prepared, challenge.id, prepared.model, 2);
    expect(won.firstWin).toBe(true);
    const duplicate = engine.recordWin('race', won.progress, challenge.id, prepared.model, 3);
    expect(duplicate.firstWin).toBe(false);
    expect(duplicate.progress.buddies.progress).toBe(won.progress.buddies.progress);
  });

  it('lets a player select only an owned buddy and keeps separate workshop progress independent', () => {
    const race = fresh('race');
    const dino = fresh('dino');
    expect(engine.setBuddy(race, 'dino').buddies.selected).toBe('dino');
    const other = BUDDY_KINDS.find((kind) => kind !== 'dino')!;
    expect(engine.setBuddy(race, other).buddies.selected).toBe('dino');
    const raceWithOwnedBuddy: WorkshopProgress = { ...race, buddies: { unlocked: ['dino', other], selected: 'dino', progress: 3 } };
    const selectedRace = engine.setBuddy(raceWithOwnedBuddy, other);
    expect(selectedRace.buddies.selected).toBe(other);
    expect(dino.buddies).toEqual(race.buddies);
    const save = { ...engine.newPlayerSave('easy'), workshops: { race: selectedRace, dino } };
    const restored = engine.normalizeSave(JSON.parse(JSON.stringify(save)))!;
    expect(restored.workshops.race?.buddies.selected).toBe(other);
    expect(restored.workshops.dino?.buddies.selected).toBe('dino');
    expect(restored.workshops.race).not.toBe(restored.workshops.dino);
  });
});
