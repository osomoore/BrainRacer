import { P, T, palette as C } from '../../run/common/props';
import type { View } from '../../core/types';
import type { PartSpec } from '../bake';

type SceneryShape = readonly [spec: PartSpec, subject: string, faceSafe?: true];
type SceneryFamily = SceneryShape[];

export const SIDE_SCENERY = {
  cloud: [[P.cloud(), 'soft white cloud']],
  moon: [[P.moon(), 'cream full moon with golden craters']],
  sun: [[P.sun(), 'sunny yellow disc with a soft golden halo']],

  tree: [
    [P.tree(), 'bright green broadleaf tree with a brown trunk'],
    [P.tree('#7fa08c'), 'muted sage green broadleaf tree with a brown trunk'],
    [P.tree('#3f9f48'), 'forest green broadleaf tree with a brown trunk'],
  ],
  pine: [[P.pine(), 'dark green pine tree'], [P.pine(true), 'dark green pine tree capped with white snow']],
  bush: [
    [P.bush(), 'round green bush with lime highlights'],
    [P.bush('#3fa046'), 'round grass green bush with lime highlights'],
    [P.bush('#1f4a3a'), 'round deep green bush in dim nighttime light'],
  ],
  flower: [[P.flower(C.pink), 'pink flower with a gold center']],
  fence: [[P.fence(), 'brown wooden rail fence']],
  reeds: [[P.reeds(), 'green reeds with brown cattail heads']],
  barn: [[P.barn(), 'red barn with white door trim']],
  tractor: [[P.tractor(), 'green farm tractor with black tires']],
  hay: [[P.hay(), 'small rectangular golden hay bale']],
  haystack: [[P.haystack(), 'stack of golden hay bales']],
  hayTop: [[P.hayTop(), 'golden hay bale with brown bindings']],
  melon: [[P.melon(), 'green watermelon with darker green stripes']],

  house: [
    [P.house(3), 'cream house with a red roof and lit windows'],
    [P.house(3, '#bfe3ff'), 'pale blue house with a red roof and lit windows'],
    [P.house(3, '#ffd0d8'), 'pale pink house with a red roof and lit windows'],
    [P.house(0, '#6a7aa8', '#7a3a5a'), 'dusky blue house with a plum roof and dark windows'],
    [P.house(1, '#6a7aa8', '#7a3a5a'), 'dusky blue house with a plum roof and one warm lit window'],
  ],
  store: [[P.store(), 'cream shopfront with a striped blue awning']],
  gasPump: [[P.gasPump(), 'red gas pump with a yellow accent and blank display']],
  signpost: [
    [P.signpost(), 'blue roadside sign with a white arrow'],
    [P.signpost(C.yellow), 'yellow roadside sign with a white arrow'],
    [P.signpost(C.yellow, false), 'blank yellow roadside sign'],
  ],
  window: [[P.window(false), 'dark blue window with crossbars'], [P.window(true), 'warm glowing yellow window with crossbars']],
  mileSign: [1, 2, 3, 4, 5, 6].map((n) => [P.mileSign(n), `green milestone marker with exactly ${n} white dots`]),
  flag: [[C.red, 'red'], [C.yellow, 'yellow'], [C.green, 'green'], [C.blue, 'blue']].map(([color, name]) => [
    P.flag(color), `plain ${name} pennant on a gray pole`,
  ]),
  flagPole: [[P.flagPole(), 'slim gray flagpole']],
  checker: [[P.checker(), 'black and white checkered racing flag']],
  cone: [[P.cone(), 'orange traffic cone with a white reflective stripe']],
  crate: [[P.crate(), 'wooden crate with a blank white label'], [P.crate(C.hay), 'golden crate with a blank white label']],
  box: [
    ['#ffb347', 'orange'], ['#6ec8ff', 'sky blue'], ['#ff7eb6', 'pink'],
    ['#9bde6a', 'pale green'], ['#ffd23f', 'yellow'], ['#b98cff', 'lavender'],
  ].map(([color, name]) => [P.box(color), `${name} delivery box with a single darker tape strip`]),

  umbrella: [[P.umbrella(), 'red beach umbrella striped with white']],
  sandcastle: [[P.sandcastle(), 'golden sandcastle with three small towers']],
  bucket: [[P.bucket(), 'blue toy beach bucket with a white handle']],
  shovel: [[P.shovel(), 'small red beach shovel with a wooden handle']],
  towel: [[P.towel(), 'pink beach towel with white stripes']],
  beachBall: [[P.beachBall(), 'white toy beach ball with red and blue panels']],

  rock: [
    [P.rock(180, 90, 3), 'wide gray river rock with a silver highlight'],
    ...[1, 2, 3].flatMap((lv): SceneryFamily => Array.from({ length: 2 + lv }, (_, i) => [
      P.rock(90 + lv * 20, 40 + lv * 22 - i % 2 * 12, i + 1), 'gray trail rock with a silver highlight',
    ])),
  ],
  boulder: [190, 230, 270].map((h) => [P.boulder(360, h), 'rounded gray boulder with a silver highlight']),
  log: [1, 2, 3].map((lv) => [P.log(300 + lv * 60, 80 + lv * 30), 'fallen brown log with golden growth rings']),
  logRound: [[P.logRound(100), 'round cut end of a log with brown growth rings']],
  lily: [[P.lily(), 'green lily pad with a small pink blossom']],
  plank: (['wood', 'rope', 'stick'] as const).map((style) => [
    P.plank(900 / 22 + 10, style), `small brown ${style} footbridge deck segment`,
  ]),
  postTall: [[P.postTall(), 'brown timber bridge post']],
  ice: [520, 760, 1000].map((w) => [P.ice(w), 'flat, pale blue ice patch with a white shine']),
  snowbank: [[P.snowbank(320, 120), 'soft white snowbank with pale blue shadows']],
  hat: [[P.hat(), 'small charcoal top hat with a red ribbon']],
  hook: [[P.hook(), 'small navy metal hook']],
  hubcap: [[P.hubcap(), 'round silver car hubcap with a gray center']],
  bandage: [[P.bandage(), 'peach adhesive bandage with a tan pad']],
  stroller: [[P.stroller(), 'pink stroller with dark wheels']],
  balloon: [[P.balloon(C.red), 'red party balloon with a string'], [P.balloon(C.green), 'green party balloon with a string'],
    [P.balloon('rainbow'), 'rainbow party balloon with a string']],
  bunting: [[P.bunting(480, C.red), 'string of red and white pennants'], [P.bunting(480, C.green), 'string of green and white pennants'],
    [P.bunting(480, 'rainbow'), 'string of rainbow pennants']],
  floatWagon: [[P.floatWagon(C.red), 'red parade wagon with colorful balloons'], [P.floatWagon(C.green), 'green parade wagon with colorful balloons'],
    [P.floatWagon('rainbow'), 'golden parade wagon with rainbow balloons']],

  sheep: [[P.sheep(), 'fluffy white sheep with a charcoal face', true]],
  duck: [0.8, 1, 1.2, 1.25].map((s) => [P.duck(s), 'yellow duck with an orange bill', true]),
  frog: [[P.frog(), 'small bright green frog', true]],
  pigeon: [[P.pigeon(), 'gray pigeon with an orange bill', true]],
  squirrel: [[P.squirrel(), 'russet squirrel with a white belly and bushy tail', true]],
  fish: [[P.fish(), 'little orange fish with a golden shine', true]],
  turtle: [[P.turtle(), 'green turtle with a darker green shell', true]],
  crab: [[P.crab(), 'small red crab with round claws', true]],
  gull: [[P.gull(), 'white seagull with an orange bill', true]],
  puppy: [[P.puppy(), 'sleeping golden puppy with floppy brown ears', true],
    [P.puppy(false), 'awake golden puppy with floppy brown ears', true]],
  snowman: [[P.snowman(), 'white snowman with an orange carrot nose and dark hat', true]],
  person: [
    [P.person('#ff7a59', C.yellow, 'wave'), 'waving delivery helper with a coral shirt and yellow cap', true],
    [P.person('#5aa0ff', '#fff', 'wave'), 'waving shopkeeper with a blue shirt and white cap', true],
    [P.person('#5aa0ff', '#d9a066', 'wave'), 'waving farmer with a blue shirt and brown cap', true],
    [P.person(C.yellow, '#222', 'down'), 'person in a yellow shirt with a dark cap', true],
    [P.person(C.yellow, C.red, 'down'), 'parade marshal in a yellow shirt with a red cap', true],
  ],
  grandpa: [[P.grandpa(), 'grandpa with a blue nightcap and a white beard', true]],
  band: [[P.band(), 'marching musician with a blue uniform and a gold instrument', true]],
} satisfies Partial<Record<keyof typeof P, SceneryFamily>>;

export const TOP_SCENERY = {
  hayTop: [[T.hayTop(), 'golden hay bale with brown bindings']],
  cone: [[T.cone(), 'orange traffic cone with a white reflective ring']],
  treeTop: [
    [T.treeTop(120), 'round green tree crown'], [T.treeTop(150), 'round green tree crown'],
    [T.treeTop(300), 'large green tree crown'], [T.treeTop(300, '#47b84f'), 'large bright green tree crown'],
  ],
  squirrelTop: [[T.squirrelTop(), 'russet squirrel with a bushy tail', true]],
  duckTop: [1, 1.5].map((s) => [T.duckTop(s), 'yellow duck with an orange bill', true]),
  puddle: [960, 1920].map((width) => [T.puddle(width * 0.42, 220), 'oval blue pond with a pale blue reflection']),
} satisfies Partial<Record<keyof typeof T, SceneryFamily>>;

export function addRaceRunShapes(add: (view: View, part: string, shape: SceneryShape) => void): void {
  for (const [view, families] of [['side', SIDE_SCENERY], ['top', TOP_SCENERY]] as const) {
    for (const [part, shapes] of Object.entries(families)) {
      for (const shape of shapes) add(part === 'hayTop' ? 'top' : view, part, shape);
    }
  }
}
