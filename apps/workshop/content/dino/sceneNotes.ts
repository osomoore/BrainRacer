/**
 * Notes for the runs package: what each Dino Lab scene shows and how each facet passes or fails on screen.
 * Kid-safe: critters are gulped whole (belly bulge, burp, "nom" puff), predators are comic and wander off confused.
 * Facet params (level) size the scene: higher level = taller, wider, faster, bigger.
 */
import type { FacetId, ScenarioId } from '../../core/types';

export interface DinoSceneNote {
  scene: string;
  success: Record<FacetId, string>;
  failure: Record<FacetId, string>;
}

export const DINO_SCENE_NOTES: Record<ScenarioId, DinoSceneNote> = {
  snack: {
    scene: 'Side view, sunny clearing. A cartoon critter (level 1 beetle, 2 frog, 3 huge lizard; bigGulp: pumpkin/car-sized beetle) sits giggling on a stump. The dino walks up and snaps.',
    success: {
      'snack.bite': 'Snap, the critter vanishes in one gulp, belly bulges, a "nom" puff, then a happy burp.',
      'snack.bigGulp': 'The dino opens wide, gulps the giant beetle whole, belly balloons, it pats its tummy and lets out a huge burp that ruffles the leaves.',
    },
    failure: {
      'snack.bite': 'The soft teeth just tickle: the critter giggles, wriggles free and skips away waving. The dino blinks with an empty mouth.',
      'snack.bigGulp': 'The dino gets only the beetle\'s nose in its mouth (too small); the beetle sneezes, the dino pops backward onto its tail, the beetle rolls away laughing.',
    },
  },
  chase: {
    scene: 'TOP view, a grassy field with rocks. A lizard zigzags toward a hole on the far side; the dino chases (speed) or tiptoes up to a napping lizard (quiet).',
    success: {
      'chase.speed': 'The dino catches up before the hole and scoops the lizard up; nom puff, happy hop.',
      'chase.quiet': 'The dino creeps up without a sound; the sleepy lizard is gulped with a tiny "nom" puff and a snore bubble pops.',
    },
    failure: {
      'chase.speed': 'The lizard stays ahead, dives into its hole and pokes its tongue out; the dino skids to a stop, dust cloud, spins dizzy.',
      'chase.quiet': 'A twig snaps under the dino, the lizard\'s eyes pop open, it zips away; the dino freezes mid-tiptoe with a sheepish grin.',
    },
  },
  ferns: {
    scene: 'Side view, fern forest (level 1 thick ferns, 3 only a few thin ferns; flowers: a purple flower patch). A big goofy sniffing dino plods by, nose to the ground.',
    success: {
      'ferns.hide': 'The dino blends in; the big dino sniffs right past, scratches its head, shrugs and wanders off.',
      'ferns.flowers': 'The dino vanishes among the purple flowers; the big dino sniffs a flower, sneezes, and wanders away.',
    },
    failure: {
      'ferns.hide': 'The dino sticks out (bright skin or too big), the big dino spots it, gives a friendly lick that leaves it soggy and tagged "You\'re it!" (tag game; no danger).',
      'ferns.flowers': 'The dino stands out against the flowers; the big dino taps it on the head, it giggles and pops out of the patch.',
    },
  },
  ledge: {
    scene: 'Side view, rocky cliff with a ledge (level 1 low, 2 door-high, 3 house-high). A friend waves from the ledge.',
    success: {
      'ledge.jump': 'Big spring, the dino lands on the ledge with a dust puff and high-fives its friend.',
    },
    failure: {
      'ledge.jump': 'The dino jumps, misses the edge, slides down the rock face, tumbles backward onto its tail; a pebble bonks it on the head.',
    },
  },
  burrow: {
    scene: 'Side view, grassy hill with a small round hole (level 1 small, 2 cup-sized). A tiny friend peeks out. Dig: dirt piles block the door. Dark: inside is pitch black.',
    success: {
      'burrow.fit': 'The dino wiggles in with a "pop"; its tail wiggles happily, then disappears inside.',
      'burrow.dig': 'Dirt flies in a fountain; a tunnel opens and the dino trots in.',
      'burrow.dark': 'Glow spots light up the tunnel; the friends inside cheer at the cozy glow.',
    },
    failure: {
      'burrow.fit': 'The dino gets stuck halfway, legs kicking; the friend pushes it back out with a "boing", it bounces onto its bottom.',
      'burrow.dig': 'The dino paws at the dirt, makes only a tiny dent, dirt slides back, a clump lands on its nose.',
      'burrow.dark': 'It walks into the dark, eyes blinking; a soft bonk on the wall, little stars, it backs out rubbing its head.',
    },
  },
  tallGrass: {
    scene: 'Side view, a sea of tall grass (level 1 dino-height, 2 door-high, 3 house-high). The nest with eggs is somewhere in the grass. Sneak: a nosy big dino looks around.',
    success: {
      'tallGrass.peek': 'The dino rises above the grass, spots the nest, a little arrow, it trots straight to it; eggs wobble happily.',
      'tallGrass.sneak': 'Stripes blend with the grass shadows; the nosy dino looks right at it, sees only grass, and walks off.',
    },
    failure: {
      'tallGrass.peek': 'The dino cannot see over the grass and wanders in circles; a question mark pops above it as it ends up where it started.',
      'tallGrass.sneak': 'The dino stands out in the grass; the nosy dino points, it giggles and pops up, game over.',
    },
  },
  tallTree: {
    scene: 'Side view, a tall tree with one fruit (level 1 low branch, 2 high, 3 treetop). Shake: the dino bumps the trunk.',
    success: {
      'tallTree.fruit': 'The dino stretches up and plucks the fruit; munch, happy cheeks.',
      'tallTree.shake': 'The dino shoves the trunk, the tree wobbles, the fruit drops right into its mouth.',
    },
    failure: {
      'tallTree.fruit': 'The dino stretches and hops, still short; it tumbles backward onto its tail and the fruit drops later and bonks it on the head.',
      'tallTree.shake': 'The dino pushes, the tree does not budge; a single leaf flutters down onto its nose; it sneezes.',
    },
  },
  rocks: {
    scene: 'Side view, a pile of boulders (level 1 bumpy pile, 2 steep wall, 3 tall slippery cliff). Tough: pebbles (level 2 big rocks) tumble down while it climbs.',
    success: {
      'rocks.climb': 'The dino climbs to the top, plants its feet and enjoys the view; sparkles.',
      'rocks.tough': 'Pebbles bounce off its back, boing boing, and it keeps walking with a grin.',
    },
    failure: {
      'rocks.climb': 'Halfway up it loses grip, slides down slowly like on a slide, lands on its bottom with a puff.',
      'rocks.tough': 'The pebbles go bonk bonk; it covers its head, hops back down and waits for the rocks to stop, little stars above it.',
    },
  },
  river: {
    scene: 'Side view, a river (level 1 calm, 2 wide with waves, 3 rushing). Friends wave from the far bank. Fish: fish swim near the surface.',
    success: {
      'river.swim': 'The dino splashes in and paddles across, climbs out and shakes off water like a dog.',
      'river.fish': 'Blue skin blends in; a fish swims right up and the dino gulps it whole, nom puff and a bubbly burp.',
    },
    failure: {
      'river.swim': 'The dino sinks to its eyes, blows bubbles, the current carries it gently back to the start bank where it plops out dripping.',
      'river.fish': 'The fish see the dino, make a face and swim away in a zigzag; the dino gets a splash in the face.',
    },
  },
  canyon: {
    scene: 'Side view, a deep canyon with a broken bridge (level 1 narrow, 2 wide and windy, 3 the widest). Friends wait on the far cliff.',
    success: {
      'canyon.fly': 'The dino flaps across and lands with a little hop on the far cliff.',
    },
    failure: {
      'canyon.fly': 'Without wings it flaps its arms at the edge and steps back. Too heavy: it flaps across halfway, gets tired, and floats back down onto a big soft bush on the start side (never falls into the canyon).',
    },
  },
  nut: {
    scene: 'Side view, a giant nut on the ground (level 1 hard nut, 2 coconut, 3 rock-hard giant nut).',
    success: {
      'nut.crack': 'CRACK: the shell splits, the treat pops out and the dino munches happily.',
    },
    failure: {
      'nut.crack': 'The dino bites, its teeth go "boing"; it tries a head bonk, sees stars, the nut rolls away unharmed.',
    },
  },
  log: {
    scene: 'Side view, a forest path blocked by a log (level 1 small log, 2 thick heavy log, 3 bus-sized log). Friends wait behind it.',
    success: {
      'log.push': 'The dino leans in, the log rolls off the path and down a little slope; friends cheer and run past.',
    },
    failure: {
      'log.push': 'The dino pushes and pushes, feet sliding in place, the log does not move; it flops over panting, the log wobbles once.',
    },
  },
  snow: {
    scene: 'Side view, a snowy mountain path (warm level 1 snowy, 2 blizzard). Slope: an icy hill (level 2 steep ice wall).',
    success: {
      'snow.warm': 'The dino strolls through the snow, cozy and smiling; snowflakes land on it and melt.',
      'snow.slope': 'The dino grips the ice and climbs up step by step; plants a happy pose at the top.',
    },
    failure: {
      'snow.warm': 'The dino shivers, teeth chatter, icicle on its nose; it turns around and hurries back to the warm start.',
      'snow.slope': 'It slips on the ice, slides back down on its belly like a sled, spins to a stop in a snow pile.',
    },
  },
  birds: {
    scene: 'Side view, the dino\'s nest in a tree or on a rock, pesky birds pecking at it (level 1 a few, 2 a flock, 3 a huge flock). The dino honks, rattles or ROARs (ROAR is allowed on screen).',
    success: {
      'birds.roar': 'Big ROAR / honk wave; the birds flutter away in a puff of feathers, the nest is safe, the dino puffs its chest.',
    },
    failure: {
      'birds.roar': 'The dino makes a tiny squeak; the birds look at each other, laugh, and one lands on its head.',
    },
  },
  desert: {
    scene: 'Side view, hot sand dunes with a big sun (hide level 1 dunes, 3 flat open sand; a big sniffing dino walks past). Cool: wavy heat lines (level 2 hottest).',
    success: {
      'desert.hide': 'The dino blends into the sand; the big sniffing dino walks right past, shrugs and wanders off.',
      'desert.cool': 'The dino strolls across the hot sand, relaxed, sunglasses glint.',
    },
    failure: {
      'desert.hide': 'The dino stands out on the sand; the big dino spots it, giggles and taps it "found you".',
      'desert.cool': 'The dino gets too hot, red face, tongue out, hops from foot to foot and runs back to a shady palm tree.',
    },
  },
};
