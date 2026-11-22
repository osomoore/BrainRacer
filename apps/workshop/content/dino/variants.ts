/**
 * Dino Lab aspects and variants.
 * FROZEN by the orchestrator: aspect ids/order, variant ids, names, starters (art and content both key on them).
 * The Dino Lab content package owns `stats`, `tags` and `note` (fill them in; propose id/name changes in its report).
 * The first starter of each aspect is in the default model.
 * A T-Rex must be buildable late: head.rex + teeth.mega + claws.tinyArms + legs.powerful + move.stand + tail.heavy + size.big/huge.
 */
import type { AspectDef, Variant } from '../../core/types';

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
  { id: 'extra', label: 'Extras', starters: ['extra.feathers', 'extra.frill'], visibleFromTop: true },
];

const v = (id: string, name: string): Variant => ({ id, aspect: id.split('.')[0], name, stats: {}, tags: [], note: '' });

export const DINO_VARIANTS: readonly Variant[] = [
  // color (skin): orange*, green* (hides in ferns/forest), then sandy (desert), blue (water), purple, spotted (dappled shade)
  v('color.orange', 'Orange'), v('color.green', 'Green'), v('color.sandy', 'Sandy Brown'),
  v('color.blue', 'Sky Blue'), v('color.purple', 'Purple'), v('color.spotted', 'Spotty'),
  // head: round*, horned* (push, strong), then longNeck (reach high), crest (loud honk), rex (big T-Rex head)
  v('head.round', 'Round Head'), v('head.horned', 'Horn Head'), v('head.longNeck', 'Long Neck'),
  v('head.crest', 'Crest Head'), v('head.rex', 'Rex Head'),
  // teeth: flat* (plants), big* (gulp critters), then sharp, beak (crack nuts/shells), mega (T-Rex)
  v('teeth.flat', 'Flat Teeth'), v('teeth.big', 'Big Teeth'), v('teeth.sharp', 'Sharp Teeth'),
  v('teeth.beak', 'Beak'), v('teeth.mega', 'Mega Teeth'),
  // claws/arms: small*, hooks* (climb), then digging, grabby hands (grab/reach), tinyArms (T-Rex)
  v('claws.small', 'Little Claws'), v('claws.hooks', 'Hook Claws'), v('claws.digging', 'Digging Claws'),
  v('claws.grabby', 'Grabby Hands'), v('claws.tinyArms', 'Tiny Arms'),
  // legs: short*, long* (jump, run, reach), then powerful (fast, strong), hoppy (big jumps), flippers (swim)
  v('legs.short', 'Short Legs'), v('legs.long', 'Long Legs'), v('legs.powerful', 'Powerful Legs'),
  v('legs.hoppy', 'Hoppy Legs'), v('legs.flippers', 'Flippers'),
  // movement: crawl* (low, sneaky), stand* (tall, see over things), then fly (wings), swim
  v('move.crawl', 'Crawling'), v('move.stand', 'Standing'), v('move.fly', 'Flying'), v('move.swim', 'Swimming'),
  // tail: short*, long* (balance), then heavy (strong, slow), spiked (protect), paddle (swim)
  v('tail.short', 'Short Tail'), v('tail.long', 'Long Tail'), v('tail.heavy', 'Heavy Tail'),
  v('tail.spiked', 'Spiked Tail'), v('tail.paddle', 'Paddle Tail'),
  // body: round*, slim* (fast, squeeze), then armored (tough, slow), sail (back sail), belly (big belly, strong)
  v('body.round', 'Round Body'), v('body.slim', 'Slim Body'), v('body.armored', 'Armor Plates'),
  v('body.sail', 'Back Sail'), v('body.belly', 'Big Belly'),
  // size: medium*, small* (fits small holes, hides), then big, huge
  v('size.medium', 'Medium'), v('size.small', 'Small'), v('size.big', 'Big'), v('size.huge', 'Huge'),
  // extras: feathers*, frill*, then glow (glowing spots, dark caves), camo (leaf pattern, hides), stripes (tall grass)
  v('extra.feathers', 'Feathers'), v('extra.frill', 'Neck Frill'), v('extra.glow', 'Glow Spots'),
  v('extra.camo', 'Leaf Pattern'), v('extra.stripes', 'Tiger Stripes'),
];
