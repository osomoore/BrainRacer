/** Always-encouraging result messages (pure). */
export function messageFor(stars: 1 | 2 | 3, playerCount: number): string {
  if (stars === 3) return playerCount > 1 ? 'Super Brain Team!' : 'Super Brain Racer!';
  if (stars === 2) return 'Great driving!';
  return playerCount > 1 ? 'Nice teamwork! Let’s go again!' : 'Nice job! Let’s go again!';
}
