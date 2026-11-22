/**
 * Race Shop phrase banks. Same requirement at every reading level; only the wording changes.
 * Easy: <= 9 words, may name the aspect. Medium: the task, no part names. Hard: richer words, the reader infers the part.
 * Never name an exact variant (see catalog.test.ts for the checks).
 */
import type { FacetPhrases, ReadingLevel, ScenarioPhrases } from '../../core/types';

type Lv = Readonly<Record<ReadingLevel, readonly string[]>>;
const L = (easy: string[], medium: string[], hard: string[]): Lv => ({ easy, medium, hard });
const fp = (facet: string, requirement: Lv[], hint: Lv, vocab: string[]): FacetPhrases => ({ facet, requirement, hint, vocab });

export const RACE_FACET_PHRASES: readonly FacetPhrases[] = [
  // ------------------------------------------------------------------ mud
  fp('mud.grip', [
    L(['Your car needs wheels that work in mud.', 'Pick wheels that can grip the mud.', 'Get wheels that do not slip in mud.'],
      ['Build a car that can drive across a muddy field.', 'Make a car that will not get stuck in the mud.', 'Your car must splash through a muddy farm road.'],
      ['Equip your vehicle with enough traction to cross slippery, muddy ground.', 'Prepare a vehicle that can grip the slippery mud without sliding.', 'Your vehicle needs firm traction on a soft, muddy track.']),
    L(['The mud is deep. Get grippy wheels.', 'Your wheels must work in deep mud.', 'Deep mud! Your car needs extra grip.'],
      ['Build a car that can push through deep, sticky mud.', 'Make a car that keeps moving in very deep mud.', 'Your car must cross a field of thick, deep mud.'],
      ['Your vehicle needs strong traction to plow through deep, sticky mud.', 'Design a vehicle that grips firmly in deep, slippery mud.', 'Deep mud traps cars with weak grip, so give yours powerful traction.']),
    L(['This mud is super deep. Get the most grip.', 'Super deep mud! Your car needs huge grip.', 'Your car needs the best grip for gooey mud.'],
      ['Build a car that can cross the deepest, gooiest mud on the farm.', 'Make a car that never gets stuck, even in super deep mud.', 'Your car must crawl through a swamp of very deep, sticky mud.'],
      ['Give your vehicle exceptional traction for a bottomless, gooey mud pit.', 'Only a vehicle with outstanding grip can navigate this deep, slippery swamp.', 'Equip your vehicle to grip and pull through extremely deep, sticky mud.']),
  ], L(['Try different wheels.', "Look at your car's wheels."],
    ['Think about what touches the muddy ground.', 'Some wheels grip mud better than others.'],
    ['Consider which part of your vehicle provides traction.', 'Traction comes from the parts that touch the ground.']),
  ['deep', 'slippery', 'sticky', 'traction', 'navigate', 'powerful']),

  fp('mud.pull', [
    L(['Your car needs a way to pull a friend.', 'Help pull a stuck tractor out of mud.', 'Bring something that can pull a stuck car.'],
      ['Build a car that can pull a stuck tractor out of the mud.', 'Your car must be able to tow a friend out of a muddy ditch.', 'Make a car that can pull a little tractor free.'],
      ['Equip your vehicle with a way to haul a stranded tractor out of the mud.', 'Your vehicle must be able to tow a stuck friend back onto the road.', 'Prepare a vehicle that can drag a trapped tractor free of the sticky mud.']),
    L(['Pull a big, heavy truck out with power.', 'Your car must pull hard. The tractor is heavy.', 'Pull a heavy tractor. You need lots of power.'],
      ['Build a strong car that can pull a heavy tractor out of deep mud.', 'Your car must tow a big, heavy tractor, so it needs lots of pulling power.', 'Make a car that can pull and has the strength to free a heavy tractor.'],
      ['Equip a powerful vehicle that can haul a heavy, stranded tractor from the mud.', 'Your vehicle needs both a way to tow and plenty of power to free a heavy tractor.', 'Rescuing this heavy tractor takes a towing tool and a powerful vehicle.']),
  ], L(['Look at the extras.', 'Try a different extra part.'],
    ['Think about what could hook onto the tractor.', 'Something on your car must do the pulling.'],
    ['Consider an accessory that can attach to the stuck tractor and pull it.', 'Which extra could grab the tractor and drag it free?']),
  ['heavy', 'big', 'powerful', 'sticky']),

  // ------------------------------------------------------------------ jump
  fp('jump.speed', [
    L(['Your car must go fast to jump the gap.', 'Go fast to fly over the gap.', 'You need speed for a long jump.'],
      ['Build a car that is fast enough to jump over the gap.', 'Make a car that can zoom up the ramp and fly across.', 'Your car must speed up the ramp and leap the gap.'],
      ['Your vehicle must accelerate quickly to soar across the gap.', 'Build a vehicle with enough speed to launch over the wide gap.', 'Only a fast vehicle can leap across this gap without landing short.']),
    L(['The gap is long. Go very fast.', 'Your car must be very fast to jump.', 'A long jump needs a very fast car.'],
      ['Build a very fast car that can jump a long gap.', 'Make a car that zooms fast enough to fly over a long canyon.', 'Your car must be quick enough to jump a long, wide gap.'],
      ['Your vehicle must accelerate to high speed to clear a long gap.', 'Design a swift vehicle that can soar across a long canyon.', 'Clearing this long gap requires a vehicle with impressive speed.']),
    L(['The gap is huge! Go super fast.', 'Your car must be the fastest ever.', 'Super fast speed for a giant jump.'],
      ['Build the fastest car you can to jump a giant canyon.', 'Make a super fast car that can fly over a huge gap.', 'Your car must go faster than ever to leap the biggest gap.'],
      ['Your vehicle must reach tremendous speed to soar over an enormous canyon.', 'Only an extraordinarily fast vehicle can clear this enormous gap.', "Maximize your vehicle's speed to launch across a gigantic canyon."]),
  ], L(['Try different gears.', 'Change a part to go faster.'],
    ['Think about what makes your car go faster.', 'Some gears and extras help you zoom.'],
    ['Consider which parts help your vehicle accelerate.', 'Look for parts that turn power into speed.']),
  ['fast', 'long', 'wide', 'accelerate', 'big']),

  fp('jump.landing', [
    L(['Your car must land softly after the jump.', 'Get springs for a soft landing.', 'Land with a soft bounce, not a bump.'],
      ['Build a car that lands gently after a big jump.', 'Make a car that bounces softly when it lands.', 'Your car must land on the other side without a hard bump.'],
      ['Your vehicle must be flexible enough to cushion a hard landing.', 'Design a vehicle that absorbs the bump when it lands.', 'Prepare your vehicle to land gently instead of thudding down.']),
    L(['Big drop! Land with a very soft bounce.', 'Your car must land very softly.', 'Land softly from a very high jump.'],
      ['Build a car that can land softly after a very high jump.', 'Make a car with lots of bounce for a big landing.', 'Your car must bounce gently down from a very tall ramp.'],
      ['Your vehicle needs extremely flexible cushioning for a long fall.', 'Design a vehicle that absorbs a heavy landing with a gentle bounce.', 'Equip your vehicle to land softly from a dramatic height.']),
  ], L(['Try different springs.', 'Look at your springs.'],
    ['Think about what helps a car bounce.', 'The parts under your car can soften a bump.'],
    ['Consider how your vehicle absorbs a bump.', 'Flexible parts beneath the vehicle cushion a landing.']),
  ['soft', 'high', 'tall', 'flexible', 'heavy']),

  // ------------------------------------------------------------------ turn
  fp('turn.handling', [
    L(['Your car must turn fast around a corner.', 'Get springs that help you turn.', 'Make sharp turns without spinning out.'],
      ['Build a car that can zip around a sharp turn.', 'Make a car that stays on the road around a tight corner.', 'Your car must take a sharp turn without sliding off.'],
      ['Your vehicle must navigate a sharp bend without skidding.', 'Design a vehicle that handles tight corners smoothly.', 'Prepare a vehicle that grips the road through a sharp curve.']),
    L(['The road twists a lot. Turn well.', 'Your car must turn very well.', 'Lots of sharp turns! Steer really well.'],
      ['Build a car that can zigzag along a twisty road.', 'Make a car that turns quickly around many sharp corners.', 'Your car must wiggle through a twisty road without sliding.'],
      ['Your vehicle must navigate a winding road full of sharp bends.', 'Design an agile vehicle that handles one tight corner after another.', 'Prepare your vehicle to steer precisely along a twisting route.']),
    L(['Super twisty road! Turn the best you can.', 'Your car must turn super well.', 'Zigzag road! Your car must steer perfectly.'],
      ['Build a car that can zigzag through the twistiest road ever.', 'Make a car that turns perfectly around very tight loops.', 'Your car must steer through a road that twists like a snake.'],
      ['Your vehicle needs exceptional handling to navigate a series of hairpin bends.', 'Only a remarkably agile vehicle can master this twisting mountain road.', 'Design a vehicle that corners precisely through extremely tight curves.']),
  ], L(['Try different springs.', 'Look at how your car turns.'],
    ['Think about what keeps a car steady in a turn.', 'Some parts help a car hug the road.'],
    ["Consider which parts improve your vehicle's handling.", 'A steadier vehicle corners better, so look beneath it.']),
  ['sharp', 'fast', 'navigate', 'tight']),

  // ------------------------------------------------------------------ hill
  fp('hill.power', [
    L(['Your car needs a strong engine for the hill.', 'Climb a steep hill with lots of power.', 'Get an engine that can climb hills.'],
      ['Build a car that can drive up a steep hill.', 'Make a car strong enough to climb a steep hill.', 'Your car must chug all the way up a steep hill.'],
      ['Your vehicle needs plenty of power to conquer a steep slope.', 'Design a powerful vehicle that can climb a steep hillside.', 'Only a vehicle with strong pulling power can ascend this steep hill.']),
    L(['The hill is very steep. Get more power.', 'Very steep hill! Your car needs power.', 'Climb a very steep hill. Be strong!'],
      ['Build a strong car that can climb a very steep hill.', 'Make a car powerful enough to reach the top of a very steep hill.', 'Your car must chug up a very steep, bumpy hill.'],
      ['Your vehicle requires substantial power to ascend a very steep slope.', 'Design a powerful vehicle that will not roll back on a very steep hill.', 'Equip your vehicle with enough power to climb a very steep incline.']),
    L(['The steepest hill ever! Get the most power.', 'This hill is like a wall. Be powerful!', 'Your car must be super strong to climb.'],
      ['Build the strongest car you can to climb the steepest hill.', 'Make a super strong car that can climb a hill almost like a wall.', 'Your car must climb a mountain that is very, very steep.'],
      ['Your vehicle needs tremendous power to ascend a nearly vertical slope.', 'Only an extremely powerful vehicle can conquer this towering, steep mountain.', "Maximize your vehicle's pulling power to climb an incredibly steep hill."]),
  ], L(['Try a different engine.', 'Look at your engine.'],
    ['Think about what gives your car its power.', 'The part that makes the car go can be stronger.'],
    ["Consider which part provides your vehicle's power.", 'More pulling power comes from the heart of the vehicle.']),
  ['steep', 'powerful', 'strong']),

  // ------------------------------------------------------------------ fog
  fp('fog.bright', [
    L(['Your car must be a bright color.', 'Paint your car a bright color.', 'Pick bright paint so the ducks see you.'],
      ['Make a car that the ducks can see in the fog.', 'Build a car with a bright color that shows up in the fog.', 'Your car must be easy to see on a foggy road.'],
      ['Your vehicle must be vividly colored so it stands out in thick fog.', 'Choose a brilliant color so the ducks can spot your vehicle through the mist.', 'A dull vehicle vanishes in the fog, so make yours bright and visible.']),
  ], L(['Try a different paint.', "Look at your car's color."],
    ['Think about which colors are easy to see.', 'Can the ducks see your car in the fog?'],
    ['Consider which colors remain visible in gray mist.', 'A dull color blends into fog, so think about your paint.']),
  ['bright', 'dull', 'visible']),

  // ------------------------------------------------------------------ low bridge
  fp('lowBridge.height', [
    L(['Your car must be short to fit under.', 'The bridge is low. Make your car short.', 'Make a car that fits under a low bridge.'],
      ['Build a car that is short enough to drive under a low bridge.', 'Make a car that can squeeze under a low bridge.', 'Your car must fit under a bridge without bumping its roof.'],
      ['Your vehicle must be low enough to pass beneath a low bridge.', 'Design a vehicle with a low roofline that clears the bridge.', 'Make sure nothing on your vehicle is too tall for the low bridge.']),
    L(['The bridge is very low. Be very short.', 'Your car must be very short.', 'Duck under a very low bridge!'],
      ['Build a very short car that can slide under a very low bridge.', 'Make a car that is low and flat to fit under the bridge.', 'Your car must be short enough for a very low bridge.'],
      ['Your vehicle needs a very low profile to pass beneath this bridge.', 'Design a flat, compact vehicle that clears a very low bridge.', 'Remove anything tall and lower your vehicle to fit under this very low bridge.']),
    L(['The bridge is super low. Be super short!', 'Your car must be as short as possible.', 'Make the shortest car to fit under.'],
      ['Build the shortest, flattest car you can to fit under the bridge.', 'Make a car so low it can sneak under the lowest bridge.', 'Your car must be super flat to squeeze under the lowest bridge.'],
      ['Your vehicle must be as low as possible to slip beneath the lowest bridge.', 'Design an extremely flat, compact vehicle that barely clears the bridge.', 'Only the lowest, most compact vehicle can pass beneath this bridge.']),
  ], L(['Try a different size.', 'Look at how tall your car is.'],
    ['Think about the tallest part of your car.', 'Some parts make a car taller or shorter.'],
    ["Consider your vehicle's size and anything on its roof.", 'Which parts add height to your vehicle?']),
  ['short', 'tall', 'low', 'compact']),

  // ------------------------------------------------------------------ narrow
  fp('narrow.width', [
    L(['Your car must be narrow to fit.', 'Make a small car for a narrow path.', 'The gap is narrow. Make your car slim.'],
      ['Build a car that can squeeze between two trees.', 'Make a car narrow enough to drive down a skinny alley.', 'Your car must fit through a narrow gap in the fence.'],
      ['Your vehicle must be narrow enough to navigate a slim forest path.', 'Design a compact vehicle that can slip between closely spaced trees.', 'A wide vehicle will get stuck, so keep yours narrow for this alley.']),
    L(['The path is very narrow. Be very small.', 'Your car must be very narrow.', 'Make the thinnest car to fit through.'],
      ['Build a very skinny car that can squeeze through a very narrow alley.', 'Make a car small enough to drive between trees that are very close.', 'Your car must fit through the narrowest gap in the garden.'],
      ['Your vehicle must be extremely narrow to navigate a cramped alley.', 'Only a very compact vehicle can slip through this very tight gap.', 'Design a slender vehicle that fits between trees standing very close together.']),
  ], L(['Try a different size.', 'Look at how wide your car is.'],
    ['Think about how wide your car is.', 'Some parts make a car wider or skinnier.'],
    ["Consider your vehicle's width.", 'Which choices make your vehicle more compact?']),
  ['narrow', 'wide', 'small', 'navigate', 'compact']),

  // ------------------------------------------------------------------ delivery
  fp('delivery.load', [
    L(['Your car must carry lots of boxes.', 'Get a car that can carry a big load.', 'Carry many boxes to the toy store.'],
      ['Build a car that can carry a load of boxes to the store.', 'Make a car with room for lots of packages.', 'Your car must deliver a pile of boxes to the bakery.'],
      ['Your vehicle needs space to haul a large delivery of packages.', 'Design a vehicle that can transport a big load of boxes.', 'Equip your vehicle to carry a big shipment across town.']),
    L(['Carry a very big load of boxes.', 'Your car must carry a huge pile.', 'So many boxes! Get lots of room.'],
      ['Build a car that can carry a very big pile of boxes.', 'Make a car with lots and lots of room for packages.', 'Your car must deliver a very big load of watermelons.'],
      ['Your vehicle needs generous cargo space for a very large delivery.', 'Design a vehicle that can transport a massive stack of packages.', 'Equip your vehicle to haul an enormous load of watermelons.']),
    L(['Carry the biggest load ever!', 'Your car must carry a giant load.', 'The most boxes! Get the most room.'],
      ['Build a car that can carry a giant mountain of boxes.', 'Make a car with the most room possible for a huge delivery.', 'Your car must carry every box from the whole warehouse.'],
      ['Your vehicle must haul a colossal shipment, so maximize its cargo space.', 'Design a vehicle with enormous capacity for the largest delivery of the year.', 'Only a vehicle with vast cargo room can transport this gigantic load.']),
  ], L(['Try a different body.', "Look at your car's body."],
    ['Think about where the boxes will go.', 'Some cars have more room in the back.'],
    ["Consider your vehicle's cargo space.", 'A larger, roomier vehicle carries more.']),
  ['big', 'large', 'heavy', 'huge']),

  fp('delivery.power', [
    L(['The boxes are heavy. Get more power.', 'Your car must be strong to pull boxes.', 'Heavy boxes need a strong engine.'],
      ['Build a car strong enough to carry heavy boxes up a ramp.', 'Make a car with enough power to pull a heavy load.', 'Your car must drive up the loading ramp with heavy boxes.'],
      ['Your vehicle needs enough power to haul heavy cargo up a ramp.', 'Design a vehicle strong enough to move a heavy load without stalling.', 'Equip your vehicle with ample power for carrying heavy freight.']),
  ], L(['Try a different engine.', 'Look at your engine.'],
    ['Think about what gives your car its power.', 'Heavy things need a stronger car.'],
    ["Consider which part provides your vehicle's power.", 'Hauling heavy cargo takes extra pulling power.']),
  ['heavy', 'strong', 'powerful']),

  // ------------------------------------------------------------------ snow
  fp('snow.grip', [
    L(['Your car needs wheels that grip snow.', 'Drive on snow without sliding.', 'Get wheels that work on snow.'],
      ['Build a car that can drive on a snowy road.', 'Make a car that will not slide on the snow.', 'Your car must cross a snowy hill without slipping.'],
      ['Equip your vehicle with traction for a slippery, snowy road.', 'Design a vehicle that grips firmly on a snowy road.', 'Your vehicle must navigate a snowy pass without sliding.']),
    L(['Deep snow! Your wheels need more grip.', 'Your car must drive through deep snow.', 'Get wheels for deep, slippery snow.'],
      ['Build a car that can drive through deep, slippery snow.', 'Make a car that keeps going in deep snow.', 'Your car must climb a mountain pass covered in deep snow.'],
      ['Your vehicle requires strong traction to plow through deep snow.', 'Design a vehicle that grips steadily in deep, slippery snow.', 'Equip your vehicle to navigate a mountain pass buried in snow.']),
    L(['Snow and ice everywhere! Get the most grip.', 'Your car must grip ice and deep snow.', 'Super slippery ice! Your car needs huge grip.'],
      ['Build a car that can cross deep snow and slippery ice.', 'Make a car that grips the road in a big snowstorm.', 'Your car must drive over the iciest, snowiest mountain pass.'],
      ['Your vehicle needs exceptional traction for deep snow and slick ice.', 'Only a vehicle with outstanding grip can navigate this icy, snowbound pass.', 'Design a vehicle that grips firmly through a fierce blizzard.']),
  ], L(['Try different wheels.', 'Look at your wheels.'],
    ['Think about what touches the snowy ground.', 'Some wheels grip snow better than others.'],
    ['Consider which parts give your vehicle traction on ice.', 'Grip on snow comes from what meets the ground.']),
  ['slippery', 'deep', 'traction', 'navigate']),

  // ------------------------------------------------------------------ rocks
  fp('rocks.tough', [
    L(['Your car must be tough for bumpy rocks.', 'Get strong bumpers for the rocky road.', 'Make a car that can bump rocks.'],
      ['Build a car tough enough for a bumpy, rocky road.', 'Make a car that can bonk into rocks and keep going.', 'Your car must bounce along a rocky trail without getting dented.'],
      ['Your vehicle must be durable enough to survive a rocky road.', 'Design a sturdy vehicle that shrugs off bumps from rocks.', 'Equip your vehicle to withstand jolts on a rough, rocky trail.']),
    L(['Lots of rocks! Your car must be tougher.', 'Your car must be very tough.', 'Big rocks everywhere. Be extra strong!'],
      ['Build a very tough car for a road full of big rocks.', 'Make a car that can bump into many big rocks.', 'Your car must bounce through a canyon full of boulders.'],
      ['Your vehicle must be very durable to endure a field of boulders.', 'Design a rugged vehicle that withstands bump after bump from big rocks.', 'Strengthen your vehicle so it survives a long canyon full of boulders.']),
    L(['The rockiest road ever! Be super tough.', 'Your car must be the toughest ever.', 'Giant rocks! Your car must be super strong.'],
      ['Build the toughest car you can for a road of giant rocks.', 'Make a super strong car that can bounce over giant boulders.', 'Your car must survive the bumpiest, rockiest road in the world.'],
      ['Your vehicle must be extremely durable to conquer a road of giant boulders.', 'Only an exceptionally rugged vehicle can survive this rocky obstacle course.', 'Reinforce every part of your vehicle for the roughest terrain imaginable.']),
  ], L(['Try different bumpers.', 'Look at your bumpers.'],
    ['Think about what protects your car from bumps.', 'Some parts help a car take a bonk.'],
    ['Consider which parts make your vehicle more durable.', 'Protection at the front and back can help.']),
  ['durable', 'big', 'strong', 'tough']),

  fp('rocks.clearance', [
    L(['Your car must ride high over rocks.', 'Lift your car up over the rocks.', "Your car's belly must clear the rocks."],
      ['Build a car that rides high enough to roll over rocks.', 'Make a car with lots of space underneath for big rocks.', 'Your car must drive over rocks without scraping its belly.'],
      ['Your vehicle needs high ground clearance to pass over rocks.', 'Design a vehicle that rides high above the jagged stones.', 'Raise your vehicle so its underside clears the rocky road.']),
    L(['Huge rocks! Your car must ride very high.', 'Ride very high over giant rocks.', 'Lift your car way up over boulders.'],
      ['Build a car that rides very high over huge rocks.', 'Make a car with tons of space under it for giant boulders.', 'Your car must roll over big boulders without getting stuck on top.'],
      ['Your vehicle requires exceptional ground clearance to cross huge boulders.', 'Design a vehicle that sits very high above giant rocks.', 'Elevate your vehicle significantly so boulders pass beneath it.']),
  ], L(['Try different springs.', 'Look under your car.'],
    ['Think about the space under your car.', 'Some parts lift a car higher.'],
    ["Consider your vehicle's ground clearance.", 'Which parts raise your vehicle higher off the ground?']),
  ['high', 'big', 'huge', 'tall']),

  fp('rocks.log', [
    L(['Push a fallen log off the road.', 'Your car must push a big log.', 'Get a front that can push logs.'],
      ['Build a car that can push a fallen log out of the way.', 'Make a car strong enough to shove a log off the trail.', 'Your car must nudge a big log off the road.'],
      ['Equip your vehicle to push a fallen log aside.', 'Design a vehicle with a sturdy front that can shove a log off the path.', 'Your vehicle must clear a fallen log blocking the trail.']),
    L(['A giant log! Push really hard.', 'Your car must push a huge log.', 'Push a giant tree trunk off the road.'],
      ['Build a car that can push a giant log off the road.', 'Make a car that shoves hard enough to move a huge tree trunk.', 'Your car must push a heavy pile of logs out of the way.'],
      ['Your vehicle needs a powerful front end to shove a massive log aside.', 'Design a vehicle capable of pushing an enormous tree trunk off the trail.', 'Equip your vehicle to bulldoze a heavy pile of logs off the road.']),
  ], L(['Try different bumpers.', 'Look at the front of your car.'],
    ['Think about what touches the log first.', 'The front of your car does the pushing.'],
    ["Consider your vehicle's front end.", 'The shape and front of your vehicle affect how it pushes.']),
  ['big', 'heavy', 'powerful', 'huge']),

  // ------------------------------------------------------------------ river
  fp('river.cross', [
    L(['Drive through water up to the windows.', 'The water is deep. Your car must breathe.', 'Your car needs air in deep water.'],
      ['Build a car that can drive through deep water up to its windows.', 'Make a car that can keep breathing air while driving through deep water.', 'Your car must splash across a deep stream without stalling.'],
      ['Equip your vehicle to breathe air while fording a deep stream.', 'Your vehicle must wade through water nearly up to its roof.', 'Design a vehicle that can drive along a deep stream bottom without stalling.']),
    L(['The river is very deep. Your car must float.', 'Make your car float across the river.', 'Your car must float like a boat.'],
      ['Build a car that can float across a wide, deep river.', 'Make a car that bobs on the water like a boat.', 'Your car must float to the other side of the river.'],
      ['Your vehicle must stay afloat to cross a deep, wide river.', 'Design a buoyant vehicle that can paddle across the river.', 'Equip your vehicle so it floats instead of sinking in the deep river.']),
  ], L(['Look at the extras.', 'Try a different extra.'],
    ['Think about what helps in deep water.', 'An extra part can help with water.'],
    ['Consider an accessory designed for water.', 'Which add-on would help your vehicle in a river?']),
  ['deep', 'wide']),

  // ------------------------------------------------------------------ wobbly bridge
  fp('wobbly.weight', [
    L(['The bridge is wobbly. Make your car light.', 'Your car must be light.', 'Make a light car for the old bridge.'],
      ['Build a light car that can cross a wobbly old bridge.', 'Make a car that is not too heavy for a creaky bridge.', 'Your car must be light to tiptoe across an old wooden bridge.'],
      ['Your vehicle must be lightweight to cross a fragile old bridge.', 'Design a light vehicle that will not overload the wobbly bridge.', 'A heavy vehicle would make the old bridge sag, so keep yours light.']),
    L(['Very wobbly bridge! Make your car very light.', 'Your car must be very light.', 'Get a very light car to cross.'],
      ['Build a very light car for a very wobbly rope bridge.', 'Make a car light enough for a very shaky rope bridge.', 'Your car must be very light to cross a creaky rope bridge.'],
      ['Your vehicle must be very lightweight to cross a swaying rope bridge.', 'Design an extremely light vehicle for a fragile, creaky bridge.', "Reduce your vehicle's weight a lot to cross a very shaky rope bridge."]),
    L(['The lightest car ever! Be light as a feather.', 'Your car must be super light.', 'Make the lightest car you can.'],
      ['Build the lightest car you can for a bridge made of sticks.', 'Make a car as light as a feather to cross the shakiest bridge.', 'Your car must be super light to cross a bridge of thin sticks.'],
      ['Your vehicle must be as light as possible to cross the flimsiest bridge.', 'Only an extremely lightweight vehicle can cross this delicate twig bridge.', 'Strip away every heavy part so your vehicle can cross the flimsiest bridge.']),
  ], L(['Try a different size.', 'Look at how heavy your car is.'],
    ['Think about which parts are heavy.', 'A smaller car weighs less.'],
    ['Consider which parts add weight to your vehicle.', 'Lighter parts help on a fragile bridge.']),
  ['light', 'heavy', 'small']),

  // ------------------------------------------------------------------ beach
  fp('beach.range', [
    L(['The beach is far. Go a long way.', 'Your car must drive a long way.', 'Get an engine for a long trip.'],
      ['Build a car that can drive all the way to the beach.', 'Make a car that can go a long way without stopping.', 'Your car must travel a long road to the seaside.'],
      ['Your vehicle needs an efficient design for a long journey to the beach.', 'Design a vehicle that can travel far without running out of fuel.', 'Equip your vehicle for a lengthy trip to the seaside.']),
    L(['Drive a very long way to the beach.', 'Your car must go very, very far.', 'A very long trip! Do not run out.'],
      ['Build a car that can drive a very long way to a faraway beach.', 'Make a car that can go very far without filling up.', 'Your car must travel across the whole country to the beach.'],
      ['Your vehicle must be very efficient to complete a very long journey.', 'Design a vehicle that travels a great distance on a single tank.', 'Equip your vehicle to cross many miles of road without refueling.']),
    L(['The longest trip ever! Go super far.', 'Your car must go the farthest ever.', 'Drive super far to the faraway beach.'],
      ['Build a car that can drive the longest trip ever without stopping.', 'Make a car that can go farther than any other car.', 'Your car must reach a beach at the very end of the map.'],
      ['Your vehicle must be exceptionally efficient for an extremely long expedition.', 'Only the most efficient, lightweight vehicle can complete this enormous journey.', "Maximize your vehicle's range for a journey to the most distant beach."]),
  ], L(['Try a different engine.', 'Look at your engine.'],
    ['Think about what uses up energy.', 'Some cars use less fuel than others.'],
    ['Consider which parts make your vehicle efficient.', 'Lighter, smoother vehicles travel farther.']),
  ['long', 'far', 'efficient', 'light']),

  fp('beach.load', [
    L(['Bring beach toys. Your car needs room.', 'Carry toys and towels to the beach.', 'Your car needs room for beach toys.'],
      ['Build a car with room for buckets, shovels, and towels.', 'Make a car that can carry all the beach toys.', 'Your car must bring an umbrella and a cooler to the beach.'],
      ['Your vehicle needs cargo space for beach umbrellas and coolers.', 'Design a vehicle with room to haul all the beach gear.', 'Equip your vehicle to transport towels, buckets, and a big umbrella.']),
  ], L(['Try a different body.', 'Where will the toys go?'],
    ['Think about where the beach toys will go.', 'Some cars have more room than others.'],
    ["Consider your vehicle's cargo space.", 'Room for gear can come from the body or the roof.']),
  ['big', 'small']),

  // ------------------------------------------------------------------ parade
  fp('parade.color', [
    L(['The parade needs a red car.', 'Paint your car red.', 'Your car must be red.'],
      ['Make a red car for the parade.', 'Build a car as red as a juicy apple.', 'Your car must be red to lead the parade.'],
      ['The parade needs a vehicle the color of ripe strawberries.', 'Choose a vivid red finish for your vehicle in the parade.', 'Your vehicle must match the red balloons in the parade.']),
    L(['The garden parade needs a green car.', 'Paint your car green.', 'Your car must be green.'],
      ['Make a green car for the garden parade.', 'Build a car as green as a frog.', 'Your car must be green to match the parade leaves.'],
      ['The garden parade requires a vehicle the color of fresh grass.', 'Choose a green finish to match the leafy parade floats.', 'Your vehicle must blend with the green garden decorations.']),
    L(['The parade needs a car with every color.', 'Paint your car with lots of colors.', 'Your car must have all the colors.'],
      ['Make a car with every color for the big parade.', 'Build a car covered in many bright colors at once.', 'Your car must have red, orange, yellow, green, blue, and purple.'],
      ['The parade requires a multicolored vehicle with every hue.', 'Choose a finish that displays every color, like a prism.', 'Your vehicle must shimmer with all the colors that appear after a rainstorm.']),
  ], L(['Try a different paint.', "Look at your car's color."],
    ['Think about what color the parade wants.', "Your car's color matters here."],
    ["Consider your vehicle's paint.", 'Read the color clue carefully.']),
  ['bright', 'vivid']),

  // ------------------------------------------------------------------ night
  fp('night.quiet', [
    L(['Babies are sleeping. Make your car quiet.', 'Your car must be quiet.', 'Get a quiet engine for the night.'],
      ['Build a quiet car that will not wake the sleeping town.', 'Make a car that hums softly at night.', 'Your car must drive past the sleeping puppies quietly.'],
      ['Your vehicle must operate quietly so the sleepy town keeps dreaming.', 'Design a hushed vehicle that will not disturb the sleeping kittens.', 'Equip your vehicle to glide by quietly without waking anyone.']),
    L(['Shh! Your car must be super quiet.', 'Make the quietest car ever.', 'Your car must make no sound.'],
      ['Build a car so quiet it does not even wake a mouse.', 'Make a car that makes almost no sound at all.', 'Your car must tiptoe past a sleeping baby without a peep.'],
      ['Your vehicle must be completely silent to sneak past a light sleeper.', 'Design a nearly silent vehicle that will not wake a sleeping puppy.', 'Only a whisper-quiet vehicle can pass the nursery without waking anyone.']),
  ], L(['Try a different engine.', 'Listen to your engine.'],
    ['Think about which part makes noise.', 'Some parts are loud and some are quiet.'],
    ['Consider which components make your vehicle loud.', 'Noisy parts wake sleepers, so find a quieter choice.']),
  ['quiet', 'loud', 'silent']),

  fp('night.hide', [
    L(['Hide-and-seek at night! Make your car dark.', 'Your car must be a dark color.', 'Paint your car dark to hide.'],
      ['Make a car that can hide in the dark for hide-and-seek.', 'Build a car that is hard to see at night.', 'Your car must blend into the dark night.'],
      ['Your vehicle must conceal itself in the shadows of the night.', 'Choose a dark color so your vehicle stays hidden after sunset.', 'Design a vehicle that disappears into the darkness for hide-and-seek.']),
  ], L(['Try a different paint.', "Look at your car's color."],
    ['Think about which colors are hard to see at night.', "Your car's color can help it hide."],
    ['Consider which shades vanish in darkness.', 'Concealment at night depends on your paint.']),
  ['dark', 'conceal']),
];

