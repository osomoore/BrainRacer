/**
 * Race Shop phrase banks, written for beginning readers (kids 5-9 sounding out words).
 * Title = the problem (one per facet level; the scenario title is used when a stage has 2+ requirements).
 * Each requirement line = the FIX: it names the part(s) to pick, by the names shown at the stations
 * (every option for an any-of requirement). Each level has two rows (A, B); a challenge shows one row at all four
 * reading levels, so a row says the same fix four ways. Easy <= 6 words, Medium <= 8, Hard <= 12, and
 * Easy <= Medium <= Hard in length. validateCatalog checks all of this. Scenario intros are empty.
 */
import type { FacetPhrases, LeveledPhrases, ScenarioPhrases } from '../../core/types';

type Row = readonly [starter: string, easy: string, medium: string, hard: string];
const L = (starter: string[], easy: string[], medium: string[], hard: string[]): LeveledPhrases => ({ starter, easy, medium, hard });
/** Two rows (A, B) for one facet level. */
const rows = (a: Row, b: Row): LeveledPhrases => L([a[0], b[0]], [a[1], b[1]], [a[2], b[2]], [a[3], b[3]]);
const fp = (facet: string, title: string[], starterTitle: string[], requirement: LeveledPhrases[], hint: LeveledPhrases, vocab: string[]): FacetPhrases =>
  ({ facet, title, starterTitle, requirement, hint, vocab });

