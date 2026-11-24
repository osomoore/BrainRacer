/**
 * Race Shop phrase banks, written for beginning readers (kids 5-9 sounding out words).
 * Each requirement sentence is shown alone under the scenario title: it names the FIX, not the story.
 * Easy: <= 6 short, common words, may name the aspect. Medium: <= 8 words, no part names. Hard: <= 12 plain words.
 * Never name an exact variant (see catalog.test.ts). Scenario intros are dropped: every intro is empty.
 */
import type { FacetPhrases, ReadingLevel, ScenarioPhrases } from '../../core/types';

type Lv = Readonly<Record<ReadingLevel, readonly string[]>>;
const L = (easy: string[], medium: string[], hard: string[]): Lv => ({ easy, medium, hard });
const fp = (facet: string, requirement: Lv[], hint: Lv, vocab: string[]): FacetPhrases => ({ facet, requirement, hint, vocab });

export const RACE_FACET_PHRASES: readonly FacetPhrases[] = [
  fp('mud.grip', [
    L(['Get wheels that grip mud.', 'Get wheels that do not slip.'], ['Get something that grips mud well.', 'Do not get stuck in the mud.'], ['Get a part that keeps the car from slipping in mud.', 'Pick something with a strong grip for soft mud.']),
    L(['Get wheels with more grip.', 'Deep mud needs strong grip.'], ['Get a lot of grip for deep mud.', 'Deep mud needs a very good grip.'], ['Get a part with a very strong grip for deep mud.', 'Deep, sticky mud needs the best grip you can get.']),
    L(['Get the most grip for mud.', 'This mud needs top grip.'], ['Get the best grip for gooey mud.', 'This mud is deep, so grip the most.'], ['Get the strongest grip you can for very deep, gooey mud.', 'Only the best grip will move through this deep mud.']),
  ], L(['Try new wheels.', 'Look at the wheels.'], ['Look at what touches the ground.', 'Some parts grip mud best.'], ['Think about what touches the muddy ground.', 'The part that touches the ground gives grip.']), ['deep', 'slippery', 'sticky', 'powerful']),
  fp('mud.pull', [
    L(['Get a way to pull.', 'Pull the stuck tractor out.'], ['Get a tool to pull the tractor out.', 'You need to pull a stuck tractor.'], ['Bring something that can hook and pull a stuck tractor.', 'Pick a tool that can pull a tractor out.']),
    L(['The tractor is heavy. Get power.', 'Pull a heavy tractor with power.'], ['Pull a heavy tractor with power.', 'You need a tool and strong power.'], ['A heavy tractor needs a pulling tool and strong power.', 'Bring a tool to pull and plenty of power.']),
  ], L(['Look at the extra.', 'Try a new extra.'], ['Look for something that can hook on.', 'A part on your car must pull.'], ['Think about a part that can hook onto the tractor.', 'Which extra part could pull the tractor free?']), ['heavy', 'big', 'powerful', 'sticky']),
  fp('jump.speed', [
    L(['Go fast to jump the gap.', 'Get speed for the jump.'], ['Go fast enough to jump the gap.', 'Get speed to fly over the gap.'], ['Your car needs enough speed to fly over the gap.', 'Go fast so you do not land short.']),
    L(['Long gap. Go very fast.', 'A long jump needs more speed.'], ['Go very fast to jump the long gap.', 'A long gap needs a very fast car.'], ['Your car must be very fast to jump the long gap.', 'The gap is long, so you need a lot of speed.']),
    L(['Huge gap. Go super fast.', 'Get the most speed.'], ['Get top speed to jump the huge gap.', 'Go super fast to cross the big gap.'], ['Go as fast as you can to jump the huge gap.', 'Only the fastest car can jump this big gap.']),
  ], L(['Try new gears.', 'Change a part to go fast.'], ['Think about what makes a car fast.', 'Some parts help you go fast.'], ['Think about which parts make your car go fast.', 'Look for parts that turn power into speed.']), ['fast', 'long', 'wide', 'big']),
  fp('jump.landing', [
    L(['Get springs for a soft landing.', 'Land soft, not with a bump.'], ['Land soft after the big jump.', 'Make the landing soft, not hard.'], ['Your car must land soft after the jump.', 'Pick a part that makes the landing soft.']),
    L(['Big drop! Land very soft.', 'Get springs that are very soft.'], ['The drop is big, so land very soft.', 'Make a very soft landing from up high.'], ['The drop is high, so make the landing very soft.', 'Pick a part that makes a very soft landing.']),
  ], L(['Try new springs.', 'Look at the springs.'], ['Think about what makes a car bounce.', 'Parts under the car make it soft.'], ['Think about which part makes landings soft.', 'Soft parts under the car help a landing.']), ['soft', 'high', 'tall', 'heavy']),
  fp('turn.handling', [
    L(['Get springs that help you turn.', 'Turn fast without a slide.'], ['Turn the sharp corner without a slide.', 'Get a car that turns well.'], ['Your car must turn the sharp corner without sliding.', 'Pick a part that helps the car turn well.']),
    L(['The road twists. Turn well.', 'Get a car that turns well.'], ['The road twists, so turn very well.', 'Turn many corners without a slide.'], ['The road has many turns, so your car must turn well.', 'Pick a part that helps with turn after turn.']),
    L(['Super twisty road! Turn best.', 'Turn super well.'], ['The road is super twisty. Turn best.', 'Zigzag with no slide at all.'], ['Turn as well as you can on this very twisty road.', 'Only the best turner can zigzag along this road.']),
  ], L(['Try new springs.', 'Look at how you turn.'], ['Think about what keeps a car steady.', 'Some parts help in a turn.'], ['Think about which parts keep the car steady in a turn.', 'A steady car turns best, so look under it.']), ['sharp', 'fast', 'tight']),
  fp('hill.power', [
    L(['Get an engine for the hill.', 'Climb the hill with power.'], ['Get power to climb the steep hill.', 'The hill is steep, so get power.'], ['Your car needs power to climb the steep hill.', 'Pick a part with strong power for the hill.']),
    L(['Steep hill. Get much more power.', 'Get lots of power.'], ['Get lots of power for the steep hill.', 'The hill is very steep. Be strong.'], ['A very steep hill needs a lot of power.', 'Pick a part with much more power for this hill.']),
    L(['Huge hill! Get top power.', 'Be super strong.'], ['Get the most power for the steepest hill.', 'This hill is a wall, so be strong.'], ['Get the most power you can to climb this very steep hill.', 'Only the strongest car can climb this hill.']),
  ], L(['Try a new engine.', 'Look at the engine.'], ['Think about what gives power.', 'The part that moves the car.'], ['Think about which part gives the car power.', 'More power comes from the middle of the car.']), ['steep', 'powerful', 'strong']),
  fp('fog.bright', [
    L(['Get bright paint.', 'Paint the car bright.'], ['Make the car bright so ducks see it.', 'Pick a color ducks can see in fog.'], ['Pick a bright color so the ducks can see your car.', 'A dull car hides in fog, so make it bright.']),
  ], L(['Try new paint.', 'Look at the color.'], ['Think about colors that are easy to see.', 'Can ducks see your car?'], ['Think about which colors are easy to see in fog.', 'A dull color hides in fog, so look at paint.']), ['bright', 'dull', 'visible']),
  fp('lowBridge.height', [
    L(['Make the car short to fit.', 'The bridge is low. Be short.'], ['Make the car short to fit under.', 'Get low to go under the bridge.'], ['Your car must be short enough to go under the bridge.', 'Make sure nothing on the car is too tall.']),
    L(['Very low bridge. Be very short.', 'Get a very short car.'], ['The bridge is very low. Be very short.', 'Make the car very short and flat.'], ['The bridge is very low, so make your car very short.', 'Take off anything tall so the car fits under.']),
    L(['Low gap! Be the shortest.', 'Get the shortest car.'], ['Make the car as short as you can.', 'Get the lowest car to fit under.'], ['Make your car as short and flat as it can be.', 'Only the lowest car can fit under this bridge.']),
  ], L(['Try a new size.', 'Look at how tall it is.'], ['Think about the tallest part.', 'Some parts make the car taller.'], ['Think about the tallest part of your car.', 'Which parts make the car tall?']), ['short', 'tall', 'low']),
  fp('narrow.width', [
    L(['Get a thin car to fit.', 'The path is thin. Be small.'], ['Make the car thin to fit through.', 'Go through the thin gap.'], ['Your car must be thin enough to go through the gap.', 'A wide car gets stuck, so make yours thin.']),
    L(['Very thin path. Be very thin.', 'Get the thinnest car.'], ['The gap is very thin. Be very thin.', 'Make the car very small to fit.'], ['The gap is very thin, so make your car very thin.', 'Only a very thin car can go through here.']),
  ], L(['Try a new size.', 'Look at how wide it is.'], ['Think about how wide the car is.', 'Some parts make the car wide.'], ['Think about how wide your car is.', 'Which choices make the car thinner?']), ['narrow', 'wide', 'small']),
  fp('delivery.load', [
    L(['Get room for lots of boxes.', 'Carry boxes to the shop.'], ['Make room to carry many boxes.', 'The car must carry a big load.'], ['Your car needs room to carry many boxes.', 'Pick a car with space for a big load.']),
    L(['Carry a very big load.', 'Get lots of room.'], ['Make lots of room for the boxes.', 'The pile of boxes is very big.'], ['The pile of boxes is very big, so you need much room.', 'Pick a car with lots of space in the back.']),
    L(['Carry the biggest load!', 'Get the most room.'], ['Get the most room you can for boxes.', 'The load is giant, so make room.'], ['Get as much room as you can for this giant load.', 'Only a car with the most space can carry it all.']),
  ], L(['Try a new body.', 'Look at the body.'], ['Think about where the boxes go.', 'Some cars have more room.'], ['Think about how much space the car has.', 'A bigger car can carry more.']), ['big', 'large', 'heavy', 'huge']),
  fp('delivery.power', [
    L(['The boxes are heavy. Get power.', 'Heavy boxes need a strong engine.'], ['The boxes are heavy, so get power.', 'Get strong power to pull a heavy load.'], ['Heavy boxes need a car with strong power.', 'Pick a part with enough power for the ramp.']),
  ], L(['Try a new engine.', 'Look at the engine.'], ['Think about what gives power.', 'Heavy things need more power.'], ['Think about which part gives the car power.', 'A heavy load needs extra power.']), ['heavy', 'strong', 'powerful']),
  fp('snow.grip', [
    L(['Get wheels that grip snow.', 'Do not slide on snow.'], ['Get a grip so you do not slide.', 'Drive on snow without a slide.'], ['Pick a part that grips the road in snow.', 'Your car must not slide on the snowy road.']),
    L(['Deep snow! Get more grip.', 'Get wheels for deep snow.'], ['Get a lot of grip for deep snow.', 'Drive through deep snow without a slide.'], ['Pick a part with a strong grip for deep snow.', 'Deep snow is slippery, so you need more grip.']),
    L(['Snow and ice! Get top grip.', 'Ice is slippery. Get top grip.'], ['Get the best grip for snow and ice.', 'Ice is very slippery, so grip the most.'], ['Get the best grip you can for deep snow and ice.', 'Only the strongest grip will work on this icy road.']),
  ], L(['Try new wheels.', 'Look at the wheels.'], ['Think about what touches the snow.', 'Some parts grip snow best.'], ['Think about which parts grip the snowy road.', 'Grip comes from what touches the ground.']), ['slippery', 'deep']),
  fp('rocks.tough', [
    L(['Get a tough car for rocks.', 'Get strong bumpers for rocks.'], ['Make the car tough to bump rocks.', 'The road is rocky, so be tough.'], ['Your car must be tough enough for a rocky road.', 'Pick parts that can take bumps from rocks.']),
    L(['Lots of rocks! Be more tough.', 'Get a very tough car.'], ['Get a very tough car for big rocks.', 'The rocks are big, so be tough.'], ['Many big rocks need a car that is very tough.', 'Pick parts that can take bump after bump.']),
    L(['The rockiest road! Be the toughest.', 'Get a super tough car.'], ['Get the toughest car for giant rocks.', 'Giant rocks need a super strong car.'], ['Make your car as tough as you can for giant rocks.', 'Only the toughest car will get past these rocks.']),
  ], L(['Try new bumpers.', 'Look at the bumpers.'], ['Think about what keeps a car safe.', 'Some parts take a bump well.'], ['Think about which parts keep the car safe.', 'Parts at the front and back can help.']), ['big', 'strong', 'tough']),
  fp('rocks.clearance', [
    L(['Ride high over the rocks.', 'Lift the car up.'], ['Ride high so rocks go under.', 'Get space under the car.'], ['Your car must ride high so rocks go underneath.', 'Lift your car up to go over the rocks.']),
    L(['Big rocks! Ride very high.', 'Lift the car way up.'], ['Ride very high over the huge rocks.', 'Get lots of space under the car.'], ['Huge rocks need a car that rides very high.', 'Lift your car up a lot to pass over them.']),
  ], L(['Try new springs.', 'Look under the car.'], ['Think about the space under the car.', 'Some parts lift a car up.'], ['Think about the space under your car.', 'Which parts lift the car higher?']), ['high', 'big', 'huge', 'tall']),
  fp('rocks.log', [
    L(['Push the log off the road.', 'Get a front that can push.'], ['Push the log out of the way.', 'The car must push a big log.'], ['Your car must push the log off the road.', 'Pick a strong front that can push a log.']),
    L(['A giant log! Push hard.', 'Push the huge log.'], ['Push hard to move the huge log.', 'The log is giant, so push hard.'], ['The log is huge, so your car must push very hard.', 'Pick a strong front that can move a giant log.']),
  ], L(['Try new bumpers.', 'Look at the front.'], ['Think about what touches the log first.', 'The front does the pushing.'], ['Think about the front of your car.', 'The front part decides how well you push.']), ['big', 'heavy', 'powerful', 'huge']),
  fp('river.cross', [
    L(['Drive through deep water.', 'Get air in deep water.'], ['Drive through the deep water.', 'The car needs air under water.'], ['Your car must get air while it drives in deep water.', 'Pick a part that helps you drive through water.']),
    L(['The river is deep. Float.', 'Make the car float.'], ['The river is very deep, so float.', 'Float across like a boat.'], ['The river is very deep, so your car must float.', 'Pick a part that keeps the car on top of the water.']),
  ], L(['Look at the extra.', 'Try a new extra.'], ['Think about what helps in water.', 'An extra part can help.'], ['Think about a part made for water.', 'Which extra part would help in a river?']), ['deep', 'wide']),
  fp('wobbly.weight', [
    L(['Get a light car.', 'The bridge is wobbly. Be light.'], ['Make the car light for the bridge.', 'A heavy car will fall through.'], ['Your car must be light to cross the old bridge.', 'A heavy car will make the bridge sag.']),
    L(['Very wobbly! Get a light car.', 'Be very light.'], ['The bridge is very wobbly, so be light.', 'Make the car very light to cross.'], ['The bridge is very wobbly, so make your car very light.', 'Take off heavy parts so the car is very light.']),
    L(['Get the lightest car.', 'Be as light as a feather.'], ['Make the car as light as you can.', 'The bridge is thin sticks. Be light.'], ['Make your car as light as it can be to cross.', 'The bridge is made of thin sticks, so use light parts.']),
  ], L(['Try a new size.', 'Look at what is heavy.'], ['Think about which parts are heavy.', 'A small car is light.'], ['Think about which parts add weight.', 'Light parts help on a weak bridge.']), ['light', 'heavy', 'small']),
  fp('beach.range', [
    L(['The beach is far. Go far.', 'Get an engine to go far.'], ['Drive a long way to the beach.', 'Go far and do not stop.'], ['Your car must go a long way to the beach.', 'Pick parts that let the car go far.']),
    L(['Go very far to the beach.', 'A very long trip!'], ['Drive a very long way to the beach.', 'Go very far and do not run out.'], ['The beach is very far, so your car must go very far.', 'Pick parts that let the car drive a very long way.']),
    L(['The longest trip! Go the farthest.', 'Go super far.'], ['Go the farthest you can to the beach.', 'This is the longest trip of all.'], ['Go as far as you can on the longest trip of all.', 'Only the car that goes farthest will reach the beach.']),
  ], L(['Try a new engine.', 'Look at the engine.'], ['Think about what uses up energy.', 'Some cars go farther than others.'], ['Think about which parts use less energy.', 'A light, smooth car goes farther.']), ['long', 'far', 'light']),
  fp('beach.load', [
    L(['Get room for beach toys.', 'Carry toys and towels.'], ['Make room for the beach things.', 'Carry all the toys to the beach.'], ['Your car needs room for all the beach things.', 'Pick a car with space for toys and towels.']),
  ], L(['Try a new body.', 'Where do the toys go?'], ['Think about where the toys will go.', 'Some cars have more room.'], ['Think about how much room the car has.', 'Room can come from the body or the roof.']), ['big', 'small']),
  fp('parade.color', [
    L(['Paint the car red.', 'The car must be red.'], ['The parade needs a red car.', 'Make the car red.'], ['The parade needs a car that is red.', 'Pick the color red for your car.']),
    L(['Paint the car green.', 'The car must be green.'], ['The parade needs a green car.', 'Make the car green.'], ['The parade needs a car that is green.', 'Pick the color green for your car.']),
    L(['Paint the car with all colors.', 'Use every color.'], ['The parade needs every color.', 'Make the car have many colors.'], ['The parade needs a car with every color on it.', 'Pick paint that shows all the colors at once.']),
  ], L(['Try new paint.', 'Look at the color.'], ['Think about what color is needed.', 'The color of the car matters.'], ['Think about the color the parade needs.', 'Read the color clue with care.']), ['bright', 'vivid']),
  fp('night.quiet', [
    L(['Get a quiet engine.', 'Make the car quiet.'], ['Make the car quiet for the sleepers.', 'Do not wake the town.'], ['Your car must be quiet so no one wakes up.', 'Pick a part that makes less noise.']),
    L(['Shh! Be very quiet.', 'Make no sound.'], ['Make the car very quiet.', 'Make almost no sound at all.'], ['Your car must be very quiet so the baby sleeps.', 'Pick a part that makes almost no noise.']),
  ], L(['Try a new engine.', 'Listen to the engine.'], ['Think about which part is loud.', 'Some parts are loud.'], ['Think about which part makes the noise.', 'Loud parts wake sleepers, so find a quiet one.']), ['quiet', 'loud', 'silent']),
  fp('night.hide', [
    L(['Paint the car dark.', 'Hide in the dark.'], ['Make the car dark to hide.', 'The car must be hard to see.'], ['Your car must be dark so it is hard to see.', 'Pick a dark color to hide at night.']),
  ], L(['Try new paint.', 'Look at the color.'], ['Think about colors that are hard to see.', 'The color can help you hide.'], ['Think about which colors are hard to see at night.', 'Your paint can help you hide.']), ['dark', 'hide']),
];

