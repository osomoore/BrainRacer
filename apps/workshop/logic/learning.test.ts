import { describe, expect, it } from 'vitest';
import { WS_RULES } from '../config';
import { WORKSHOP_IDS, type Challenge, type Model, type PlayerSave, type RunResult } from '../core/types';
import { engine } from './index';
import { failedRequirementIds, isLearningChallenge, mergeLearning, recordLearningTry, validLearningEntry } from './learning';
import { challengeKey, generateChallenge } from './generator';
import { MAX_PROFILE_DATA_BYTES } from '../../../shared/sync/protocol';
import { readRevision, type ProfileRecord } from '../../../shared/sync/record';

function result(card: Challenge, failed: string[] = [], endStage = card.stages.length - 1): RunResult {
  return { passed: !failed.length, cleverWin: false, endStage, stages: [],
    requirements: card.stages.flatMap((stage, index) => stage.requirements.map(req => ({
      id: req.id, passed: !failed.includes(req.id), route: failed.includes(req.id) ? null : 'check', reached: index <= endStage,
    }))),
  };
}

function player(): PlayerSave {
  return { ...engine.newPlayerSave('hard'), workshops: {
    race: engine.progressOf(engine.newPlayerSave('hard'), 'race'),
    dino: engine.progressOf(engine.newPlayerSave('hard'), 'dino'),
  } };
}

function testCard(room: NonNullable<PlayerSave['workshops']['race']>): Challenge {
  return Object.values(room.challenges).find(isLearningChallenge)!;
}