export const RACE_FACET_PHRASES: readonly FacetPhrases[] = [
  fp('mud.grip', ['Muddy Road', 'Deep Mud', 'Very Deep Mud'], ['Sticky Mud', 'Thick Mud', 'Deep Mud'], [
    rows(['Get Mud Tires to grip.', 'Get Mud Tires.', 'Get Mud Tires so you do not slip.', 'Put on Mud Tires so the wheels grip the soft mud.'],
      ['Pick Mud Tires.', 'Pick Mud Tires for the mud.', 'Pick Mud Tires or 4x4 Drive.', 'Pick Mud Tires or 4x4 Drive to grip the mud.']),
    rows(['Get Jeep and Mud Tires.', 'Get Mud Tires and a Jeep.', 'Deep mud needs Mud Tires and a Jeep.', 'Put Mud Tires on a Jeep so it grips the deep mud.'],
      ['Pick Jeep and Monster Wheels.', 'Use Monster Wheels and a Jeep.', 'Monster Wheels on a Jeep grip deep mud.', 'Pick Monster Wheels and a Jeep to get through deep mud.']),
    rows(['Get 4x4 Drive and Mud Tires.', 'Get Mud Tires and 4x4 Drive.', 'Deep mud needs Mud Tires and 4x4 Drive.', 'Mud this deep needs Mud Tires with 4x4 Drive to grip.'],
      ['Pick 4x4 Drive and Monster Wheels.', 'Use Monster Wheels and 4x4 Drive.', 'Monster Wheels and 4x4 Drive grip best.', 'Put on Monster Wheels and 4x4 Drive for this very deep mud.']),
  ], L(['Check Wheels.', 'Go to Wheels.'], ['Check Wheels.', 'Look at Wheels.'], ['Check Wheels for more grip.', 'Look at Wheels for a part that grips.'], ['Check Wheels for a part that will grip in the mud.', 'Look at Wheels for a way to keep from spinning.']), ['deep', 'sticky', 'grip']),
  fp('mud.pull', ['Stuck Tractor', 'Heavy Tractor'], ['Stuck Tractor', 'Big Tractor'], [
    rows(['Get Winch.', 'Get a Winch to pull.', 'Get a Winch to pull the tractor out.', 'Put a Winch on your car to pull the stuck tractor out.'],
      ['Pick Winch.', 'Use a Winch on the tractor.', 'Hook a Winch to the stuck tractor.', 'Hook your Winch to the tractor and pull it from the mud.']),
    rows(['Get Winch and Climbing Gears.', 'Get a Winch and Climbing Gears.', 'Pull with a Winch and Climbing Gears.', 'The tractor is heavy, so use a Winch and Climbing Gears.'],
      ['Pick Big Engine and Winch.', 'A Winch and a Big Engine.', 'Get a Winch and a Big Engine.', 'The tractor is heavy, so get a Winch and a Big Engine.']),
  ], L(['Check Extra.', 'Go to Extra.'], ['Check Extra.', 'Look at Extra.'], ['Check Extra for a part that hooks on.', 'Check Extra for a part that can pull.'], ['Check Extra for a part that can hook onto the tractor.', 'Look at Extra for a part that could pull the tractor free.']), ['heavy', 'pull', 'stuck']),
  fp('jump.speed', ['Jump the Gap', 'Long Gap', 'Huge Gap'], ['Ramp and Gap', 'Long Gap', 'Big Gap'], [
    rows(['Get Speed Gears.', 'Get Speed Gears to go fast.', 'Get Speed Gears to jump the gap.', 'Put in Speed Gears so your car goes fast enough to jump.'],
      ['Pick Rocket Booster.', 'Use a Rocket Booster to jump.', 'A Rocket Booster gets you over the gap.', 'Use a Rocket Booster to fly fast over the gap.']),
    rows(['Get Rocket Booster and Speed Gears.', 'Use Speed Gears and Rocket Booster.', 'Get Speed Gears and a Rocket Booster.', 'The gap is long, so get Speed Gears and a Rocket Booster.'],
      ['Pick Sports Car and Sleek.', 'Get a Sleek Sports Car.', 'A Sleek Sports Car can jump this gap.', 'Pick a Sports Car with a Sleek shape for the long gap.']),
    rows(['Get Turbo Engine. Get Rocket Booster and Speed Gears.', 'Turbo Engine, Rocket Booster, Speed Gears.', 'Add Speed Gears, Turbo Engine, and Rocket Booster.', 'Use Speed Gears, a Turbo Engine, and a Rocket Booster.'],
      ['Pick Sports Car, Turbo Engine, Sleek.', 'Sleek Sports Car with Turbo Engine.', 'A Sleek Sports Car with a Turbo Engine.', 'Pick a Sleek Sports Car with a Turbo Engine for this gap.']),
  ], L(['Check Gears.', 'Go to Gears.'], ['Check Engine.', 'Check Engine for more speed.'], ['Check Engine for more speed.', 'Look at Gears for more speed.'], ['Check Engine or Gears for parts that make your car go fast.', 'Check Gears for parts that turn power into speed.']), ['fast', 'long', 'gap']),
  fp('jump.landing', ['Hard Landing', 'Long Drop'], ['Hard Bump', 'Big Drop'], [
    rows(['Get Bouncy Springs.', 'Get Bouncy Springs to land.', 'Get Bouncy Springs for a soft landing.', 'Put in Bouncy Springs so the car lands soft after the jump.'],
      ['Pick Bouncy Springs.', 'Land soft with Bouncy Springs.', 'Bouncy Springs make the landing soft.', 'Pick Bouncy Springs so the landing is soft, not a bump.']),
    rows(['Fit Bouncy Springs and Monster Wheels.', 'Get Bouncy Springs and Monster Wheels.', 'Land soft on Bouncy Springs and Monster Wheels.', 'The drop is big, so get Bouncy Springs and Monster Wheels.'],
      ['Pick Rubber Bumpers and Bouncy Springs.', 'Use Bouncy Springs and Rubber Bumpers.', 'Land on Bouncy Springs and Rubber Bumpers.', 'Pick Bouncy Springs and Rubber Bumpers to land soft from up high.']),
  ], L(['Check Springs.', 'Go to Springs.'], ['Check Springs.', 'Look at Springs.'], ['Check Springs for a softer ride.', 'Look at Springs for a soft landing.'], ['Check Springs for a part that makes landings soft.', 'Look at Springs for a part that softens the bump.']), ['soft', 'high', 'drop']),
  fp('turn.handling', ['Sharp Turn', 'Many Turns', 'Super Tight Turns'], ['Sharp Bend', 'Twist and Bend', 'Hard Bends'], [
    rows(['Get Sport Springs.', 'Get Sport Springs to turn.', 'Get Sport Springs to turn without a slide.', 'Put in Sport Springs so the car turns without a slide.'],
      ['Pick Racing Tires.', 'Use Racing Tires to turn.', 'Racing Tires help you take the sharp turn.', 'Pick Racing Tires or a Big Spoiler to take the sharp turn.']),
    rows(['Fit Sport Springs and Racing Tires.', 'Get Sport Springs and Racing Tires.', 'Get Sport Springs and Racing Tires for turns.', 'Many turns are coming, so get Sport Springs and Racing Tires.'],
      ['Pick Big Spoiler and Sport Springs.', 'Use Sport Springs and Big Spoiler.', 'Use Sport Springs and a Big Spoiler.', 'Pick Sport Springs and a Big Spoiler for all the turns.']),
    rows(['Get Big Spoiler. Get Sport Springs and Racing Tires.', 'Sport Springs, Racing Tires, Big Spoiler.', 'Add Sport Springs, Racing Tires, and Big Spoiler.', 'Use Sport Springs, Racing Tires, and a Big Spoiler for tight turns.'],
      ['Pick Tiny, Sport Springs, Racing Tires.', 'Sport Springs, Racing Tires, Tiny size.', 'Add Sport Springs, Racing Tires, and Tiny size.', 'Pick Sport Springs, Racing Tires, and Tiny size for super tight turns.']),
  ], L(['Check Springs.', 'Go to Springs.'], ['Check Wheels.', 'Look at Wheels.'], ['Check Springs for a steadier ride.', 'Look at Wheels for grip in turns.'], ['Check Wheels or Springs for parts that keep the car steady.', 'Check Springs for a steadier ride.']), ['sharp', 'turn', 'tight']),
  fp('hill.power', ['Steep Hill', 'Very Steep Hill', 'Super Steep Hill'], ['Big Hill', 'Steep Hill', 'Top of the Hill'], [
    rows(['Get Big Engine.', 'Get a Big Engine to climb.', 'Get a Big Engine to climb the hill.', 'Put in a Big Engine so the car can climb the hill.'],
      ['Pick Climbing Gears.', 'Use Climbing Gears for the hill.', 'Climbing Gears give power to go up.', 'Pick Climbing Gears or a Big Engine to climb the steep hill.']),
    rows(['Get Big Engine and Climbing Gears.', 'Climbing Gears and a Big Engine.', 'Get Climbing Gears and a Big Engine.', 'A very steep hill needs Climbing Gears and a Big Engine.'],
      ['Pick Turbo Engine and Climbing Gears.', 'Climbing Gears and a Turbo Engine.', 'Use Climbing Gears and a Turbo Engine.', 'Pick Climbing Gears and a Turbo Engine for lots of power.']),
    rows(['Get Big Engine and Climbing Gears.', 'Big Engine with Climbing Gears.', 'Get a Big Engine with Climbing Gears.', 'A super steep hill needs a Big Engine with Climbing Gears.'],
      ['Pick Big Engine and Climbing Gears.', 'Top power: Big Engine, Climbing Gears.', 'Put a Big Engine and Climbing Gears together.', 'Use a Turbo Engine, Climbing Gears, and a Jeep for top power.']),
  ], L(['Check Engine.', 'Go to Engine.'], ['Check Engine.', 'Look at Engine.'], ['Check Engine for more power.', 'Look at Engine for a stronger part.'], ['Check Engine for a part that can pull the car uphill.', 'Check Gears for a part that gives the car more power.']), ['steep', 'power', 'climb']),
  fp('fog.bright', ['Foggy Road'], ['Thick Fog'], [
    rows(['Get Bright Yellow.', 'Paint it Bright Yellow.', 'Use Bright Yellow so the ducks see you.', 'Pick Bright Yellow paint so the ducks can see you in fog.'],
      ['Pick Rainbow or Fire Red.', 'Use Fire Red or Rainbow paint.', 'Bright paint like Fire Red or Rainbow works.', 'Pick a bright paint, like Fire Red or Rainbow, for the fog.']),
  ], L(['Check Paint.', 'Go to Paint.'], ['Check Paint.', 'Look at Paint.'], ['Check Paint for a bright color.', 'Look at Paint for a bright color.'], ['Look at Paint for a color that stands out in fog.', 'Check Paint to find a color that stands out.']), ['bright', 'fog', 'see']),
  fp('lowBridge.height', ['Low Bridge', 'Very Low Bridge', 'Super Low Bridge'], ['Low Bridge', 'So Low', 'Lowest Bridge'], [
    rows(['Get Small.', 'Get the Small size.', 'Pick the Small size to fit under.', 'Make your car the Small size so it fits under the bridge.'],
      ['Pick Sports Car.', 'Get a Sports Car to fit.', 'A low Sports Car fits under the bridge.', 'Pick a Sports Car or Sleek shape to fit under the bridge.']),
    rows(['Get Tiny.', 'Get the Tiny size.', 'Pick the Tiny size to fit under.', 'The bridge is very low, so make your car the Tiny size.'],
      ['Pick Sports Car and Small.', 'Small size and a Sports Car.', 'Get a Sports Car in the Small size.', 'Pick a Small Sports Car so it fits under this low bridge.']),
    rows(['Get Sports Car and Tiny.', 'Get a Tiny Sports Car.', 'Pick a Tiny Sports Car to fit under.', 'A Tiny Sports Car can fit under this super low bridge.'],
      ['Pick Sleek and Tiny.', 'Tiny size and a Sleek shape.', 'Use the Tiny size and a Sleek shape.', 'Pick the Tiny size and a Sleek shape to fit under.']),
  ], L(['Check Size.', 'Go to Size.'], ['Check Size.', 'Look at Size.'], ['Check Size for a shorter car.', 'Look at Size to fit under the bridge.'], ['Check Size or Body for a way to make the car lower.', 'Look at Size for a car that fits under the bridge.']), ['short', 'low', 'fit']),
  fp('narrow.width', ['Narrow Path', 'Very Narrow Path'], ['Thin Path', 'Thin Gap'], [
    rows(['Get Small.', 'Pick the Small size to fit.', 'Make the car thin with the Small size.', 'Pick the Small size so the car fits the narrow path.'],
      ['Pick Sleek.', 'Get a thin, Sleek shape.', 'A Sleek shape makes the car thin.', 'Pick a Sleek shape so your car can fit between the trees.']),
    rows(['Get Tiny.', 'Pick the Tiny size to fit.', 'Make the car very thin with Tiny size.', 'The path is very narrow, so make your car the Tiny size.'],
      ['Pick Sleek and Small.', 'Small size and a Sleek shape.', 'Get the Small size and a Sleek shape.', 'Pick the Small size and a Sleek shape for this path.']),
  ], L(['Check Size.', 'Go to Size.'], ['Check Size.', 'Look at Size.'], ['Check Size for a thinner car.', 'Look at Size for a car that fits.'], ['Check Size for a car that fits between the trees.', 'Check Shape for a part that makes the car thinner.']), ['thin', 'wide', 'small']),
  fp('delivery.load', ['Box Delivery', 'Pile of Boxes', 'Giant Delivery'], ['Box Stack', 'Big Stack', 'Tall Stack'], [
    rows(['Get Pickup Truck.', 'Get a Pickup Truck for boxes.', 'Get a Pickup Truck with room for boxes.', 'Pick a Pickup Truck so there is room for all the boxes.'],
      ['Pick Van.', 'Use a Van to carry boxes.', 'A Van has lots of room for boxes.', 'Pick a Van or the Big size to make room for boxes.']),
    rows(['Get Van.', 'Get a Van. It holds more.', 'Get a Van to carry this big load.', 'This load is big, so get a Van with lots of room.'],
      ['Pick Pickup Truck and Big.', 'Pickup Truck and Big size.', 'Get a Pickup Truck in the Big size.', 'Pick a Big Pickup Truck to carry this big load.']),
    rows(['Get Van and Big.', 'Get a Big Van.', 'Get a Van in the Big size.', 'Only a Van in the Big size can carry this giant load.'],
      ['Pick Van and Big.', 'A Big Van holds the most.', 'Pick a Big Van for the giant load.', 'Get a Van in the Big size so every box fits.']),
  ], L(['Check Body.', 'Go to Body.'], ['Check Size.', 'Look at Size.'], ['Check Body for room for the boxes.', 'Look at Body for more room.'], ['Check Body for a way to fit all the boxes.', 'Look at Body for a part with more room inside.']), ['big', 'room', 'load']),
  fp('delivery.power', ['Heavy Boxes'], ['Big Boxes'], [
    rows(['Get Big Engine.', 'Get a Big Engine for boxes.', 'Get a Big Engine to pull heavy boxes.', 'Heavy boxes need power, so put in a Big Engine.'],
      ['Pick Climbing Gears.', 'Use Climbing Gears for power.', 'Climbing Gears give power for the heavy load.', 'Pick Climbing Gears or a Turbo Engine to carry the heavy load.']),
  ], L(['Check Engine.', 'Go to Engine.'], ['Check Engine.', 'Look at Engine.'], ['Check Engine for more power.', 'Look at Engine for a stronger part.'], ['Check Engine for a part that gives power to carry the boxes.', 'Check Engine for enough power to carry a heavy load.']), ['heavy', 'power']),
  fp('snow.grip', ['Snowy Road', 'Deep Snow', 'Snow and Ice'], ['Cold Track', 'Deep Slush', 'Slick Slush'], [
    rows(['Get Snow Tires to grip.', 'Get Snow Tires.', 'Get Snow Tires so you do not slide.', 'Put on Snow Tires so the wheels grip the snowy road.'],
      ['Pick 4x4 Drive.', 'Use 4x4 Drive in the snow.', 'Snow Tires or 4x4 Drive will grip snow.', 'Pick Snow Tires or 4x4 Drive so the car does not slide.']),
    rows(['Get Snow Tires.', 'Get Snow Tires for deep snow.', 'Deep snow needs Snow Tires to grip.', 'Put on Snow Tires so your car can get through deep snow.'],
      ['Pick Snow Tires.', 'Snow Tires grip deep snow.', 'Pick Snow Tires to drive in deep snow.', 'Pick Snow Tires so the car can drive through deep snow.']),
    rows(['Get 4x4 Drive and Snow Tires.', 'Snow Tires and 4x4 Drive.', 'Get Snow Tires and 4x4 Drive for ice.', 'Snow and ice need both Snow Tires and 4x4 Drive.'],
      ['Pick Jeep and Snow Tires.', 'Get Snow Tires and a Jeep.', 'Put Snow Tires on a Jeep for ice.', 'Pick a Jeep with Snow Tires to grip the snow and ice.']),
  ], L(['Check Wheels.', 'Go to Wheels.'], ['Check Wheels.', 'Look at Wheels.'], ['Check Wheels for more grip in snow.', 'Look at Wheels for a part that grips.'], ['Check Wheels for parts that grip the snowy road.', 'Look at Wheels for a way to keep from sliding.']), ['snow', 'ice', 'deep']),
  fp('rocks.tough', ['Bumpy Rocks', 'Heavy Rocks', 'Giant Rocks'], ['Rock Bumps', 'Big Rocks', 'Rock Fall'], [
    rows(['Get Rubber Bumpers.', 'Get Rubber Bumpers for rocks.', 'Get Rubber Bumpers to bump off the rocks.', 'Put on Rubber Bumpers so the rocks just bounce off.'],
      ['Pick Big Bumpers.', 'Use Big Bumpers on rocks.', 'Big Bumpers make the car tough.', 'Pick Big Bumpers or a Jeep so the car is tough enough.']),
    rows(['Get Jeep and Rubber Bumpers.', 'Rubber Bumpers and a Jeep.', 'Get Rubber Bumpers and a Jeep for rocks.', 'Big rocks need a tough Jeep with Rubber Bumpers.'],
      ['Pick Jeep and Big Bumpers.', 'Get Big Bumpers and a Jeep.', 'Put Big Bumpers on a tough Jeep.', 'Pick Big Bumpers and Monster Wheels to roll over big rocks.']),
    rows(['Get Jeep, Rubber Bumpers, Monster Wheels.', 'Jeep, Rubber Bumpers, Monster Wheels.', 'Get a Jeep, Rubber Bumpers, and Monster Wheels.', 'Giant rocks need a Jeep, Rubber Bumpers, and Monster Wheels.'],
      ['Pick Rubber Bumpers, Round, Monster Wheels.', 'Rubber Bumpers, Monster Wheels, Round shape.', 'Monster Wheels, Rubber Bumpers, and Round shape.', 'Pick Rubber Bumpers, Monster Wheels, and a Round shape for giant rocks.']),
  ], L(['Check Bumper.', 'Go to Bumper.'], ['Check Bumper.', 'Look at Bumper.'], ['Check Bumper to take a hit.', 'Look at Bumper for a tougher part.'], ['Check Bumper for a part that keeps the car safe.', 'Look at Bumper for a part that can take a hard hit.']), ['tough', 'rocks', 'bump']),
  fp('rocks.clearance', ['Tall Rocks', 'Very Tall Rocks'], ['Tall Rocks', 'Rock Tops'], [
    rows(['Get Lift Kit.', 'Get a Lift Kit.', 'Get a Lift Kit to ride up high.', 'Put on a Lift Kit so the car rides over the rocks.'],
      ['Pick Monster Wheels.', 'Use Monster Wheels to ride high.', 'Monster Wheels lift the car over rocks.', 'Pick Monster Wheels or a Jeep to ride high over the rocks.']),
    rows(['Get Jeep and Lift Kit.', 'A Jeep with a Lift Kit.', 'Put a Lift Kit on a Jeep.', 'Put a Lift Kit on a Jeep to ride over tall rocks.'],
      ['Pick Lift Kit and Monster Wheels.', 'Lift Kit and Monster Wheels.', 'Get a Lift Kit and Monster Wheels.', 'Pick a Lift Kit and Monster Wheels to ride very high.']),
  ], L(['Check Springs.', 'Go to Springs.'], ['Check Springs.', 'Look at Springs.'], ['Check Springs to lift the car.', 'Look at Springs to lift the car.'], ['Check Springs for a part that lifts the car above the rocks.', 'Look at Springs for a way to keep the car from scraping.']), ['high', 'tall', 'lift']),
  fp('rocks.log', ['Log on the Road', 'Huge Log'], ['Log Block', 'Thick Log'], [
    rows(['Get Push Bumper.', 'Get a Push Bumper.', 'Get a Push Bumper to move the log.', 'Put on a Push Bumper so your car can push the log.'],
      ['Pick Push Bumper.', 'A Push Bumper moves logs.', 'Use a Push Bumper on the big log.', 'Pick a Push Bumper to push the log off the road.']),
    rows(['Get Push Bumper and Wedge.', 'Push Bumper and a Wedge shape.', 'Get a Push Bumper and a Wedge shape.', 'A huge log needs a Push Bumper and a Wedge shape.'],
      ['Pick Push Bumper and Winch.', 'Push Bumper and a Winch.', 'Use a Push Bumper and a Winch.', 'Pick a Push Bumper and a Winch to move the huge log.']),
  ], L(['Check Bumper.', 'Go to Bumper.'], ['Check Bumper.', 'Look at Bumper.'], ['Check Bumper for a part that pushes.', 'Look at Bumper for a stronger push.'], ['Check Bumper for a part that can shove the log away.', 'Look at Bumper for a part that helps the car push harder.']), ['push', 'log', 'huge']),
  fp('river.cross', ['Deep Stream', 'Across the River'], ['Deep Stream', 'Big Splash'], [
    rows(['Get Floaties or Snorkel.', 'Use Floaties or a Snorkel.', 'Use a Snorkel or Floaties to cross.', 'Use a Snorkel to drive under, or Floaties to float on top.'],
      ['Pick Floaties or Snorkel.', 'Pick a Snorkel or Floaties.', 'Get Floaties or a Snorkel for the stream.', 'Floaties keep the car up, or a Snorkel lets it drive under.']),
    rows(['Get Floaties.', 'Get Floaties to float.', 'Get Floaties so the car floats across.', 'The river is wide and deep, so use Floaties to float across.'],
      ['Pick Floaties.', 'Use Floaties on the river.', 'Floaties keep the car on top of water.', 'Pick Floaties so your car floats like a boat across the river.']),
  ], L(['Check Extra.', 'Go to Extra.'], ['Check Extra.', 'Look at Extra.'], ['Check Extra for a part made for water.', 'Look at Extra for a way to cross.'], ['Check Extra for a part that helps in deep water.', 'Look at Extra for a way to get across the river.']), ['deep', 'float', 'river']),
  fp('wobbly.weight', ['Wobbly Bridge', 'Very Wobbly Bridge', 'Super Wobbly Bridge'], ['Old Bridge', 'Shaky Bridge', 'Snap Bridge'], [
    rows(['Get Electric Motor.', 'Get a light Electric Motor.', 'An Electric Motor makes the car light.', 'Put in a light Electric Motor to cross the old bridge.'],
      ['Pick Small.', 'The Small size is light.', 'Make the car light with the Small size.', 'Pick the Small size or a Sports Car to be light.']),
    rows(['Get Tiny.', 'Tiny size makes it very light.', 'Pick the Tiny size to be very light.', 'The bridge is very wobbly, so make your car the Tiny size.'],
      ['Pick Electric Motor and Small.', 'Small size and an Electric Motor.', 'Use the Small size and an Electric Motor.', 'Pick an Electric Motor and the Small size to be very light.']),
    rows(['Get Electric Motor and Tiny.', 'Tiny size and an Electric Motor.', 'Use the Tiny size and an Electric Motor.', 'A Tiny car with an Electric Motor is light enough.'],
      ['Pick Sports Car and Tiny.', 'A Tiny Sports Car is light.', 'Pick a Tiny Sports Car to be light.', 'Pick a Tiny Sports Car so the bridge does not wobble.']),
  ], L(['Check Size.', 'Go to Size.'], ['Check Size.', 'Look at Size.'], ['Check Size for a lighter car.', 'Look at Size for a light car.'], ['Check Size or Engine for a way to make the car lighter.', 'Look at Size for a car light enough for the old bridge.']), ['light', 'heavy', 'small']),
  fp('beach.range', ['Long Drive', 'Very Long Drive', 'Longest Drive'], ['Long Trip', 'Far Trip', 'Last Bit of Gas'], [
    rows(['Get Efficient Engine.', 'Get an Efficient Engine.', 'Get an Efficient Engine to go far.', 'Put in an Efficient Engine so the car goes a long way.'],
      ['Pick Tiny.', 'A Tiny car goes far.', 'The Tiny size lets the car go far.', 'Pick an Efficient Engine or the Tiny size to drive far.']),
    rows(['Get Efficient Engine.', 'An Efficient Engine goes far.', 'Get an Efficient Engine for the long drive.', 'The beach is very far, so put in an Efficient Engine.'],
      ['Pick Efficient Engine.', 'Pick an Efficient Engine.', 'Pick an Efficient Engine to go very far.', 'Pick an Efficient Engine so the car can go very far.']),
    rows(['Get Efficient Engine and Tiny.', 'Efficient Engine and Tiny size.', 'Get an Efficient Engine and the Tiny size.', 'The longest drive needs an Efficient Engine and the Tiny size.'],
      ['Pick Efficient Engine and Tiny.', 'Tiny size plus an Efficient Engine.', 'Pick the Tiny size and an Efficient Engine.', 'Pick a Tiny car with an Efficient Engine to go the farthest.']),
  ], L(['Check Engine.', 'Go to Engine.'], ['Check Engine.', 'Look at Engine.'], ['Check Engine for a part that saves gas.', 'Look at Engine to go farther.'], ['Check Engine for a part that uses less gas on the trip.', 'Look at Engine for a part that goes far on little gas.']), ['far', 'long']),
  fp('beach.load', ['Beach Toys'], ['Toys for the Trip'], [
    rows(['Get Pickup Truck.', 'Get a Pickup Truck for toys.', 'Get a Pickup Truck for the beach toys.', 'Pick a Pickup Truck so there is room for toys and towels.'],
      ['Pick Big.', 'Use the Big size for toys.', 'The Big size has room for beach toys.', 'Pick the Big size or a Van to fit the beach toys.']),
  ], L(['Check Body.', 'Go to Body.'], ['Check Size.', 'Look at Size.'], ['Check Body for room for the toys.', 'Look at Body for more room.'], ['Check Body for a way to fit the toys inside.', 'Look at Body or Extra for room to carry the toys.']), ['big', 'room']),
  fp('parade.color', ['Red Parade', 'Green Parade', 'Parade of Colors'], ['Red Parade', 'Green Parade', 'Lots of Colors'], [
    rows(['Get Fire Red.', 'Paint the car Fire Red.', 'Paint the car Fire Red for the parade.', 'The parade needs a red car, so pick Fire Red paint.'],
      ['Pick Fire Red.', 'Use Fire Red paint.', 'Pick Fire Red paint for your car.', 'Make your car red with Fire Red paint for the parade.']),
    rows(['Get Leaf Green.', 'Paint the car Leaf Green.', 'Paint the car Leaf Green for the parade.', 'The parade needs a green car, so pick Leaf Green paint.'],
      ['Pick Leaf Green.', 'Use Leaf Green paint.', 'Pick Leaf Green paint for your car.', 'Make your car green with Leaf Green paint for the parade.']),
    rows(['Get Rainbow.', 'Paint the car Rainbow.', 'Paint the car Rainbow for the parade.', 'The parade needs every color, so pick Rainbow paint.'],
      ['Pick Rainbow.', 'Use Rainbow paint.', 'Pick Rainbow paint for your car.', 'Make your car every color with Rainbow paint for the parade.']),
  ], L(['Check Paint.', 'Go to Paint.'], ['Check Paint.', 'Look at Paint.'], ['Check Paint for a parade color.', 'Look at Paint to match the flags.'], ['Check Paint for the colors you see on the parade flags.', 'Read the color clue, then look at Paint.']), ['red', 'green', 'color']),
  fp('night.quiet', ['Quiet Night', 'Sleeping Baby'], ['Kids Asleep', 'Baby Naps'], [
    rows(['Get Electric Motor.', 'Get an Electric Motor.', 'Get a quiet Electric Motor for the town.', 'Put in an Electric Motor so the car is quiet at night.'],
      ['Pick Efficient Engine.', 'Use a quiet Efficient Engine.', 'An Efficient Engine is quiet enough here.', 'Pick an Efficient Engine or Electric Motor so nobody wakes up.']),
    rows(['Get Electric Motor.', 'Use an Electric Motor. Shh!', 'Only an Electric Motor is this quiet.', 'The baby is asleep, so put in a quiet Electric Motor.'],
      ['Pick Electric Motor.', 'Pick the Electric Motor.', 'Pick the Electric Motor to make no noise.', 'Pick the Electric Motor so the car makes almost no sound.']),
  ], L(['Check Engine.', 'Go to Engine.'], ['Check Engine.', 'Look at Engine.'], ['Check Engine for a quiet part.', 'Look at Engine to make less noise.'], ['Check Engine for a part that will let the town sleep.', 'Loud parts wake sleepers, so check Engine for a quieter part.']), ['quiet', 'loud']),
  fp('night.hide', ['Hide at Night'], ['Hide at Night'], [
    rows(['Get Night Black.', 'Paint the car Night Black.', 'Paint the car Night Black to hide.', 'Pick Night Black paint so your car is hard to see.'],
      ['Pick Night Black.', 'Use Night Black paint.', 'Night Black paint hides you in the dark.', 'Make your car dark with Night Black paint to hide at night.']),
  ], L(['Check Paint.', 'Go to Paint.'], ['Check Paint.', 'Look at Paint.'], ['Check Paint for a dark color.', 'Look at Paint for a color that hides.'], ['Check Paint for a color that is hard to see at night.', 'Look at Paint for a dark color that blends into the night.']), ['dark', 'hide']),
];

