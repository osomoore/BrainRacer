/**
 * Dino Lab phrase banks, written for beginning readers (kids 5-9 sounding out words).
 * Title = the problem (one per facet level; the scenario title is used when a stage has 2+ requirements).
 * Each requirement line = the FIX: it names the part(s) to pick, by the names shown at the stations
 * (every option for an any-of requirement). Each level has two rows (A, B); a challenge shows one row at all four
 * reading levels, so a row says the same fix four ways. Easy <= 6 words, Medium <= 8, Hard <= 12, and
 * Easy <= Medium <= Hard in length. validateCatalog checks all of this.
 * Hints: 2 per reading level, same word limits; they point at a station and never give the full answer.
 * Scenario intros are dropped: every intro is empty (the type still needs the field). Plain ASCII.
 */
import type { FacetPhrases, LeveledPhrases, ScenarioPhrases } from '../../core/types';

type Row = readonly [starter: string, easy: string, medium: string, hard: string];
const L = (starter: string[], easy: string[], medium: string[], hard: string[]): LeveledPhrases => ({ starter, easy, medium, hard });
/** Two rows (A, B) for one facet level. */
const rows = (a: Row, b: Row): LeveledPhrases => L([a[0], b[0]], [a[1], b[1]], [a[2], b[2]], [a[3], b[3]]);
const fp = (facet: string, title: string[], starterTitle: string[], requirement: LeveledPhrases[], hint: LeveledPhrases, vocab: string[]): FacetPhrases =>
  ({ facet, title, starterTitle, requirement, hint, vocab });
const sp = (scenario: string, title: string, starterTitle: string): ScenarioPhrases =>
  ({ scenario, title: [title], starterTitle: [starterTitle], intro: L([], [], [], []) });

