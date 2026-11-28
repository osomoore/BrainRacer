/**
 * Race Shop aspects and variants.
 * FROZEN by the orchestrator: aspect ids/order, variant ids, names, starters (art and content both key on them).
 * The Race Shop content package owns `stats`, `tags` and `note` (fill them in; propose id/name changes in its report).
 * Starred (*) = starters; the first starter of each aspect is in the default model.
 * Stat ids: see stats.ts. Default model stats: speed 3, power 3, handling 3, mudGrip 1, snowGrip 1, toughness 2,
 * load 3, weight 4, height 3, width 3, clearance 2, range 3, push 1, noise 3, bounce 2.
 */
import type { AspectDef, StatId, Variant } from '../../core/types';

export const RACE_ASPECTS: readonly AspectDef[] = [
  { id: 'wheels', label: 'Wheels', starters: ['wheels.road', 'wheels.mud'], visibleFromTop: true },
  { id: 'engine', label: 'Engine', starters: ['engine.small', 'engine.big'], visibleFromTop: true },
  { id: 'gears', label: 'Gears', starters: ['gears.easy', 'gears.speedy'], visibleFromTop: false },
  { id: 'springs', label: 'Springs', starters: ['springs.soft', 'springs.sport'], visibleFromTop: false },
  { id: 'bumpers', label: 'Bumper', starters: ['bumpers.small', 'bumpers.big'], visibleFromTop: true },
  { id: 'paint', label: 'Paint', starters: ['paint.blue', 'paint.yellow'], visibleFromTop: true },
  { id: 'body', label: 'Body', starters: ['body.car', 'body.truck'], visibleFromTop: true },
  { id: 'shape', label: 'Shape', starters: ['shape.boxy', 'shape.round'], visibleFromTop: true },
  { id: 'size', label: 'Size', starters: ['size.medium', 'size.small'], visibleFromTop: true },
  { id: 'extra', label: 'Extra', starters: ['extra.roofRack', 'extra.rocket'], visibleFromTop: true },
];

type Stats = Partial<Record<StatId, number>>;
const v = (id: string, name: string, stats: Stats, tags: readonly string[], note: string): Variant =>
  ({ id, aspect: id.split('.')[0], name, stats, tags, note });