const sp = (scenario: string, title: string, starterTitle: string): ScenarioPhrases => ({ scenario, title: [title], starterTitle: [starterTitle], intro: L([], [], [], []) });

/** One title per scenario, used when a stage has two or more requirements (it fits every facet of the scenario). */
export const RACE_SCENARIO_PHRASES: readonly ScenarioPhrases[] = [
  sp('mud', 'Muddy Farm Road', 'Mud and Ruts'),
  sp('jump', 'Ramp Jump', 'Jump Test'),
  sp('turn', 'Corners Ahead', 'Bend Test'),
  sp('hill', 'Hill Climb', 'Hill Run'),
  sp('fog', 'Fog and Ducks', 'Ducks in Fog'),
  sp('lowBridge', 'Bridge Ahead', 'Fit Test'),
  sp('narrow', 'Tree Path', 'Thin Track'),
  sp('delivery', 'Heavy Delivery', 'Box Run'),
  sp('snow', 'Snowy Pass', 'Cold Run'),
  sp('rocks', 'Rocky Trail', 'Rock Run'),
  sp('river', 'River Ahead', 'Splash Test'),
  sp('wobbly', 'Old Bridge', 'Bridge Test'),
  sp('beach', 'Beach Trip', 'Trip Test'),
  sp('parade', 'Color Parade', 'Flag Run'),
  sp('night', 'Sleepy Town', 'Hush Test'),
];

/** Approved short words for parts in guidelines (besides the variant names). */
export const RACE_PART_ALIASES: Readonly<Record<string, readonly string[]>> = {
  rocket: ['extra.rocket'],
  spoiler: ['extra.spoiler'],
  turbo: ['engine.turbo'],
};