export const DINO_FACET_PHRASES: readonly FacetPhrases[] = [
  // ------------------------------------------------------------------ snack
  fp('snack.bite', ['Beetle Snack', 'Frog Snack', 'Lizard Snack'], ['Bug Snack', 'Frog Snack', 'Big Snack'], [
    rows(['Get Big Teeth.', 'Get Big Teeth to crunch.', 'Get Big Teeth to crunch the beetle shell.', 'Give your dino Big Teeth so it can crunch a hard shell.'],
      ['Pick Big Teeth.', 'Pick Big Teeth for the beetle.', 'Big Teeth can bite the hard beetle.', 'Pick Big Teeth or a Rex Head for a big bite.']),
    rows(['Get Sharp Teeth.', 'Get Sharp Teeth for the frog.', 'Get Sharp Teeth to hold the frog.', 'Give your dino Sharp Teeth so it can hold the frog.'],
      ['Pick Rex Head and Big Teeth.', 'Big Teeth and a Rex Head.', 'Use Big Teeth and a Rex Head.', 'Pick Sharp Teeth, or Big Teeth and a Rex Head.']),
    rows(['Get Mega Teeth.', 'Get Mega Teeth for the lizard.', 'Get Mega Teeth to gulp the huge lizard.', 'The lizard is huge, so give your dino Mega Teeth.'],
      ['Pick Rex Head and Sharp Teeth.', 'Sharp Teeth and a Rex Head.', 'Use Sharp Teeth and a Rex Head.', 'Pick Mega Teeth, or Sharp Teeth and a Rex Head.']),
  ], L(['Check Teeth.', 'Go to Teeth.'], ['Check Teeth.', 'Look at Teeth.'],
       ['Check Teeth for a stronger bite.', 'Check Head or Teeth for a stronger bite.'],
       ['Check Teeth for a part that bites hard.', 'Check Teeth for a part that can grab a wiggly snack.']),
  ['teeth', 'crunch', 'bite']),
  fp('snack.bigGulp', ['Giant Beetle', 'Beetle for a Giant'], ['Big Gulp', 'Gulp It Up'], [
    rows(['Get Big and Mega Teeth.', 'Mega Teeth and the Big size.', 'Get Mega Teeth and the Big size.', 'A giant beetle needs Mega Teeth and the Big size to gulp.'],
      ['Pick Huge and Sharp Teeth.', 'Sharp Teeth and the Huge size.', 'Use Sharp Teeth and the Huge size.', 'Pick Sharp Teeth and the Huge size to gulp it down.']),
    rows(['Get Huge and Mega Teeth.', 'Mega Teeth and the Huge size.', 'Get Mega Teeth and the Huge size.', 'Only Mega Teeth and the Huge size can gulp this beetle.'],
      ['Pick Huge and Mega Teeth.', 'Huge size with Mega Teeth.', 'Make a Huge dino with Mega Teeth.', 'Pick the Huge size with Mega Teeth to gulp the huge beetle.']),
  ], L(['Check Teeth.', 'Go to Teeth.'], ['Check Teeth.', 'Check Size.'],
       ['Check Size and Teeth.', 'Check Size for room for a big gulp.'],
       ['Check Size and Teeth for a build that can gulp the beetle.', 'Look at Size for a dino that can hold a giant meal.']),
  ['big', 'huge', 'giant']),
  // ------------------------------------------------------------------ chase (top view)
  fp('chase.speed', ['Fast Lizard', 'Very Fast Lizard', 'Super Fast Lizard'], ['Fast Dash', 'Quick Dash', 'Zip and Dash'], [
    rows(['Get Long Legs.', 'Get Long Legs to run fast.', 'Get Long Legs to run after the lizard.', 'Give your dino Long Legs so it can catch the fast lizard.'],
      ['Pick Slim Body.', 'Use a Slim Body for speed.', 'A Slim Body helps your dino run fast.', 'Pick a Slim Body or Long Legs to catch the lizard.']),
    rows(['Get Slim Body and Long Legs.', 'Long Legs and a Slim Body.', 'Get Long Legs and a Slim Body.', 'To catch it, get Long Legs and a Slim Body.'],
      ['Pick Slim Body and Powerful Legs.', 'Powerful Legs and a Slim Body.', 'Use Powerful Legs and a Slim Body.', 'Pick Powerful Legs and a Slim Body to run very fast.']),
    rows(['Get Powerful Legs.', 'Run fastest with Powerful Legs.', 'Powerful Legs, Slim Body, Tiny Arms, Small size.', 'Pick Powerful Legs, a Slim Body, a Long Tail, and Small size.'],
      ['Pick Powerful Legs and Small.', 'Get Powerful Legs. Be Small.', 'Powerful Legs, Slim Body, Long Tail, Small size.', 'Use Powerful Legs, a Slim Body, Tiny Arms, and the Small size.']),
  ], L(['Check Legs.', 'Go to Legs.'], ['Check Body.', 'Look at Body.'],
       ['Check Body for a faster build.', 'Check Legs to help your dino run.'],
       ['Check Legs and Body for parts that help you run faster.', 'Look at Legs for a way to catch the fast lizard.']),
  ['fast', 'run', 'legs']),
  fp('chase.quiet', ['Sneak Up', 'Sneak Up Close'], ['Sneak Up', 'Sneak Up Close'], [
    rows(['Get Small and hide.', 'Be the Small size to sneak.', 'Pick the Small size to sneak up softly.', 'Pick the Small size so the lizard does not see you.'],
      ['Pick Small to slip in.', 'A Small dino can sneak.', 'Get the Small size and keep Crawling.', 'Pick the Small size and keep Crawling to sneak up close.']),
    rows(['Get Slim Body, Spotty, Small.', 'Small size, Slim Body, Spotty skin.', 'Pick Small size, a Slim Body, and Spotty.', 'Pick the Small size, a Slim Body, and Spotty skin to sneak.'],
      ['Pick Spotty, Leaf Pattern, Small.', 'Small, Spotty, and a Leaf Pattern.', 'Small size, Spotty skin, and Leaf Pattern.', 'Pick the Small size, Spotty skin, and a Leaf Pattern to hide.']),
  ], L(['Check Size.', 'Go to Size.'], ['Look at Size.', 'Small is hard to see.'],
       ['Check Size for a dino that can hide.', 'Check Size to help your dino hide.'],
       ['Check Size for a way to go unseen.', 'Look at Body for a part that helps your dino sneak.']),
  ['small', 'quiet', 'sneak']),
  // ------------------------------------------------------------------ ferns
  fp('ferns.hide', ['Sniffing Dino', 'Short Ferns', 'Few Ferns'], ['Fern Hide', 'Short Ferns', 'Small Patch'], [
    rows(['Get Green.', 'Get Green skin for the ferns.', 'Pick Green skin to hide in the ferns.', 'Give your dino Green skin so it hides in the green ferns.'],
      ['Pick Leaf Pattern.', 'Use a Leaf Pattern to hide.', 'A Leaf Pattern or Spotty skin hides you.', 'Pick Green, Spotty, or a Leaf Pattern to match the ferns.']),
    rows(['Get Green and Small.', 'Green skin and the Small size.', 'Get Green skin and the Small size.', 'The ferns are short, so pick Green skin and the Small size.'],
      ['Pick Spotty and Leaf Pattern.', 'Spotty skin and a Leaf Pattern.', 'Use Spotty skin with a Leaf Pattern.', 'Pick Spotty skin and a Leaf Pattern to hide in short ferns.']),
    rows(['Get Spotty, Leaf Pattern, Small.', 'Spotty, Leaf Pattern, and Small size.', 'Pick Spotty, a Leaf Pattern, and Small size.', 'Few ferns: pick Spotty skin, a Leaf Pattern, and Small size.'],
      ['Pick Slim Body, Spotty, Small.', 'Spotty skin, Small size, Slim Body.', 'Pick Spotty, a Slim Body, and Small size.', 'Pick Spotty skin, a Slim Body, and the Small size to hide.']),
  ], L(['Check Color.', 'Go to Color.'], ['Check Color.', 'Look at Color to hide.'],
       ['Check Color for a match with the leaves.', 'Look at Color for a good match.'],
       ['Check Color for a part that blends in with the leaves.', 'Look at Color for a part that blends into the ferns.']),
  ['hide', 'small', 'match']),
  fp('ferns.flowers', ['Flower Patch'], ['Purple Buds'], [
    rows(['Get Purple.', 'Get Purple skin.', 'Pick Purple skin to match the flowers.', 'Give your dino Purple skin so it hides in the purple flowers.'],
      ['Pick Purple.', 'Use Purple to hide.', 'Purple skin hides you in the flowers.', 'The flowers are purple, so pick Purple skin to hide in them.']),
  ], L(['Check Color.', 'Go to Color.'], ['Check Color.', 'Check Color to match.'],
       ['Check Color for a match with the flowers.', 'Look for a match at Color.'],
       ["Look at the flowers, then pick a match at Color.", 'Check Color to find a part that matches the flowers.']),
  ['hide', 'match', 'color']),
  // ------------------------------------------------------------------ ledge
  fp('ledge.jump', ['High Rock', 'Very High Rock', 'Super High Rock'], ['Rock Hop', 'Big Hop', 'Top of the Rock'], [
    rows(['Get Long Legs.', 'Get Long Legs to jump.', 'Get Long Legs to jump up the rock.', 'Give your dino Long Legs so it can jump onto the rock.'],
      ['Pick Long Legs.', 'Pick Long Legs for a jump.', 'Long Legs or Hoppy Legs can jump up.', 'Pick Long Legs or Hoppy Legs to jump up high.']),
    rows(['Get Hoppy Legs.', 'Get Hoppy Legs to jump high.', 'Get Hoppy Legs to jump very high.', 'The rock is very high, so give your dino Hoppy Legs.'],
      ['Pick Hoppy Legs.', 'Hoppy Legs jump very high.', 'Pick Hoppy Legs for a very high jump.', 'Pick Hoppy Legs so your dino can jump very high.']),
    rows(['Get Slim Body. Get Hoppy Legs and Long Tail.', 'Hoppy Legs, Long Tail, Slim Body.', 'Pick Hoppy Legs, Long Tail, and Slim Body.', 'Jump highest with Hoppy Legs, a Long Tail, and a Slim Body.'],
      ['Pick Slim Body, Hoppy Legs, Small.', 'Hoppy Legs, Slim Body, Small size.', 'Use Hoppy Legs, Slim Body, and Small size.', 'Pick Hoppy Legs, a Slim Body, and Small size for this jump.']),
  ], L(['Check Legs.', 'Go to Legs.'], ['Check Legs.', 'Look at Legs.'],
       ['Check Legs for a bigger jump.', 'Check Body to make your dino lighter.'],
       ['Check Legs for parts that help your dino jump high.', 'Look at Body for a part that makes it easier to jump.']),
  ['high', 'jump', 'legs']),
  // ------------------------------------------------------------------ burrow
  fp('burrow.fit', ['Little Hole', 'Tight Hole'], ['Small Den', 'Slim Gap'], [
    rows(['Get Small to fit.', 'Get the Small size to fit.', 'Pick the Small size for the little hole.', 'Make your dino the Small size so it fits in the hole.'],
      ['Pick Small to get in.', 'A Small dino fits the hole.', 'Only a Small dino can fit in here.', 'The hole is little, so pick the Small size to fit.']),
    rows(['Get Slim Body and Small.', 'Small size and a Slim Body.', 'Get the Small size and a Slim Body.', 'For the tiny hole, pick Small size and a Slim Body.'],
      ['Pick Slim Body and Small.', 'Be Small with a Slim Body.', 'Use a Slim Body in the Small size.', 'Only a Small dino with a Slim Body fits this tiny hole.']),
  ], L(['Check Size.', 'Go to Size.'], ['Look at Size.', 'Look at Body.'],
       ['Check Size for a part that fits.', 'Check Body for a dino that fits.'],
       ['Check Size for a dino that can fit the hole.', 'Look at Body for a part that can help your dino fit.']),
  ['small', 'tiny', 'fit']),
  fp('burrow.dig', ['Dirt Pile', 'Hard Dirt'], ['Dirt Pile', 'Hard Dirt'], [
    rows(['Get Digging Claws to dig.', 'Get Digging Claws.', 'Get Digging Claws to dig through dirt.', 'Give your dino Digging Claws so it can dig through the dirt.'],
      ['Pick Digging Claws.', 'Dig with Digging Claws.', 'Digging Claws can dig the dirt away.', 'Pick Digging Claws to dig a way into the hole.']),
    rows(['Get Digging Claws and Horn Head.', 'Digging Claws and a Horn Head.', 'Get Digging Claws and a Horn Head.', 'The dirt is hard, so get Digging Claws and a Horn Head.'],
      ['Pick Digging Claws and Horn Head.', 'A Horn Head and Digging Claws.', 'Dig with Digging Claws and a Horn Head.', 'Pick Digging Claws and a Horn Head to dig through hard dirt.']),
  ], L(['Check Claws.', 'Go to Claws.'], ['Check Claws.', 'Look at Claws.'],
       ['Check Claws for parts that dig.', 'Look at Claws for a part that scoops.'],
       ['Check Claws for parts that can dig into hard dirt.', 'Look at Claws for a part that can scoop the dirt away.']),
  ['dig', 'dirt', 'hard']),
  fp('burrow.dark', ['Dark Tunnel'], ['Dark Den'], [
    rows(['Get Glow Spots to help.', 'Get Glow Spots.', 'Get Glow Spots to see in the dark.', 'Give your dino Glow Spots to light up the dark tunnel.'],
      ['Pick Glow Spots.', 'Use Glow Spots in the dark.', 'Glow Spots light up the dark tunnel.', 'Pick Glow Spots so your dino makes its own light.']),
  ], L(['Check Extra.', 'Go to Extra.'], ['Check Extra.', 'Look at Extra for a light.'],
       ['Check Extra for a part that makes light.', 'Look at Extra for light in the tunnel.'],
       ['Check Extra for a part that will light the tunnel.', 'Look at Extra for a part that will help your dino see.']),
  ['dark', 'light', 'glow']),
  // ------------------------------------------------------------------ tall grass
  fp('tallGrass.peek', ['Tall Grass', 'Very Tall Grass', 'Super Tall Grass'], ['Tall Grass', 'Big Grass Patch', 'Spot the Nest'], [
    rows(['Get Long Neck, Standing or Big.', 'Standing, Long Neck, or Big size.', 'Pick Standing, a Long Neck, or Big size.', 'To see over the grass, pick Standing, Long Neck, or Big.'],
      ['Pick Long Neck, Standing or Big.', 'Long Neck, Standing, or Big size.', 'Get a Long Neck, Standing, or Big size.', 'Peek over with a Long Neck, Standing, or the Big size.']),
    rows(['Get Long Neck.', 'Get a Long Neck to peek.', 'Get a Long Neck to see the nest.', 'The grass is very tall, so give your dino a Long Neck.'],
      ['Pick Standing and Big.', 'Standing and the Big size.', 'Pick Standing with the Big size.', 'Pick Standing and the Big size to see over the grass.']),
    rows(['Get Long Neck, Standing, Huge.', 'Long Neck, Huge size, and Standing.', 'Get a Long Neck, Huge size, and Standing.', 'Super tall grass needs a Long Neck, Huge size, and Standing.'],
      ['Pick Long Neck, Standing, Big.', 'Long Neck, Big size, and Standing.', 'Pick a Long Neck, Big size, and Standing.', 'Pick Standing, a Long Neck, and the Big size to see.']),
  ], L(['Check Moving.', 'Go to Moving.'], ['Check Moving.', 'Check Head and Size.'],
       ['Check Moving to help your dino see higher.', 'Check Head for more reach.'],
       ['Check Head for a way to see above the tall grass.', 'Look at Moving for a way to get a better view.']),
  ['tall', 'high', 'see']),
  fp('tallGrass.sneak', ['Grass Hide'], ['Grass Hide'], [
    rows(['Get Tiger Stripes.', 'Get Tiger Stripes to hide.', 'Get Tiger Stripes to hide in the grass.', 'Give your dino Tiger Stripes so it looks like the tall grass.'],
      ['Pick Tiger Stripes.', 'Tiger Stripes hide you.', 'Tiger Stripes look like the tall grass.', 'Pick Tiger Stripes so the big dino cannot see you.']),
  ], L(['Check Extra.', 'Go to Extra.'], ['Check Extra.', 'Look at Extra to hide.'],
       ['Look at Extra for a grass match.', 'Check Extra for a pattern.'],
       ['Check Extra for a part that looks like grass.', 'Look at Extra for a part that helps you hide in grass.']),
  ['hide', 'grass', 'stripes']),
  // ------------------------------------------------------------------ tall tree
  fp('tallTree.fruit', ['Fruit on a Branch', 'High Fruit', 'Fruit at the Top'], ['Snack on a Branch', 'Tall Branch', 'Top Branch'], [
    rows(['Get Long Neck.', 'Get a Long Neck to reach.', 'Get a Long Neck to reach the fruit.', 'Give your dino a Long Neck so it can reach the fruit.'],
      ['Pick Huge.', 'Be the Huge size to reach.', 'A Huge dino can reach the fruit.', 'Pick a Long Neck or the Huge size to reach up high.']),
    rows(['Get Long Neck and Standing.', 'Long Neck and Standing.', 'Pick a Long Neck and Standing.', 'The fruit is high, so pick Standing and a Long Neck.'],
      ['Pick Long Neck and Big.', 'A Long Neck and Big size.', 'Use a Long Neck and the Big size.', 'Pick a Long Neck and Big size for the high fruit.']),
    rows(['Get Long Neck, Standing, Huge.', 'Long Neck, Huge size, Standing.', 'Pick Standing, a Long Neck, and Huge size.', 'Reach the top with a Long Neck, Huge size, and Standing.'],
      ['Pick Grabby Hands, Long Neck, Huge.', 'Long Neck, Grabby Hands, Huge size.', 'A Long Neck, Grabby Hands, and Huge size.', 'Pick a Long Neck, Grabby Hands, and Huge size to grab it.']),
  ], L(['Check Head.', 'Go to Head.'], ['Check Head.', 'Look at Head.'],
       ['Check Head for more reach.', 'Look at Head for more reach.'],
       ['Check Head for a part that will help reach the high fruit.', 'Check Moving for a way to reach higher.']),
  ['tall', 'high', 'reach']),
  fp('tallTree.shake', ['Stuck Fruit', 'Thick Tree'], ['Stuck Snack', 'Thick Trunk'], [
    rows(['Get Heavy Tail.', 'Get a Heavy Tail to shake.', 'Get a Heavy Tail to shake the tree.', 'Give your dino a Heavy Tail to shake the fruit down.'],
      ['Pick Huge.', 'Be the Huge size to shake.', 'A Huge dino can shake the tree.', 'Pick a Heavy Tail or Huge size to shake the tree hard.']),
    rows(['Get Big Belly and Heavy Tail.', 'Heavy Tail and a Big Belly.', 'Get a Heavy Tail and a Big Belly.', 'For a thick tree, get a Heavy Tail and Big Belly.'],
      ['Pick Horn Head and Huge.', 'Huge size and a Horn Head.', 'Use the Huge size and a Horn Head.', 'Pick Huge size and a Horn Head to shake the thick tree.']),
  ], L(['Check Size.', 'Go to Size.'], ['Check Size.', 'Look at Size.'],
       ['Check Size for a stronger dino.', 'Look at Size for a stronger push.'],
       ['Check Tail for a part that can push a heavy tree.', 'Look at Size for a dino strong enough to shake the tree.']),
  ['big', 'strong', 'shake']),
  // ------------------------------------------------------------------ rocks
  fp('rocks.climb', ['Rock Pile', 'Steep Rocks', 'Very Steep Rocks'], ['Rock Pile', 'Rock Hill', 'Tall Rock Hill'], [
    rows(['Get Hook Claws.', 'Get Hook Claws to climb.', 'Get Hook Claws to climb the rocks.', 'Give your dino Hook Claws to climb the pile of rocks.'],
      ['Pick Hook Claws.', 'Climb with Hook Claws.', 'Hook Claws or Grabby Hands can climb.', 'Pick Hook Claws or Grabby Hands to hold on and climb.']),
    rows(['Get Grabby Hands and Long Tail.', 'Grabby Hands and a Long Tail.', 'Get Grabby Hands and a Long Tail.', 'The rocks are steep, so get Grabby Hands and a Long Tail.'],
      ['Pick Slim Body and Grabby Hands.', 'Grabby Hands and a Slim Body.', 'Climb with Grabby Hands and a Slim Body.', 'Pick Grabby Hands and a Slim Body to climb the steep rocks.']),
    rows(['Get Slim Body. Get Grabby Hands and Long Tail.', 'Grabby Hands, Long Tail, Slim Body.', 'Grabby Hands, Long Tail, Slim Body, Small size.', 'Pick Grabby Hands, a Long Tail, a Slim Body, and Small size.'],
      ['Pick Grabby Hands.', 'Climb best with Grabby Hands.', 'Grabby Hands, Powerful Legs, Long Tail, Slim Body.', 'Use Grabby Hands, Powerful Legs, a Long Tail, and a Slim Body.']),
  ], L(['Check Claws.', 'Go to Claws.'], ['Check Claws.', 'Look at Claws.'],
       ['Check Claws for more grip.', 'Look at Claws to help you hold on.'],
       ['Check Claws for a part that will grip the rocks.', 'Look at Size for a lighter dino that can climb more easily.']),
  ['steep', 'grip', 'climb']),
  fp('rocks.tough', ['Falling Stones', 'Falling Rocks'], ['Rock Hits', 'Big Rock Hits'], [
    rows(['Get Armor Plates to help.', 'Get Armor Plates.', 'Get Armor Plates so stones bounce off.', 'Give your dino Armor Plates so falling stones bounce off.'],
      ['Pick Spiked Tail.', 'A Spiked Tail makes you strong.', 'Armor Plates or a Spiked Tail are tough.', 'Pick Armor Plates or a Spiked Tail so stones bounce off.']),
    rows(['Get Armor Plates and Spiked Tail.', 'Armor Plates and a Spiked Tail.', 'Get Armor Plates and a Spiked Tail.', 'Big rocks fall here, so get Armor Plates and a Spiked Tail.'],
      ['Pick Armor Plates and Huge.', 'Armor Plates and the Huge size.', 'Use Armor Plates and the Huge size.', 'Pick Armor Plates and the Huge size so big rocks bounce off.']),
  ], L(['Check Body.', 'Go to Body.'], ['Check Body.', 'Check Body for cover.'],
       ['Check Body for more cover.', 'Look at Body for more cover.'],
       ['Check Body for a part that keeps rocks from hurting you.', 'Look at Body for a part that can stop a falling rock.']),
  ['tough', 'rocks', 'stones']),
  // ------------------------------------------------------------------ river
  fp('river.swim', ['Calm River', 'Wide River', 'Fast River'], ['Swim Trip', 'Long Swim', 'Fast Swim'], [
    rows(['Get Flippers.', 'Get Flippers to swim.', 'Get Flippers to swim across the river.', 'Give your dino Flippers so it can swim across the calm river.'],
      ['Pick Paddle Tail.', 'Use a Paddle Tail to swim.', 'A Paddle Tail or Flippers help you swim.', 'Pick Flippers, a Paddle Tail, or Swimming to cross the river.']),
    rows(['Get Swimming.', 'Pick Swimming to cross.', 'Pick Swimming to cross the wide river.', 'The river is wide, so pick Swimming to get across.'],
      ['Pick Flippers.', 'Get Flippers for the wide river.', 'Flippers help your dino swim a long way.', 'Pick Flippers or Swimming so your dino can swim far.']),
    rows(['Get Swimming and Paddle Tail.', 'Swimming and a Paddle Tail.', 'Use Swimming and a Paddle Tail.', 'The river is fast, so pick Swimming and a Paddle Tail.'],
      ['Pick Flippers and Paddle Tail.', 'Flippers and a Paddle Tail.', 'Get Flippers and a Paddle Tail to swim.', 'Pick Flippers and a Paddle Tail to swim in the fast river.']),
  ], L(['Check Legs.', 'Go to Legs.'], ['Check Legs.', 'Look at Legs.'],
       ['Check Legs for a part that swims well.', 'Look at Moving for a way to swim.'],
       ['Check Legs and Tail for parts that help in water.', 'Look at Moving for a way to get across the river.']),
  ['wide', 'swim', 'fast']),
  fp('river.fish', ['Shy Fish'], ['Fish and Dip'], [
    rows(['Get Sky Blue.', 'Get Sky Blue skin.', 'Pick Sky Blue skin to match the water.', 'Give your dino Sky Blue skin so fish do not see it.'],
      ['Pick Sky Blue.', 'Use Sky Blue to hide.', 'Sky Blue skin looks like the water.', 'Water is blue, so pick Sky Blue skin to hide from fish.']),
  ], L(['Check Color.', 'Go to Color.'], ['Check Color.', 'Look at Color to hide.'],
       ['Check Color for a match with the river.', 'Look at Color to hide from fish.'],
       ["Look at the water, then pick a match at Color.", 'Check Color for a part that looks like the water.']),
  ['hide', 'match', 'color']),
  // ------------------------------------------------------------------ canyon
  fp('canyon.fly', ['Deep Gap', 'Wide Gap', 'Very Wide Gap'], ['Gap and Cliff', 'Long Cliff Gap', 'Big Cliff Gap'], [
    rows(['Get Flying.', 'Pick Flying to cross.', 'Pick Flying so your dino can cross.', 'There is no bridge, so pick Flying to cross the deep gap.'],
      ['Pick Flying.', 'Use Flying to get across.', 'Flying lets your dino go over the gap.', 'Pick Flying so your dino can fly over the deep gap.']),
    rows(['Get Slim Body and Flying.', 'Flying and a Slim Body.', 'Fly far with Flying and a Slim Body.', 'The gap is wide, so pick Flying and a Slim Body.'],
      ['Pick Flying and Small.', 'Pick Flying and be Small.', 'Pick Flying and the Small size.', 'Pick Flying and stay small, not Big or Huge, to fly far.']),
    rows(['Get Flying and Small.', 'Flying and the Small size.', 'Use Flying and the Small size to cross.', 'The gap is very wide, so pick Flying and the Small size.'],
      ['Pick Flying and Small.', 'A Small dino with Flying.', 'Pick Flying for a Small, light dino.', 'Pick Small size and Flying to fly over the very wide gap.']),
  ], L(['Check Moving.', 'Go to Moving.'], ['Check Moving.', 'Look at Moving.'],
       ['Check Moving for a way across.', 'Look at Moving to cross the gap.'],
       ['Check Moving for a way to cross without a bridge.', 'Check Size for a light dino that can stay up.']),
  ['wide', 'gap', 'fly']),
  // ------------------------------------------------------------------ nut
  fp('nut.crack', ['Hard Nut', 'Very Hard Nut', 'Giant Nut'], ['Hard Nut', 'Thick Shell', 'Big Nut'], [
    rows(['Get Beak.', 'Get a Beak to crack it.', 'Get a Beak to crack the hard nut.', 'Give your dino a Beak so it can crack the hard nut.'],
      ['Pick Horn Head.', 'Crack it with a Horn Head.', 'A Horn Head or a Beak cracks nuts.', 'Pick a Horn Head or a Beak to crack the hard shell.']),
    rows(['Get Beak.', 'Get a Beak for this nut.', 'Pick a Beak for the very hard nut.', 'The nut is very hard, so give your dino a strong Beak.'],
      ['Pick Horn Head and Big Teeth.', 'Horn Head and Big Teeth.', 'Use a Horn Head and Big Teeth.', 'Pick a Horn Head and Big Teeth to crack this nut.']),
    rows(['Get Horn Head and Beak.', 'A Beak and a Horn Head.', 'Get a Beak and a Horn Head.', 'The nut is giant, so get a Beak and a Horn Head.'],
      ['Pick Horn Head and Beak.', 'Horn Head plus a Beak.', 'Crack it with a Beak and Horn Head.', 'Pick a Beak and a Horn Head to crack this giant nut.']),
  ], L(['Check Teeth.', 'Go to Teeth.'], ['Check Teeth.', 'Look at Teeth.'],
       ['Check Teeth for a part that cracks nuts.', 'Look at Teeth for a stronger bite.'],
       ['Check Teeth and Head for parts that crack hard shells.', 'Look at Teeth for a part that can crack hard things.']),
  ['hard', 'crack', 'nut']),
  // ------------------------------------------------------------------ log
  fp('log.push', ['Log on the Path', 'Heavy Log', 'Giant Log'], ['Log Block', 'Thick Log', 'Big Log'], [
    rows(['Get Horn Head.', 'Push with a Horn Head.', 'Get a Horn Head to push the log.', 'Give your dino a Horn Head to push the log away.'],
      ['Pick Heavy Tail.', 'Get a Heavy Tail to push.', 'A Heavy Tail or Big Belly pushes logs.', 'Pick a Heavy Tail or Big Belly to push the log away.']),
    rows(['Get Huge.', 'Be the Huge size to push.', 'Pick the Huge size to push the log.', 'The log is heavy, so make your dino the Huge size.'],
      ['Pick Horn Head and Heavy Tail.', 'Horn Head and a Heavy Tail.', 'Use a Horn Head and a Heavy Tail.', 'Pick a Horn Head and a Heavy Tail to push it away.']),
    rows(['Get Huge and Heavy Tail.', 'Huge size and a Heavy Tail.', 'Get the Huge size and a Heavy Tail.', 'The log is giant, so pick Huge size and a Heavy Tail.'],
      ['Pick Huge and Heavy Tail.', 'Be Huge with a Heavy Tail.', 'Make a Huge dino with a Heavy Tail.', 'Push the giant log with a Huge dino and a Heavy Tail.']),
  ], L(['Check Head.', 'Go to Head.'], ['Check Size.', 'Look at Size.'],
       ['Check Head for a part that pushes hard.', 'Look at Size for a stronger dino.'],
       ['Check Tail for a part that gives a strong push.', 'Look at Size for a dino that can move a heavy log.']),
  ['heavy', 'push', 'log']),
  // ------------------------------------------------------------------ snow
  fp('snow.warm', ['Cold Snow', 'Snow Storm'], ['Cold Wind', 'Cold Blast'], [
    rows(['Get Back Sail.', 'Get a warm Back Sail.', 'Get a Back Sail to stay warm.', 'Give your dino a Back Sail to stay warm in the snow.'],
      ['Pick Feathers and Big.', 'Keep Feathers and be Big.', 'Keep your Feathers and pick the Big size.', 'Pick a Big Belly or the Big size to stay warm.']),
    rows(['Get Back Sail and Big.', 'A Back Sail and Big size.', 'Pick a Back Sail and the Big size.', 'For the cold storm, get a Back Sail and Big size.'],
      ['Pick Big Belly and Huge.', 'Big Belly and the Huge size.', 'Get a Big Belly and the Huge size.', 'Keep your Feathers and get a Big Belly and Huge size.']),
  ], L(['Check Body.', 'Go to Body.'], ['Check Body.', 'Check Body for warmth.'],
       ['Check Body for a way to stay warm.', 'Look at Body for a warmer part.'],
       ['Check Body for a part that keeps your dino warm.', 'Look at Body for a part that uses sun to stay warm.']),
  ['warm', 'cold', 'snow']),
  fp('snow.slope', ['Snowy Hill', 'Icy Hill'], ['Cold Hill', 'Slick Hill'], [
    rows(['Get Hook Claws.', 'Get Hook Claws for the snow.', 'Get Hook Claws so you do not slide.', 'Give your dino Hook Claws so it can climb the snowy hill.'],
      ['Pick Hook Claws.', 'Hook Claws grip the snow.', 'Hook Claws or Grabby Hands grip snow.', 'Pick Hook Claws or Grabby Hands to climb without a slide.']),
    rows(['Get Grabby Hands.', 'Get Grabby Hands for ice.', 'Get Grabby Hands to climb the icy hill.', 'The hill is steep and icy, so get Grabby Hands.'],
      ['Pick Hook Claws and Long Tail.', 'Hook Claws and a Long Tail.', 'Use Hook Claws and a Long Tail.', 'Pick Hook Claws and a Long Tail to climb the icy hill.']),
  ], L(['Check Claws.', 'Go to Claws.'], ['Check Claws.', 'Look at Claws.'],
       ['Check Claws for a way to hold on.', 'Look at Claws for grip on ice.'],
       ['Check Claws for parts that give your dino a good grip.', 'Look at Claws for a way to keep from sliding down.']),
  ['steep', 'icy', 'climb']),
  // ------------------------------------------------------------------ birds
  fp('birds.roar', ['Birds on the Nest', 'Lots of Birds', 'So Many Birds'], ['Birds on the Nest', 'Honk at the Nest', 'Big Honk'], [
    rows(['Get Neck Frill.', 'Shake a Neck Frill at them.', 'A loud Neck Frill chases the birds.', 'Give your dino a loud Neck Frill to chase the birds.'],
      ['Pick Crest Head.', 'Honk with a Crest Head.', 'A Crest Head makes a loud honk.', 'Pick a Crest Head or a Neck Frill to make loud noise.']),
    rows(['Get Crest Head.', 'Get a Crest Head to honk.', 'Get a Crest Head for a loud honk.', 'There are lots of birds, so give your dino a Crest Head.'],
      ['Pick Rex Head.', 'Roar with a Rex Head.', 'A Rex Head makes a very loud roar.', 'Pick a Rex Head or a Crest Head to be very loud.']),
    rows(['Get Neck Frill, Rex Head, Huge.', 'Rex Head, Huge size, Neck Frill.', 'Use Rex Head, Huge size and Neck Frill.', 'Get a Rex Head, the Huge size, and a Neck Frill.'],
      ['Pick Neck Frill, Crest Head, Huge.', 'Crest Head, Huge size, Neck Frill.', 'Pick Crest Head, Huge size and Neck Frill.', 'Be loudest with a Crest Head, Huge size, and a Neck Frill.']),
  ], L(['Check Head.', 'Go to Head.'], ['Check Head.', 'Look at Head.'],
       ['Check Head for a part that makes noise.', 'Look at Head for a loud honk.'],
       ['Check Head for a part that makes your dino louder.', 'Look at Extra for a part that can scare the birds.']),
  ['loud', 'birds', 'roar']),
  // ------------------------------------------------------------------ desert
  fp('desert.hide', ['Open Sand', 'Low Sand Hill', 'Flat Sand'], ['Sand Hide', 'Sand Hill', 'Flat Sand'], [
    rows(['Get Sandy Brown.', 'Get Sandy Brown skin.', 'Pick Sandy Brown skin to match the sand.', 'Give your dino Sandy Brown skin so it hides in the sand.'],
      ['Pick Sandy Brown.', 'Use Sandy Brown to hide.', 'Sandy Brown skin looks just like sand.', 'The sand is brown, so pick Sandy Brown skin to hide.']),
    rows(['Get Sandy Brown and Small.', 'Sandy Brown and the Small size.', 'Get Sandy Brown skin and the Small size.', 'Behind a small sand hill, pick Sandy Brown skin and Small size.'],
      ['Pick Sandy Brown and Small.', 'Be Small and Sandy Brown.', 'Use Sandy Brown skin and be Small.', 'Pick Sandy Brown skin and the Small size to hide well.']),
    rows(['Get Slim Body, Sandy Brown, Small.', 'Sandy Brown, Small, Slim Body.', 'Sandy Brown, Small size, Slim Body, Leaf Pattern.', 'Pick Sandy Brown, Small size, a Slim Body, and a Leaf Pattern.'],
      ['Pick Sandy Brown and Small.', 'Sandy Brown skin and Small size.', 'Sandy Brown, Small, Slim Body, Tiger Stripes.', 'Use Sandy Brown skin, Small size, a Slim Body, and Tiger Stripes.']),
  ], L(['Check Color.', 'Go to Color.'], ['Check Color.', 'Look at Color to hide.'],
       ['Check Color for a match with the sand.', 'Look at Color to blend in.'],
       ['Check Color for a part that looks like sand.', 'Look at Color for a way to go unseen on the sand.']),
  ['hide', 'small', 'sand']),
  fp('desert.cool', ['Hot Sun', 'Super Hot Sun'], ['Hot Sun', 'Sun Blast'], [
    rows(['Pop on Neck Frill.', 'Swap Feathers for Neck Frill.', 'Swap the Feathers for a Neck Frill.', 'Feathers are too hot here, so pick a Neck Frill instead.'],
      ['Get Glow Spots.', 'Get Glow Spots instead of Feathers.', 'Pick Glow Spots or Tiger Stripes, not Feathers.', 'Swap Feathers for Glow Spots or Tiger Stripes to stay cool.']),
    rows(['Get Slim Body and Neck Frill.', 'Pick Slim Body and Neck Frill.', 'Get a Slim Body and a Neck Frill.', 'Get a Slim Body and swap the Feathers for a Neck Frill.'],
      ['Pick Slim Body and Glow Spots.', 'Get Slim Body and Glow Spots.', 'Use a Slim Body and Glow Spots.', 'Pick a Slim Body and Glow Spots so your dino stays cool.']),
  ], L(['Check Body.', 'Go to Body.'], ['Check Body to cool off.', 'Look at Body for help.'],
       ['Check Extra for a cooler part.', 'Check Body if the sun is too hot.'],
       ['Check Extra for a part that lets heat out.', 'In the hottest sun, check Body as well as Extra.']),
  ['cool', 'hot', 'sun']),
];

