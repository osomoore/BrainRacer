import { describe, expect, it } from 'vitest';
import type { PlayerSettings } from '../core/types';
import { normalizeQuestionTypes, resolveChallengeMode as r, resolveRaceQuestions } from './questionsPolicy';

describe('resolveChallengeMode', () => {
  it('keeps the saved mode with no overrides', () => expect(r('math', null, undefined, false)).toBe('math'));
  it('ignores off (url, env, saved) when not allowed', () => {
    expect(r('words', 'off', undefined, false)).toBe('words');
    expect(r('words', null, 'off', false)).toBe('words');
    expect(r('off', null, undefined, false)).toBe('words');
  });
  it('allows off when enabled', () => expect(r('words', 'off', undefined, true)).toBe('off'));
  it('url beats env default beats saved', () => {
    expect(r('words', 'math', 'off', true)).toBe('math');
    expect(r('words', null, 'off', true)).toBe('off');
  });
  it('ignores garbage values', () => expect(r('mixed', 'banana', 'nope', true)).toBe('mixed'));
});

describe('per-player question settings', () => {
  const player: PlayerSettings = {
    device: { type: 'keyboard', layout: 'left' },
    difficulty: 'easy',
    car: 'dino',
  };
  const multiplication = { addition: false, multiplication: true, spelling: false };
  const spelling = { addition: false, multiplication: false, spelling: true };
  const addition = { addition: true, multiplication: false, spelling: false };

  it('migrates the old presets when player choices are missing or invalid', () => {
    expect(normalizeQuestionTypes(undefined, 'words')).toEqual(spelling);
    expect(normalizeQuestionTypes(undefined, 'math')).toEqual(addition);
    expect(normalizeQuestionTypes({ spelling: 'true' }, 'mixed')).toEqual({ ...addition, spelling: true });
    expect(normalizeQuestionTypes({ addition: false, multiplication: false, spelling: false })).toEqual(spelling);
  });

  it('keeps each player’s selection when there is no launch override', () => {
    const saved = {
      challengeMode: 'words' as const,
      players: [{ ...player, questionTypes: multiplication }, { ...player, questionTypes: spelling }],
    };
    expect(resolveRaceQuestions(saved, null, undefined, false)).toEqual(saved);
    const race = resolveRaceQuestions(saved, 'math', 'off', true);
    expect(race.players.map(p => p.questionTypes)).toEqual([addition, addition]);
    expect(saved.players.map(p => p.questionTypes)).toEqual([multiplication, spelling]);
  });

  it('keeps per-player choices when the build rejects the off override', () => {
    const saved = { challengeMode: 'words' as const, players: [{ ...player, questionTypes: multiplication }] };
    expect(resolveRaceQuestions(saved, 'off', undefined, false)).toEqual(saved);
    expect(resolveRaceQuestions(saved, 'off', undefined, true).challengeMode).toBe('off');
  });
});
