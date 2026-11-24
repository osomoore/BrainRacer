/**
 * Dino Lab phrase banks, written for beginning readers (kids 5-9 sounding out words).
 * Title = the problem (one per facet level; the scenario title is used when a stage has 2+ requirements).
 * Each requirement line = the FIX: it names the part(s) to pick, by the names shown at the stations
 * (every option for an any-of requirement). Each level has two rows (A, B); a challenge shows one row at all three
 * reading levels, so a row says the same fix three ways. Easy <= 6 words, Medium <= 8, Hard <= 12, and
 * Easy <= Medium <= Hard in length. validateCatalog checks all of this.
 * Hints: 2 per reading level, same word limits; they point at a station and never give the full answer.
 * Scenario intros are dropped: every intro is empty (the type still needs the field). Plain ASCII.
 */
import type { FacetPhrases, ReadingLevel, ScenarioPhrases } from '../../core/types';

type Lines = readonly string[];
type Tri = readonly [easy: Lines, medium: Lines, hard: Lines];
type Row = readonly [easy: string, medium: string, hard: string];
const tri = ([easy, medium, hard]: Tri): Record<ReadingLevel, Lines> => ({ easy, medium, hard });
const L = (easy: Lines, medium: Lines, hard: Lines): Tri => [easy, medium, hard];
/** Two rows (A, B) for one facet level. */
const rows = (a: Row, b: Row): Tri => [[a[0], b[0]], [a[1], b[1]], [a[2], b[2]]];
const fp = (facet: string, title: string[], levels: Tri[], hint: Tri, vocab: string[]): FacetPhrases =>
  ({ facet, title, requirement: levels.map(tri), hint: tri(hint), vocab });
const sp = (scenario: string, title: string): ScenarioPhrases => ({ scenario, title: [title], intro: tri(L([], [], [])) });

