/**
 * Dino Lab aspects and variants.
 * FROZEN by the orchestrator: aspect ids/order, variant ids, names, starters (art and content both key on them).
 * The Dino Lab content package owns `stats`, `tags` and `note` (fill them in; propose id/name changes in its report).
 * The first starter of each aspect is in the default model.
 * A T-Rex must be buildable late: head.rex + teeth.mega + claws.tinyArms + legs.powerful + move.stand + tail.heavy + size.big/huge.
 *
 * Stats are additive on top of DINO_STATS bases (see stats.ts). Tradeoffs: big things are strong but easy to spot,
 * armor is tough but slow, a long neck reaches high but sticks out, feathers keep warm but are hot in the desert.
 */
import type { AspectDef, StatId, Variant } from '../../core/types';

export const DINO_ASPECTS: readonly AspectDef[] = [
  { id: 'color', label: 'Color', starters: ['color.orange', 'color.green'], visibleFromTop: true },
  { id: 'head', label: 'Head', starters: ['head.round', 'head.horned'], visibleFromTop: true },
  { id: 'teeth', label: 'Teeth', starters: ['teeth.flat', 'teeth.big'], visibleFromTop: false },
  { id: 'claws', label: 'Claws', starters: ['claws.small', 'claws.hooks'], visibleFromTop: true },
  { id: 'legs', label: 'Legs', starters: ['legs.short', 'legs.long'], visibleFromTop: true },
  { id: 'move', label: 'Moving', starters: ['move.crawl', 'move.stand'], visibleFromTop: true },
  { id: 'tail', label: 'Tail', starters: ['tail.short', 'tail.long'], visibleFromTop: true },
  { id: 'body', label: 'Body', starters: ['body.round', 'body.slim'], visibleFromTop: true },
  { id: 'size', label: 'Size', starters: ['size.medium', 'size.small'], visibleFromTop: true },
  { id: 'extra', label: 'Extra', starters: ['extra.feathers', 'extra.frill'], visibleFromTop: true },
];

type S = Partial<Record<StatId, number>>;
const v = (id: string, name: string, stats: S, tags: string[], note: string): Variant =>
  ({ id, aspect: id.split('.')[0], name, stats, tags, note });

