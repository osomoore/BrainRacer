/**
 * Race Shop phrase banks, written for beginning readers (kids 5-9 sounding out words).
 * Title = the problem (one per facet level; the scenario title is used when a stage has 2+ requirements).
 * Each requirement line = the FIX: it names the part(s) to pick, by the names shown at the stations
 * (every option for an any-of requirement). Each level has two rows (A, B); a challenge shows one row at all three
 * reading levels, so a row says the same fix three ways. Easy <= 6 words, Medium <= 8, Hard <= 12, and
 * Easy <= Medium <= Hard in length. validateCatalog checks all of this. Scenario intros are empty.
 */
import type { FacetPhrases, ReadingLevel, ScenarioPhrases } from '../../core/types';

type Lv = Readonly<Record<ReadingLevel, readonly string[]>>;
type Row = readonly [easy: string, medium: string, hard: string];
const L = (easy: string[], medium: string[], hard: string[]): Lv => ({ easy, medium, hard });
/** Two rows (A, B) for one facet level. */
const rows = (a: Row, b: Row): Lv => ({ easy: [a[0], b[0]], medium: [a[1], b[1]], hard: [a[2], b[2]] });
const fp = (facet: string, title: string[], requirement: Lv[], hint: Lv, vocab: string[]): FacetPhrases =>
  ({ facet, title, requirement, hint, vocab });

