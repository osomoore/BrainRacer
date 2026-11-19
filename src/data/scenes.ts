/** Runtime access to scene images + labels. Generated data: run `npm run assets` after editing manifest.csv. */
import type { SceneEntry } from '../core/types';
import raw from './scenes.json';

export const SCENES: readonly SceneEntry[] = raw as SceneEntry[];

const byWord = new Map<string, SceneEntry[]>();
for (const s of SCENES) {
  const list = byWord.get(s.word) ?? [];
  list.push(s);
  byWord.set(s.word, list);
}

/** All distinct words that have at least one image. */
export const ALL_WORDS: readonly string[] = [...byWord.keys()].sort();

export function scenesForWord(word: string): readonly SceneEntry[] {
  return byWord.get(word) ?? [];
}

export function sceneById(id: string): SceneEntry | undefined {
  return SCENES.find((s) => s.id === id);
}