export const DINO_VARIANTS: readonly Variant[] = [
  // color (skin): orange*, green* (hides in ferns/forest), then sandy (desert), blue (water), purple, spotted (dappled shade)
  v('color.orange', 'Orange', {}, ['color:orange', 'bright'], 'Default skin. Bright: hides nowhere.'),
  v('color.green', 'Green', {}, ['color:green', 'camo:forest'], 'Hides in ferns and forests.'),
  v('color.sandy', 'Sandy Brown', {}, ['color:sandy', 'camo:desert'], 'Hides in the desert.'),
  v('color.blue', 'Sky Blue', {}, ['color:blue', 'camo:water'], 'Blends into rivers and lakes.'),
  v('color.purple', 'Purple', {}, ['color:purple', 'camo:flowers', 'bright'], 'Hides among purple flowers.'),
  v('color.spotted', 'Spotty', { stealth: 1 }, ['color:spotted', 'camo:forest'], 'Dappled shade: forest camo plus a little stealth.'),
  // head: round*, horned* (push, strong), then longNeck (reach high), crest (loud honk), rex (big T-Rex head)
  v('head.round', 'Round Head', {}, ['head:round'], 'Default head. Nothing special.'),
  v('head.horned', 'Horn Head', { strength: 2, crunch: 2, toughness: 1, dig: 1 }, ['head:horned', 'horns'], 'Push logs, bonk nuts open, a bit tougher.'),
  v('head.longNeck', 'Long Neck', { reach: 4, stealth: -2, strength: -1 }, ['head:longNeck', 'longNeck'], 'Reaches very high, but sticks out when hiding.'),
  v('head.crest', 'Crest Head', { loudness: 4, reach: 1, stealth: -1 }, ['head:crest'], 'Hollow crest: a loud honk.'),
  v('head.rex', 'Rex Head', { bite: 2, loudness: 5, strength: 1, reach: 1, crunch: 1 }, ['head:rex', 'rex'], 'T-Rex head: huge roar, strong jaws.'),
  // teeth: flat* (plants), big* (gulp critters), then sharp, beak (crack nuts/shells), mega (T-Rex)
  v('teeth.flat', 'Flat Teeth', { crunch: 1 }, ['diet:plants'], 'Default: munches leaves. Critters giggle and wriggle away.'),
  v('teeth.big', 'Big Teeth', { bite: 3, crunch: 2 }, ['diet:critters'], 'Catches and gulps small critters.'),
  v('teeth.sharp', 'Sharp Teeth', { bite: 5, crunch: 1 }, ['diet:critters'], 'Stronger gulp for bigger critters.'),
  v('teeth.beak', 'Beak', { bite: 1, crunch: 5 }, ['diet:plants', 'beak'], 'Cracks giant nuts and shells.'),
  v('teeth.mega', 'Mega Teeth', { bite: 7, crunch: 3, loudness: 1 }, ['diet:critters', 'rex'], 'T-Rex teeth: the biggest gulp.'),
  // claws/arms: small*, hooks* (climb), then digging, grabby hands (grab/reach), tinyArms (T-Rex)
  v('claws.small', 'Little Claws', {}, [], 'Default claws. Nothing special.'),
  v('claws.hooks', 'Hook Claws', { climb: 3, dig: 1 }, ['hooks'], 'Climbs rocks.'),
  v('claws.digging', 'Digging Claws', { dig: 4, climb: 1 }, ['digger'], 'Digs through dirt into burrows.'),
  v('claws.grabby', 'Grabby Hands', { reach: 2, climb: 4 }, ['hands'], 'Grabs high fruit and rock edges.'),
  v('claws.tinyArms', 'Tiny Arms', { reach: -1, climb: -1, speed: 1 }, ['tinyArms', 'rex'], 'T-Rex arms: light, so a little faster; useless for climbing.'),
  // legs: short*, long* (jump, run, reach), then powerful (fast, strong), hoppy (big jumps), flippers (swim)
  v('legs.short', 'Short Legs', { dig: 1 }, [], 'Default legs: slow, low jump, good for digging.'),
  v('legs.long', 'Long Legs', { speed: 2, jump: 3, reach: 1 }, [], 'Runs, jumps and reaches better.'),
  v('legs.powerful', 'Powerful Legs', { speed: 3, jump: 2, strength: 2, climb: 1 }, [], 'Fast and strong (T-Rex legs).'),
  v('legs.hoppy', 'Hoppy Legs', { jump: 5, speed: 1 }, ['hoppy'], 'Huge jumps.'),
  v('legs.flippers', 'Flippers', { swim: 4, speed: -1, jump: -1, dig: 1 }, ['flippers'], 'Swims well, waddles on land.'),
  // movement: crawl* (low, sneaky), stand* (tall, see over things), then fly (wings), swim
  v('move.crawl', 'Crawling', { stealth: 2 }, ['pose:crawl'], 'Default: low and sneaky, cannot see over grass.'),
  v('move.stand', 'Standing', { reach: 2, stealth: -1 }, ['pose:stand'], 'Stands up tall: peeks over grass, reaches higher.'),
  v('move.fly', 'Flying', { reach: 1, speed: 1, stealth: -1 }, ['canFly', 'wings'], 'Wings: flies over canyons.'),
  v('move.swim', 'Swimming', { swim: 4, speed: -1, stealth: 1 }, ['canSwim', 'pose:crawl'], 'Swims like a croc, low in the water.'),
  // tail: short*, long* (balance), then heavy (strong, slow), spiked (protect), paddle (swim)
  v('tail.short', 'Short Tail', {}, [], 'Default tail. Nothing special.'),
  v('tail.long', 'Long Tail', { jump: 1, climb: 1, speed: 1 }, [], 'Balance: a little better at jumping, climbing, running.'),
  v('tail.heavy', 'Heavy Tail', { strength: 3, toughness: 1, speed: -1 }, [], 'Strong push (T-Rex tail), a bit slower.'),
  v('tail.spiked', 'Spiked Tail', { toughness: 3, stealth: -1 }, ['spikes'], 'Tough: falling pebbles bounce off.'),
  v('tail.paddle', 'Paddle Tail', { swim: 3 }, ['paddleTail'], 'Swims faster.'),
  // body: round*, slim* (fast, squeeze), then armored (tough, slow), sail (back sail), belly (big belly, strong)
  v('body.round', 'Round Body', { warmth: 1, toughness: 1, swim: 1 }, [], 'Default: a bit warm, a bit floaty.'),
  v('body.slim', 'Slim Body', { speed: 2, jump: 1, climb: 1, stealth: 1, size: -1, warmth: -1 }, [], 'Fast and nimble, squeezes into holes, gets cold.'),
  v('body.armored', 'Armor Plates', { toughness: 4, strength: 1, speed: -2, jump: -1, climb: -1, swim: -2, stealth: -1 }, ['armor'], 'Very tough, but slow and sinks.'),
  v('body.sail', 'Back Sail', { warmth: 3, stealth: -1 }, ['sail'], 'Soaks up sun: very warm in the snow.'),
  v('body.belly', 'Big Belly', { strength: 2, size: 1, bite: 1, warmth: 2, swim: 1, loudness: 1, speed: -1 }, ['belly'], 'Room for a big gulp, strong, warm, loud burps.'),
  // size: medium*, small* (fits small holes, hides), then big, huge
  v('size.medium', 'Medium', {}, ['size:medium'], 'Default size.'),
  v('size.small', 'Small', { size: -2, stealth: 2, strength: -1, speed: 1, jump: 1, climb: 1, reach: -1 }, ['size:small'], 'Fits small holes, hides well, weaker.'),
  v('size.big', 'Big', { size: 2, strength: 2, reach: 2, toughness: 1, warmth: 1, loudness: 1, stealth: -2, jump: -1, climb: -1 }, ['size:big'], 'Strong and tall, easy to spot.'),
  v('size.huge', 'Huge', { size: 4, strength: 4, reach: 3, toughness: 2, warmth: 2, loudness: 2, bite: 1, stealth: -3, speed: -1, jump: -2, climb: -2 }, ['size:huge'], 'Very strong and tall, very easy to spot, heavy.'),
  // extras: feathers*, frill*, then glow (glowing spots, dark caves), camo (leaf pattern, hides), stripes (tall grass)
  v('extra.feathers', 'Feathers', { warmth: 3 }, ['feathers'], 'Default: warm and fluffy (too hot in the desert).'),
  v('extra.frill', 'Neck Frill', { loudness: 2, toughness: 1 }, ['frill'], 'Shakes with a loud rattle; scares off pesky birds.'),
  v('extra.glow', 'Glow Spots', {}, ['glow'], 'Lights up dark burrows.'),
  v('extra.camo', 'Leaf Pattern', { stealth: 1 }, ['camo:forest'], 'Forest camo on any skin color.'),
  v('extra.stripes', 'Tiger Stripes', { stealth: 1 }, ['camo:grass'], 'Hides in tall grass.'),
];