export const RACE_FACET_PHRASES: readonly FacetPhrases[] = [
  fp('mud.grip', ['Muddy Road', 'Deep Mud', 'Very Deep Mud'], [
    rows(['Get Mud Tires.', 'Get Mud Tires so you do not slip.', 'Put on Mud Tires so the wheels grip the soft mud.'],
      ['Pick Mud Tires for the mud.', 'Pick Mud Tires or 4x4 Drive.', 'Pick Mud Tires or 4x4 Drive to grip the mud.']),
    rows(['Get Mud Tires and a Jeep.', 'Deep mud needs Mud Tires and a Jeep.', 'Put Mud Tires on a Jeep so it grips the deep mud.'],
      ['Use Monster Wheels and a Jeep.', 'Monster Wheels on a Jeep grip deep mud.', 'Pick Monster Wheels and a Jeep to get through deep mud.']),
    rows(['Get Mud Tires and 4x4 Drive.', 'Deep mud needs Mud Tires and 4x4 Drive.', 'Mud this deep needs Mud Tires with 4x4 Drive to grip.'],
      ['Use Monster Wheels and 4x4 Drive.', 'Monster Wheels and 4x4 Drive grip best.', 'Put on Monster Wheels and 4x4 Drive for this very deep mud.']),
  ], L(['Try new wheels.', 'Look at the wheels.'], ['Look at what touches the ground.', 'Some parts grip mud best.'], ['Think about what touches the muddy ground.', 'The part that touches the ground gives grip.']), ['deep', 'sticky', 'grip']),
  fp('mud.pull', ['Stuck Tractor', 'Heavy Tractor'], [
    rows(['Get a Winch to pull.', 'Get a Winch to pull the tractor out.', 'Put a Winch on your car to pull the stuck tractor out.'],
      ['Use a Winch on the tractor.', 'Hook a Winch to the stuck tractor.', 'Hook your Winch to the tractor and pull it from the mud.']),
    rows(['Get a Winch and Climbing Gears.', 'Pull with a Winch and Climbing Gears.', 'The tractor is heavy, so use a Winch and Climbing Gears.'],
      ['A Winch and a Big Engine.', 'Get a Winch and a Big Engine.', 'The tractor is heavy, so get a Winch and a Big Engine.']),
  ], L(['Look at the extra.', 'Try a new extra.'], ['Look for something that can hook on.', 'A part on your car must pull.'], ['Think about a part that can hook onto the tractor.', 'Which extra part could pull the tractor free?']), ['heavy', 'pull', 'stuck']),
  fp('jump.speed', ['Jump the Gap', 'Long Gap', 'Huge Gap'], [
    rows(['Get Speed Gears to go fast.', 'Get Speed Gears to jump the gap.', 'Put in Speed Gears so your car goes fast enough to jump.'],
      ['Use a Rocket Booster to jump.', 'A Rocket Booster gets you over the gap.', 'Use a Rocket Booster to fly fast over the gap.']),
    rows(['Use Speed Gears and a Rocket.', 'Get Speed Gears and a Rocket Booster.', 'The gap is long, so get Speed Gears and a Rocket Booster.'],
      ['Get a Sleek Sports Car.', 'A Sleek Sports Car can jump this gap.', 'Pick a Sports Car with a Sleek shape for the long gap.']),
    rows(['Turbo Engine, Rocket, Speed Gears.', 'Add Speed Gears, Turbo Engine, and Rocket.', 'Use Speed Gears, a Turbo Engine, and a Rocket Booster.'],
      ['A Sleek Sports Car with Turbo.', 'A Sleek Sports Car with a Turbo Engine.', 'Pick a Sleek Sports Car with a Turbo Engine for this gap.']),
  ], L(['Try new gears.', 'Change a part to go fast.'], ['Think about what makes a car fast.', 'Some parts help you go fast.'], ['Think about which parts make your car go fast.', 'Look for parts that turn power into speed.']), ['fast', 'long', 'gap']),
  fp('jump.landing', ['Hard Landing', 'Big Drop'], [
    rows(['Get Bouncy Springs to land.', 'Get Bouncy Springs for a soft landing.', 'Put in Bouncy Springs so the car lands soft after the jump.'],
      ['Land soft with Bouncy Springs.', 'Bouncy Springs make the landing soft.', 'Pick Bouncy Springs so the landing is soft, not a bump.']),
    rows(['Get Bouncy Springs and Monster Wheels.', 'Land soft on Bouncy Springs and Monster Wheels.', 'The drop is big, so get Bouncy Springs and Monster Wheels.'],
      ['Use Bouncy Springs and Rubber Bumpers.', 'Land on Bouncy Springs and Rubber Bumpers.', 'Pick Bouncy Springs and Rubber Bumpers to land soft from up high.']),
  ], L(['Try new springs.', 'Look at the springs.'], ['Think about what makes a car bounce.', 'Parts under the car make it soft.'], ['Think about which part makes landings soft.', 'Soft parts under the car help a landing.']), ['soft', 'high', 'drop']),
  fp('turn.handling', ['Sharp Turn', 'Many Turns', 'Super Tight Turns'], [
    rows(['Get Sport Springs to turn.', 'Get Sport Springs to turn without a slide.', 'Put in Sport Springs so the car turns without a slide.'],
      ['Use Racing Tires to turn.', 'Racing Tires help you take the sharp turn.', 'Pick Racing Tires or a Big Spoiler to take the sharp turn.']),
    rows(['Get Sport Springs and Racing Tires.', 'Get Sport Springs and Racing Tires for turns.', 'Many turns are coming, so get Sport Springs and Racing Tires.'],
      ['Use Sport Springs and a Spoiler.', 'Use Sport Springs and a Big Spoiler.', 'Pick Sport Springs and a Big Spoiler for all the turns.']),
    rows(['Sport Springs, Racing Tires, Big Spoiler.', 'Add Sport Springs, Racing Tires, and a Spoiler.', 'Use Sport Springs, Racing Tires, and a Big Spoiler for tight turns.'],
      ['Sport Springs, Racing Tires, Tiny size.', 'Add Sport Springs, Racing Tires, and Tiny size.', 'Pick Sport Springs, Racing Tires, and Tiny size for super tight turns.']),
  ], L(['Try new springs.', 'Look at how you turn.'], ['Think about what keeps a car steady.', 'Some parts help in a turn.'], ['Think about which parts keep the car steady in a turn.', 'A steady car turns best, so look under it.']), ['sharp', 'turn', 'tight']),
  fp('hill.power', ['Steep Hill', 'Very Steep Hill', 'Super Steep Hill'], [
    rows(['Get a Big Engine to climb.', 'Get a Big Engine to climb the hill.', 'Put in a Big Engine so the car can climb the hill.'],
      ['Use Climbing Gears for the hill.', 'Climbing Gears give power to go up.', 'Pick Climbing Gears or a Big Engine to climb the steep hill.']),
    rows(['Climbing Gears and a Big Engine.', 'Get Climbing Gears and a Big Engine.', 'A very steep hill needs Climbing Gears and a Big Engine.'],
      ['Climbing Gears and a Turbo Engine.', 'Use Climbing Gears and a Turbo Engine.', 'Pick Climbing Gears and a Turbo Engine for lots of power.']),
    rows(['Big Engine with Climbing Gears.', 'Get a Big Engine with Climbing Gears.', 'A super steep hill needs a Big Engine with Climbing Gears.'],
      ['Top power: Big Engine, Climbing Gears.', 'Put a Big Engine and Climbing Gears together.', 'Use a Turbo Engine, Climbing Gears, and a Jeep for top power.']),
  ], L(['Try a new engine.', 'Look at the engine.'], ['Think about what gives power.', 'The part that moves the car.'], ['Think about which part gives the car power.', 'More power comes from the middle of the car.']), ['steep', 'power', 'climb']),
  fp('fog.bright', ['Foggy Road'], [
    rows(['Paint it Bright Yellow.', 'Use Bright Yellow so the ducks see you.', 'Pick Bright Yellow paint so the ducks can see you in fog.'],
      ['Use Fire Red or Rainbow paint.', 'Bright paint like Fire Red or Rainbow works.', 'Pick a bright paint, like Fire Red or Rainbow, for the fog.']),
  ], L(['Try new paint.', 'Look at the color.'], ['Think about colors that are easy to see.', 'Can ducks see your car?'], ['Think about which colors are easy to see in fog.', 'A dull color hides in fog, so look at paint.']), ['bright', 'fog', 'see']),
  fp('lowBridge.height', ['Low Bridge', 'Very Low Bridge', 'Super Low Bridge'], [
    rows(['Get the Small size.', 'Pick the Small size to fit under.', 'Make your car the Small size so it fits under the bridge.'],
      ['Get a Sports Car to fit.', 'A low Sports Car fits under the bridge.', 'Pick a Sports Car or Sleek shape to fit under the bridge.']),
    rows(['Get the Tiny size.', 'Pick the Tiny size to fit under.', 'The bridge is very low, so make your car the Tiny size.'],
      ['Small size and a Sports Car.', 'Get a Sports Car in the Small size.', 'Pick a Small Sports Car so it fits under this low bridge.']),
    rows(['Get a Tiny Sports Car.', 'Pick a Tiny Sports Car to fit under.', 'A Tiny Sports Car can fit under this super low bridge.'],
      ['Tiny size and a Sleek shape.', 'Use the Tiny size and a Sleek shape.', 'Pick the Tiny size and a Sleek shape to fit under.']),
  ], L(['Try a new size.', 'Look at how tall it is.'], ['Think about the tallest part.', 'Some parts make the car taller.'], ['Think about the tallest part of your car.', 'Which parts make the car tall?']), ['short', 'low', 'fit']),
  fp('narrow.width', ['Narrow Path', 'Very Narrow Path'], [
    rows(['Pick the Small size to fit.', 'Make the car thin with the Small size.', 'Pick the Small size so the car fits the narrow path.'],
      ['Get a thin, Sleek shape.', 'A Sleek shape makes the car thin.', 'Pick a Sleek shape so your car can fit between the trees.']),
    rows(['Pick the Tiny size to fit.', 'Make the car very thin with Tiny size.', 'The path is very narrow, so make your car the Tiny size.'],
      ['Small size and a Sleek shape.', 'Get the Small size and a Sleek shape.', 'Pick the Small size and a Sleek shape for this path.']),
  ], L(['Try a new size.', 'Look at how wide it is.'], ['Think about how wide the car is.', 'Some parts make the car wide.'], ['Think about how wide your car is.', 'Which choices make the car thinner?']), ['thin', 'wide', 'small']),
  fp('delivery.load', ['Box Delivery', 'Big Delivery', 'Giant Delivery'], [
    rows(['Get a Pickup Truck for boxes.', 'Get a Pickup Truck with room for boxes.', 'Pick a Pickup Truck so there is room for all the boxes.'],
      ['Use a Van to carry boxes.', 'A Van has lots of room for boxes.', 'Pick a Van or the Big size to make room for boxes.']),
    rows(['Get a Van. It holds more.', 'Get a Van to carry this big load.', 'This load is big, so get a Van with lots of room.'],
      ['Pickup Truck and Big size.', 'Get a Pickup Truck in the Big size.', 'Pick a Big Pickup Truck to carry this big load.']),
    rows(['Get a Big Van.', 'Get a Van in the Big size.', 'Only a Van in the Big size can carry this giant load.'],
      ['A Big Van holds the most.', 'Pick a Big Van for the giant load.', 'Get a Van in the Big size so every box fits.']),
  ], L(['Try a new body.', 'Look at the body.'], ['Think about where the boxes go.', 'Some cars have more room.'], ['Think about how much space the car has.', 'A bigger car can carry more.']), ['big', 'room', 'load']),
  fp('delivery.power', ['Heavy Boxes'], [
    rows(['Get a Big Engine for boxes.', 'Get a Big Engine to pull heavy boxes.', 'Heavy boxes need power, so put in a Big Engine.'],
      ['Use Climbing Gears for power.', 'Climbing Gears give power for the heavy load.', 'Pick Climbing Gears or a Turbo Engine to carry the heavy load.']),
  ], L(['Try a new engine.', 'Look at the engine.'], ['Think about what gives power.', 'Heavy things need more power.'], ['Think about which part gives the car power.', 'A heavy load needs extra power.']), ['heavy', 'power']),
  fp('snow.grip', ['Snowy Road', 'Deep Snow', 'Snow and Ice'], [
    rows(['Get Snow Tires.', 'Get Snow Tires so you do not slide.', 'Put on Snow Tires so the wheels grip the snowy road.'],
      ['Use 4x4 Drive in the snow.', 'Snow Tires or 4x4 Drive will grip snow.', 'Pick Snow Tires or 4x4 Drive so the car does not slide.']),
    rows(['Get Snow Tires for deep snow.', 'Deep snow needs Snow Tires to grip.', 'Put on Snow Tires so your car can get through deep snow.'],
      ['Snow Tires grip deep snow.', 'Pick Snow Tires to drive in deep snow.', 'Pick Snow Tires so the car can drive through deep snow.']),
    rows(['Snow Tires and 4x4 Drive.', 'Get Snow Tires and 4x4 Drive for ice.', 'Snow and ice need both Snow Tires and 4x4 Drive.'],
      ['Get Snow Tires and a Jeep.', 'Put Snow Tires on a Jeep for ice.', 'Pick a Jeep with Snow Tires to grip the snow and ice.']),
  ], L(['Try new wheels.', 'Look at the wheels.'], ['Think about what touches the snow.', 'Some parts grip snow best.'], ['Think about which parts grip the snowy road.', 'Grip comes from what touches the ground.']), ['snow', 'ice', 'deep']),
  fp('rocks.tough', ['Bumpy Rocks', 'Big Rocks', 'Giant Rocks'], [
    rows(['Get Rubber Bumpers for rocks.', 'Get Rubber Bumpers to bump off the rocks.', 'Put on Rubber Bumpers so the rocks just bounce off.'],
      ['Use Big Bumpers on rocks.', 'Big Bumpers make the car tough.', 'Pick Big Bumpers or a Jeep so the car is tough enough.']),
    rows(['Rubber Bumpers and a Jeep.', 'Get Rubber Bumpers and a Jeep for rocks.', 'Big rocks need a tough Jeep with Rubber Bumpers.'],
      ['Get Big Bumpers and a Jeep.', 'Put Big Bumpers on a tough Jeep.', 'Pick Big Bumpers and Monster Wheels to roll over big rocks.']),
    rows(['Jeep, Rubber Bumpers, Monster Wheels.', 'Get a Jeep, Rubber Bumpers, and Monster Wheels.', 'Giant rocks need a Jeep, Rubber Bumpers, and Monster Wheels.'],
      ['Rubber Bumpers, Monster Wheels, Round shape.', 'Monster Wheels, Rubber Bumpers, and Round shape.', 'Pick Rubber Bumpers, Monster Wheels, and a Round shape for giant rocks.']),
  ], L(['Try new bumpers.', 'Look at the bumpers.'], ['Think about what keeps a car safe.', 'Some parts take a bump well.'], ['Think about which parts keep the car safe.', 'Parts at the front and back can help.']), ['tough', 'rocks', 'bump']),
  fp('rocks.clearance', ['Tall Rocks', 'Very Tall Rocks'], [
    rows(['Get a Lift Kit.', 'Get a Lift Kit to ride up high.', 'Put on a Lift Kit so the car rides over the rocks.'],
      ['Use Monster Wheels to ride high.', 'Monster Wheels lift the car over rocks.', 'Pick Monster Wheels or a Jeep to ride high over the rocks.']),
    rows(['A Jeep with a Lift Kit.', 'Put a Lift Kit on a Jeep.', 'Put a Lift Kit on a Jeep to ride over tall rocks.'],
      ['Lift Kit and Monster Wheels.', 'Get a Lift Kit and Monster Wheels.', 'Pick a Lift Kit and Monster Wheels to ride very high.']),
  ], L(['Try new springs.', 'Look under the car.'], ['Think about the space under the car.', 'Some parts lift a car up.'], ['Think about the space under your car.', 'Which parts lift the car higher?']), ['high', 'tall', 'lift']),
  fp('rocks.log', ['Log on the Road', 'Huge Log'], [
    rows(['Get a Push Bumper.', 'Get a Push Bumper to move the log.', 'Put on a Push Bumper so your car can push the log.'],
      ['A Push Bumper moves logs.', 'Use a Push Bumper on the big log.', 'Pick a Push Bumper to push the log off the road.']),
    rows(['Push Bumper and a Wedge shape.', 'Get a Push Bumper and a Wedge shape.', 'A huge log needs a Push Bumper and a Wedge shape.'],
      ['Push Bumper and a Winch.', 'Use a Push Bumper and a Winch.', 'Pick a Push Bumper and a Winch to move the huge log.']),
  ], L(['Try new bumpers.', 'Look at the front.'], ['Think about what touches the log first.', 'The front does the pushing.'], ['Think about the front of your car.', 'The front part decides how well you push.']), ['push', 'log', 'huge']),
  fp('river.cross', ['Deep Stream', 'Big River'], [
    rows(['Use Floaties or a Snorkel.', 'Use a Snorkel or Floaties to cross.', 'Use a Snorkel to drive under, or Floaties to float on top.'],
      ['Pick a Snorkel or Floaties.', 'Get Floaties or a Snorkel for the stream.', 'Floaties keep the car up, or a Snorkel lets it drive under.']),
    rows(['Get Floaties to float.', 'Get Floaties so the car floats across.', 'The river is wide and deep, so use Floaties to float across.'],
      ['Use Floaties on the river.', 'Floaties keep the car on top of water.', 'Pick Floaties so your car floats like a boat across the river.']),
  ], L(['Look at the extra.', 'Try a new extra.'], ['Think about what helps in water.', 'An extra part can help.'], ['Think about a part made for water.', 'Which extra part would help in a river?']), ['deep', 'float', 'river']),
  fp('wobbly.weight', ['Wobbly Bridge', 'Very Wobbly Bridge', 'Super Wobbly Bridge'], [
    rows(['Get a light Electric Motor.', 'An Electric Motor makes the car light.', 'Put in a light Electric Motor to cross the old bridge.'],
      ['The Small size is light.', 'Make the car light with the Small size.', 'Pick the Small size or a Sports Car to be light.']),
    rows(['Tiny size makes it very light.', 'Pick the Tiny size to be very light.', 'The bridge is very wobbly, so make your car the Tiny size.'],
      ['Small size and an Electric Motor.', 'Use the Small size and an Electric Motor.', 'Pick an Electric Motor and the Small size to be very light.']),
    rows(['Tiny size and an Electric Motor.', 'Use the Tiny size and an Electric Motor.', 'A Tiny car with an Electric Motor is light enough.'],
      ['A Tiny Sports Car is light.', 'Pick a Tiny Sports Car to be light.', 'Pick a Tiny Sports Car so the bridge does not wobble.']),
  ], L(['Try a new size.', 'Look at what is heavy.'], ['Think about which parts are heavy.', 'A small car is light.'], ['Think about which parts add weight.', 'Light parts help on a weak bridge.']), ['light', 'heavy', 'small']),
  fp('beach.range', ['Long Drive', 'Very Long Drive', 'Longest Drive'], [
    rows(['Get an Efficient Engine.', 'Get an Efficient Engine to go far.', 'Put in an Efficient Engine so the car goes a long way.'],
      ['A Tiny car goes far.', 'The Tiny size lets the car go far.', 'Pick an Efficient Engine or the Tiny size to drive far.']),
    rows(['An Efficient Engine goes far.', 'Get an Efficient Engine for the long drive.', 'The beach is very far, so put in an Efficient Engine.'],
      ['Pick an Efficient Engine.', 'Pick an Efficient Engine to go very far.', 'Pick an Efficient Engine so the car can go very far.']),
    rows(['Efficient Engine and Tiny size.', 'Get an Efficient Engine and the Tiny size.', 'The longest drive needs an Efficient Engine and the Tiny size.'],
      ['Tiny size plus an Efficient Engine.', 'Pick the Tiny size and an Efficient Engine.', 'Pick a Tiny car with an Efficient Engine to go the farthest.']),
  ], L(['Try a new engine.', 'Look at the engine.'], ['Think about what uses up energy.', 'Some cars go farther than others.'], ['Think about which parts use less energy.', 'A light, smooth car goes farther.']), ['far', 'long']),
  fp('beach.load', ['Beach Toys'], [
    rows(['Get a Pickup Truck for toys.', 'Get a Pickup Truck for the beach toys.', 'Pick a Pickup Truck so there is room for toys and towels.'],
      ['Use the Big size for toys.', 'The Big size has room for beach toys.', 'Pick the Big size or a Van to fit the beach toys.']),
  ], L(['Try a new body.', 'Where do the toys go?'], ['Think about where the toys will go.', 'Some cars have more room.'], ['Think about how much room the car has.', 'Room can come from the body or the roof.']), ['big', 'room']),
  fp('parade.color', ['Red Parade', 'Green Parade', 'Rainbow Parade'], [
    rows(['Paint the car Fire Red.', 'Paint the car Fire Red for the parade.', 'The parade needs a red car, so pick Fire Red paint.'],
      ['Use Fire Red paint.', 'Pick Fire Red paint for your car.', 'Make your car red with Fire Red paint for the parade.']),
    rows(['Paint the car Leaf Green.', 'Paint the car Leaf Green for the parade.', 'The parade needs a green car, so pick Leaf Green paint.'],
      ['Use Leaf Green paint.', 'Pick Leaf Green paint for your car.', 'Make your car green with Leaf Green paint for the parade.']),
    rows(['Paint the car Rainbow.', 'Paint the car Rainbow for the parade.', 'The parade needs every color, so pick Rainbow paint.'],
      ['Use Rainbow paint.', 'Pick Rainbow paint for your car.', 'Make your car every color with Rainbow paint for the parade.']),
  ], L(['Try new paint.', 'Look at the color.'], ['Think about what color is needed.', 'The color of the car matters.'], ['Think about the color the parade needs.', 'Read the color clue with care.']), ['red', 'green', 'color']),
  fp('night.quiet', ['Quiet Night', 'Sleeping Baby'], [
    rows(['Get an Electric Motor.', 'Get a quiet Electric Motor for the town.', 'Put in an Electric Motor so the car is quiet at night.'],
      ['Use a quiet Efficient Engine.', 'An Efficient Engine is quiet enough here.', 'Pick an Efficient Engine or Electric Motor so nobody wakes up.']),
    rows(['Use an Electric Motor. Shh!', 'Only an Electric Motor is this quiet.', 'The baby is asleep, so put in a quiet Electric Motor.'],
      ['Pick the Electric Motor.', 'Pick the Electric Motor to make no noise.', 'Pick the Electric Motor so the car makes almost no sound.']),
  ], L(['Try a new engine.', 'Listen to the engine.'], ['Think about which part is loud.', 'Some parts are loud.'], ['Think about which part makes the noise.', 'Loud parts wake sleepers, so find a quiet one.']), ['quiet', 'loud']),
  fp('night.hide', ['Hide at Night'], [
    rows(['Paint the car Night Black.', 'Paint the car Night Black to hide.', 'Pick Night Black paint so your car is hard to see.'],
      ['Use Night Black paint.', 'Night Black paint hides you in the dark.', 'Make your car dark with Night Black paint to hide at night.']),
  ], L(['Try new paint.', 'Look at the color.'], ['Think about colors that are hard to see.', 'The color can help you hide.'], ['Think about which colors are hard to see at night.', 'Your paint can help you hide.']), ['dark', 'hide']),
];

