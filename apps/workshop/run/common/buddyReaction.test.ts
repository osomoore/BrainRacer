import { expect, test } from 'vitest';
import { buddyReaction, type BuddyCues } from './buddyReaction';

const cues: BuddyCues = { leading: false, searching: false, slowed: false, passed: true, ended: false };

test('leads at the start and follows during regular motion', () => {
  expect(buddyReaction({ ...cues, leading: true, anim: 'run' })).toBe('lead');
  expect(buddyReaction({ ...cues, anim: 'drive' })).toBe('follow');
});

test('pushes on wheelspin or sustained slowdown and searches during a search cue', () => {
  expect(buddyReaction({ ...cues, leading: true, anim: 'spinWheels' })).toBe('push');
  expect(buddyReaction({ ...cues, anim: 'walk', slowed: true })).toBe('push');
  expect(buddyReaction({ ...cues, searching: true, slowed: true })).toBe('search');
});

test('only reacts to outcome poses that agree with the stage result, then uses the final result', () => {
  expect(buddyReaction({ ...cues, anim: 'celebrate' })).toBe('celebrate');
  expect(buddyReaction({ ...cues, passed: false, anim: 'celebrate' })).toBe('follow');
  expect(buddyReaction({ ...cues, passed: false, anim: 'dizzy' })).toBe('shrug');
  expect(buddyReaction({ ...cues, anim: 'dizzy' })).toBe('follow');
  expect(buddyReaction({ ...cues, ended: true, searching: true })).toBe('celebrate');
  expect(buddyReaction({ ...cues, ended: true, passed: false, anim: 'spinWheels' })).toBe('shrug');
});
