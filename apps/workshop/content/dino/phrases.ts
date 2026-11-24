/**
 * Dino Lab phrase banks. requirement[levelIndex] = sentences per reading level (level index = facet level - 1).
 * Easy: <= 9 words, may name the aspect. Medium: describes the task, no part names. Hard: richer words, infer the part.
 */
import type { FacetPhrases, ReadingLevel, ScenarioPhrases } from '../../core/types';

type Lines = readonly string[];
type Tri = readonly [easy: Lines, medium: Lines, hard: Lines];
const tri = ([easy, medium, hard]: Tri): Record<ReadingLevel, Lines> => ({ easy, medium, hard });
const fp = (facet: string, levels: Tri[], hint: Tri, vocab: string[]): FacetPhrases =>
  ({ facet, requirement: levels.map(tri), hint: tri(hint), vocab });
const sp = (scenario: string, title: string[], intro: Tri): ScenarioPhrases => ({ scenario, title, intro: tri(intro) });

export const DINO_FACET_PHRASES: readonly FacetPhrases[] = [
  // ------------------------------------------------------------------ snack
  fp('snack.bite', [
    [
      ['Your dino needs big teeth.', 'Give your dino teeth that can gulp a bug.', 'Pick teeth that can catch a beetle.'],
      ['Make a dino that can catch and gulp a beetle.', 'Build a dino that can snap up a wriggly bug for lunch.', 'Your dino must gulp down a giggly beetle.'],
      ['Design a dinosaur whose jaws can snatch a wriggling beetle.', 'Create a dinosaur equipped to catch a squirmy beetle before it escapes.', 'Your dinosaur needs jaws capable of gulping a slippery beetle.'],
    ],
    [
      ['Your dino needs strong teeth for a frog.', 'Pick teeth that can gulp a big frog.', 'Give your dino sharper teeth.'],
      ['Make a dino that can gulp a big bouncy frog.', 'Build a dino that can catch a frog before it hops away.', 'Your dino must snap up a big, slippery frog.'],
      ['Design a dinosaur with jaws powerful enough to hold a bouncy frog.', 'Equip your dinosaur to capture a large, slippery frog in one gulp.', 'Your dinosaur must seize a big frog before it springs away.'],
    ],
    [
      ['Your dino needs the biggest gulp.', 'Pick teeth that can gulp a huge lizard.', 'Give your dino very strong teeth and jaws.'],
      ['Make a dino that can gulp a huge wiggly lizard.', 'Build a dino with a giant gulp for a giant lizard.', 'Your dino must snap up a lizard as long as a bed.'],
      ['Design a dinosaur whose mighty jaws can swallow an enormous lizard whole.', 'Equip your dinosaur with a gulp powerful enough for a gigantic, wriggling lizard.', 'Your dinosaur needs formidable jaws to capture a massive, squirming lizard.'],
    ],
  ], [
    ['Try different teeth.', 'Look at the teeth station.'],
    ['Think about what your dino eats with.', 'Maybe its mouth needs to change.'],
    ["Consider whether your dinosaur's mouth is built for catching critters.", 'Leaf-munching teeth are not ideal for snatching food that wriggles.'],
  ], ['big', 'powerful', 'slippery', 'capture']),
  fp('snack.bigGulp', [
    [
      ['Make a big dino with a big gulp.', 'Your dino must be big with strong teeth.', 'Gulp a giant beetle with a big dino.'],
      ['Make a dino big enough to gulp a giant beetle.', 'Build a large dino that can swallow a beetle the size of a pumpkin.', 'Your dino must gulp a giant beetle and still have room for it.'],
      ['Design a hefty dinosaur capable of swallowing a pumpkin-sized beetle whole.', 'Create a large dinosaur whose jaws and belly can handle a gigantic beetle.', 'Your dinosaur must be big and powerful enough to gulp an enormous beetle.'],
    ],
    [
      ['Make a huge dino with the biggest teeth.', 'Your dino must be huge to gulp this.', 'Gulp a beetle as big as a car.'],
      ['Make a huge dino that can gulp a beetle as big as a car.', 'Build an enormous dino that can swallow a giant beetle in one gulp.', 'Your dino must be huge and gulp the biggest beetle ever.'],
      ['Design a colossal dinosaur that can devour a car-sized beetle in a single gulp.', 'Construct a gigantic dinosaur with jaws mighty enough for an enormous beetle.', 'Only a massive dinosaur with tremendous jaws can swallow this gigantic beetle.'],
    ],
  ], [
    ['Try bigger teeth or a bigger dino.', 'Check the teeth and the size.'],
    ['A tiny mouth cannot hold a giant snack.', 'Think about the teeth and how big your dino is.'],
    ['Consider both the strength of the jaws and the size of the body.', 'A modest dinosaur cannot accommodate an enormous meal.'],
  ], ['big', 'huge', 'powerful', 'enormous']),
  // ------------------------------------------------------------------ chase (top view)
  fp('chase.speed', [
    [
      ['Your dino must run fast.', 'Give your dino faster legs.', 'Run fast to catch the lizard.'],
      ['Make a dino that can catch a quick lizard.', 'Build a dino that runs fast enough to catch a lizard.', 'Your dino must chase a lizard across the field.'],
      ['Design a dinosaur agile enough to overtake a speedy lizard.', 'Create a swift dinosaur that can keep pace with a darting lizard.', 'Your dinosaur must accelerate quickly to catch a scurrying lizard.'],
    ],
    [
      ['Your dino must run very fast.', 'Catch a very fast lizard.', 'Give your dino legs for a fast race.'],
      ['Make a dino that can catch a lizard that zooms.', 'Build a dino fast enough to catch a racing lizard.', 'Your dino must chase down a very fast lizard.'],
      ['Design a dinosaur swift enough to overtake a zooming lizard.', 'Your dinosaur must accelerate rapidly to catch a lightning-quick lizard.', 'Create a nimble sprinter that can outrun a racing lizard.'],
    ],
    [
      ['Your dino must be super fast.', 'Catch the fastest lizard in the land.', 'Make your dino the fastest runner.'],
      ['Make a dino that can catch the fastest lizard in the world.', 'Build the fastest dino ever to catch a rocket-quick lizard.', 'Your dino must outrun a lizard that zips like the wind.'],
      ['Design an extraordinarily swift dinosaur to overtake the fastest lizard alive.', 'Your dinosaur must accelerate like lightning to catch a blurring lizard.', 'Engineer a sleek, lightweight sprinter that can outpace the quickest lizard.'],
    ],
  ], [
    ['Try different legs.', 'Look at the legs station.'],
    ['Think about how your dino runs.', 'Maybe its legs or body slow it down.'],
    ['Consider which parts make your dinosaur heavy and sluggish.', 'Lighter, longer limbs help a dinosaur accelerate.'],
  ], ['fast', 'agile', 'accelerate', 'light']),
  fp('chase.quiet', [
    [
      ['Sneak up on the lizard quietly.', 'Your dino must be small and sneaky.', 'Tiptoe close to the sleepy lizard.'],
      ['Make a dino that can sneak up on a sleepy lizard.', 'Build a dino that creeps close without waking the lizard.', 'Your dino must tiptoe up to a napping lizard.'],
      ['Design a stealthy dinosaur that can approach a dozing lizard unnoticed.', 'Your dinosaur must creep silently toward a sleeping lizard.', 'Create a dinosaur discreet enough to sneak up on a drowsy lizard.'],
    ],
    [
      ['Be very sneaky near the lizard.', 'Your dino must be super quiet.', 'Sneak up without one sound.'],
      ['Make a dino so sneaky that a jumpy lizard never notices.', 'Build a dino that can creep right up to a nervous lizard.', 'Your dino must sneak past every stick without a snap.'],
      ['Design an exceptionally stealthy dinosaur that a jittery lizard cannot detect.', 'Your dinosaur must approach a wary lizard without making a single sound.', 'Create a dinosaur so discreet that even a nervous lizard stays unaware.'],
    ],
  ], [
    ['Try a smaller dino.', 'A small dino is sneaky.'],
    ['Big dinos are easy to notice.', 'Think about how big and how loud your dino is.'],
    ['Consider which parts make your dinosaur conspicuous.', 'A bulky silhouette is difficult to conceal.'],
  ], ['small', 'conceal', 'navigate']),
  // ------------------------------------------------------------------ ferns
  fp('ferns.hide', [
    [
      ['Your dino needs green skin.', 'Pick a color that hides in ferns.', 'Hide in the green ferns.'],
      ['Make a dino that can hide in the ferns.', 'Build a dino the big sniffy dino cannot spot in the leaves.', 'Your dino must hide among the leafy ferns.'],
      ['Design a dinosaur that can conceal itself among the ferns.', 'Your dinosaur must blend into the leafy undergrowth to avoid a curious giant.', 'Create a dinosaur camouflaged well enough to vanish into the ferns.'],
    ],
    [
      ['Hide in the ferns and stay low.', 'Your dino must be green and sneaky.', 'Hide well in the ferns.'],
      ['Make a dino that hides in the ferns and stays out of sight.', 'Build a dino that blends into the ferns and is hard to see.', 'Your dino must hide in short ferns from a big sniffy dino.'],
      ['Design a dinosaur that blends into the ferns and stays inconspicuous.', 'Your dinosaur must conceal itself in sparse ferns while a giant sniffs nearby.', 'Create a camouflaged, stealthy dinosaur that disappears into the ferns.'],
    ],
    [
      ['Hide very well in the little ferns.', 'Be green, small and very sneaky.', 'Hide where the ferns are thin.'],
      ['Make a dino that can hide in a tiny patch of ferns.', 'Build a dino that stays hidden even when the big dino sniffs right next to it.', 'Your dino must vanish into a few thin ferns.'],
      ['Design a dinosaur so well camouflaged that it vanishes in a sparse patch of ferns.', 'Your dinosaur must remain concealed while an inquisitive giant sniffs inches away.', 'Create the stealthiest dinosaur possible to blend into a few slender ferns.'],
    ],
  ], [
    ['Try a different color.', 'What color are ferns?'],
    ['Think about what color the leaves are.', 'Maybe your dino stands out too much.'],
    ["Consider whether your dinosaur's skin matches its leafy surroundings.", 'Bright skin is difficult to conceal among the ferns.'],
  ], ['conceal', 'camouflage', 'small']),
  fp('ferns.flowers', [
    [
      ['Hide in the purple flowers.', 'Your dino needs purple skin.', 'Pick a color like the flowers.'],
      ['Make a dino that can hide in a patch of grape-colored flowers.', 'Build a dino that blends into the plum-colored flower field.', 'Your dino must hide among flowers that look like grape jelly.'],
      ['Design a dinosaur whose skin matches the violet blossoms so it can disappear.', 'Your dinosaur must camouflage itself among lavender flowers.', 'Create a dinosaur that blends seamlessly into a meadow of violet blossoms.'],
    ],
  ], [
    ['Try a different color.', 'Look at the flower color.'],
    ['Look at the color of the flowers.', "Your dino's skin should match the flowers."],
    ["Compare your dinosaur's skin with the blossoms around it.", 'Camouflage works best when colors match.'],
  ], ['conceal', 'camouflage']),
  // ------------------------------------------------------------------ ledge
  fp('ledge.jump', [
    [
      ['Your dino must jump up high.', 'Give your dino legs that jump.', 'Jump up onto the rock ledge.'],
      ['Make a dino that can jump up onto a rock ledge.', 'Build a dino that can hop up to its friend on the ledge.', 'Your dino must jump up to reach the ledge.'],
      ['Design a dinosaur that can leap onto a raised ledge.', 'Your dinosaur must spring upward to land on a rocky ledge.', 'Create a dinosaur with enough bounce to vault onto a ledge.'],
    ],
    [
      ['Jump onto a high ledge.', 'Your dino must jump very high.', 'Give your dino legs for big jumps.'],
      ['Make a dino that can jump onto a high ledge.', 'Build a dino that can jump up to a nest on a high rock.', 'Your dino must jump onto a ledge as high as a door.'],
      ['Design a dinosaur that can leap onto a lofty ledge.', 'Your dinosaur must launch itself onto an elevated rocky shelf.', 'Create a light, springy dinosaur that can vault onto a high ledge.'],
    ],
    [
      ['Jump onto the highest ledge.', 'Your dino must jump super high.', 'Make the best jumper ever.'],
      ['Make a dino that can jump onto a ledge as high as a house.', 'Build the best jumping dino to reach the very top ledge.', 'Your dino must jump all the way up to the highest ledge.'],
      ['Design an extraordinary leaper that can reach a towering ledge.', 'Your dinosaur must propel itself onto a ledge as tall as a house.', 'Create a lightweight, springy dinosaur capable of an enormous vertical leap.'],
    ],
  ], [
    ['Try different legs.', 'Legs help a dino jump.'],
    ['Think about what your dino jumps with.', 'Heavy parts can make jumping hard.'],
    ['Consider which limbs give your dinosaur the most spring.', 'A heavy dinosaur struggles to leave the ground.'],
  ], ['high', 'light', 'heavy', 'flexible']),
  // ------------------------------------------------------------------ burrow
  fp('burrow.fit', [
    [
      ['Your dino must be small.', 'Make a small dino for a small hole.', 'Fit into the little hole.'],
      ['Make a dino that can fit into a small burrow.', 'Build a dino that can squeeze through a little hole.', 'Your dino must fit through a tiny door into a burrow.'],
      ['Design a dinosaur compact enough to enter a narrow burrow.', 'Your dinosaur must squeeze through a cramped tunnel entrance.', 'Create a petite dinosaur that fits inside a narrow burrow.'],
    ],
    [
      ['Fit into a very tiny hole.', 'Your dino must be tiny and thin.', 'Make your dino as thin as possible.'],
      ['Make a dino that can squeeze into a super tiny hole.', 'Build a thin little dino that fits a hole as small as a cup.', 'Your dino must wiggle through the tiniest hole in the hill.'],
      ['Design an exceptionally slender, compact dinosaur for a very narrow tunnel.', 'Your dinosaur must squeeze through an opening barely wider than a cup.', 'Create the most compact dinosaur possible to slip into a minuscule burrow.'],
    ],
  ], [
    ['Try a different size.', 'A smaller dino might fit.'],
    ['Think about how big your dino is.', 'Maybe its body is too wide.'],
    ["Consider your dinosaur's overall dimensions.", 'A bulky frame will never fit through a narrow opening.'],
  ], ['small', 'narrow', 'big']),
  fp('burrow.dig', [
    [
      ['Your dino must dig in dirt.', 'Give your dino claws that dig.', 'Dig through the dirt to the burrow.'],
      ['Make a dino that can dig through a pile of dirt.', 'Build a dino that can dig open the blocked burrow.', 'Your dino must scoop away dirt to find the burrow door.'],
      ['Design a dinosaur that can excavate the soil blocking the burrow.', 'Your dinosaur must tunnel through a mound of loose dirt.', 'Create a dinosaur equipped to burrow through a heap of soil.'],
    ],
    [
      ['Dig through lots of hard dirt.', 'Your dino must be a great digger.', 'Dig a long tunnel.'],
      ['Make a dino that can dig a long tunnel through hard dirt.', 'Build a super digger dino for the packed, hard ground.', 'Your dino must dig deep down to reach the burrow.'],
      ['Design a powerful excavator dinosaur that tunnels through compacted earth.', 'Your dinosaur must dig an extensive tunnel through dense, hard soil.', 'Create a dinosaur with durable claws to burrow through solid ground.'],
    ],
  ], [
    ['Try different claws.', 'Claws help a dino dig.'],
    ['Think about what your dino digs with.', 'Its hands may not be good for dirt.'],
    ["Consider whether your dinosaur's forelimbs are suited to excavation.", 'Some claws scoop soil far better than others.'],
  ], ['durable', 'powerful']),
  fp('burrow.dark', [
    [
      ['Your dino must glow in the dark.', 'Light up the dark burrow.', 'Give your dino spots that glow.'],
      ['Make a dino that can light up a dark burrow.', 'Build a dino that can see its friends in the dark burrow.', 'Your dino must bring its own light into the dark tunnel.'],
      ['Design a dinosaur that can illuminate a pitch-black burrow.', 'Your dinosaur must navigate a dark tunnel by its own light.', 'Create a luminous dinosaur that brightens a gloomy burrow.'],
    ],
  ], [
    ['Try a different extra.', 'Look at the extras station.'],
    ['Think about how your dino could make light.', 'Something extra could help in the dark.'],
    ['Consider which extra feature could brighten the darkness.', 'A dinosaur cannot navigate a tunnel it cannot see.'],
  ], ['navigate']),
  // ------------------------------------------------------------------ tall grass
  fp('tallGrass.peek', [
    [
      ['Your dino must stand up tall.', 'Stand up to see the nest.', 'Peek over the grass to find the nest.'],
      ['Make a dino that can peek over the tall grass to find its nest.', 'Build a dino that can see over the grass.', 'Your dino must look over the grass to spot the nest.'],
      ['Design a dinosaur tall enough to survey the meadow and locate its nest.', 'Your dinosaur must peer above the grass to navigate toward its nest.', 'Create an upright dinosaur that can spot its nest above the swaying grass.'],
    ],
    [
      ['See over very tall grass.', 'Your dino must be taller.', 'Peek over grass taller than you.'],
      ['Make a dino tall enough to see over very tall grass.', 'Build a dino that can find its nest in grass as tall as a door.', 'Your dino must spot the nest over grass taller than a grown-up.'],
      ['Design a lofty dinosaur that can see above towering grass.', 'Your dinosaur must gain enough height to locate its nest in very tall grass.', 'Create a dinosaur whose head rises above grass taller than an adult.'],
    ],
    [
      ['See over the tallest grass ever.', 'Your dino must be super tall.', 'Make your dino as tall as possible.'],
      ['Make a dino that can see over grass as tall as a house.', 'Build the tallest dino to find a nest in giant grass.', 'Your dino must look over grass taller than a house.'],
      ['Design an exceptionally tall dinosaur to survey a sea of gigantic grass.', 'Your dinosaur must tower above house-high grass to pinpoint its nest.', 'Create a towering dinosaur that can peer across an enormous grassland.'],
    ],
  ], [
    ['Try a different way of moving.', 'Can your dino stand up?'],
    ['Think about how your dino holds its body.', 'A dino low to the ground cannot see far.'],
    ["Consider your dinosaur's posture and height.", 'A creature that stays close to the ground has a limited view.'],
  ], ['tall', 'long', 'navigate']),
  fp('tallGrass.sneak', [
    [
      ['Hide in the tall grass.', 'Your dino needs stripes.', 'Pick an extra that hides in grass.'],
      ['Make a dino that can hide in the stripy shadows of the tall grass.', 'Build a dino that blends into the tall grass.', 'Your dino must hide in the grass from a nosy big dino.'],
      ['Design a dinosaur whose markings conceal it among the tall grass.', 'Your dinosaur must camouflage itself within the stripy shadows of the grass.', 'Create a dinosaur patterned to vanish into the swaying grass.'],
    ],
  ], [
    ['Try a different extra.', 'Grass makes stripy shadows.'],
    ['Think about patterns that look like grass.', 'Something extra on its skin could help.'],
    ['Consider which markings resemble tall blades of grass.', 'A pattern can conceal a dinosaur even when its color cannot.'],
  ], ['conceal', 'camouflage', 'tall']),
  // ------------------------------------------------------------------ tall tree
  fp('tallTree.fruit', [
    [
      ['Your dino must reach the fruit.', 'Reach up to the low fruit.', 'Get the fruit from the tree.'],
      ['Make a dino that can reach fruit on a low branch.', 'Build a dino that can pick a fruit just above its head.', 'Your dino must reach up and grab a juicy fruit.'],
      ['Design a dinosaur that can reach fruit dangling from a low branch.', 'Your dinosaur must stretch upward to pluck a ripe fruit.', 'Create a dinosaur with enough height to harvest fruit overhead.'],
    ],
    [
      ['Reach the fruit high in the tree.', 'Your dino needs a long reach.', 'Get the high fruit.'],
      ['Make a dino that can reach fruit high in a tree.', 'Build a dino that can get fruit from a tall branch.', 'Your dino must reach a fruit far above the ground.'],
      ['Design a dinosaur that can reach fruit on a lofty branch.', 'Your dinosaur must extend itself to pluck fruit high in the canopy.', 'Create a dinosaur tall enough to harvest fruit from an elevated branch.'],
    ],
    [
      ['Reach the fruit at the very top.', 'Your dino must reach super high.', 'Get the fruit from the tree top.'],
      ['Make a dino that can reach fruit at the very top of a tall tree.', 'Build a dino that can get the very highest fruit.', 'Your dino must reach the fruit at the top of the tallest tree.'],
      ['Design a towering dinosaur that can reach fruit at the summit of a giant tree.', 'Your dinosaur must stretch to the uppermost branch for the last fruit.', 'Create a dinosaur with extraordinary reach to harvest fruit from the treetop.'],
    ],
  ], [
    ['Try a different head.', 'A longer neck could help.'],
    ['Think about how high your dino can reach.', 'Maybe its head should be higher up.'],
    ["Consider which parts would raise your dinosaur's head higher.", 'Height and a long reach work together.'],
  ], ['tall', 'long', 'high']),
  fp('tallTree.shake', [
    [
      ['Shake the tree so fruit falls.', 'Your dino must be strong.', 'Push the tree hard to drop fruit.'],
      ['Make a dino strong enough to shake fruit out of a tree.', 'Build a dino that can bump the tree until fruit falls down.', 'Your dino must shake the tree so the fruit drops.'],
      ['Design a powerful dinosaur that can shake fruit loose from a tree.', 'Your dinosaur must jostle the trunk until ripe fruit tumbles down.', 'Create a sturdy dinosaur that can rattle a tree to release its fruit.'],
    ],
    [
      ['Shake a very big tree.', 'Your dino must be very strong.', 'Shake the giant tree for fruit.'],
      ['Make a dino strong enough to shake a giant tree.', 'Build a dino that can rock a huge tree until the fruit falls.', 'Your dino must shake a thick tree trunk hard.'],
      ['Design an immensely powerful dinosaur to shake a massive tree trunk.', 'Your dinosaur must rock an enormous tree until the fruit cascades down.', 'Create a formidable dinosaur that can rattle the sturdiest tree.'],
    ],
  ], [
    ['Try a bigger dino.', 'Big dinos are strong.'],
    ['Think about how strong your dino is.', 'A bigger, heavier dino pushes harder.'],
    ['Consider which parts add strength and weight.', 'A slight dinosaur cannot budge a sturdy trunk.'],
  ], ['big', 'heavy', 'powerful']),
  // ------------------------------------------------------------------ rocks
  fp('rocks.climb', [
    [
      ['Your dino must climb rocks.', 'Give your dino claws that climb.', 'Climb up the big rocks.'],
      ['Make a dino that can climb up a pile of rocks.', 'Build a dino that can climb a rocky hill.', 'Your dino must climb the rocks to see the view.'],
      ['Design a dinosaur that can scale a pile of boulders.', 'Your dinosaur must clamber up a rocky slope.', 'Create a dinosaur with enough grip to ascend a heap of rocks.'],
    ],
    [
      ['Climb the steep rocks.', 'Your dino must be a good climber.', 'Climb up a steep rock wall.'],
      ['Make a dino that can climb a steep rock wall.', 'Build a dino that can climb steep, bumpy rocks.', 'Your dino must climb up a rock wall to its friend.'],
      ['Design a nimble dinosaur that can scale a steep rock face.', 'Your dinosaur must grip and climb a steep cliff.', 'Create an agile dinosaur that can ascend a steep, rugged wall.'],
    ],
    [
      ['Climb the steepest, slippery rocks.', 'Your dino must be the best climber.', 'Climb up a very tall cliff.'],
      ['Make a dino that can climb a tall, slippery cliff.', 'Build the best climbing dino for a steep, slippery rock wall.', 'Your dino must climb to the very top of a slippery cliff.'],
      ['Design an exceptionally agile climber to scale a towering, slippery cliff.', 'Your dinosaur must ascend a sheer, slippery rock face without sliding.', 'Create a light, grippy dinosaur that can conquer the steepest cliff.'],
    ],
  ], [
    ['Try different claws.', 'Claws help a dino climb.'],
    ['Think about what your dino holds on with.', 'Heavy dinos slide down rocks.'],
    ["Consider whether your dinosaur's grip is strong enough for rock.", 'Lighter, nimble dinosaurs ascend more easily.'],
  ], ['steep', 'slippery', 'agile', 'light']),
  fp('rocks.tough', [
    [
      ['Your dino must be tough.', 'Let little pebbles bounce off your dino.', 'Walk under falling pebbles safely.'],
      ['Make a dino tough enough to walk where pebbles fall.', 'Build a dino that pebbles just bounce off.', 'Your dino must stroll under a shower of little pebbles.'],
      ['Design a durable dinosaur that pebbles simply bounce off.', 'Your dinosaur must withstand a shower of tumbling pebbles.', 'Create a sturdy dinosaur protected from falling pebbles.'],
    ],
    [
      ['Let big rocks bounce off.', 'Your dino must be very tough.', 'Walk under falling rocks safely.'],
      ['Make a dino so tough that big falling rocks bounce off.', 'Build a dino that can walk under a bouncy rock slide.', 'Your dino must be tough enough for bouncing rocks.'],
      ['Design an extremely durable dinosaur that shrugs off a tumbling rockslide.', 'Your dinosaur must be resilient enough to shrug off bouncing boulders.', 'Create a rugged, durable dinosaur that rocks simply bounce off.'],
    ],
  ], [
    ['Try a different body.', 'A tough body helps.'],
    ['Think about what protects your dino.', 'Its back could use some protection.'],
    ["Consider which parts would shield your dinosaur's back.", 'Soft skin is not very durable.'],
  ], ['durable', 'heavy']),
  // ------------------------------------------------------------------ river
  fp('river.swim', [
    [
      ['Your dino must swim.', 'Swim across the river.', 'Give your dino a way to swim.'],
      ['Make a dino that can swim across a calm river.', 'Build a dino that can paddle over the river.', 'Your dino must swim to the other side of the river.'],
      ['Design a dinosaur that can swim across a gentle river.', 'Your dinosaur must navigate a calm river to the far bank.', 'Create an aquatic dinosaur that can cross a lazy river.'],
    ],
    [
      ['Swim across a wide river.', 'Your dino must swim well.', 'Swim fast across the river.'],
      ['Make a dino that can swim across a wide river.', 'Build a dino that is a strong swimmer.', 'Your dino must swim across a river with little waves.'],
      ['Design a strong swimmer to cross a wide, choppy river.', 'Your dinosaur must navigate a broad river with rippling waves.', 'Create an efficient swimmer that can traverse a wide river.'],
    ],
    [
      ['Swim across a fast, wild river.', 'Your dino must be a super swimmer.', 'Swim against a strong river.'],
      ['Make a dino that can swim across a fast, splashy river.', 'Build a dino that swims well enough for a wild, rushing river.', 'Your dino must swim across a river that pushes hard.'],
      ['Design an exceptionally powerful swimmer to cross a rushing current.', 'Your dinosaur must navigate a turbulent river without drifting away.', 'Create a streamlined, efficient swimmer that conquers a raging river.'],
    ],
  ], [
    ['Try different legs.', 'Legs can help a dino swim.'],
    ['Think about what your dino swims with.', 'Heavy parts can make a dino sink.'],
    ['Consider which limbs and tail would propel your dinosaur through water.', 'Some dinosaurs are designed for land, not water.'],
  ], ['wide', 'efficient', 'navigate', 'heavy']),
  fp('river.fish', [
    [
      ['Your dino needs blue skin.', 'Blend in with the water to catch a fish.', 'Pick a color like the water.'],
      ['Make a dino that blends into the water to sneak up on a fish.', 'Build a dino a fish cannot spot in the river, so it can catch it.', 'Your dino must look like the water to catch a fish.'],
      ['Design a dinosaur camouflaged in the rippling water so it can ambush a fish.', 'Your dinosaur must blend into the river to creep up on a fish unseen.', 'Create a dinosaur whose skin conceals it in the water while it stalks a fish.'],
    ],
  ], [
    ['Try a different color.', 'What color is the water?'],
    ['Think about the color of the river.', 'A fish swims away from a bright dino.'],
    ["Consider whether your dinosaur's color matches the water.", 'Bright skin is conspicuous to a fish in a river.'],
  ], ['conceal', 'camouflage']),
  // ------------------------------------------------------------------ canyon
  fp('canyon.fly', [
    [
      ['Your dino must fly.', 'Fly across the deep canyon.', 'Give your dino a way to fly.'],
      ['Make a dino that can fly over a deep canyon.', 'Build a dino that can get across the canyon through the air.', 'Your dino must cross a canyon with no bridge.'],
      ['Design a dinosaur that can soar across a deep canyon.', 'Your dinosaur must glide over a chasm with no bridge.', 'Create an airborne dinosaur that can traverse a deep canyon.'],
    ],
    [
      ['Fly across a wide canyon.', 'Your dino must fly and be light.', 'Fly far and do not be big.'],
      ['Make a dino that can fly across a wide canyon without getting tired.', 'Build a dino that can fly far, so it must not be too big.', 'Your dino must fly over a wide canyon on a windy day.'],
      ['Design a light, airborne dinosaur that can traverse a wide canyon.', 'Your dinosaur must fly a long distance, so it cannot be too heavy.', 'Create an airborne dinosaur light enough to cross a broad chasm.'],
    ],
    [
      ['Fly across the widest canyon.', 'Your dino must fly and be small.', 'Be a small dino that flies far.'],
      ['Make a dino that can fly across the widest canyon in the world.', 'Build a little dino that can fly very far.', 'Your dino must fly over a giant canyon, so it must be very light.'],
      ['Design a featherweight flier that can cross an immense canyon.', 'Your dinosaur must be compact and light to fly across an enormous chasm.', 'Create a tiny, efficient flier that can traverse the widest canyon.'],
    ],
  ], [
    ['Try a different way of moving.', 'Can your dino fly?'],
    ['Think about how your dino moves.', 'Big dinos get tired when they fly far.'],
    ['Consider how your dinosaur travels and how heavy it is.', 'A heavy creature cannot stay airborne for long.'],
  ], ['wide', 'light', 'heavy', 'efficient']),
  // ------------------------------------------------------------------ nut
  fp('nut.crack', [
    [
      ['Crack open a hard nut.', 'Your dino needs strong teeth.', 'Bonk or bite a nut open.'],
      ['Make a dino that can crack open a hard nut.', 'Build a dino that can open a nut for a snack.', 'Your dino must break a nut to get the yummy inside.'],
      ['Design a dinosaur that can crack a tough nut.', 'Your dinosaur must break open a hard shell to reach the treat inside.', 'Create a dinosaur with jaws or a head durable enough to crack a nut.'],
    ],
    [
      ['Crack a very hard nut.', 'Your dino must crunch hard.', 'Open a big coconut.'],
      ['Make a dino that can crack a big coconut.', 'Build a dino that can break open a very hard coconut.', 'Your dino must crunch a coconut to get the juice.'],
      ['Design a dinosaur powerful enough to crack a sturdy coconut.', 'Your dinosaur must split a thick coconut shell.', 'Create a dinosaur with a formidable crunch for a hard coconut.'],
    ],
    [
      ['Crack the hardest nut ever.', 'Your dino must crunch super hard.', 'Open a giant rock-hard nut.'],
      ['Make a dino that can crack a giant nut as hard as a rock.', 'Build a dino that can crunch the hardest nut in the jungle.', 'Your dino must open a huge nut that nobody can crack.'],
      ['Design a dinosaur with an extraordinary crunch to split a rock-hard nut.', 'Your dinosaur must crack an enormous nut with a nearly unbreakable shell.', 'Create a dinosaur equipped to shatter the most durable nut in the jungle.'],
    ],
  ], [
    ['Try different teeth.', 'Look at the teeth station.'],
    ['Think about what your dino bites with.', 'Its mouth may be too soft for nuts.'],
    ["Consider whether your dinosaur's mouth is built for crushing.", 'Some mouths are designed to crack hard shells.'],
  ], ['powerful', 'durable', 'big']),
  // ------------------------------------------------------------------ log
  fp('log.push', [
    [
      ['Push the log off the path.', 'Your dino must be strong.', 'Move the log out of the way.'],
      ['Make a dino that can push a log off the path.', 'Build a dino strong enough to roll a log away.', 'Your dino must clear a log from the path.'],
      ['Design a strong dinosaur that can shove a log off the trail.', 'Your dinosaur must push a fallen log out of the way.', 'Create a powerful dinosaur that can clear a log from the path.'],
    ],
    [
      ['Push a big heavy log.', 'Your dino must be very strong.', 'Move a heavy log off the path.'],
      ['Make a dino that can push a big, heavy log off the path.', 'Build a strong dino to roll a thick log away.', 'Your dino must shove a heavy log out of the way.'],
      ['Design a powerful dinosaur that can shove a heavy log aside.', 'Your dinosaur must budge a thick, heavy log blocking the trail.', 'Create a sturdy, forceful dinosaur that can clear a massive log.'],
    ],
    [
      ['Push a giant log.', 'Your dino must be super strong.', 'Move the biggest log ever.'],
      ['Make a dino that can push a giant log as big as a bus.', 'Build the strongest dino to move a huge log.', 'Your dino must push a gigantic log off the path.'],
      ['Design an immensely powerful dinosaur to shove an enormous log aside.', 'Your dinosaur must move a colossal log the size of a bus.', 'Create the mightiest dinosaur possible to clear a gigantic log.'],
    ],
  ], [
    ['Try a different head.', 'Horns help push.'],
    ['Think about what your dino pushes with.', 'A bigger, heavier dino pushes harder.'],
    ['Consider which parts add strength and weight.', 'A slight dinosaur cannot shift a heavy load.'],
  ], ['heavy', 'big', 'powerful']),
  // ------------------------------------------------------------------ snow
  fp('snow.warm', [
    [
      ['Your dino must stay warm.', 'Walk in the cold snow.', 'Keep your dino warm in snow.'],
      ['Make a dino that stays warm on a snowy mountain.', 'Build a dino that does not shiver in the snow.', 'Your dino must walk over a cold, snowy hill.'],
      ['Design a dinosaur insulated against the chilly mountain snow.', 'Your dinosaur must stay warm while crossing a frosty slope.', 'Create a dinosaur that can endure the cold of a snowy peak.'],
    ],
    [
      ['Stay warm in a big snowstorm.', 'Your dino must be very warm.', 'Walk in the freezing cold.'],
      ['Make a dino that stays warm in a big snowstorm.', 'Build a dino that stays cozy on the coldest mountain.', 'Your dino must walk through a freezing blizzard.'],
      ['Design a well-insulated dinosaur to endure a freezing blizzard.', 'Your dinosaur must stay warm on a frigid, windswept summit.', 'Create a dinosaur that can withstand bitter, icy winds.'],
    ],
  ], [
    ['Try a different body.', 'Some bodies keep warm.'],
    ['Think about what keeps your dino warm.', 'A thin dino gets cold fast.'],
    ['Consider which parts would trap heat or soak up sunshine.', 'Slender bodies lose warmth quickly.'],
  ], ['efficient', 'big']),
  fp('snow.slope', [
    [
      ['Climb the snowy hill.', 'Your dino must grip the snow.', 'Walk up a slippery, snowy slope.'],
      ['Make a dino that can climb a slippery, snowy hill.', 'Build a dino that does not slide down the snow.', 'Your dino must climb up an icy slope.'],
      ['Design a dinosaur with enough grip to climb a slippery, snowy slope.', 'Your dinosaur needs traction to ascend an icy hill.', 'Create a dinosaur that can climb a frosty slope without sliding.'],
    ],
    [
      ['Climb a steep, icy hill.', 'Your dino must climb very well.', 'Climb up the icy cliff.'],
      ['Make a dino that can climb a steep, icy hill.', 'Build a dino that can climb up a slippery ice wall.', 'Your dino must climb an icy slope that is very steep.'],
      ['Design an agile dinosaur with traction to scale a steep, icy wall.', 'Your dinosaur must grip a slippery, steep slope covered in ice.', 'Create a dinosaur that can navigate a treacherous, icy incline.'],
    ],
  ], [
    ['Try different claws.', 'Claws help on ice.'],
    ['Think about what your dino holds on with.', 'Heavy dinos slide down slippery hills.'],
    ['Consider whether your dinosaur has the traction for ice.', 'Without a grip, a dinosaur slips back down.'],
  ], ['steep', 'slippery', 'traction', 'navigate']),
  // ------------------------------------------------------------------ birds
  fp('birds.roar', [
    [
      ['Make a loud noise to shoo birds.', 'Your dino must be loud.', 'Shoo the pesky birds away.'],
      ['Make a dino loud enough to shoo pesky birds off its nest.', 'Build a dino that can make a noise to chase off birds.', 'Your dino must rattle or honk to shoo away pesky birds.'],
      ['Design a dinosaur that can make enough noise to shoo away pesky birds.', 'Your dinosaur must startle a flock of cheeky birds off its nest.', 'Create a noisy dinosaur that can disperse a flock of pesky birds.'],
    ],
    [
      ['Make a very loud honk.', 'Your dino must be very loud.', 'Shoo a big flock of birds.'],
      ['Make a dino loud enough to shoo a big flock of birds.', 'Build a dino with a honk that echoes across the valley.', 'Your dino must honk loud enough to clear the whole tree.'],
      ['Design a dinosaur with a booming honk that disperses a large flock.', 'Your dinosaur must produce a resonant call to scatter many birds.', 'Create a dinosaur whose call echoes across the entire valley.'],
    ],
    [
      ['Make the loudest roar ever.', 'Your dino must roar super loud.', 'Roar so loud the trees shake.'],
      ['Make a dino with a roar so loud that every bird flies away.', 'Build a dino whose roar can be heard over the whole jungle.', 'Your dino must roar louder than a thunderstorm.'],
      ['Design a dinosaur with a thunderous roar that empties the entire sky of birds.', 'Your dinosaur must unleash a deafening roar audible across the jungle.', 'Create a dinosaur whose mighty roar is louder than a thunderstorm.'],
    ],
  ], [
    ['Try a different head.', 'Some heads are very loud.'],
    ['Think about how your dino makes noise.', 'A bigger head can make a bigger sound.'],
    ["Consider which features would amplify your dinosaur's voice.", 'A quiet dinosaur will not impress these birds.'],
  ], ['big', 'powerful']),
  // ------------------------------------------------------------------ desert
  fp('desert.hide', [
    [
      ['Hide in the sandy desert.', 'Your dino needs sand-colored skin.', 'Pick a color like the sand.'],
      ['Make a dino that can hide in the sandy desert.', 'Build a dino that a big sniffy dino cannot see in the sand.', 'Your dino must hide among the sand dunes.'],
      ['Design a dinosaur that can conceal itself among the sand dunes.', 'Your dinosaur must blend into the desert to avoid a curious giant.', 'Create a dinosaur camouflaged for the dusty, sandy desert.'],
    ],
    [
      ['Hide well in the sand.', 'Your dino must be sneaky in the desert.', 'Hide behind one little sand dune.'],
      ['Make a dino that hides in the desert and stays out of sight.', 'Build a dino that can hide behind a little sand dune.', 'Your dino must stay hidden in the desert while a big dino sniffs around.'],
      ['Design an inconspicuous dinosaur that blends into a sparse desert.', 'Your dinosaur must stay concealed behind a modest dune.', 'Create a camouflaged, stealthy dinosaur for the open desert.'],
    ],
    [
      ['Hide in flat sand with no dunes.', 'Your dino must be super sneaky in sand.', 'Hide in the open sand.'],
      ['Make a dino that can hide in flat sand with nowhere else to hide.', 'Build the sneakiest desert dino that a sniffy dino walks right past.', 'Your dino must stay hidden on flat, open sand.'],
      ['Design the stealthiest dinosaur possible to vanish on flat, open sand.', 'Your dinosaur must remain concealed on a barren plain while a giant sniffs nearby.', 'Create a dinosaur so well camouflaged that it disappears on the open desert.'],
    ],
  ], [
    ['Try a different color.', 'What color is sand?'],
    ['Think about the color of the desert.', 'Maybe your dino stands out too much.'],
    ["Consider whether your dinosaur's skin matches the dunes.", 'Vivid colors are difficult to conceal in the desert.'],
  ], ['conceal', 'camouflage', 'small']),
  fp('desert.cool', [
    [
      ['Do not get too hot in the desert.', 'Your dino must stay cool.', 'Stay cool in the hot sun.'],
      ['Make a dino that stays cool in the hot desert.', 'Build a dino that does not get too hot in the sun.', 'Your dino must cross the hot sand without getting sweaty.'],
      ['Design a dinosaur that stays cool under the blazing desert sun.', 'Your dinosaur must avoid overheating while crossing scorching sand.', 'Create a dinosaur that sheds heat efficiently in the desert.'],
    ],
    [
      ['Stay cool in the hottest desert.', 'Your dino must stay very cool.', 'Cross the hottest sand ever.'],
      ['Make a dino that stays cool in the hottest desert in the world.', 'Build a dino that can cross sand hot enough to cook an egg.', 'Your dino must stay cool on the hottest day ever.'],
      ['Design a dinosaur that stays cool in an extraordinarily scorching desert.', 'Your dinosaur must cross sand hot enough to fry an egg without overheating.', 'Create a lightweight, efficient dinosaur that never overheats in blistering heat.'],
    ],
  ], [
    ['Try a different extra.', 'Fluffy things are hot.'],
    ['Think about what makes your dino warm.', 'A fluffy coat is too warm here.'],
    ['Consider which features trap heat around your dinosaur.', 'Insulation is helpful in snow, but not in a desert.'],
  ], ['efficient', 'light']),
];

