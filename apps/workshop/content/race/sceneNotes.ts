/**
 * Notes for the run animator (runs package): what each scenario's scene looks like and the funny success / failure
 * for each facet. Kid-safe: crashes are silly bounces, nothing breaks for real.
 * Facet levels size the scene (deeper mud, lower bridge, wider gap...): see scenarios.ts.
 */
import type { FacetId, ScenarioId } from '../../core/types';

export interface SceneNote {
  scene: string;
  success: Record<FacetId, string>;
  failure: Record<FacetId, string>;
}

export const RACE_SCENE_NOTES: Record<ScenarioId, SceneNote> = {
  mud: {
    scene: 'Side view. Farm road with a red barn and fence; a brown mud patch whose depth grows with mud.grip level (1 puddle, 2 knee-deep, 3 swamp with bubbles). mud.pull: a small green tractor is stuck in the middle, axle-deep, a farmer waving.',
    success: {
      'mud.grip': 'Car churns through, mud flies from the wheels in brown arcs, it pops out the far side splattered and shakes like a wet dog.',
      'mud.pull': 'Car parks on firm ground, the winch cable hooks the tractor, it pops out with a big "schlurp" and the farmer throws his hat up.',
    },
    failure: {
      'mud.grip': 'Wheels spin, mud sprays everywhere, the car sinks slowly to the doors; a little frog hops onto the hood and blinks.',
      'mud.pull': 'Car pushes its nose against the tractor and slides; nothing to grab with. (Level 2 with a winch but weak power: cable goes tight, the car is pulled backwards into the mud instead.)',
    },
  },
  jump: {
    scene: 'Side view. A wooden ramp at the end of a road, a gap (canyon with a stream far below, flags on both sides), landing pad on the far side. Gap width grows with jump.speed level; jump.landing level raises the ramp so the drop is higher.',
    success: {
      'jump.speed': 'Car zooms up the ramp, flies in a big arc with a speed trail, lands on the far side; flags wave.',
      'jump.landing': 'Car lands, springs squash and boing gently twice, and it rolls on smiling.',
    },
    failure: {
      'jump.speed': 'Car leaves the ramp too slow, flies a short arc, and lands softly in a giant haystack / net halfway down, bouncing like on a trampoline.',
      'jump.landing': 'Car lands with a big thud: wheels splay out flat like a cartoon, it boings up into the air, spins once, and settles dizzy with stars circling.',
    },
  },
  turn: {
    scene: 'Top view. A race track with sharp corners lined with hay bales and cones; more and tighter corners per turn.handling level (1 one sharp corner, 2 zigzag, 3 hairpins).',
    success: {
      'turn.handling': 'Car zips around every corner on the line, little skid marks, a checkered flag at the end.',
    },
    failure: {
      'turn.handling': 'Car takes the corner too wide, slides sideways into the hay bales with a soft poof; hay rains down and a straw sticks out of the window.',
    },
  },
  hill: {
    scene: 'Side view. A grassy hill with a picnic at the top; slope steepness grows with hill.power level (3: almost a wall, with a flag at the top).',
    success: {
      'hill.power': 'Car chugs steadily up, little exhaust puffs, reaches the top and does a happy hop by the picnic blanket.',
    },
    failure: {
      'hill.power': 'Car slows halfway, wheels spin, it rolls gently backwards to the bottom and bumps into a hay bale; a sheep watches and chews.',
    },
  },
  fog: {
    scene: 'Side view (top also possible). A pond road in thick gray fog; a mother duck and three ducklings wait at the edge to cross. Bright cars glow through the fog, dull ones are barely visible.',
    success: {
      'fog.bright': 'Bright car rolls up and stops; ducks see it, quack, and waddle across in a line; the car toots and drives on.',
    },
    failure: {
      'fog.bright': 'Dull car fades into the fog; the ducks do not see it and keep waiting. The car honks, honks again (little note puffs), nobody moves; a duckling falls asleep. Car never gets past.',
    },
  },
  lowBridge: {
    scene: 'Side view. An old stone arch bridge over the road; the gap under it shrinks with lowBridge.height level. A pigeon sits on top.',
    success: {
      'lowBridge.height': 'Car slides under with a hair of room to spare; the pigeon peeks down and coos.',
    },
    failure: {
      'lowBridge.height': 'Roof (or roof rack, snorkel...) bonks the bridge; the car bounces back like rubber, stops, and the pigeon flutters up and lands on the roof.',
    },
  },
  narrow: {
    scene: 'Top view. A forest path / alley squeezing between two tall trees (or brick walls); the gap narrows with narrow.width level.',
    success: {
      'narrow.width': 'Car slips straight through the gap; leaves rustle; a squirrel gives a thumbs up.',
    },
    failure: {
      'narrow.width': 'Car wedges in between the trees, wiggles left and right, then pops backwards out like a cork; a few leaves float down onto it.',
    },
  },
  delivery: {
    scene: 'Side view. A loading dock with a stack of boxes (more boxes per delivery.load level; level 2 watermelons). delivery.power: a steep loading ramp up to the store.',
    success: {
      'delivery.load': 'Boxes plop into the car one by one, all fit, the car drives off and the shopkeeper waves.',
      'delivery.power': 'Loaded car chugs up the loading ramp and parks at the door.',
    },
    failure: {
      'delivery.load': 'Boxes stack higher and higher on the car until the tower wobbles and boxes tumble off around it (soft boxes, they bounce); some are left behind.',
      'delivery.power': 'Loaded car strains on the ramp, slowly rolls back down, and bumps gently into the box pile.',
    },
  },
  snow: {
    scene: 'Side view. A snowy mountain pass with pine trees and a snowman; snow depth / ice patches grow with snow.grip level.',
    success: {
      'snow.grip': 'Car grips and rolls steadily through, snow puffs behind; the snowman smiles.',
    },
    failure: {
      'snow.grip': 'Wheels spin on the ice, the car slides sideways, does a slow spin and plops nose-first into a snowbank; the snowman hat lands on the roof.',
    },
  },
  rocks: {
    scene: 'Side view. A forest trail with rocks (bigger and more per rocks.tough level), boulders with a high middle (rocks.clearance), and a fallen log across the road (rocks.log; level 2 a big trunk / log pile).',
    success: {
      'rocks.tough': 'Car bonks over the rocks, bouncing happily, no dents, and keeps going.',
      'rocks.clearance': 'Car rolls over the boulders, its belly passing high above them.',
      'rocks.log': 'Car pushes the log; it rolls off the trail and a squirrel rides it away.',
    },
    failure: {
      'rocks.tough': 'Car bonks a rock, wobbles, a hubcap pops off and rolls away; the car stops and a bandage appears on the bumper.',
      'rocks.clearance': 'Car drives up onto a boulder and gets stuck on its belly, wheels spinning in the air like a turtle.',
      'rocks.log': 'Car pushes, the log does not budge; the car squishes against it and slides back with a boing.',
    },
  },
  river: {
    scene: 'Side view. river.cross level 1: a deep stream, water up to the windows, fish swimming. Level 2: a wide deep river with lily pads and a turtle on a rock.',
    success: {
      'river.cross': 'Level 1: car drives under water, the snorkel blows bubbles, it comes out dripping with a fish on the roof that hops back in. Level 2: floaties puff up, the car bobs across like a duck, the turtle waves.',
    },
    failure: {
      'river.cross': 'Level 1: car rolls in, engine goes glug-glug and bubbles, the car stops and a fish peeks in the window. Level 2: car drives in and sinks to the roof, just the roof sticking out; a frog sits on it. (Both: tow rope pulls it back out.)',
    },
  },
  wobbly: {
    scene: 'Side view. An old wooden (level 2: rope; level 3: stick) bridge over a gentle creek; it sways more per wobbly.weight level.',
    success: {
      'wobbly.weight': 'Light car tiptoes across, the bridge wobbles just a little, birds keep sitting on the rope.',
    },
    failure: {
      'wobbly.weight': 'Bridge sags lower and lower with a long creak until the car slides gently down into the shallow creek with a splash, sitting in water up to the wheels; a duck paddles past.',
    },
  },
  beach: {
    scene: 'Side view. A long road with mile signs and a gas pump, the beach with an umbrella far away; distance grows with beach.range level. beach.load: a pile of beach toys, towels and an umbrella by the house.',
    success: {
      'beach.range': 'Car cruises past sign after sign and parks on the sand; a crab pinches the flag on the antenna playfully.',
      'beach.load': 'All the beach toys fit; car arrives and the toys spill out onto the sand.',
    },
    failure: {
      'beach.range': 'Car sputters to a stop halfway, fuel needle on E; a seagull lands on it and the beach is still far away.',
      'beach.load': 'Car drives off but the bucket, shovel and umbrella fall off the back and roll down the road.',
    },
  },
  parade: {
    scene: 'Side view (top possible). A street parade with balloons and bunting in the target color (red balloons, green garden floats, or rainbow streamers); a band plays; a slot waits in the parade line.',
    success: {
      'parade.color': 'Car joins the parade line, matching the balloons; confetti falls and the crowd cheers.',
    },
    failure: {
      'parade.color': 'Car rolls up; the marshal holds up a color card, shakes head, and the car is waved to the side; a balloon floats away.',
    },
  },
  night: {
    scene: 'Side view. A sleepy town at night: moon, lit windows, a sleeping puppy on a porch and a baby stroller; for night.hide, kids play hide-and-seek with a flashlight.',
    success: {
      'night.quiet': 'Car glides past with tiny "zzz" puffs from the windows; nobody wakes up.',
      'night.hide': 'The seeker sweeps the flashlight right past the dark car and walks on scratching his head.',
    },
    failure: {
      'night.quiet': 'Car roars past; windows light up one by one, the puppy pops awake with ears straight up, a sleepy grandpa opens a window in a nightcap.',
      'night.hide': 'The flashlight finds the car instantly; it shines like a lamp, and the seeker shouts and points.',
    },
  },
};