const sp = (scenario: string, title: string): ScenarioPhrases => ({ scenario, title: [title], intro: L([], [], []) });

/** One title per scenario, used when a stage has two or more requirements (it fits every facet of the scenario). */
export const RACE_SCENARIO_PHRASES: readonly ScenarioPhrases[] = [
  sp('mud', 'Muddy Farm Road'),
  sp('jump', 'Ramp Jump'),
  sp('turn', 'Corners Ahead'),
  sp('hill', 'Hill Climb'),
  sp('fog', 'Fog and Ducks'),
  sp('lowBridge', 'Bridge Ahead'),
  sp('narrow', 'Tree Path'),
  sp('delivery', 'Heavy Delivery'),
  sp('snow', 'Snowy Pass'),
  sp('rocks', 'Rocky Trail'),
  sp('river', 'River Ahead'),
  sp('wobbly', 'Old Bridge'),
  sp('beach', 'Beach Trip'),
  sp('parade', 'Color Parade'),
  sp('night', 'Sleepy Town'),
];

/** Approved short words for parts in guidelines (besides the variant names). */
export const RACE_PART_ALIASES: Readonly<Record<string, readonly string[]>> = {
  rocket: ['extra.rocket'],
  spoiler: ['extra.spoiler'],
  turbo: ['engine.turbo'],
};
