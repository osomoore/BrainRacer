/** Prints sample challenges for human review: `npx tsx src/challenge/sample.ts [seed]`. */
import { Rng } from '../core/rng';
import type { ChallengeKind, ChallengeOption, ChallengePrompt, Difficulty } from '../core/types';
import { CITY_PLACE_WORDS } from '../data/places';
import { sceneById } from '../data/scenes';
import { ChallengeGenerator, type GeneratedChallenge } from './ChallengeGenerator';

const SLOT_LABELS = ['X', 'Y', 'B'];

function show(x: ChallengePrompt | ChallengeOption): string {
  if (x.kind === 'text') return x.text;
  if (x.kind === 'verse') return `${x.ref} ${x.text}`;
  return `[img:${sceneById(x.sceneId)?.word ?? x.sceneId}]`;
}

function line(c: GeneratedChallenge): string {
  const opts = c.options.map((o, i) => `${SLOT_LABELS[i]}=${show(o)}${i === c.correct ? '*' : ''}`).join('   ');
  return `${show(c.prompt).padEnd(26)} -> ${opts}${c.placeWord ? `   (place: ${c.placeWord})` : ''}`;
}

const seed = Number(process.argv[2] ?? 1) || 1;
const pickRng = new Rng(seed + 7);
const gen = new ChallengeGenerator(new Rng(seed));
const kinds: ChallengeKind[] = ['picToWord', 'wordToPic', 'math', 'multiplication'];
const levels: Difficulty[] = ['easy', 'easyPlus', 'normal', 'hard'];

for (const kind of kinds) {
  for (const d of levels) {
    console.log(`\n== ${kind} / ${d} (seed ${seed}) ==`);
    for (let i = 0; i < 10; i++) console.log(line(gen.generate(kind, d)));
  }
}
for (const d of levels) {
  console.log(`\n== place / ${d} ==`);
  for (let i = 0; i < 6; i++) console.log(line(gen.generate('picToWord', d, { placeWord: pickRng.pick(CITY_PLACE_WORDS) })));
}
