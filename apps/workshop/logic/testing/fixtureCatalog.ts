/** Small but realistic Race-Shop-like catalog for engine tests (not shipped content). */
import type {
  AspectDef, Check, FacetDef, FacetPhrases, ReadingLevel, ScenarioDef, ScenarioPhrases, StatDef, Variant, View, WorkshopCatalog,
} from '../../core/types';
import { READING_LEVELS } from '../../core/types';

const stat = (id: string, base: number, max = 10): StatDef => ({ id, label: id, base, min: 0, max });
const STATS: StatDef[] = [stat('speed', 1), stat('grip', 1), stat('power', 1), stat('jump', 0), stat('size', 2, 6), stat('turn', 1)];

const ASPECTS: AspectDef[] = [
  { id: 'wheels', label: 'Wheels', starters: ['wheels.road', 'wheels.mud'], visibleFromTop: true },
  { id: 'engine', label: 'Engine', starters: ['engine.small', 'engine.big'], visibleFromTop: true },
  { id: 'paint', label: 'Paint', starters: ['paint.blue', 'paint.yellow'], visibleFromTop: true },
  { id: 'size', label: 'Size', starters: ['size.medium', 'size.small'], visibleFromTop: true },
  { id: 'springs', label: 'Springs', starters: ['springs.soft', 'springs.sport'], visibleFromTop: false },
  { id: 'extra', label: 'Extra', starters: ['extra.roofRack', 'extra.rocket'], visibleFromTop: true },
];

const v = (id: string, stats: Variant['stats'] = {}, tags: string[] = []): Variant =>
  ({ id, aspect: id.split('.')[0], name: id.split('.')[1], stats, tags, note: '' });

const VARIANTS: Variant[] = [
  v('wheels.road', { grip: 1, speed: 1 }), v('wheels.mud', { grip: 3, speed: -1 }), v('wheels.racing', { speed: 2, grip: -1 }),
  v('wheels.snow', { grip: 2 }, ['snow']),
  v('engine.small', { power: 1 }), v('engine.big', { power: 3 }), v('engine.efficient', { power: 2 }, ['efficient']),
  v('engine.turbo', { power: 4, speed: 2 }),
  v('paint.blue', {}, ['color:blue']), v('paint.yellow', {}, ['bright', 'color:yellow']), v('paint.red', {}, ['bright', 'color:red']),
  v('paint.black', {}, ['dark', 'color:black']), v('paint.green', {}, ['color:green']),
  v('size.medium'), v('size.small', { size: -1 }), v('size.big', { size: 1, power: 1 }), v('size.tiny', { size: -2, power: -1 }),
  v('springs.soft'), v('springs.sport', { turn: 3 }), v('springs.lifted', { size: 1, jump: 1 }), v('springs.bouncy', { jump: 3, turn: -1 }),
  v('extra.roofRack', {}, ['canCarry']), v('extra.rocket', { speed: 3 }), v('extra.floats', { speed: -1 }, ['canFloat']),
  v('extra.spoiler', { turn: 2 }), v('extra.anchors', { grip: 1, speed: -1 }),
];

const min = (stat: string, m: number): Check => ({ kind: 'statMin', stat, min: m });
const max = (stat: string, m: number): Check => ({ kind: 'statMax', stat, max: m });
const tag = (t: string): Check => ({ kind: 'tag', tag: t });
const noTag = (t: string): Check => ({ kind: 'noTag', tag: t });

const facet = (id: string, levels: number[], hintAspect: string, minTier: number, check: (l: number) => Check[], views: View[] = ['side']): FacetDef =>
  ({ id, levels, hintAspect, views, minTier, check });

