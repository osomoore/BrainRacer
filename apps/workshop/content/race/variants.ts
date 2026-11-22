/**
 * Race Shop aspects and variants.
 * FROZEN by the orchestrator: aspect ids/order, variant ids, names, starters (art and content both key on them).
 * The Race Shop content package owns `stats`, `tags` and `note` (fill them in; propose id/name changes in its report).
 * Starred (*) = starters; the first starter of each aspect is in the default model.
 */
import type { AspectDef, Variant } from '../../core/types';

export const RACE_ASPECTS: readonly AspectDef[] = [
  { id: 'wheels', label: 'Wheels', starters: ['wheels.road', 'wheels.mud'], visibleFromTop: true },
  { id: 'engine', label: 'Engine', starters: ['engine.small', 'engine.big'], visibleFromTop: true },
  { id: 'gears', label: 'Gears', starters: ['gears.easy', 'gears.speedy'], visibleFromTop: false },
  { id: 'springs', label: 'Springs', starters: ['springs.soft', 'springs.sport'], visibleFromTop: false },
  { id: 'bumpers', label: 'Bumpers', starters: ['bumpers.small', 'bumpers.big'], visibleFromTop: true },
  { id: 'paint', label: 'Paint', starters: ['paint.blue', 'paint.yellow'], visibleFromTop: true },
  { id: 'body', label: 'Body', starters: ['body.car', 'body.truck'], visibleFromTop: true },
  { id: 'shape', label: 'Shape', starters: ['shape.boxy', 'shape.round'], visibleFromTop: true },
  { id: 'size', label: 'Size', starters: ['size.medium', 'size.small'], visibleFromTop: true },
  { id: 'extra', label: 'Extras', starters: ['extra.roofRack', 'extra.rocket'], visibleFromTop: true },
];

const v = (id: string, name: string): Variant => ({ id, aspect: id.split('.')[0], name, stats: {}, tags: [], note: '' });

export const RACE_VARIANTS: readonly Variant[] = [
  // wheels: road*, mud*, then racing, snow, monster
  v('wheels.road', 'Road Tires'), v('wheels.mud', 'Mud Tires'), v('wheels.racing', 'Racing Tires'),
  v('wheels.snow', 'Snow Tires'), v('wheels.monster', 'Monster Wheels'),
  // engine: small*, big*, then efficient (long trips), turbo (very fast, heavy), electric (quiet, light)
  v('engine.small', 'Small Engine'), v('engine.big', 'Big Engine'), v('engine.efficient', 'Efficient Engine'),
  v('engine.turbo', 'Turbo Engine'), v('engine.electric', 'Electric Motor'),
  // gears: easy*, speedy*, then climbing (power), fourByFour (mud/snow/hill grip)
  v('gears.easy', 'Easy Gears'), v('gears.speedy', 'Speed Gears'), v('gears.climbing', 'Climbing Gears'),
  v('gears.fourByFour', '4x4 Drive'),
  // springs (suspension): soft*, sport* (turns), then lifted (tall, rocks), bouncy (jumps)
  v('springs.soft', 'Soft Springs'), v('springs.sport', 'Sport Springs'), v('springs.lifted', 'Lift Kit'),
  v('springs.bouncy', 'Bouncy Springs'),
  // bumpers: small*, big*, then rubber (bounce off), pusher (push things)
  v('bumpers.small', 'Small Bumpers'), v('bumpers.big', 'Big Bumpers'), v('bumpers.rubber', 'Rubber Bumpers'),
  v('bumpers.pusher', 'Push Bumper'),
  // paint: blue*, yellow* (bright), then red (bright), green, black (dark), rainbow (bright)
  v('paint.blue', 'Blue'), v('paint.yellow', 'Bright Yellow'), v('paint.red', 'Fire Red'),
  v('paint.green', 'Leaf Green'), v('paint.black', 'Night Black'), v('paint.rainbow', 'Rainbow'),
  // body type: car*, truck* (carries loads), then sports (fast, low), van (big load, tall), jeep (rough ground)
  v('body.car', 'Car'), v('body.truck', 'Pickup Truck'), v('body.sports', 'Sports Car'),
  v('body.van', 'Van'), v('body.jeep', 'Jeep'),
  // body shape: boxy*, round*, then sleek (fast), wedge (low, pushes)
  v('shape.boxy', 'Boxy'), v('shape.round', 'Round'), v('shape.sleek', 'Sleek'), v('shape.wedge', 'Wedge'),
  // size: medium*, small*, then big, tiny
  v('size.medium', 'Medium'), v('size.small', 'Small'), v('size.big', 'Big'), v('size.tiny', 'Tiny'),
  // extras: roofRack* (carry), rocket* (speed burst), then floats (rivers), spoiler (turns), snorkel (deep water), winch (pull)
  v('extra.roofRack', 'Roof Rack'), v('extra.rocket', 'Rocket Booster'), v('extra.floats', 'Floaties'),
  v('extra.spoiler', 'Big Spoiler'), v('extra.snorkel', 'Snorkel'), v('extra.winch', 'Winch'),
];