export const RACE_VARIANTS: readonly Variant[] = [
  // wheels: road*, mud*, then racing, snow, monster
  v('wheels.road', 'Road Tires', {}, [], 'Plain all-round tires (default).'),
  v('wheels.mud', 'Mud Tires', { mudGrip: 3, snowGrip: 1, speed: -1 }, [], 'Chunky tread: mud grip, a bit slower.'),
  v('wheels.racing', 'Racing Tires', { speed: 2, handling: 2, mudGrip: -1, snowGrip: -1 }, [],
    'Fast and grippy on roads; slip in mud and snow.'),
  v('wheels.snow', 'Snow Tires', { snowGrip: 4, mudGrip: 1, speed: -1 }, [], 'Snow and ice grip.'),
  v('wheels.monster', 'Monster Wheels',
    { height: 2, clearance: 3, mudGrip: 3, snowGrip: 1, toughness: 2, bounce: 1, push: 1, noise: 1, handling: -2, speed: -1, weight: 1, width: 1 },
    [], 'Huge wheels: rocks, mud, clearance; tall, wide, clumsy in turns.'),
  // engine: small*, big*, then efficient (long trips), turbo (very fast, heavy), electric (quiet, light)
  v('engine.small', 'Small Engine', {}, [], 'Small, plain engine (default).'),
  v('engine.big', 'Big Engine', { power: 3, speed: 1, push: 1, weight: 1, range: -1, noise: 2 }, [],
    'Hills and heavy loads; heavier, loud, thirsty.'),
  v('engine.efficient', 'Efficient Engine', { range: 4, noise: -1, power: -1 }, [], 'Long trips; a little weaker.'),
  v('engine.turbo', 'Turbo Engine', { speed: 3, power: 2, push: 1, weight: 1, range: -2, noise: 3 }, [],
    'Very fast and strong; heavy, loud, short range.'),
  v('engine.electric', 'Electric Motor', { power: 1, speed: 1, range: 1, weight: -1, noise: -3 }, [],
    'Whisper quiet and light (sleepy town).'),
  // gears: easy*, speedy*, then climbing (power), fourByFour (mud/snow/hill grip)
  v('gears.easy', 'Easy Gears', {}, [], 'Plain gears (default).'),
  v('gears.speedy', 'Speed Gears', { speed: 2, power: -1 }, [], 'More speed, less pulling power.'),
  v('gears.climbing', 'Climbing Gears', { power: 3, speed: -1 }, [], 'Low gears: power for hills; slower.'),
  v('gears.fourByFour', '4x4 Drive', { mudGrip: 2, snowGrip: 2, power: 1, weight: 1, range: -1 }, [],
    'All four wheels pull: mud and snow grip.'),
  // springs (suspension): soft*, sport* (turns), then lifted (tall, rocks), bouncy (jumps)
  v('springs.soft', 'Soft Springs', {}, [], 'Plain comfy springs (default).'),
  v('springs.sport', 'Sport Springs', { handling: 3, clearance: -1, bounce: -1 }, [], 'Stiff and low: sharp turns.'),
  v('springs.lifted', 'Lift Kit', { height: 2, clearance: 3, bounce: 1, handling: -1 }, [],
    'Raises the car: rocks; taller.'),
  v('springs.bouncy', 'Bouncy Springs', { bounce: 3, toughness: 1, handling: -1 }, [], 'Soft landings after jumps.'),
  // bumpers: small*, big*, then rubber (bounce off), pusher (push things)
  v('bumpers.small', 'Small Bumpers', {}, [], 'Plain bumpers (default).'),
  v('bumpers.big', 'Big Bumpers', { toughness: 2, push: 1, weight: 1 }, [], 'Tougher; a bit heavier.'),
  v('bumpers.rubber', 'Rubber Bumpers', { toughness: 3, bounce: 1 }, [], 'Bonk-proof rubber: toughest.'),
  v('bumpers.pusher', 'Push Bumper', { push: 4, toughness: 1, weight: 1, speed: -1 }, [], 'Bulldozer plate: pushes logs.'),
  // paint: blue*, yellow* (bright), then red (bright), green, black (dark), rainbow (bright)
  v('paint.blue', 'Blue', {}, ['color:blue'], 'Default color; not bright, not dark.'),
  v('paint.yellow', 'Bright Yellow', {}, ['color:yellow', 'bright'], 'Bright: seen in the fog.'),
  v('paint.red', 'Fire Red', {}, ['color:red', 'bright'], 'Bright; red parade.'),
  v('paint.green', 'Leaf Green', {}, ['color:green'], 'Green garden parade.'),
  v('paint.black', 'Night Black', {}, ['color:black', 'dark'], 'Dark: hides at night.'),
  v('paint.rainbow', 'Rainbow', {}, ['color:rainbow', 'bright'], 'Bright; every-color parade.'),
  // body type: car*, truck* (carries loads), then sports (fast, low), van (big load, tall), jeep (rough ground)
  v('body.car', 'Car', {}, [], 'Plain car (default).'),
  v('body.truck', 'Pickup Truck',
    { load: 3, power: 1, push: 1, clearance: 1, toughness: 1, height: 1, weight: 1, speed: -1 }, [],
    'Cargo bed: loads; heavier, taller.'),
  v('body.sports', 'Sports Car', { speed: 2, handling: 1, load: -1, height: -1, clearance: -1, weight: -1 }, [],
    'Fast and low; little room.'),
  v('body.van', 'Van', { load: 4, height: 2, weight: 2, width: 1, power: 1, speed: -1, handling: -1, range: -1 }, [],
    'Most cargo; tall, wide, heavy.'),
  v('body.jeep', 'Jeep', { clearance: 2, toughness: 2, mudGrip: 1, snowGrip: 1, power: 1, load: 1, height: 1 }, [],
    'Rough ground: rocks, mud, snow, a little cargo.'),
  // body shape: boxy*, round*, then sleek (fast), wedge (low, pushes)
  v('shape.boxy', 'Boxy', {}, [], 'Plain box (default).'),
  v('shape.round', 'Round', { bounce: 1, toughness: 1, load: -1 }, [], 'Bubbly: bounces, shrugs off bumps; less room.'),
  v('shape.sleek', 'Sleek', { speed: 2, range: 1, height: -1, width: -1, load: -1 }, [], 'Smooth: fast, low, slim, efficient.'),
  v('shape.wedge', 'Wedge', { push: 2, speed: 1, height: -1, clearance: -1, load: -1 }, [], 'Low pointy nose: pushes logs.'),
  // size: medium*, small*, then big, tiny
  v('size.medium', 'Medium', {}, [], 'Default size.'),
  v('size.small', 'Small', { width: -1, height: -1, weight: -1, load: -1, handling: 1, range: 1 }, [],
    'Narrower, shorter, lighter; less room.'),
  v('size.big', 'Big', { width: 2, height: 1, weight: 2, load: 2, toughness: 1, push: 1, handling: -1, range: -1 }, [],
    'Roomy and tough; wide, tall, heavy.'),
  v('size.tiny', 'Tiny',
    { width: -2, height: -2, weight: -2, load: -2, handling: 2, range: 2, power: -1, toughness: -1 }, [],
    'Squeezes anywhere; almost no room, weaker.'),
  // extras: roofRack* (carry), rocket* (speed burst), then river, turn, pull, light and cooling parts
  v('extra.roofRack', 'Roof Rack', { load: 2, height: 1 }, ['roofRack'], 'Extra cargo on top (default); adds height.'),
  v('extra.rocket', 'Rocket Booster', { speed: 3, noise: 3, range: -1 }, ['rocket'], 'Speed burst for jumps; loud.'),
  v('extra.floats', 'Floaties', { width: 1, speed: -1 }, ['canFloat'], 'Floats across deep rivers.'),
  v('extra.spoiler', 'Big Spoiler', { handling: 2, speed: 1 }, ['spoiler'], 'Presses the car down: turns.'),
  v('extra.snorkel', 'Snorkel', { height: 1 }, ['snorkel'], 'Breathes in deep water (stream crossing).'),
  v('extra.winch', 'Winch', { weight: 1, push: 1 }, ['winch'], 'Pulls stuck friends out of the mud.'),
  v('extra.rallyLights', 'Rally Lights', {}, ['glow'], 'Lights up dark roads.'),
  v('extra.radiator', 'Radiator', {}, ['cooling'], 'Keeps the car cool in the heat.'),
];
