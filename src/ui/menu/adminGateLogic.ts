export interface GateQuestion { a: number; b: number; answer: number }

/** Random a x b with both factors in [min, max]. `rng` returns [0, 1) (UI only, not gameplay). */
export function makeGateQuestion(rng: () => number, min: number, max: number): GateQuestion {
  const pick = () => min + Math.min(max - min, Math.floor(rng() * (max - min + 1)));
  const a = pick();
  const b = pick();
  return { a, b, answer: a * b };
}

/** Entered digits ("" or "63") match the question's answer. */
export function checkGateAnswer(q: GateQuestion, entered: string): boolean {
  return /^\d+$/.test(entered) && Number(entered) === q.answer;
}

/** Digit appended, capped at maxDigits; a leading zero is not stacked. */
export function appendGateDigit(entered: string, digit: number, maxDigits: number): string {
  if (entered.length >= maxDigits) return entered;
  if (entered === '0') return String(digit);
  return entered + String(digit);
}
