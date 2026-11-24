/**
 * Race Shop scenarios and facets. Thresholds per facet level live in the tables below (content data, not tunables).
 * Stat scale: see stats.ts (default car around 3, max 10).
 */
import type { AspectId, BasicCheck, Check, FacetDef, ScenarioDef, StatId, View } from '../../core/types';
import { partTag } from '../../logic/stats';

const atLeast = (stat: StatId, min: number): BasicCheck => ({ kind: 'statMin', stat, min });
const atMost = (stat: StatId, max: number): Check => ({ kind: 'statMax', stat, max });
const tag = (t: string): BasicCheck => ({ kind: 'tag', tag: t });

/** Each advertised build works on its own, and any other build can still meet the stat target. */
function jumpCheck(stat: StatId, min: number, ...builds: string[][]): Check {
  return { kind: 'anyOf', options: [[atLeast(stat, min)], ...builds.map((parts) => parts.map((id) => tag(partTag(id))))] };
}

/** Pick the checks for a level; unknown levels clamp to the nearest defined one. */
function byLevel(table: Record<number, Check[]>): (level: number) => Check[] {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  return (level) => {
    const k = keys.reduce((best, key) => (Math.abs(key - level) < Math.abs(best - level) ? key : best), keys[0]);
    return table[k].map((c) => ({ ...c }));
  };
}

function facet(id: string, hintAspect: AspectId, views: readonly View[], minTier: number, table: Record<number, Check[]>): FacetDef {
  return { id, levels: Object.keys(table).map(Number).sort((a, b) => a - b), check: byLevel(table), hintAspect, views, minTier };
}

const SIDE: readonly View[] = ['side'];
const BOTH: readonly View[] = ['side', 'top'];
const TOP: readonly View[] = ['top'];

export const RACE_SCENARIOS: readonly ScenarioDef[] = [
  {
    id: 'mud', label: 'Deep mud on the farm road', minTier: 0, facets: [
      facet('mud.grip', 'wheels', SIDE, 0, { 1: [atLeast('mudGrip', 3)], 2: [atLeast('mudGrip', 5)], 3: [atLeast('mudGrip', 6)] }),
      facet('mud.pull', 'extra', SIDE, 2, { 1: [tag('winch')], 2: [tag('winch'), atLeast('power', 6)] }),
    ],
  },
  {
    id: 'jump', label: 'Ramp jump over a gap', minTier: 0, facets: [
      facet('jump.speed', 'gears', SIDE, 0, {
        1: [jumpCheck('speed', 5, ['gears.speedy'], ['extra.rocket'])],
        2: [jumpCheck('speed', 7, ['gears.speedy', 'extra.rocket'], ['body.sports', 'shape.sleek'])],
        3: [jumpCheck('speed', 10, ['gears.speedy', 'extra.rocket', 'engine.turbo'], ['body.sports', 'shape.sleek', 'engine.turbo'])],
      }),
      facet('jump.landing', 'springs', SIDE, 2, {
        1: [jumpCheck('bounce', 4, ['springs.bouncy'])],
        2: [jumpCheck('bounce', 6, ['springs.bouncy', 'wheels.monster'], ['springs.bouncy', 'bumpers.rubber'])],
      }),
    ],
  },
  {
    id: 'turn', label: 'Sharp turns (top view)', minTier: 0, facets: [
      facet('turn.handling', 'springs', TOP, 0, { 1: [atLeast('handling', 5)], 2: [atLeast('handling', 7)], 3: [atLeast('handling', 9)] }),
    ],
  },
  {
    id: 'hill', label: 'Steep hill climb', minTier: 0, facets: [
      facet('hill.power', 'engine', SIDE, 0, { 1: [atLeast('power', 6)], 2: [atLeast('power', 8)], 3: [atLeast('power', 9)] }),
    ],
  },
  {
    id: 'fog', label: 'Foggy road, ducks waiting to cross', minTier: 0, facets: [
      facet('fog.bright', 'paint', BOTH, 0, { 1: [tag('bright')] }),
    ],
  },
  {
    id: 'lowBridge', label: 'Low bridge', minTier: 0, facets: [
      facet('lowBridge.height', 'size', SIDE, 0, { 1: [atMost('height', 2)], 2: [atMost('height', 1)], 3: [atMost('height', 0)] }),
    ],
  },
  {
    id: 'narrow', label: 'Narrow alley between trees (top view)', minTier: 1, facets: [
      facet('narrow.width', 'size', TOP, 1, { 1: [atMost('width', 2)], 2: [atMost('width', 1)] }),
    ],
  },
  {
    id: 'delivery', label: 'Heavy delivery', minTier: 0, facets: [
      facet('delivery.load', 'body', SIDE, 0, { 1: [atLeast('load', 5)], 2: [atLeast('load', 7)], 3: [atLeast('load', 9)] }),
      facet('delivery.power', 'engine', SIDE, 2, { 1: [atLeast('power', 5)] }),
    ],
  },
  {
    id: 'snow', label: 'Snowy mountain pass', minTier: 1, facets: [
      facet('snow.grip', 'wheels', SIDE, 1, { 1: [atLeast('snowGrip', 3)], 2: [atLeast('snowGrip', 5)], 3: [atLeast('snowGrip', 6)] }),
    ],
  },
  {
    id: 'rocks', label: 'Rocky forest trail', minTier: 0, facets: [
      facet('rocks.tough', 'bumpers', SIDE, 0, { 1: [atLeast('toughness', 4)], 2: [atLeast('toughness', 6)], 3: [atLeast('toughness', 8)] }),
      facet('rocks.clearance', 'springs', SIDE, 1, { 1: [atLeast('clearance', 4)], 2: [atLeast('clearance', 6)] }),
      facet('rocks.log', 'bumpers', SIDE, 2, { 1: [atLeast('push', 4)], 2: [atLeast('push', 6)] }),
    ],
  },
  {
    id: 'river', label: 'River crossing (deep stream, then a wide river)', minTier: 2, facets: [
      facet('river.cross', 'extra', SIDE, 2, {
        1: [{ kind: 'anyOf', options: [[tag('snorkel')], [tag('canFloat')]] }],
        2: [tag('canFloat')],
      }),
    ],
  },
  {
    id: 'wobbly', label: 'Wobbly old bridge', minTier: 1, facets: [
      facet('wobbly.weight', 'size', SIDE, 1, { 1: [atMost('weight', 3)], 2: [atMost('weight', 2)], 3: [atMost('weight', 1)] }),
    ],
  },
  {
    id: 'beach', label: 'Long trip to the beach', minTier: 1, facets: [
      facet('beach.range', 'engine', SIDE, 1, { 1: [atLeast('range', 5)], 2: [atLeast('range', 7)], 3: [atLeast('range', 9)] }),
      facet('beach.load', 'body', SIDE, 3, { 1: [atLeast('load', 4)] }),
    ],
  },
  {
    id: 'parade', label: 'Color parade', minTier: 1, facets: [
      facet('parade.color', 'paint', BOTH, 1, { 1: [tag('color:red')], 2: [tag('color:green')], 3: [tag('color:rainbow')] }),
    ],
  },
  {
    id: 'night', label: 'Sleepy town at night (quiet, hide-and-seek)', minTier: 2, facets: [
      facet('night.quiet', 'engine', SIDE, 2, { 1: [atMost('noise', 2)], 2: [atMost('noise', 0)] }),
      facet('night.hide', 'paint', SIDE, 2, { 1: [tag('dark')] }),
    ],
  },
];
