/**
 * Dino Lab scenarios and facets. Each facet level maps to concrete checks (all must pass).
 * Levels are always 1..n, so the phrase level index is `level - 1`.
 * Default model stats: speed 3, jump 1, reach 1, climb 1, swim 1, strength 2, bite 1, crunch 2, dig 1, size 3,
 * stealth 4, toughness 2, warmth 4, loudness 1 (see stats.ts + variants.ts).
 */
import type { AspectId, BasicCheck, Check, FacetDef, ScenarioDef, StatId, View } from '../../core/types';

const atLeast = (stat: StatId, min: number): Check => ({ kind: 'statMin', stat, min });
const atMost = (stat: StatId, max: number): Check => ({ kind: 'statMax', stat, max });
const tag = (t: string): BasicCheck => ({ kind: 'tag', tag: t });

/** `table[i]` = checks for level i + 1; levels past the end use the last entry. */
function facet(id: string, table: Check[][], hintAspect: AspectId, minTier: number, views: View[] = ['side']): FacetDef {
  return {
    id,
    levels: table.map((_, i) => i + 1),
    check: (level) => table[Math.max(0, Math.min(table.length - 1, Math.round(level) - 1))].map((c) => ({ ...c })),
    hintAspect,
    views,
    minTier,
  };
}

const scenario = (id: string, label: string, minTier: number, facets: FacetDef[]): ScenarioDef => ({ id, label, minTier, facets });

export const DINO_SCENARIOS: readonly ScenarioDef[] = [
  scenario('snack', 'Snack time: gulp a cartoon critter', 0, [
    facet('snack.bite', [[atLeast('bite', 3)], [atLeast('bite', 6)], [atLeast('bite', 7)]], 'teeth', 0),
    facet('snack.bigGulp', [
      [atLeast('bite', 7), atLeast('size', 5)],
      [atLeast('bite', 9), atLeast('size', 7)],
    ], 'teeth', 4),
  ]),
  scenario('chase', 'Chase a speedy lizard (top view)', 1, [
    facet('chase.speed', [[atLeast('speed', 5)], [atLeast('speed', 7)], [atLeast('speed', 10)]], 'legs', 1, ['top']),
    facet('chase.quiet', [[atLeast('stealth', 6)], [atLeast('stealth', 8)]], 'size', 2, ['top']),
  ]),
  scenario('ferns', 'Hide in the ferns from a big sniffing dino', 0, [
    facet('ferns.hide', [
      [tag('camo:forest')],
      [tag('camo:forest'), atLeast('stealth', 6)],
      [tag('camo:forest'), atLeast('stealth', 8)],
    ], 'color', 0),
    facet('ferns.flowers', [[tag('camo:flowers')]], 'color', 4),
  ]),
  scenario('ledge', 'Jump up onto a high ledge', 0, [
    facet('ledge.jump', [[atLeast('jump', 3)], [atLeast('jump', 5)], [atLeast('jump', 8)]], 'legs', 0),
  ]),
  scenario('burrow', 'Squeeze into a small burrow', 0, [
    facet('burrow.fit', [[atMost('size', 1)], [atMost('size', 0)]], 'size', 0),
    facet('burrow.dig', [[atLeast('dig', 3)], [atLeast('dig', 6)]], 'claws', 2),
    facet('burrow.dark', [[tag('glow')]], 'extra', 3),
  ]),
  scenario('tallGrass', 'Find the nest in the tall grass', 0, [
    facet('tallGrass.peek', [
      [{ kind: 'anyOf', options: [[tag('pose:stand')], [tag('longNeck')], [tag('tallBody')]] }],
      [atLeast('reach', 5)],
      [atLeast('reach', 9)],
    ], 'move', 0),
    facet('tallGrass.sneak', [[tag('camo:grass')]], 'extra', 3),
  ]),
  scenario('tallTree', 'Get the fruit from a tall tree', 0, [
    facet('tallTree.fruit', [[atLeast('reach', 4)], [atLeast('reach', 6)], [atLeast('reach', 9)]], 'head', 0),
    facet('tallTree.shake', [[atLeast('strength', 5)], [atLeast('strength', 7)]], 'size', 2),
  ]),
  scenario('rocks', 'Climb the big rocks', 0, [
    facet('rocks.climb', [[atLeast('climb', 4)], [atLeast('climb', 6)], [atLeast('climb', 8)]], 'claws', 0),
    facet('rocks.tough', [[atLeast('toughness', 5)], [atLeast('toughness', 7)]], 'body', 2),
  ]),
  scenario('river', 'Cross the river', 1, [
    facet('river.swim', [[atLeast('swim', 3)], [atLeast('swim', 5)], [atLeast('swim', 8)]], 'legs', 1),
    facet('river.fish', [[tag('camo:water')]], 'color', 3),
  ]),
  scenario('canyon', 'Fly across a deep canyon', 2, [
    facet('canyon.fly', [
      [tag('canFly')],
      [tag('canFly'), atMost('size', 3)],
      [tag('canFly'), atMost('size', 1)],
    ], 'move', 2),
  ]),
  scenario('nut', 'Crack a giant nut', 0, [
    facet('nut.crack', [[atLeast('crunch', 3)], [atLeast('crunch', 5)], [atLeast('crunch', 7)]], 'teeth', 0),
  ]),
  scenario('log', 'Push a log off the path', 0, [
    facet('log.push', [[atLeast('strength', 4)], [atLeast('strength', 6)], [atLeast('strength', 9)]], 'head', 0),
  ]),
  scenario('snow', 'Walk over the snowy mountain', 2, [
    facet('snow.warm', [[atLeast('warmth', 5)], [atLeast('warmth', 7)]], 'body', 2),
    facet('snow.slope', [[atLeast('climb', 3)], [atLeast('climb', 5)]], 'claws', 2),
  ]),
  scenario('birds', 'Shoo the pesky birds away', 0, [
    facet('birds.roar', [[atLeast('loudness', 3)], [atLeast('loudness', 5)], [atLeast('loudness', 9)]], 'head', 0),
  ]),
  scenario('desert', 'Hot sandy desert', 0, [
    facet('desert.hide', [
      [tag('camo:desert')],
      [tag('camo:desert'), atLeast('stealth', 6)],
      [tag('camo:desert'), atLeast('stealth', 8)],
    ], 'color', 1),
    facet('desert.cool', [[atMost('warmth', 3)], [atMost('warmth', 0)]], 'body', 0),
  ]),
];