const SCENARIOS: ScenarioDef[] = [
  { id: 'mud', label: 'Mud', minTier: 0, facets: [facet('mud.grip', [1, 2, 3], 'wheels', 0, (l) => [min('grip', l + 2)])] },
  { id: 'jump', label: 'Long jump', minTier: 0, facets: [facet('jump.far', [1, 2, 3], 'extra', 0, (l) => [min('speed', [4, 5, 7][l - 1])])] },
  { id: 'hill', label: 'Hill', minTier: 0, facets: [facet('hill.climb', [1, 2, 3], 'engine', 0, (l) => [min('power', l + 2)])] },
  { id: 'turn', label: 'Sharp turn', minTier: 0, facets: [facet('turn.sharp', [1, 2], 'springs', 0, (l) => [min('turn', l + 2)], ['top'])] },
  { id: 'fog', label: 'Fog', minTier: 0, facets: [facet('fog.bright', [1], 'paint', 0, () => [tag('bright')], ['side', 'top'])] },
  { id: 'river', label: 'River', minTier: 1, facets: [
    facet('river.float', [1], 'extra', 1, () => [tag('canFloat')]),
    facet('river.light', [1], 'size', 2, () => [max('size', 1)]),
  ] },
  { id: 'sneak', label: 'Night sneak', minTier: 1, facets: [facet('sneak.hidden', [1], 'paint', 1, () => [tag('dark'), noTag('bright')], ['side', 'top'])] },
  { id: 'tree', label: 'Tall tree', minTier: 1, facets: [facet('tree.reach', [1, 2], 'size', 1, (l) => [min('size', l + 2)])] },
  { id: 'delivery', label: 'Delivery', minTier: 1, facets: [
    facet('delivery.load', [1], 'extra', 1, () => [tag('canCarry')]),
    facet('delivery.heavy', [1], 'engine', 2, () => [tag('canCarry'), min('power', 3)]),
  ] },
  { id: 'ramp', label: 'Ramp', minTier: 2, facets: [facet('ramp.jump', [1, 2], 'springs', 2, (l) => [min('jump', l + 1)])] },
  { id: 'bridge', label: 'Low bridge', minTier: 2, facets: [facet('bridge.low', [1, 2], 'size', 2, (l) => [max('size', 2 - l)])] },
];

const lev = (s: string): Record<ReadingLevel, string[]> =>
  Object.fromEntries(READING_LEVELS.map((r) => [r, [`${s} (${r} A).`, `${s} (${r} B).`]])) as Record<ReadingLevel, string[]>;

const FACET_PHRASES: FacetPhrases[] = SCENARIOS.flatMap((s) => s.facets.map((f) => ({
  facet: f.id,
  requirement: f.levels.map((l) => lev(`Need ${f.id} at level ${l}`)),
  hint: lev(`Look at the ${f.hintAspect} for ${f.id}`),
})));

const SCENARIO_PHRASES: ScenarioPhrases[] = SCENARIOS.map((s) => ({
  scenario: s.id,
  title: [`${s.label} Trial`, `${s.label} Run`],
  intro: lev(`You reach the ${s.label}`),
}));

export const FIXTURE_CATALOG: WorkshopCatalog = {
  id: 'race',
  title: 'Fixture Shop',
  stats: STATS,
  aspects: ASPECTS,
  variants: VARIANTS,
  scenarios: SCENARIOS,
  facetPhrases: FACET_PHRASES,
  scenarioPhrases: SCENARIO_PHRASES,
  unlockOrder: [
    'wheels.racing', 'engine.efficient', 'paint.red', 'springs.lifted', 'extra.floats', 'size.big', 'wheels.snow',
    'engine.turbo', 'paint.black', 'springs.bouncy', 'extra.spoiler', 'size.tiny', 'paint.green', 'extra.anchors',
  ],
  starters: [
    { id: 'st-mud', stages: [{ scenario: 'mud', facets: [{ facet: 'mud.grip', level: 1 }] }] },
    { id: 'st-jump', stages: [{ scenario: 'jump', facets: [{ facet: 'jump.far', level: 1 }] }] },
    { id: 'st-turn', stages: [{ scenario: 'turn', facets: [{ facet: 'turn.sharp', level: 1 }] }] },
    { id: 'st-hill', stages: [{ scenario: 'hill', facets: [{ facet: 'hill.climb', level: 1 }] }] },
    { id: 'st-bright', stages: [{ scenario: 'fog', facets: [{ facet: 'fog.bright', level: 1 }] }] },
  ],
};
