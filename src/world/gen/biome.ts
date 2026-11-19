/** Biome selection. Wave 5 extends this (noise-driven); for now everything is city. */
export type Biome = 'city' | 'countryside' | 'industrial';

export function biomeAt(_tx: number, _ty: number, _seed: number): Biome {
  return 'city';
}
