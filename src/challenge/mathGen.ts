/** Math challenge body generation (addition only). Pure. */
import { CHALLENGE, DIFFICULTY } from '../config/gameConfig';
import type { Rng } from '../core/rng';
import type { Difficulty } from '../core/types';

export interface MathBody {
  text: string;            // "7 + 5"
  answer: number;
  distractors: number[];
}

type Pair = readonly [number, number];
const pairCache = new Map<Difficulty, Pair[]>();

/** Every (a, b) allowed by the difficulty's math profile. */
function validPairs(d: Difficulty): Pair[] {
  const cached = pairCache.get(d);
  if (cached) return cached;
  const m = DIFFICULTY[d].math;
  const out: Pair[] = [];
  for (let a = m.minA; a <= m.maxA; a++) {
    for (let b = m.minB; b <= m.maxB; b++) {
      if (a + b > m.maxSum) continue;
      if (m.requireCarry && (a % 10) + (b % 10) < 10) continue;
      out.push([a, b]);
    }
  }
  pairCache.set(d, out);
  return out;
}

/** Swap the last two digits (73 -> 37, 124 -> 142). Null when it gives nothing new or a leading zero. */
function digitSwap(n: number): number | null {
  if (n < 10 || n % 10 === 0) return null;
  const ones = n % 10;
  const tens = Math.floor(n / 10) % 10;
  const swapped = n - tens * 10 - ones + ones * 10 + tens;
  return swapped === n ? null : swapped;
}

function distractorPool(d: Difficulty, answer: number, rng: Rng): number[] {
  const near = (offs: number[]) => offs.map((o) => answer + o);
  switch (d) {
    case 'easy':
    case 'easyPlus': return rng.shuffle(near([-3, -2, -1, 1, 2, 3]));
    case 'normal': {
      const close = rng.shuffle(near([-2, -1, 1, 2]));
      const tens = rng.shuffle(near([-10, 10]));
      return rng.chance(CHALLENGE.normalTensDistractorChance)
        ? [close[0], ...tens, ...close.slice(1)]
        : [...close, ...tens];
    }
    case 'hard': {
      const swap = digitSwap(answer);
      const rest = rng.shuffle([answer + 1, answer - 1, ...(swap === null ? [] : [swap]), answer + 10]);
      return rng.chance(CHALLENGE.hardForgotCarryChance) ? [answer - 10, ...rest] : [...rest, answer - 10];
    }
  }
}

export function generateMath(rng: Rng, d: Difficulty, optionCount = 3): MathBody {
  const need = optionCount - 1;
  const [a, b] = rng.pick(validPairs(d));
  const answer = a + b;
  const chosen: number[] = [];
  const ok = (n: number) => n >= 1 && n !== answer && !chosen.includes(n);
  for (const c of distractorPool(d, answer, rng)) {
    if (chosen.length === need) break;
    if (ok(c)) chosen.push(c);
  }
  for (let k = 1; chosen.length < need; k++) {
    for (const c of [answer + k, answer - k]) if (chosen.length < need && ok(c)) chosen.push(c);
  }
  return { text: `${a} + ${b}`, answer, distractors: chosen };
}
