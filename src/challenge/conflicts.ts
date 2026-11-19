/** Which words must never share a challenge (near-synonyms, one-contains-the-other, look-alikes). */
import { WORD_META } from '../data/wordMeta';

/** Extra hand-checked pairs on top of WORD_META.confusableWith (symmetric). */
const EXTRA_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['house', 'city'], ['house', 'treehouse'], ['tree', 'treehouse'], ['ship', 'sailboat'], ['car', 'pickup truck'],
  ['windmill', 'wind turbine'], ['lake', 'river'], ['road', 'bridge'], ['mountain', 'volcano'],
  ['cube', 'box'], ['sphere', 'beach ball'], ['sphere', 'black circle'], ['sphere', 'red circle'], ['sphere', 'gray circle'],
  ['cube', 'blue square'], ['cube', 'outline square'], ['glass of water', 'mug'], ['glass of water', 'milk'],
  ['glass of water', 'glasses'], ['painting', 'paintbrush'], ['writing', 'pencil'], ['writing', 'crayon'],
  ['playing soccer', 'stadium'], ['swinging', 'playground'], ['sleeping', 'bed'], ['digging', 'excavator'],
  ['lighthouse', 'tower'], ['castle', 'tower'], ['flashlight', 'lamp'], ['rainbow', 'rain cloud'],
  ['ice skating', 'roller skating'], ['park', 'forest'], ['fire station', 'police station'],
  ['train', 'train station'], ['airplane', 'airport'], ['harbor', 'ship'], ['harbor', 'sailboat'],
  ['fishing', 'lake'], ['flying a kite', 'kite'], ['watering flowers', 'flower'], ['cooking', 'restaurant'],
  ['reading', 'library'], ['sledding', 'skiing'], ['swimming', 'beach'],
];

const extra = new Map<string, Set<string>>();
for (const [a, b] of EXTRA_PAIRS) {
  (extra.get(a) ?? extra.set(a, new Set()).get(a)!).add(b);
  (extra.get(b) ?? extra.set(b, new Set()).get(b)!).add(a);
}

function hasWholeWord(haystack: string, needle: string): boolean {
  return (` ${haystack} `).includes(` ${needle} `);
}

/** True when `a` and `b` are the same word, listed confusable, or one is a whole-word part of the other. */
export function wordsConflict(a: string, b: string): boolean {
  if (a === b) return true;
  if (WORD_META[a]?.confusableWith.includes(b) || WORD_META[b]?.confusableWith.includes(a)) return true;
  if (extra.get(a)?.has(b)) return true;
  return hasWholeWord(a, b) || hasWholeWord(b, a);
}