const sp = (scenario: string, title: string[], intro: Lv): ScenarioPhrases => ({ scenario, title, intro });

/** First title = starter title where the scenario has a starter. */
export const RACE_SCENARIO_PHRASES: readonly ScenarioPhrases[] = [
  sp('mud', ['Deep Mud', 'Muddy Field', 'Mud Rescue'], L(
    ['The farm road is full of mud!', 'Splash! It rained all night.'],
    ['Rain turned the farm road into a muddy mess.', 'The tractor path is soft and muddy today.'],
    ['Days of rain have turned the farm lane into a slippery, muddy swamp.', 'The meadow trail is soaked, and the mud is thick and sticky.'])),
  sp('jump', ['Long Jump', 'Big Ramp', 'Canyon Leap'], L(
    ['A big ramp is at the end of the road!', 'There is a gap. Can your car fly?'],
    ['A ramp leads up to a gap you must jump.', 'The road stops at a canyon with a ramp.'],
    ['A daring ramp launches cars across a gap in the canyon road.', 'Spectators cheer beside a ramp that leaps over a wide gap.'])),
  sp('turn', ['Sharp Turn', 'Twisty Road', 'Zigzag Track'], L(
    ['The road turns this way and that way!', 'Look out! Sharp turns ahead.'],
    ['The race track bends left and right like a ribbon.', 'A twisty road winds between the hay bales.'],
    ['The track curves sharply between rows of cheering fans.', 'A winding road snakes through the hills with tight bends.'])),
  sp('hill', ['Steep Hill', 'Mountain Climb', 'Up, Up, Up'], L(
    ['A big hill is in the way!', 'The road goes up, up, up.'],
    ['A steep hill stands between you and the picnic.', 'The road climbs high up a grassy hill.'],
    ['A steep, towering hill rises in front of the finish line.', 'The mountain road climbs sharply toward the clouds.'])),
  sp('fog', ['Bright Color', 'Foggy Road', 'Duck Crossing'], L(
    ['The road is foggy. Ducks want to cross.', 'Fog! The ducks wait by the road.'],
    ['A family of ducks waits to cross the foggy road.', 'Thick fog covers the pond road this morning.'],
    ['A family of ducks hesitates beside a misty road, waiting for a car they can see.', 'Morning fog blankets the pond road, hiding anything dull.'])),
  sp('lowBridge', ['Low Bridge', 'Duck Under', 'Squeeze Under'], L(
    ['A low bridge is on the road.', 'Watch your roof! The bridge is low.'],
    ['The road goes under an old stone bridge.', 'A low bridge crosses over the country road.'],
    ['An ancient stone bridge arches low over the narrow road.', 'The road dips beneath a bridge with very little room above.'])),
  sp('narrow', ['Narrow Path', 'Skinny Alley', 'Between the Trees'], L(
    ['The path is very thin!', 'Two trees stand close together.'],
    ['A skinny alley is the only way through town.', 'The forest path squeezes between tall trees.'],
    ['A cramped alley winds between tall brick buildings.', 'Ancient trees crowd the forest path on both sides.'])),
  sp('delivery', ['Big Delivery', 'Delivery Day', 'Box Hauler'], L(
    ['Lots of boxes need to go to town!', 'It is delivery day!'],
    ['A big pile of boxes is waiting at the store.', 'The bakery needs its delivery right away.'],
    ['A mountain of packages awaits delivery across town.', 'The warehouse is overflowing with orders to deliver.'])),
  sp('snow', ['Snowy Pass', 'Snow Day', 'Icy Road'], L(
    ['Snow is on the road!', 'Brr! It is a snowy day.'],
    ['Snow covers the road over the mountain.', 'The mountain pass is white and slippery.'],
    ['A fresh blanket of snow covers the winding mountain pass.', 'Icy patches glisten across the frozen mountain road.'])),
  sp('rocks', ['Rocky Road', 'Bumpy Trail', 'Forest Trail'], L(
    ['The trail has lots of rocks!', 'Bump, bump! Rocks are everywhere.'],
    ['A bumpy trail full of rocks leads through the forest.', 'The forest road is covered in stones and sticks.'],
    ['A rugged forest trail is littered with stones and fallen branches.', 'The rough path winds through rocky, uneven terrain.'])),
  sp('river', ['River Crossing', 'Splash Across', 'Deep Water'], L(
    ['There is water on the road!', 'Splash! A river is in the way.'],
    ['The road ends at the edge of a river.', 'A deep stream runs across the trail.'],
    ['The road disappears into a deep, rushing stream.', 'A wide river separates you from the campsite.'])),
  sp('wobbly', ['Wobbly Bridge', 'Creaky Crossing', 'Rope Bridge'], L(
    ['The old bridge wiggles and creaks.', 'Look! A wobbly bridge.'],
    ['An old wooden bridge wobbles over the creek.', 'A rope bridge sways over the little valley.'],
    ['A rickety old bridge creaks above the gentle creek.', 'A swaying rope bridge stretches across the valley.'])),
  sp('beach', ['Beach Trip', 'Long Drive', 'Seaside Road'], L(
    ['Let us go to the beach!', 'The beach is far away.'],
    ['Your family wants to spend the day at the beach.', 'A long road leads to the sunny seaside.'],
    ['A long, winding highway stretches toward the distant seaside.', 'The family is planning a lengthy road trip to the coast.'])),
  sp('parade', ['Parade Day', 'Color Parade', 'Party Parade'], L(
    ['The parade is today!', 'Music and balloons! It is a parade.'],
    ['The town is having a colorful parade today.', 'Everyone is lining up for the big parade.'],
    ['Crowds gather along the street for a colorful celebration.', 'Banners and balloons decorate the street for the parade.'])),
  sp('night', ['Sleepy Town', 'Night Drive', 'Hide and Seek'], L(
    ['It is night. The town is asleep.', 'Shh! Everyone is sleeping.'],
    ['The moon is out and the whole town is asleep.', 'It is late at night on a quiet street.'],
    ['Moonlight glows over a peaceful town where everyone is dreaming.', 'The streets are hushed and dark long after sunset.'])),
];
