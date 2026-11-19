import { describe, expect, it } from 'vitest';
import { resolveChallengeMode as r } from './questionsPolicy';

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