describe('Workshop learning record', () => {
  it('tracks this build’s tries, hint exposure, win time, and the tested model across reload', () => {
    const save = player();
    const room = save.workshops.race!;
    const card = testCard(room);
    const req = card.stages[0].requirements[0].id;
    room.fails[card.id] = 12;
    const tested = { ...room.model };
    const first = recordLearningTry(save, card, result(card, [req]), tested, 10, false);
    expect(first.workshops.race!.learning?.[card.id]).toMatchObject({ tries: 1, firstTryAt: 10, hintShown: false });
    expect(save.workshops.race!.learning).toBeUndefined();
    const second = recordLearningTry(first, card, result(card, [req]), tested, 20, true);
    const won = recordLearningTry(second, card, result(card), tested, 30, false);
    tested.paint = 'paint.changed';
    const loaded = engine.normalizeSave(JSON.parse(JSON.stringify(won)))!;
    const { learning, recentTries } = loaded.workshops.race!;
    expect(learning![card.id]).toMatchObject({ tries: 3, firstTryAt: 10, wonAt: 30, hintShown: true });
    expect(learning![card.id].failedChecks.map(failedRequirementIds)).toEqual([[req], [req], []]);
    expect(recentTries).toMatchObject([
      { at: 10, pass: false, challengeId: card.id, build: room.model },
      { at: 20, pass: false, challengeId: card.id, build: room.model },
      { at: 30, pass: true, challengeId: card.id, failedChecks: '', build: room.model },
    ]);
    expect(recordLearningTry(won, card, result(card), tested, 40, true)).toBe(won);
  });

  it('records optional active time, accepts old/new entries, and merges defined times by maximum', () => {
    const save = player();
    const room = save.workshops.race!;
    const card = testCard(room);
    const tested = { ...room.model };
    const legacy = recordLearningTry(save, card, result(card, [card.stages[0].requirements[0].id]), tested, 10, false);
    expect(legacy.workshops.race!.learning![card.id].activeMs).toBeUndefined();
    const timedOnce = recordLearningTry(legacy, card, result(card, [card.stages[0].requirements[0].id]), tested, 20, false, 1250);
    const timed = recordLearningTry(timedOnce, card, result(card), tested, 30, false, 50);
    expect(timed.workshops.race!.learning![card.id].activeMs).toBe(1300);
    expect(recordLearningTry(timed, card, result(card), tested, 40, false, 50)).toBe(timed);
    const learning = timed.workshops.race!.learning![card.id];
    expect(validLearningEntry({ ...learning, activeMs: undefined })).toBe(true);
    expect(validLearningEntry({ ...learning, activeMs: 0 })).toBe(true);
    const older = { ...room, learning: { [card.id]: { ...learning, activeMs: 900 } } };
    const newer = { ...room, learning: { [card.id]: { ...learning, activeMs: 300 } } };
    expect(mergeLearning(older, newer, new Map()).learning![card.id].activeMs).toBe(900);
    expect(mergeLearning({ ...room, learning: { [card.id]: { ...learning, activeMs: undefined } } },
      { ...room, learning: { [card.id]: { ...learning, activeMs: 0 } } }, new Map()).learning![card.id].activeMs).toBe(0);
    expect(recordLearningTry(legacy, card, result(card), tested, 20, false, Number.NaN)
      .workshops.race!.learning![card.id].activeMs).toBeUndefined();
    const localLoaded = engine.normalizeSave(JSON.parse(JSON.stringify(timed)))!;
    expect(localLoaded.workshops.race!.learning![card.id].activeMs).toBe(1300);
    const revision: ProfileRecord = { schema: 1, profile: { id: 'p-learning-time', name: 'June', createdAt: 30 }, updatedAt: 30,
      racer: { jbq: {} }, workshop: timed };
    const remoteLoaded = readRevision({ id: revision.profile.id, rev: 1, updatedAt: 30, data: revision });
    expect(remoteLoaded && !remoteLoaded.value.deleted && remoteLoaded.value.data.workshop?.workshops.race?.learning?.[card.id].activeMs)
      .toBe(1300);
    const legacyRevision = { ...revision, workshop: legacy };
    const legacyLoaded = readRevision({ id: revision.profile.id, rev: 2, updatedAt: 30, data: legacyRevision });
    expect(legacyLoaded && !legacyLoaded.value.deleted && legacyLoaded.value.data.workshop?.workshops.race?.learning?.[card.id].activeMs)
      .toBeUndefined();
  });

  it('skips practice and admin cards and omits requirements in unreached stages', () => {
    const save = player();
    const race = save.workshops.race!;
    const original = testCard(race);
    const template = original.stages[0].requirements[0];
    const first = { ...original.stages[0], requirements: [template] };
    const later = { ...first, requirements: [{ ...template, id: 'later' }] };
    const card = { ...original, stages: [first, later] };
    const failed = result(card, [template.id, 'later'], 0);
    const live = recordLearningTry(save, card, failed, race.model, 1, false);
    expect(failedRequirementIds(live.workshops.race!.recentTries![0].failedChecks)).toEqual([template.id]);
    expect(recordLearningTry(save, { ...card, source: 'admin' }, failed, race.model, 1, false)).toBe(save);
    expect(recordLearningTry(save, { ...card, stages: [{ ...first, scenario: 'practice' }] }, failed, race.model, 1, false)).toBe(save);
  });

  it('keeps a legacy win and wallet when optional learning data is unreadable', () => {
    const save = player();
    const room = save.workshops.race!;
    const card = testCard(room);
    room.completed[card.id] = { build: room.model, wonAt: 20, payout: 1 };
    const loaded = engine.normalizeSave({ ...save, workshops: { ...save.workshops, race: {
      ...room, learning: { [card.id]: { tries: 'unreadable' } }, recentTries: [null],
    } } })!;
    expect(loaded.workshops.race!.completed[card.id]).toEqual(room.completed[card.id]);
    expect(loaded.workshops.race!.wallet).toBe(room.wallet);
    expect(loaded.workshops.race!.learning?.[card.id]).toBeUndefined();
    expect(loaded.workshops.race!.recentTries).toEqual([]);
  });

  it('caps the combined recent list and keeps permanent detail through eviction and a redeal', () => {
    let save = player();
    for (let at = 1; at <= WS_RULES.recentTriesPerPlayer + 10; at++) {
      const room = save.workshops[at % 2 ? 'race' : 'dino']!;
      const card = testCard(room);
      save = recordLearningTry(save, card, result(card, [card.stages[0].requirements[0].id]), room.model, at, false);
    }
    const recent = Object.values(save.workshops).flatMap(room => room.recentTries!).map(attempt => attempt.at).sort((a, b) => a - b);
    expect(recent).toHaveLength(WS_RULES.recentTriesPerPlayer);
    expect(recent[0]).toBe(11);
    const race = save.workshops.race!;
    const id = testCard(race).id;
    const loaded = engine.normalizeSave({ ...save, reading: 'easy' })!;
    expect(loaded.workshops.race!.learning?.[id]).toMatchObject({ tries: 155, firstTryAt: 1 });
    expect(loaded.workshops.race!.learning?.[id].failedChecks).toHaveLength(155);
  });

  it('fits a heavy family snapshot with 300 full 10-part builds and 48 solved cards', () => {
    let save = player();
    let at = 1_790_000_000_000;
    for (const shop of WORKSHOP_IDS) {
      const cat = engine.catalog(shop);
      const room = save.workshops[shop]!;
      const build: Model = Object.fromEntries(cat.aspects.map(aspect => [aspect.id,
        cat.variants.filter(part => part.aspect === aspect.id).reduce((a, b) => a.id.length >= b.id.length ? a : b).id]));
      room.bought = cat.variants.map(part => part.id);
      const usedKeys = new Set(Object.values(room.challenges).map(challengeKey));
      for (let i = 1; i <= 24; i++) {
        const card = generateChallenge(cat, `${shop}-g${i}`, 'generated', i * 87691, {
          tier: Math.min(i, WS_RULES.maxTier), avail: new Set(room.bought), current: room.model, lastWin: null,
          minChanged: 0, newest: null, usedKeys, avoidScenarios: new Set(), attempts: 80, strictCurrent: false,
        })!.challenge;
        usedKeys.add(challengeKey(card));
        const progress = save.workshops[shop]!;
        progress.challenges[card.id] = card;
        const failed = result(card, card.stages[0].requirements.map(req => req.id), 0);
        for (let retry = 0; retry < 7; retry++) save = recordLearningTry(save, card, failed, build, at++, retry > 0);
        save.workshops[shop]!.completed[card.id] = { build, wonAt: at, payout: card.stages.length };
        save = recordLearningTry(save, card, result(card), build, at++, false);
      }
    }
    const data: ProfileRecord = { schema: 1, profile: { id: 'p-heavy', name: 'June', createdAt: at }, updatedAt: at,
      racer: { jbq: Object.fromEntries(Array.from({ length: 600 }, (_, i) => [i + 1, 99])) }, workshop: save };
    expect(Object.values(save.workshops).flatMap(room => room.recentTries!)).toHaveLength(300);
    expect(readRevision({ id: data.profile.id, rev: 1, updatedAt: at, data })).toBeDefined();
    expect(new TextEncoder().encode(JSON.stringify(data)).length).toBeLessThan(MAX_PROFILE_DATA_BYTES - 32 * 1024);
  });
});