/** One title per scenario, used when a stage has two or more requirements (it fits every facet of the scenario). */
export const DINO_SCENARIO_PHRASES: readonly ScenarioPhrases[] = [
  sp('snack', 'Snack Time', 'Snack Grab'),
  sp('chase', 'Lizard Chase', 'Fast Dash'),
  sp('ferns', 'Ferns and Flowers', 'Hide Spot'),
  sp('ledge', 'Rock Jump', 'Big Jump'),
  sp('burrow', 'Little Tunnel', 'Dig and Fit'),
  sp('tallGrass', 'Nest in the Grass', 'Tall Grass'),
  sp('tallTree', 'Fruit Tree', 'Up a Tree'),
  sp('rocks', 'Rocky Hill', 'Rock Hill'),
  sp('river', 'Fishy River', 'Big Splash'),
  sp('canyon', 'No Bridge', 'Big Gap'),
  sp('nut', 'Nut Snack', 'Hard Shell'),
  sp('log', 'Blocked Path', 'Big Log'),
  sp('snow', 'Snowy Mountain', 'Cold Run'),
  sp('birds', 'Bird Trouble', 'Big Nest'),
  sp('desert', 'Hot Desert', 'Hot Sand'),
];

/** Approved short words for parts in guidelines (besides the variant names). */
export const DINO_PART_ALIASES: Readonly<Record<string, readonly string[]>> = {
  stand: ['move.stand'],
  wings: ['move.fly'],
  frill: ['extra.frill'],
  sandy: ['color.sandy'],
};
