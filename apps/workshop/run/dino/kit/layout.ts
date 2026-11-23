/**
 * Dino Lab scene kit: pure layout maths (no Phaser). Which facets a stage shows, which one failed, and how
 * facet levels size the environment (higher level = taller fruit, wider river, faster prey, louder birds...).
 * Everything is deterministic and relative where it must look right next to the dino: a failing stage always
 * looks too hard for the dino, a passing one looks doable, whatever the dino's size.
 */
import type { Requirement, Stage, StageResult } from '../../../core/types';

/** Facets a stage shows: every requirement's facet plus any facet that has a level in `params`. */
export function stageFacets(stage: Pick<Stage, 'params' | 'requirements'>): string[] {
  const out: string[] = [];
  for (const r of stage.requirements) if (!out.includes(r.facet)) out.push(r.facet);
  for (const f of Object.keys(stage.params)) if (!out.includes(f)) out.push(f);
  return out;
}

/** Level of a facet in this stage (requirement level wins over params), `dflt` if the stage does not use it. */
export function facetLevel(stage: Pick<Stage, 'params' | 'requirements'>, facet: string, dflt = 1): number {
  const r = stage.requirements.find((q) => q.facet === facet);
  return r ? r.level : stage.params[facet] ?? dflt;
}

/** Facet of the requirement that failed first (undefined when the stage passed or the id is unknown). */
export function failedFacet(stage: Pick<Stage, 'requirements'>, result: Pick<StageResult, 'passed' | 'firstFail'>): string | undefined {
  if (result.passed || !result.firstFail) return undefined;
  return stage.requirements.find((r: Requirement) => r.id === result.firstFail)?.facet;
}

/** Facets that failed (all failing requirements). */
export function failedFacets(stage: Pick<Stage, 'requirements'>, reqs: readonly { id: string; passed: boolean }[]): string[] {
  const bad = new Set(reqs.filter((r) => !r.passed).map((r) => r.id));
  const out: string[] = [];
  for (const r of stage.requirements) if (bad.has(r.id) && !out.includes(r.facet)) out.push(r.facet);
  return out;
}

const clampLevel = (level: number, max = 3): number => Math.max(1, Math.min(max, Math.round(level)));

/** Linear table lookup: level 1..n. */
export const byLevel = <T>(level: number, table: readonly T[]): T => table[clampLevel(level, table.length) - 1];

// ---------------------------------------------------------------- per-scenario sizing

/** Snack critter kind and its scale relative to the dino. */
export function snackCritter(level: number, big: boolean): { kind: 'beetle' | 'frog' | 'lizard'; scale: number } {
  if (big) return { kind: 'beetle', scale: byLevel(level, [1.5, 2.0]) };
  return { kind: byLevel(level, ['beetle', 'frog', 'lizard'] as const), scale: byLevel(level, [0.7, 0.8, 1.15]) };
}

/** Prey speed (px/s on screen) for the chase; also the dino's chasing speed on success. */
export const chaseSpeed = (level: number): number => byLevel(level, [300, 380, 470]);

/** Number of fern clumps (hiding) and visible thickness: level 1 thick, level 3 a few thin ferns. */
export function fernDensity(level: number): { clumps: number; leaves: number } {
  return byLevel(level, [{ clumps: 9, leaves: 7 }, { clumps: 6, leaves: 5 }, { clumps: 4, leaves: 3 }]);
}

/** Ledge height as a multiple of the dino's height. Passing builds look reachable (<1), failing ones too high (>1). */
export function ledgeHeight(level: number, pass: boolean): number {
  return pass ? byLevel(level, [0.32, 0.5, 0.72]) : byLevel(level, [0.78, 1.0, 1.3]);
}

/** Burrow hole diameter as a fraction of the dino's height. */
export function holeFraction(level: number, pass: boolean): number {
  return pass ? byLevel(level, [0.72, 0.6]) : byLevel(level, [0.42, 0.32]);
}

/** Tall grass height as a multiple of the dino's height (peek). Passing: dino rises above it; failing: it towers over the dino. */
export function grassHeight(level: number, pass: boolean): number {
  return pass ? byLevel(level, [0.55, 0.62, 0.7]) : byLevel(level, [0.85, 0.95, 1.05]);
}

/** Fruit height above ground, as a multiple of the dino's mouth height. */
export function fruitHeight(level: number, pass: boolean): number {
  return pass ? byLevel(level, [1.05, 1.4, 1.7]) : byLevel(level, [1.9, 2.3, 2.8]);
}

/** Boulder wall height as a multiple of the dino's height, and number of steps. */
export function rockWall(level: number): { height: number; steps: number } {
  return byLevel(level, [{ height: 0.9, steps: 4 }, { height: 1.2, steps: 5 }, { height: 1.5, steps: 6 }]);
}

/** River width as a multiple of the dino's width, plus wave amplitude (px) and speed multiplier. */
export function riverSize(level: number): { width: number; wave: number; speed: number } {
  return byLevel(level, [{ width: 1.2, wave: 4, speed: 1 }, { width: 1.8, wave: 9, speed: 1.4 }, { width: 2.4, wave: 14, speed: 2 }]);
}

/** Canyon gap width as a multiple of the dino's length, and wind streak count. */
export function canyonGap(level: number): { gap: number; wind: number } {
  return byLevel(level, [{ gap: 1.1, wind: 0 }, { gap: 1.7, wind: 4 }, { gap: 2.3, wind: 7 }]);
}

/** Nut look (1 hard, 2 coconut, 3 rock) and size relative to the dino's height. */
export const nutSize = (level: number): number => byLevel(level, [0.34, 0.42, 0.52]);

/** Log size relative to the dino's height (diameter) and length. */
export function logSize(level: number): { thick: number; length: number } {
  return byLevel(level, [{ thick: 0.22, length: 0.9 }, { thick: 0.34, length: 1.1 }, { thick: 0.62, length: 1.5 }]);
}

/** Snow: flake count (calm vs blizzard) and wall height multiple for the ice slope. */
export const snowFlakes = (level: number): number => byLevel(level, [12, 26]);
export const iceWall = (level: number): number => byLevel(level, [0.7, 1.1]);

/** Pesky birds: count (few, flock, huge flock). */
export const birdCount = (level: number): number => byLevel(level, [3, 5, 8]);

/** Desert: how flat/open the sand is (dune count falls with level) and heat intensity. */
export const duneCount = (level: number): number => byLevel(level, [4, 2, 0]);
export const heatLines = (level: number): number => byLevel(level, [4, 8]);

/** Tall-grass nest position as a fraction of the area width. */
export const nestFraction = (seed: number): number => 0.68 + (seed % 3) * 0.06;