export const DINO_FACET_PHRASES: readonly FacetPhrases[] = [
  // ------------------------------------------------------------------ snack
  fp('snack.bite', ['Beetle Snack', 'Frog Snack', 'Lizard Snack'], [
    rows(['Get Big Teeth to crunch.', 'Get Big Teeth to crunch the beetle shell.', 'Give your dino Big Teeth so it can crunch a hard shell.'],
      ['Pick Big Teeth for the beetle.', 'Big Teeth can bite the hard beetle.', 'Pick Big Teeth or a Rex Head for a big bite.']),
    rows(['Get Sharp Teeth for the frog.', 'Get Sharp Teeth to hold the frog.', 'Give your dino Sharp Teeth so it can hold the frog.'],
      ['Big Teeth and a Rex Head.', 'Use Big Teeth and a Rex Head.', 'Pick Sharp Teeth, or Big Teeth and a Rex Head.']),
    rows(['Get Mega Teeth for the lizard.', 'Get Mega Teeth to gulp the huge lizard.', 'The lizard is huge, so give your dino Mega Teeth.'],
      ['Sharp Teeth and a Rex Head.', 'Use Sharp Teeth and a Rex Head.', 'Pick Mega Teeth, or Sharp Teeth and a Rex Head.']),
  ], L(['Try different teeth.', 'Look at the teeth.'],
       ['Change what your dino bites with.', 'Try a different mouth.'],
       ['Think about what part of your dino does the biting.', 'A mouth for leaves may not crunch shells.']),
  ['teeth', 'crunch', 'bite']),
  fp('snack.bigGulp', ['Giant Beetle', 'Huge Beetle'], [
    rows(['Mega Teeth and the Big size.', 'Get Mega Teeth and the Big size.', 'A giant beetle needs Mega Teeth and the Big size to gulp.'],
      ['Sharp Teeth and the Huge size.', 'Use Sharp Teeth and the Huge size.', 'Pick Sharp Teeth and the Huge size to gulp it down.']),
    rows(['Mega Teeth and the Huge size.', 'Get Mega Teeth and the Huge size.', 'Only Mega Teeth and the Huge size can gulp this beetle.'],
      ['Huge size with Mega Teeth.', 'Make a Huge dino with Mega Teeth.', 'Pick the Huge size with Mega Teeth to gulp the huge beetle.']),
  ], L(['Try bigger teeth.', 'Try a bigger dino.'],
       ['Check the size and the teeth.', 'A small dino cannot gulp big things.'],
       ['Think about how big your dino is and how it bites.', 'A small body cannot hold a giant meal.']),
  ['big', 'huge', 'giant']),
  // ------------------------------------------------------------------ chase (top view)
  fp('chase.speed', ['Fast Lizard', 'Very Fast Lizard', 'Super Fast Lizard'], [
    rows(['Get Long Legs to run fast.', 'Get Long Legs to run after the lizard.', 'Give your dino Long Legs so it can catch the fast lizard.'],
      ['Use a Slim Body for speed.', 'A Slim Body helps your dino run fast.', 'Pick a Slim Body or Long Legs to catch the lizard.']),
    rows(['Long Legs and a Slim Body.', 'Get Long Legs and a Slim Body.', 'To catch it, get Long Legs and a Slim Body.'],
      ['Powerful Legs and a Slim Body.', 'Use Powerful Legs and a Slim Body.', 'Pick Powerful Legs and a Slim Body to run very fast.']),
    rows(['Run fastest with Powerful Legs.', 'Powerful Legs, Slim Body, Tiny Arms, Small size.', 'Pick Powerful Legs, a Slim Body, a Long Tail, and Small size.'],
      ['Get Powerful Legs. Be Small.', 'Powerful Legs, Slim Body, Long Tail, Small size.', 'Use Powerful Legs, a Slim Body, Tiny Arms, and the Small size.']),
  ], L(['Try different legs.', 'Look at the legs.'],
       ['Change how your dino runs.', 'Is your dino too heavy to run?'],
       ['Heavy parts make a dino slow, so try lighter ones.', 'Think about which parts help your dino run fast.']),
  ['fast', 'run', 'legs']),
  fp('chase.quiet', ['Sneak Up', 'Sneak Up Close'], [
    rows(['Be the Small size to sneak.', 'Pick the Small size to sneak up softly.', 'Pick the Small size so the lizard does not see you.'],
      ['A Small dino can sneak.', 'Get the Small size and keep Crawling.', 'Pick the Small size and keep Crawling to sneak up close.']),
    rows(['Small size, Slim Body, Spotty skin.', 'Pick Small size, a Slim Body, and Spotty.', 'Pick the Small size, a Slim Body, and Spotty skin to sneak.'],
      ['Small, Spotty, and a Leaf Pattern.', 'Small size, Spotty skin, and Leaf Pattern.', 'Pick the Small size, Spotty skin, and a Leaf Pattern to hide.']),
  ], L(['Try a smaller dino.', 'Small is hard to see.'],
       ['Big dinos are easy to hear and see.', 'Change the size of your dino.'],
       ['Think about which parts make your dino big or loud.', 'A smaller body is harder to see and hear.']),
  ['small', 'quiet', 'sneak']),
  // ------------------------------------------------------------------ ferns
  fp('ferns.hide', ['Sniffing Dino', 'Short Ferns', 'Few Ferns'], [
    rows(['Get Green skin for the ferns.', 'Pick Green skin to hide in the ferns.', 'Give your dino Green skin so it hides in the green ferns.'],
      ['Use a Leaf Pattern to hide.', 'A Leaf Pattern or Spotty skin hides you.', 'Pick Green, Spotty, or a Leaf Pattern to match the ferns.']),
    rows(['Green skin and the Small size.', 'Get Green skin and the Small size.', 'The ferns are short, so pick Green skin and the Small size.'],
      ['Spotty skin and a Leaf Pattern.', 'Use Spotty skin with a Leaf Pattern.', 'Pick Spotty skin and a Leaf Pattern to hide in short ferns.']),
    rows(['Spotty, Leaf Pattern, and Small size.', 'Pick Spotty, a Leaf Pattern, and Small size.', 'Few ferns: pick Spotty skin, a Leaf Pattern, and Small size.'],
      ['Spotty skin, Small size, Slim Body.', 'Pick Spotty, a Slim Body, and Small size.', 'Pick Spotty skin, a Slim Body, and the Small size to hide.']),
  ], L(['Try a different skin.', 'What color are ferns?'],
       ['Think about the color of the leaves.', 'Maybe your dino stands out too much.'],
       ['Look at how your dino stands out from the leaves.', 'Bright skin is easy to see in the ferns.']),
  ['hide', 'small', 'match']),
  fp('ferns.flowers', ['Flower Patch'], [
    rows(['Get Purple skin.', 'Pick Purple skin to match the flowers.', 'Give your dino Purple skin so it hides in the purple flowers.'],
      ['Use Purple to hide.', 'Purple skin hides you in the flowers.', 'The flowers are purple, so pick Purple skin to hide in them.']),
  ], L(['Try a different skin.', 'Look at the flowers.'],
       ['Look at the color of the flowers.', 'Your skin should match the flowers.'],
       ["Look at the flowers, then change your dino's skin.", 'Hiding works best when the colors match.']),
  ['hide', 'match', 'color']),
  // ------------------------------------------------------------------ ledge
  fp('ledge.jump', ['High Rock', 'Very High Rock', 'Super High Rock'], [
    rows(['Get Long Legs to jump.', 'Get Long Legs to jump up the rock.', 'Give your dino Long Legs so it can jump onto the rock.'],
      ['Pick Long Legs for a jump.', 'Long Legs or Hoppy Legs can jump up.', 'Pick Long Legs or Hoppy Legs to jump up high.']),
    rows(['Get Hoppy Legs to jump high.', 'Get Hoppy Legs to jump very high.', 'The rock is very high, so give your dino Hoppy Legs.'],
      ['Hoppy Legs jump very high.', 'Pick Hoppy Legs for a very high jump.', 'Pick Hoppy Legs so your dino can jump very high.']),
    rows(['Hoppy Legs, Long Tail, Slim Body.', 'Pick Hoppy Legs, Long Tail, and Slim Body.', 'Jump highest with Hoppy Legs, a Long Tail, and a Slim Body.'],
      ['Hoppy Legs, Slim Body, Small size.', 'Use Hoppy Legs, Slim Body, and Small size.', 'Pick Hoppy Legs, a Slim Body, and Small size for this jump.']),
  ], L(['Try different legs.', 'Legs help dinos jump.'],
       ['Change what your dino jumps with.', 'Heavy dinos cannot jump high.'],
       ['Think about which parts help your dino jump.', 'A heavy body makes it hard to jump.']),
  ['high', 'jump', 'legs']),
  // ------------------------------------------------------------------ burrow
  fp('burrow.fit', ['Small Hole', 'Tiny Hole'], [
    rows(['Get the Small size to fit.', 'Pick the Small size for the little hole.', 'Make your dino the Small size so it fits in the hole.'],
      ['A Small dino fits the hole.', 'Only a Small dino can fit in here.', 'The hole is little, so pick the Small size to fit.']),
    rows(['Small size and a Slim Body.', 'Get the Small size and a Slim Body.', 'For the tiny hole, pick Small size and a Slim Body.'],
      ['Be Small with a Slim Body.', 'Use a Slim Body in the Small size.', 'Only a Small dino with a Slim Body fits this tiny hole.']),
  ], L(['Try a smaller dino.', 'Try a thinner body.'],
       ['Change the size of your dino.', 'Maybe its body is too wide.'],
       ['Think about how big and wide your dino is.', 'A big body cannot fit in a small hole.']),
  ['small', 'tiny', 'fit']),
  fp('burrow.dig', ['Dirt Pile', 'Hard Dirt'], [
    rows(['Get Digging Claws.', 'Get Digging Claws to dig through dirt.', 'Give your dino Digging Claws so it can dig through the dirt.'],
      ['Dig with Digging Claws.', 'Digging Claws can dig the dirt away.', 'Pick Digging Claws to dig a way into the hole.']),
    rows(['Digging Claws and a Horn Head.', 'Get Digging Claws and a Horn Head.', 'The dirt is hard, so get Digging Claws and a Horn Head.'],
      ['A Horn Head and Digging Claws.', 'Dig with Digging Claws and a Horn Head.', 'Pick Digging Claws and a Horn Head to dig through hard dirt.']),
  ], L(['Try different claws.', 'Claws help dinos dig.'],
       ['Change what your dino digs with.', 'Its claws may not dig well.'],
       ['Think about which claws are best for digging dirt.', 'Some claws scoop dirt much better than others.']),
  ['dig', 'dirt', 'hard']),
  fp('burrow.dark', ['Dark Tunnel'], [
    rows(['Get Glow Spots.', 'Get Glow Spots to see in the dark.', 'Give your dino Glow Spots to light up the dark tunnel.'],
      ['Use Glow Spots in the dark.', 'Glow Spots light up the dark tunnel.', 'Pick Glow Spots so your dino makes its own light.']),
  ], L(['Try a different extra.', 'Look at the extras.'],
       ['Something extra can make light.', 'Think about how to see in the dark.'],
       ['Think about which extra part could make light.', 'A dino cannot go where it cannot see.']),
  ['dark', 'light', 'glow']),
  // ------------------------------------------------------------------ tall grass
  fp('tallGrass.peek', ['Tall Grass', 'Very Tall Grass', 'Super Tall Grass'], [
    rows(['Standing, Long Neck, or Big size.', 'Pick Standing, a Long Neck, or Big size.', 'To see over the grass, pick Standing, Long Neck, or Big.'],
      ['Long Neck, Standing, or Big size.', 'Get a Long Neck, Standing, or Big size.', 'Peek over with a Long Neck, Standing, or the Big size.']),
    rows(['Get a Long Neck to peek.', 'Get a Long Neck to see the nest.', 'The grass is very tall, so give your dino a Long Neck.'],
      ['Standing and the Big size.', 'Stand up tall with the Big size.', 'Pick Standing and the Big size to see over the grass.']),
    rows(['Long Neck, Huge size, and Standing.', 'Get a Long Neck, Huge size, and Standing.', 'Super tall grass needs a Long Neck, Huge size, and Standing.'],
      ['Long Neck, Big size, and Standing.', 'Pick a Long Neck, Big size, and Standing.', 'Pick Standing, a Long Neck, and the Big size to see.']),
  ], L(['Try a different way to move.', 'Look at head and size.'],
       ['Think about how your dino holds its body.', 'A low dino cannot see far.'],
       ['Think about how high your dino can hold its head.', 'A dino close to the ground cannot see far.']),
  ['tall', 'high', 'see']),
  fp('tallGrass.sneak', ['Grass Hide'], [
    rows(['Get Tiger Stripes to hide.', 'Get Tiger Stripes to hide in the grass.', 'Give your dino Tiger Stripes so it looks like the tall grass.'],
      ['Tiger Stripes hide you.', 'Tiger Stripes look like the tall grass.', 'Pick Tiger Stripes so the big dino cannot see you.']),
  ], L(['Try a different extra.', 'Grass has stripy shadows.'],
       ['Think about marks that look like grass.', 'Something extra on its skin could help.'],
       ['Think about which marks look like blades of grass.', 'Good marks on the skin can help your dino hide.']),
  ['hide', 'grass', 'stripes']),
  // ------------------------------------------------------------------ tall tree
  fp('tallTree.fruit', ['Fruit on a Branch', 'High Fruit', 'Fruit at the Top'], [
    rows(['Get a Long Neck to reach.', 'Get a Long Neck to reach the fruit.', 'Give your dino a Long Neck so it can reach the fruit.'],
      ['Be the Huge size to reach.', 'A Huge dino can reach the fruit.', 'Pick a Long Neck or the Huge size to reach up high.']),
    rows(['Long Neck and Standing.', 'Get a Long Neck and stand up tall.', 'The fruit is high, so stand up with a Long Neck.'],
      ['A Long Neck and Big size.', 'Use a Long Neck and the Big size.', 'Pick a Long Neck and Big size for the high fruit.']),
    rows(['Long Neck, Huge size, Standing.', 'Pick Standing, a Long Neck, and Huge size.', 'Reach the top with a Long Neck, Huge size, and Standing.'],
      ['Long Neck, Grabby Hands, Huge size.', 'A Long Neck, Grabby Hands, and Huge size.', 'Pick a Long Neck, Grabby Hands, and Huge size to grab it.']),
  ], L(['Try a different head.', 'Look at the head.'],
       ['Think about how high your dino can reach.', 'Maybe its head can go higher.'],
       ["Think about which parts lift your dino's head higher.", 'A tall body and a high head help reach fruit.']),
  ['tall', 'high', 'reach']),
  fp('tallTree.shake', ['Stuck Fruit', 'Thick Tree'], [
    rows(['Get a Heavy Tail to shake.', 'Get a Heavy Tail to shake the tree.', 'Give your dino a Heavy Tail to shake the fruit down.'],
      ['Be the Huge size to shake.', 'A Huge dino can shake the tree.', 'Pick a Heavy Tail or Huge size to shake the tree hard.']),
    rows(['Heavy Tail and a Big Belly.', 'Get a Heavy Tail and a Big Belly.', 'For a thick tree, get a Heavy Tail and Big Belly.'],
      ['Huge size and a Horn Head.', 'Use the Huge size and a Horn Head.', 'Pick Huge size and a Horn Head to shake the thick tree.']),
  ], L(['Try a bigger dino.', 'Big dinos are strong.'],
       ['Think about how strong your dino is.', 'A bigger dino pushes harder.'],
       ['Think about which parts add strength and weight.', 'A small dino cannot move a thick tree.']),
  ['big', 'strong', 'shake']),
  // ------------------------------------------------------------------ rocks
  fp('rocks.climb', ['Rock Pile', 'Steep Rocks', 'Very Steep Rocks'], [
    rows(['Get Hook Claws to climb.', 'Get Hook Claws to climb the rocks.', 'Give your dino Hook Claws to climb the pile of rocks.'],
      ['Climb with Hook Claws.', 'Hook Claws or Grabby Hands can climb.', 'Pick Hook Claws or Grabby Hands to hold on and climb.']),
    rows(['Grabby Hands and a Long Tail.', 'Get Grabby Hands and a Long Tail.', 'The rocks are steep, so get Grabby Hands and a Long Tail.'],
      ['Grabby Hands and a Slim Body.', 'Climb with Grabby Hands and a Slim Body.', 'Pick Grabby Hands and a Slim Body to climb the steep rocks.']),
    rows(['Grabby Hands, Long Tail, Slim Body.', 'Grabby Hands, Long Tail, Slim Body, Small size.', 'Pick Grabby Hands, a Long Tail, a Slim Body, and Small size.'],
      ['Climb best with Grabby Hands.', 'Grabby Hands, Powerful Legs, Long Tail, Slim Body.', 'Use Grabby Hands, Powerful Legs, a Long Tail, and a Slim Body.']),
  ], L(['Try different claws.', 'Claws help dinos climb.'],
       ['Think about what your dino holds on with.', 'Heavy dinos slide down rocks.'],
       ['Think about which parts help your dino grip the rocks.', 'A lighter dino can climb up more easily.']),
  ['steep', 'grip', 'climb']),
  fp('rocks.tough', ['Falling Stones', 'Falling Rocks'], [
    rows(['Get Armor Plates.', 'Get Armor Plates so stones bounce off.', 'Give your dino Armor Plates so falling stones bounce off.'],
      ['A Spiked Tail makes you tough.', 'Armor Plates or a Spiked Tail are tough.', 'Pick Armor Plates or a Spiked Tail so stones bounce off.']),
    rows(['Armor Plates and a Spiked Tail.', 'Get Armor Plates and a Spiked Tail.', 'Big rocks fall here, so get Armor Plates and a Spiked Tail.'],
      ['Armor Plates and the Huge size.', 'Use Armor Plates and the Huge size.', 'Pick Armor Plates and the Huge size so big rocks bounce off.']),
  ], L(['Try a different body.', 'Be tough.'],
       ['Think about what protects your dino.', 'Its back needs more cover.'],
       ["Think about which parts could cover your dino's back.", 'Soft skin cannot stop a falling rock.']),
  ['tough', 'rocks', 'stones']),
  // ------------------------------------------------------------------ river
  fp('river.swim', ['Calm River', 'Wide River', 'Fast River'], [
    rows(['Get Flippers to swim.', 'Get Flippers to swim across the river.', 'Give your dino Flippers so it can swim across the calm river.'],
      ['Use a Paddle Tail to swim.', 'A Paddle Tail or Flippers help you swim.', 'Pick Flippers, a Paddle Tail, or Swimming to cross the river.']),
    rows(['Pick Swimming to cross.', 'Pick Swimming to cross the wide river.', 'The river is wide, so pick Swimming to get across.'],
      ['Get Flippers for the wide river.', 'Flippers help your dino swim a long way.', 'Pick Flippers or Swimming so your dino can swim far.']),
    rows(['Swimming and a Paddle Tail.', 'Use Swimming and a Paddle Tail.', 'The river is fast, so pick Swimming and a Paddle Tail.'],
      ['Flippers and a Paddle Tail.', 'Get Flippers and a Paddle Tail to swim.', 'Pick Flippers and a Paddle Tail to swim in the fast river.']),
  ], L(['Try different legs.', 'Legs can help swim.'],
       ['Think about what your dino swims with.', 'Heavy parts can make a dino sink.'],
       ['Think about which legs and tail help in water.', 'Some dinos are made for land, not water.']),
  ['wide', 'swim', 'fast']),
  fp('river.fish', ['Shy Fish'], [
    rows(['Get Sky Blue skin.', 'Pick Sky Blue skin to match the water.', 'Give your dino Sky Blue skin so fish do not see it.'],
      ['Use Sky Blue to hide.', 'Sky Blue skin looks like the water.', 'Water is blue, so pick Sky Blue skin to hide from fish.']),
  ], L(['Try a different skin.', 'What color is water?'],
       ['Think about the color of the river.', 'A fish swims away from bright skin.'],
       ["Look at the water, then change your dino's skin color.", 'Bright skin is easy for a fish to see.']),
  ['hide', 'match', 'color']),
  // ------------------------------------------------------------------ canyon
  fp('canyon.fly', ['Deep Gap', 'Wide Gap', 'Very Wide Gap'], [
    rows(['Pick Flying to cross.', 'Pick Flying so your dino can cross.', 'There is no bridge, so pick Flying to cross the deep gap.'],
      ['Use wings: pick Flying.', 'Flying lets your dino go over the gap.', 'Pick Flying so your dino can fly over the deep gap.']),
    rows(['Flying and a Slim Body.', 'Fly far with Flying and a Slim Body.', 'The gap is wide, so pick Flying and a Slim Body.'],
      ['Pick Flying and be Small.', 'Pick Flying and the Small size.', 'Pick Flying and stay small, not Big or Huge, to fly far.']),
    rows(['Flying and the Small size.', 'Use Flying and the Small size to cross.', 'The gap is very wide, so pick Flying and the Small size.'],
      ['A Small dino with Flying.', 'Pick Flying for a Small, light dino.', 'Pick Small size and Flying to fly over the very wide gap.']),
  ], L(['Try a different way to move.', 'Can your dino fly?'],
       ['Think about how your dino moves.', 'Big dinos get tired when they fly.'],
       ['Think about how your dino moves and how heavy it is.', 'A heavy dino cannot stay up for long.']),
  ['wide', 'gap', 'fly']),
  // ------------------------------------------------------------------ nut
  fp('nut.crack', ['Hard Nut', 'Very Hard Nut', 'Giant Nut'], [
    rows(['Get a Beak to crack it.', 'Get a Beak to crack the hard nut.', 'Give your dino a Beak so it can crack the hard nut.'],
      ['Crack it with a Horn Head.', 'A Horn Head or a Beak cracks nuts.', 'Pick a Horn Head or a Beak to crack the hard shell.']),
    rows(['Get a Beak for this nut.', 'Pick a Beak for the very hard nut.', 'The nut is very hard, so give your dino a strong Beak.'],
      ['Horn Head and Big Teeth.', 'Use a Horn Head and Big Teeth.', 'Pick a Horn Head and Big Teeth to crack this nut.']),
    rows(['A Beak and a Horn Head.', 'Get a Beak and a Horn Head.', 'The nut is giant, so get a Beak and a Horn Head.'],
      ['Horn Head plus a Beak.', 'Crack it with a Beak and Horn Head.', 'Pick a Beak and a Horn Head to crack this giant nut.']),
  ], L(['Try different teeth.', 'Look at the teeth.'],
       ['Think about what your dino bites with.', 'Its mouth may be too soft.'],
       ['Think about which mouth is best for hard shells.', 'Some mouths are made to crack hard things.']),
  ['hard', 'crack', 'nut']),
  // ------------------------------------------------------------------ log
  fp('log.push', ['Log on the Path', 'Heavy Log', 'Giant Log'], [
    rows(['Push with a Horn Head.', 'Get a Horn Head to push the log.', 'Give your dino a Horn Head to push the log away.'],
      ['Get a Heavy Tail to push.', 'A Heavy Tail or Big Belly pushes logs.', 'Pick a Heavy Tail or Big Belly to push the log away.']),
    rows(['Be the Huge size to push.', 'Pick the Huge size to push the log.', 'The log is heavy, so make your dino the Huge size.'],
      ['Horn Head and a Heavy Tail.', 'Use a Horn Head and a Heavy Tail.', 'Pick a Horn Head and a Heavy Tail to push it away.']),
    rows(['Huge size and a Heavy Tail.', 'Get the Huge size and a Heavy Tail.', 'The log is giant, so pick Huge size and a Heavy Tail.'],
      ['Be Huge with a Heavy Tail.', 'Make a Huge dino with a Heavy Tail.', 'Push the giant log with a Huge dino and a Heavy Tail.']),
  ], L(['Try a different head.', 'Look at the head.'],
       ['Think about what your dino pushes with.', 'A bigger dino pushes harder.'],
       ['Think about which parts add strength and weight.', 'A small dino cannot move a heavy log.']),
  ['heavy', 'push', 'log']),
  // ------------------------------------------------------------------ snow
  fp('snow.warm', ['Cold Snow', 'Snow Storm'], [
    rows(['Get a warm Back Sail.', 'Get a Back Sail to stay warm.', 'Give your dino a Back Sail to stay warm in the snow.'],
      ['Keep Feathers and be Big.', 'Keep your Feathers and pick the Big size.', 'Pick a Big Belly or the Big size to stay warm.']),
    rows(['A Back Sail and Big size.', 'Pick a Back Sail and the Big size.', 'For the cold storm, get a Back Sail and Big size.'],
      ['Big Belly and the Huge size.', 'Get a Big Belly and the Huge size.', 'Keep your Feathers and get a Big Belly and Huge size.']),
  ], L(['Try a different body.', 'Look for something warm.'],
       ['Think about what keeps your dino warm.', 'A thin body gets cold fast.'],
       ['Think about which parts keep heat in or take in sun.', 'A thin body loses heat very fast.']),
  ['warm', 'cold', 'snow']),
  fp('snow.slope', ['Snowy Hill', 'Icy Hill'], [
    rows(['Get Hook Claws for the snow.', 'Get Hook Claws so you do not slide.', 'Give your dino Hook Claws so it can climb the snowy hill.'],
      ['Hook Claws grip the snow.', 'Hook Claws or Grabby Hands grip snow.', 'Pick Hook Claws or Grabby Hands to climb without a slide.']),
    rows(['Get Grabby Hands for ice.', 'Get Grabby Hands to climb the icy hill.', 'The hill is steep and icy, so get Grabby Hands.'],
      ['Hook Claws and a Long Tail.', 'Use Hook Claws and a Long Tail.', 'Pick Hook Claws and a Long Tail to climb the icy hill.']),
  ], L(['Try different claws.', 'Claws help on ice.'],
       ['Think about what your dino holds on with.', 'Heavy dinos slide down icy hills.'],
       ['Think about which parts give your dino a good grip.', 'Without a grip, a dino slides back down.']),
  ['steep', 'icy', 'climb']),
  // ------------------------------------------------------------------ birds
  fp('birds.roar', ['Birds on the Nest', 'Lots of Birds', 'So Many Birds'], [
    rows(['Shake a Neck Frill at them.', 'A loud Neck Frill chases the birds.', 'Give your dino a loud Neck Frill to chase the birds.'],
      ['Honk with a Crest Head.', 'A Crest Head makes a loud honk.', 'Pick a Crest Head or a Neck Frill to make loud noise.']),
    rows(['Get a Crest Head to honk.', 'Get a Crest Head for a loud honk.', 'There are lots of birds, so give your dino a Crest Head.'],
      ['Roar with a Rex Head.', 'A Rex Head makes a very loud roar.', 'Pick a Rex Head or a Crest Head to be very loud.']),
    rows(['Rex Head, Huge size, Neck Frill.', 'Use a Rex Head, Huge size, and Frill.', 'Get a Rex Head, the Huge size, and a Neck Frill.'],
      ['Crest Head, Huge size, Neck Frill.', 'Pick a Crest Head, Huge size, and Frill.', 'Be loudest with a Crest Head, Huge size, and a Neck Frill.']),
  ], L(['Try a different head.', 'Some heads are loud.'],
       ['Think about how your dino makes noise.', 'A bigger head makes a bigger sound.'],
       ["Think about which parts make your dino's voice louder.", 'A quiet dino cannot chase these birds.']),
  ['loud', 'birds', 'roar']),
  // ------------------------------------------------------------------ desert
  fp('desert.hide', ['Open Sand', 'Small Sand Hill', 'Flat Sand'], [
    rows(['Get Sandy Brown skin.', 'Pick Sandy Brown skin to match the sand.', 'Give your dino Sandy Brown skin so it hides in the sand.'],
      ['Use Sandy Brown to hide.', 'Sandy Brown skin looks just like sand.', 'The sand is brown, so pick Sandy Brown skin to hide.']),
    rows(['Sandy Brown and the Small size.', 'Get Sandy Brown skin and the Small size.', 'Behind a small sand hill, pick Sandy Brown skin and Small size.'],
      ['Be Small and Sandy Brown.', 'Use Sandy Brown skin and be Small.', 'Pick Sandy Brown skin and the Small size to hide well.']),
    rows(['Sandy Brown, Small, Slim Body.', 'Sandy Brown, Small size, Slim Body, Leaf Pattern.', 'Pick Sandy Brown, Small size, a Slim Body, and a Leaf Pattern.'],
      ['Sandy Brown skin and Small size.', 'Sandy Brown, Small, Slim Body, Tiger Stripes.', 'Use Sandy Brown skin, Small size, a Slim Body, and Tiger Stripes.']),
  ], L(['Try a different skin.', 'What color is sand?'],
       ['Think about the color of the desert.', 'Maybe your dino stands out too much.'],
       ['Look at how your dino stands out in the sand.', 'Bright skin is easy to see on sand.']),
  ['hide', 'small', 'sand']),
  fp('desert.cool', ['Hot Sun', 'Super Hot Sun'], [
    rows(['Swap Feathers for a Neck Frill.', 'Swap the warm Feathers for a Neck Frill.', 'Feathers are too hot here, so pick a Neck Frill instead.'],
      ['Pick Glow Spots, not Feathers.', 'Use Glow Spots or Tiger Stripes, not Feathers.', 'Pick any Extra but Feathers, like Glow Spots, to stay cool.']),
    rows(['Slim Body and a Neck Frill.', 'Get a Slim Body and a Neck Frill.', 'Get a Slim Body and swap the Feathers for a Neck Frill.'],
      ['Slim Body and Glow Spots.', 'Use a Slim Body and Glow Spots.', 'Pick a Slim Body and Glow Spots so your dino stays cool.']),
  ], L(['Try a different extra.', 'Fluffy things are hot.'],
       ['Think about what makes your dino warm.', 'A fluffy coat is too warm here.'],
       ['Think about which parts keep heat in your dino.', 'Warm parts help in snow, but not in sand.']),
  ['cool', 'hot', 'sun']),
];

/** One title per scenario, used when a stage has two or more requirements (it fits every facet of the scenario). */
export const DINO_SCENARIO_PHRASES: readonly ScenarioPhrases[] = [
  sp('snack', 'Snack Time'),
  sp('chase', 'Lizard Chase'),
  sp('ferns', 'Ferns and Flowers'),
  sp('ledge', 'Rock Jump'),
  sp('burrow', 'Little Tunnel'),
  sp('tallGrass', 'Nest in the Grass'),
  sp('tallTree', 'Fruit Tree'),
  sp('rocks', 'Rocky Hill'),
  sp('river', 'Fishy River'),
  sp('canyon', 'No Bridge'),
  sp('nut', 'Nut Snack'),
  sp('log', 'Blocked Path'),
  sp('snow', 'Snowy Mountain'),
  sp('birds', 'Bird Trouble'),
  sp('desert', 'Hot Desert'),
];

/** Approved short words for parts in guidelines (besides the variant names). */
export const DINO_PART_ALIASES: Readonly<Record<string, readonly string[]>> = {
  stand: ['move.stand'],
  wings: ['move.fly'],
  frill: ['extra.frill'],
  sandy: ['color.sandy'],
};