export const DINO_SCENARIO_PHRASES: readonly ScenarioPhrases[] = [
  sp('snack', ['Snack Time', 'Lunch Hunt', 'Gulp!'], [
    ['Your dino is hungry.', 'It is snack time.'],
    ["Your dino's tummy is rumbling for a snack.", 'A wriggly critter is giggling nearby.'],
    ["Your dinosaur's stomach is rumbling, and a snack is scurrying nearby.", 'Lunchtime has arrived, and something wriggly is waiting.'],
  ]),
  sp('chase', ['Lizard Chase', 'Catch Me', 'Zoom Zoom'], [
    ['A lizard runs away.', 'The lizard is fast.'],
    ['A cheeky lizard zips across the field.', 'A lizard dares your dino to a race.'],
    ['A mischievous lizard darts across the meadow.', 'A speedy lizard challenges your dinosaur to a chase.'],
  ]),
  sp('ferns', ['Fern Hide', 'Hide and Seek', 'Sniff Sniff'], [
    ['A big dino is sniffing around.', 'Time to hide in the ferns.'],
    ['A big, sniffy dino is looking for someone to play with.', 'Shh, a giant dino is sniffing through the ferns.'],
    ['An enormous, nosy dinosaur is sniffing through the undergrowth.', 'A curious giant is searching the ferns, so stay hidden.'],
  ]),
  sp('ledge', ['High Ledge', 'Jump Up', 'Rock Hop'], [
    ['A friend waits up on a ledge.', 'The ledge is up high.'],
    ["Your dino's friend is waving from a rocky ledge.", 'A shiny egg sits on a ledge above you.'],
    ['A friend beckons from a rocky ledge high above.', 'Something shiny glints on a ledge overhead.'],
  ]),
  sp('burrow', ['Small Hole', 'Burrow Visit', 'Tunnel Time'], [
    ['A friend lives in a burrow.', 'There is a little hole in the hill.'],
    ['A tiny friend invited your dino over to its burrow.', 'Your dino found a little hole in the hill.'],
    ['A tiny friend has invited your dinosaur into its underground home.', 'A narrow burrow leads deep into the hillside.'],
  ]),
  sp('tallGrass', ['Find the Nest', 'Tall Grass', 'Peek-a-Boo'], [
    ['The nest is in the grass.', 'The grass is very tall.'],
    ["Your dino's nest is lost somewhere in the tall grass.", 'The grass is so tall that the nest is hidden.'],
    ["Your dinosaur's nest is hidden somewhere in a sea of grass.", 'Swaying grass conceals the path back to the nest.'],
  ]),
  sp('tallTree', ['Fruit Tree', 'Snack Up High', 'Tall Tree'], [
    ['Yummy fruit grows on the tree.', 'The tree has juicy fruit.'],
    ['Juicy fruit is hanging in a tall tree.', 'Your dino spots a yummy fruit up in the tree.'],
    ['Ripe fruit dangles temptingly from a tall tree.', 'A delicious fruit hangs among the branches.'],
  ]),
  sp('rocks', ['Big Rocks', 'Rock Climb', 'Up We Go'], [
    ['Big rocks block the way.', 'The rocks are very tall.'],
    ['A pile of big rocks stands between your dino and home.', 'The best view is at the top of the rocks.'],
    ['A rugged pile of boulders blocks the trail home.', 'The finest view awaits at the top of the rocks.'],
  ]),
  sp('river', ['River Crossing', 'Splash', 'Fishy River'], [
    ['A river is in the way.', 'Your friend is across the river.'],
    ['A river flows between your dino and its friends.', 'Your dino wants to get to the other side of the river.'],
    ['A glittering river separates your dinosaur from its friends.', 'The trail continues on the far bank of the river.'],
  ]),
  sp('canyon', ['Deep Canyon', 'Sky Trip', 'No Bridge'], [
    ['A deep canyon is in the way.', 'There is no bridge.'],
    ['A deep canyon cuts right across the path.', 'The old bridge fell down, so there is a big gap.'],
    ['A deep canyon splits the landscape in two.', 'The bridge has collapsed, leaving an enormous gap.'],
  ]),
  sp('nut', ['Nut Crack', 'Crunch Time', 'Tough Nut'], [
    ['Your dino found a big nut.', 'The nut is very hard.'],
    ['Your dino found a nut with a yummy treat inside.', 'A hard nut rolled down the hill.'],
    ['Your dinosaur discovered a nut with a delicious treat inside.', 'A remarkably hard nut tumbled down the slope.'],
  ]),
  sp('log', ['Log Push', 'Blocked Path', 'Heave Ho'], [
    ['A log is on the path.', 'The path is blocked.'],
    ['A fallen log is blocking the path.', "Your dino's friends cannot get past the log."],
    ['A fallen log obstructs the trail.', "Your dinosaur's friends are stuck behind a fallen log."],
  ]),
  sp('snow', ['Snowy Mountain', 'Brrr', 'Ice Hill'], [
    ['It is cold and snowy.', 'Snow is on the mountain.'],
    ['Your dino must cross a cold, snowy mountain.', 'Snowflakes are falling on the mountain path.'],
    ['A frosty mountain pass lies ahead.', 'Snowflakes swirl around the chilly mountain trail.'],
  ]),
  sp('birds', ['Pesky Birds', 'Shoo Shoo', 'Noisy Nest'], [
    ["Birds are on your dino's nest.", 'The birds are pesky.'],
    ["Pesky birds are pecking at your dino's nest.", "A flock of cheeky birds landed on your dino's nest."],
    ["A flock of mischievous birds has invaded your dinosaur's nest.", "Cheeky birds are squawking around your dinosaur's nest."],
  ]),
  sp('desert', ['Hot Desert', 'Sand Dunes', 'Sunny Sands'], [
    ['The desert is hot and sandy.', 'The sun is very hot.'],
    ["The desert sand is hot under your dino's feet.", 'Sand dunes stretch as far as your dino can see.'],
    ['Scorching dunes stretch toward the horizon.', 'The blazing sun beats down on the desert.'],
  ]),
];