const sp = (scenario: string, title: string[], intro: Lv): ScenarioPhrases => ({ scenario, title, intro });

/** First title = starter title where the scenario has a starter. */
export const RACE_SCENARIO_PHRASES: readonly ScenarioPhrases[] = [
  sp('mud', ['Deep Mud', 'Muddy Field', 'Mud Rescue'], L([], [], [])),
  sp('jump', ['Long Jump', 'Big Ramp', 'Canyon Leap'], L([], [], [])),
  sp('turn', ['Sharp Turn', 'Twisty Road', 'Zigzag Track'], L([], [], [])),
  sp('hill', ['Steep Hill', 'Mountain Climb', 'Up, Up, Up'], L([], [], [])),
  sp('fog', ['Bright Color', 'Foggy Road', 'Duck Crossing'], L([], [], [])),
  sp('lowBridge', ['Low Bridge', 'Duck Under', 'Squeeze Under'], L([], [], [])),
  sp('narrow', ['Narrow Path', 'Skinny Alley', 'Between the Trees'], L([], [], [])),
  sp('delivery', ['Big Delivery', 'Delivery Day', 'Box Hauler'], L([], [], [])),
  sp('snow', ['Snowy Pass', 'Snow Day', 'Icy Road'], L([], [], [])),
  sp('rocks', ['Rocky Road', 'Bumpy Trail', 'Forest Trail'], L([], [], [])),
  sp('river', ['River Crossing', 'Splash Across', 'Deep Water'], L([], [], [])),
  sp('wobbly', ['Wobbly Bridge', 'Creaky Crossing', 'Rope Bridge'], L([], [], [])),
  sp('beach', ['Beach Trip', 'Long Drive', 'Seaside Road'], L([], [], [])),
  sp('parade', ['Parade Day', 'Color Parade', 'Party Parade'], L([], [], [])),
  sp('night', ['Sleepy Town', 'Night Drive', 'Hide and Seek'], L([], [], [])),
];
