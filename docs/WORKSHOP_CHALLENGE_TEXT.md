# Adventure Workshop: challenge text review

For the designer. Review only: no game text or code was changed. Rendered by the real text builder (`apps/workshop/logic/text.ts`, `resolveSpec`) from the phrase banks in `content/race/phrases.ts` and `content/dino/phrases.ts`, plus the scenario and facet checks.

## Summary

- **30 challenge families** (15 Race Shop, 15 Dino Lab), **48 requirements** (22 + 26), **224 table rows** (102 + 122: each requirement level has 2 authored lines per reading level), **672 guideline lines** (Easy, Medium, Hard).
- **150 of 224 rows have at least one flag** (63 of 102 in Race Shop, 87 of 122 in Dino Lab). Word limits (Easy 6, Medium 8, Hard 12) pass everywhere; the validator guarantees that. Nothing is left as an unfilled placeholder: the phrases are plain strings with no part-name templates.
- How the text reaches the player: the **title is picked at random** from 3 per scenario and is **not tied to the level or to the requirement**. Each reading level also picks its line separately from 2 options. So a title like "Mud Rescue" can sit above a plain grip line, and the A/B rows below are alternatives, not a sequence.

### Top 5 problem patterns

1. **The line states the goal or the problem, not the fix** (about 50 rows). Example: "A heavy car will fall through." or "Hide in the ferns." The rule is title = problem, line = fix.
2. **Hard words or wording for beginners** (about 35 rows): winch, snorkel, floaties, canyon, dunes, flock, shoo, shove, slippery, twisty, zigzag, pebbles in Easy/Medium lines; idioms such as "get a grip", "this hill is a wall".
3. **Part not named, wrong, or only part of the fix named** (about 26 rows). The shop shows "Teeth", "Claws", "Size", "Push Bumper", "Lift Kit", "Winch", but lines say "mouth", "hands", "strong back", "big body", "a front", "tool", and many two-part requirements (color AND small; big body AND big teeth; winch AND power) name only one part.
4. **Awkward grammar or odd wording** (about 17 rows): "so bite strong", "tough to bump rocks", "Turn best", "turner", "use long neck".
5. **Shared title does not fit every requirement** (every multi-requirement family, 10 flagged rows plus family notes), and **duplicate lines** (8 rows: for example "Be strong and push." is Easy for both a tree and a log, "Get a car that turns well." repeats across levels). Also: "Hide and Seek" is a title in both workshops.

### Legend

- **Level**: requirement id and difficulty level (L1 = easiest threshold), then A/B = the two authored lines (the player sees one of them per reading level).
- **Title**: the possible titles of that scenario (listed on the first row of each table only).
- **Easy / Medium / Hard**: exact line text. Max words 6 / 8 / 12.
- **Problems**: E, M, H mean the Easy, Medium and Hard line. "Goal, not fix" means the line says what to achieve, not what to build. Automatic checks also flag: over word limit, Easy longer than Medium, Hard shorter than Medium, hard words in Easy/Medium, repeated words, missing end punctuation, duplicates of another line.
- **Suggested rewrite**: only for flagged rows. Each rewrite follows the rules and the word limits (checked by script). Where a line has no suggestion, the problem is a family-level one (usually the title); see the family note.
- A blank Problems cell means no problem was found.

Part names the player sees. Race Shop: Wheels, Engine, Gears, Springs, Bumper, Paint, Body, Shape, Size, Extra (Winch, Floaties, Snorkel, Rocket Booster, Roof Rack, Big Spoiler). Dino Lab: Color, Head, Teeth, Claws, Legs, Moving, Tail, Body, Size, Extra (Glow Spots, Tiger Stripes, Leaf Pattern, Feathers).

## Race Shop


### mud (Deep mud on the farm road)

Titles (one is picked at random per challenge, any level): "Deep Mud", "Muddy Field", "Mud Rescue"

Family note: Title "Mud Rescue" only fits the winch requirement; "Deep Mud" does not match level 1 (H: "soft mud"). The Winch is never named.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| mud.grip L1 (A) | Deep Mud / Muddy Field / Mud Rescue | Get wheels that grip mud. | Get something that grips mud well. | Get a part that keeps the car from slipping in mud. | Title "Deep Mud" can show with "soft mud" (H). M says "something": no part named. | M: Get tires that grip mud well.<br>H: Pick wheels with a strong grip for mud. |
| mud.grip L1 (B) | same | Get wheels that do not slip. | Do not get stuck in the mud. | Pick something with a strong grip for soft mud. | M states the problem, not the fix. H "something" is vague. | M: Get wheels that do not slip.<br>H: Pick wheels with a strong grip for mud. |
| mud.grip L2 (A) | same | Get wheels with more grip. | Get a lot of grip for deep mud. | Get a part with a very strong grip for deep mud. |  |  |
| mud.grip L2 (B) | same | Deep mud needs strong grip. | Deep mud needs a very good grip. | Deep, sticky mud needs the best grip you can get. |  |  |
| mud.grip L3 (A) | same | Get the most grip for mud. | Get the best grip for gooey mud. | Get the strongest grip you can for very deep, gooey mud. | Hard word(s) in E/M: gooey |  |
| mud.grip L3 (B) | same | This mud needs top grip. | This mud is deep, so grip the most. | Only the best grip will move through this deep mud. | M "so grip the most" is bad grammar. H "will move through" is odd (the car moves, not the grip). | M: This mud is deep. Get the best grip.<br>H: Only the best grip can get through this deep mud. |
| mud.pull L1 (A) | same | Get a way to pull. | Get a tool to pull the tractor out. | Bring something that can hook and pull a stuck tractor. | No line names the Winch (the only fix). E "a way to pull" and M "a tool" are vague. | E: Get a winch to pull.<br>M: Get a winch to pull the tractor out.<br>H: Bring a winch to hook and pull a stuck tractor. |
| mud.pull L1 (B) | same | Pull the stuck tractor out. | You need to pull a stuck tractor. | Pick a tool that can pull a tractor out. | E states the goal, not the fix. M and H say "tool", not Winch. | E: Use a winch on the tractor.<br>M: You need a winch to pull the tractor.<br>H: Pick a winch that can pull a tractor out. |
| mud.pull L2 (A) | same | The tractor is heavy. Get power. | Pull a heavy tractor with power. | A heavy tractor needs a pulling tool and strong power. | Needs Winch AND power, but E and M only say "power". E "Get power" is vague. | E: Get a winch and strong power.<br>M: Get a winch and a strong engine. |
| mud.pull L2 (B) | same | Pull a heavy tractor with power. | You need a tool and strong power. | Bring a tool to pull and plenty of power. | E repeats M of the row above. M "a tool" is vague (Winch). | E: Get a winch and strong power.<br>M: You need a winch and strong power. |

### jump (Ramp jump over a gap)

Titles (one is picked at random per challenge, any level): "Long Jump", "Big Ramp", "Canyon Leap"

Family note: Titles do not fit both requirements: "Big Ramp" and "Canyon Leap" suit speed, none suits the landing lines.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| jump.speed L1 (A) | Long Jump / Big Ramp / Canyon Leap | Go fast to jump the gap. | Go fast enough to jump the gap. | Your car needs enough speed to fly over the gap. | E and M say the goal (go fast), not a fix part (Gears, Engine, Rocket). |  |
| jump.speed L1 (B) | same | Get speed for the jump. | Get speed to fly over the gap. | Go fast so you do not land short. |  |  |
| jump.speed L2 (A) | same | Long gap. Go very fast. | Go very fast to jump the long gap. | Your car must be very fast to jump the long gap. |  |  |
| jump.speed L2 (B) | same | A long jump needs more speed. | A long gap needs a very fast car. | The gap is long, so you need a lot of speed. |  |  |
| jump.speed L3 (A) | same | Huge gap. Go super fast. | Get top speed to jump the huge gap. | Go as fast as you can to jump the huge gap. |  |  |
| jump.speed L3 (B) | same | Get the most speed. | Go super fast to cross the big gap. | Only the fastest car can jump this big gap. | M says "big gap" but this level is "huge gap". | M: Go super fast to cross the huge gap. |
| jump.landing L1 (A) | same | Get springs for a soft landing. | Land soft after the big jump. | Your car must land soft after the jump. | M says the goal (land soft), not the fix. | M: Get springs to land soft. |
| jump.landing L1 (B) | same | Land soft, not with a bump. | Make the landing soft, not hard. | Pick a part that makes the landing soft. | E and M state the goal, not the fix. | E: Get springs to land soft.<br>M: Get springs for a soft landing. |
| jump.landing L2 (A) | same | Big drop! Land very soft. | The drop is big, so land very soft. | The drop is high, so make the landing very soft. | "Big drop!" does not match the shared titles (Big Ramp, Canyon Leap...). |  |
| jump.landing L2 (B) | same | Get springs that are very soft. | Make a very soft landing from up high. | Pick a part that makes a very soft landing. | "Springs that are very soft" points at Soft Springs, the weak part (the fix is Bouncy Springs). | E: Get very bouncy springs.<br>M: Get very bouncy springs for the drop. |

### turn (Sharp turns (top view))

Titles (one is picked at random per challenge, any level): "Sharp Turn", "Twisty Road", "Zigzag Track"

Family note: "Twisty Road" and "Zigzag Track" only fit levels 2-3; level 1 is a "sharp corner". The title is picked at random, not by level.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| turn.handling L1 (A) | Sharp Turn / Twisty Road / Zigzag Track | Get springs that help you turn. | Turn the sharp corner without a slide. | Your car must turn the sharp corner without sliding. |  |  |
| turn.handling L1 (B) | same | Turn fast without a slide. | Get a car that turns well. | Pick a part that helps the car turn well. | E states the goal. M is repeated as E of level 2. |  |
| turn.handling L2 (A) | same | The road twists. Turn well. | The road twists, so turn very well. | The road has many turns, so your car must turn well. | H "help with turn after turn" is awkward. | H: Pick a part that helps in every turn. |
| turn.handling L2 (B) | same | Get a car that turns well. | Turn many corners without a slide. | Pick a part that helps with turn after turn. | E repeats M of level 1 ("Get a car that turns well."). No part named. H "turn after turn" is awkward. | E: Get springs that turn very well.<br>H: Pick a part that helps in every turn. |
| turn.handling L3 (A) | same | Super twisty road! Turn best. | The road is super twisty. Turn best. | Turn as well as you can on this very twisty road. | E "Turn best" is bad grammar. Hard word(s) in E/M: twisty | E: Super twisty! Get top turning.<br>M: The road is super twisty. Turn the best. |
| turn.handling L3 (B) | same | Turn super well. | Zigzag with no slide at all. | Only the best turner can zigzag along this road. | H "best turner" is awkward. E is a goal, not a fix. Hard word(s) in E/M: zigzag | E: Get the best springs for turning.<br>H: Only the best turning car can zigzag here. |

### hill (Steep hill climb)

Titles (one is picked at random per challenge, any level): "Steep Hill", "Mountain Climb", "Up, Up, Up"

Family note: Titles fine. "Up, Up, Up" has commas in a title.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| hill.power L1 (A) | Steep Hill / Mountain Climb / Up, Up, Up | Get an engine for the hill. | Get power to climb the steep hill. | Your car needs power to climb the steep hill. |  |  |
| hill.power L1 (B) | same | Climb the hill with power. | The hill is steep, so get power. | Pick a part with strong power for the hill. |  |  |
| hill.power L2 (A) | same | Steep hill. Get much more power. | Get lots of power for the steep hill. | A very steep hill needs a lot of power. | E "much more power" is clumsy. | E: Steep hill. Get lots more power. |
| hill.power L2 (B) | same | Get lots of power. | The hill is very steep. Be strong. | Pick a part with much more power for this hill. | M "Be strong" is vague and sounds like Tough (rocks challenge). | M: The hill is steep. Get lots of power. |
| hill.power L3 (A) | same | Huge hill! Get top power. | Get the most power for the steepest hill. | Get the most power you can to climb this very steep hill. | H is the same as M, just longer. "Huge hill" vs "steepest hill". |  |
| hill.power L3 (B) | same | Be super strong. | This hill is a wall, so be strong. | Only the strongest car can climb this hill. | "strong" means power here but toughness elsewhere. M "a wall" is an idiom. | E: Get the most power.<br>M: This hill is very steep. Get top power.<br>H: Only the car with the most power can climb this hill. |

### fog (Foggy road, ducks waiting to cross)

Titles (one is picked at random per challenge, any level): "Foggy Road", "Thick Fog", "Duck Crossing"

Family note: Good: title = problem, line = fix. One level only.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| fog.bright L1 (A) | Foggy Road / Thick Fog / Duck Crossing | Get bright paint. | Make the car bright so ducks see it. | Pick a bright color so the ducks can see your car. |  |  |
| fog.bright L1 (B) | same | Paint the car bright. | Pick a color ducks can see in fog. | A dull car hides in fog, so make it bright. |  |  |

### lowBridge (Low bridge)

Titles (one is picked at random per challenge, any level): "Low Bridge", "Duck Under", "Squeeze Under"

Family note: "Duck Under" can be misread (ducks appear in Foggy Road). "Squeeze Under" suits narrow.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| lowBridge.height L1 (A) | Low Bridge / Duck Under / Squeeze Under | Make the car short to fit. | Make the car short to fit under. | Your car must be short enough to go under the bridge. |  |  |
| lowBridge.height L1 (B) | same | The bridge is low. Be short. | Get low to go under the bridge. | Make sure nothing on the car is too tall. | H is a negative ("nothing too tall"), not a fix. | H: Pick parts that keep the car short. |
| lowBridge.height L2 (A) | same | Very low bridge. Be very short. | The bridge is very low. Be very short. | The bridge is very low, so make your car very short. |  |  |
| lowBridge.height L2 (B) | same | Get a very short car. | Make the car very short and flat. | Take off anything tall so the car fits under. | H "Take off" is not possible (the player swaps parts). | H: Pick short parts so the car fits under. |
| lowBridge.height L3 (A) | same | Low gap! Be the shortest. | Make the car as short as you can. | Make your car as short and flat as it can be. | E says "gap" but the title says bridge. "Be the shortest" is odd. | E: Very low! Get the shortest car. |
| lowBridge.height L3 (B) | same | Get the shortest car. | Get the lowest car to fit under. | Only the lowest car can fit under this bridge. | "lowest car" is odd; low/short are mixed. | M: Get the shortest car to fit under.<br>H: Only the shortest car can fit under this bridge. |

### narrow (Narrow alley between trees (top view))

Titles (one is picked at random per challenge, any level): "Narrow Path", "Skinny Alley", "Between the Trees"

Family note: Lines mix "thin", "small", "path" and "gap"; shop part names are Small and Tiny.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| narrow.width L1 (A) | Narrow Path / Skinny Alley / Between the Trees | Get a thin car to fit. | Make the car thin to fit through. | Your car must be thin enough to go through the gap. |  |  |
| narrow.width L1 (B) | same | The path is thin. Be small. | Go through the thin gap. | A wide car gets stuck, so make yours thin. | E mixes "thin" and "small" (the check is width). M states the goal, not the fix, and says "gap" while the title says path. Easy longer than Medium | E: Thin path. Get a thin car.<br>M: Make the car thin for the narrow path. |
| narrow.width L2 (A) | same | Very thin path. Be very thin. | The gap is very thin. Be very thin. | The gap is very thin, so make your car very thin. | E repeats "very thin" (repeated word). | E: Thin path. Be very thin. |
| narrow.width L2 (B) | same | Get the thinnest car. | Make the car very small to fit. | Only a very thin car can go through here. | M uses "small" where the stat is width (thin). | M: Make the car very thin to fit. |

### delivery (Heavy delivery)

Titles (one is picked at random per challenge, any level): "Big Delivery", "Delivery Day", "Box Hauler"

Family note: Title "Big Delivery" fits load only. Power lines mention a ramp.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| delivery.load L1 (A) | Big Delivery / Delivery Day / Box Hauler | Get room for lots of boxes. | Make room to carry many boxes. | Your car needs room to carry many boxes. |  |  |
| delivery.load L1 (B) | same | Carry boxes to the shop. | The car must carry a big load. | Pick a car with space for a big load. | E is a goal, not a fix. | E: Get a car with more room. |
| delivery.load L2 (A) | same | Carry a very big load. | Make lots of room for the boxes. | The pile of boxes is very big, so you need much room. | E is a goal, not a fix. | E: Get a car with more room. |
| delivery.load L2 (B) | same | Get lots of room. | The pile of boxes is very big. | Pick a car with lots of space in the back. | M states the problem, not the fix. | M: Get a car with lots of room. |
| delivery.load L3 (A) | same | Carry the biggest load! | Get the most room you can for boxes. | Get as much room as you can for this giant load. |  |  |
| delivery.load L3 (B) | same | Get the most room. | The load is giant, so make room. | Only a car with the most space can carry it all. |  |  |
| delivery.power L1 (A) | same | The boxes are heavy. Get power. | The boxes are heavy, so get power. | Heavy boxes need a car with strong power. |  |  |
| delivery.power L1 (B) | same | Heavy boxes need a strong engine. | Get strong power to pull a heavy load. | Pick a part with enough power for the ramp. | H mentions "the ramp", which is not in this challenge. | H: Pick a part with enough power for the load. |

### snow (Snowy mountain pass)

Titles (one is picked at random per challenge, any level): "Snowy Pass", "Snow Day", "Icy Road"

Family note: Titles "Icy Road" and "Snow Day" do not match the level (L1 snow, L3 ice).

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| snow.grip L1 (A) | Snowy Pass / Snow Day / Icy Road | Get wheels that grip snow. | Get a grip so you do not slide. | Pick a part that grips the road in snow. | M "Get a grip" is an idiom and unclear. Wheels not named. | M: Get tires that grip the snow. |
| snow.grip L1 (B) | same | Do not slide on snow. | Drive on snow without a slide. | Your car must not slide on the snowy road. | E states the problem, M the goal. Neither is a fix. Title "Icy Road" does not fit snow at this level. | E: Get wheels that grip snow.<br>M: Get tires that grip the snow. |
| snow.grip L2 (A) | same | Deep snow! Get more grip. | Get a lot of grip for deep snow. | Pick a part with a strong grip for deep snow. |  |  |
| snow.grip L2 (B) | same | Get wheels for deep snow. | Drive through deep snow without a slide. | Deep snow is slippery, so you need more grip. | H says deep snow is slippery (ice is). | H: Deep snow is hard to drive in, so get more grip. |
| snow.grip L3 (A) | same | Snow and ice! Get top grip. | Get the best grip for snow and ice. | Get the best grip you can for deep snow and ice. |  |  |
| snow.grip L3 (B) | same | Ice is slippery. Get top grip. | Ice is very slippery, so grip the most. | Only the strongest grip will work on this icy road. | H "strongest grip" is odd (best grip). Hard word(s) in E/M: slippery | H: Only the best grip will work on this icy road. |

### rocks (Rocky forest trail)

Titles (one is picked at random per challenge, any level): "Rocky Road", "Bumpy Trail", "Forest Trail"

Family note: One title covers three different requirements (tough, lift, push a log). Mixes "strong" and "tough".

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| rocks.tough L1 (A) | Rocky Road / Bumpy Trail / Forest Trail | Get a tough car for rocks. | Make the car tough to bump rocks. | Your car must be tough enough for a rocky road. | M "tough to bump rocks" is bad grammar. | M: Make the car tough for rocks. |
| rocks.tough L1 (B) | same | Get strong bumpers for rocks. | The road is rocky, so be tough. | Pick parts that can take bumps from rocks. |  |  |
| rocks.tough L2 (A) | same | Lots of rocks! Be more tough. | Get a very tough car for big rocks. | Many big rocks need a car that is very tough. | E "be more tough" is bad grammar (tougher). | E: Lots of rocks! Be tougher. |
| rocks.tough L2 (B) | same | Get a very tough car. | The rocks are big, so be tough. | Pick parts that can take bump after bump. |  |  |
| rocks.tough L3 (A) | same | The rockiest road! Be the toughest. | Get the toughest car for giant rocks. | Make your car as tough as you can for giant rocks. |  |  |
| rocks.tough L3 (B) | same | Get a super tough car. | Giant rocks need a super strong car. | Only the toughest car will get past these rocks. | M mixes "strong" and "tough" (stat is toughness). | M: Giant rocks need a super tough car. |
| rocks.clearance L1 (A) | same | Ride high over the rocks. | Ride high so rocks go under. | Your car must ride high so rocks go underneath. |  |  |
| rocks.clearance L1 (B) | same | Lift the car up. | Get space under the car. | Lift your car up to go over the rocks. | Does not name the part that lifts (Lift Kit). | E: Get a lift kit. |
| rocks.clearance L2 (A) | same | Big rocks! Ride very high. | Ride very high over the huge rocks. | Huge rocks need a car that rides very high. |  |  |
| rocks.clearance L2 (B) | same | Lift the car way up. | Get lots of space under the car. | Lift your car up a lot to pass over them. |  |  |
| rocks.log L1 (A) | same | Push the log off the road. | Push the log out of the way. | Your car must push the log off the road. |  |  |
| rocks.log L1 (B) | same | Get a front that can push. | The car must push a big log. | Pick a strong front that can push a log. | E "a front" is vague (part is Push Bumper). M and H "front" is not a part name. | E: Get a push bumper.<br>M: Use a push bumper on the log.<br>H: Pick a push bumper that can move a log. |
| rocks.log L2 (A) | same | A giant log! Push hard. | Push hard to move the huge log. | The log is huge, so your car must push very hard. | "giant" and "huge" log are mixed within the same level. |  |
| rocks.log L2 (B) | same | Push the huge log. | The log is giant, so push hard. | Pick a strong front that can move a giant log. | E "Push the huge log" is a goal; "huge" vs "giant" mix. | E: Get a push bumper. |

### river (River crossing (deep stream, then a wide river))

Titles (one is picked at random per challenge, any level): "River Crossing", "Water Ahead", "Deep Water"

Family note: Best family: both alternatives named with "or".

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| river.cross L1 (A) | River Crossing / Water Ahead / Deep Water | Use floaties or a snorkel. | Use a snorkel or floaties to cross. | Use a snorkel to go under or floaties to stay up. | Hard word(s) in E/M: floaties, snorkel |  |
| river.cross L1 (B) | same | Pick a snorkel or floaties. | Cross with floaties or use a snorkel. | Floaties keep you up, or a snorkel lets you drive under. | Hard word(s) in E/M: snorkel, floaties |  |
| river.cross L2 (A) | same | The river is deep. Float. | The river is very deep, so float. | The river is very deep, so your car must float. |  |  |
| river.cross L2 (B) | same | Make the car float. | Float across like a boat. | Pick a part that keeps the car on top of the water. |  |  |

### wobbly (Wobbly old bridge)

Titles (one is picked at random per challenge, any level): "Wobbly Bridge", "Creaky Crossing", "Rope Bridge"

Family note: Titles say rope; lines say sticks. Several M/H lines describe the problem, not the fix.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| wobbly.weight L1 (A) | Wobbly Bridge / Creaky Crossing / Rope Bridge | Get a light car. | Make the car light for the bridge. | Your car must be light to cross the old bridge. |  |  |
| wobbly.weight L1 (B) | same | The bridge is wobbly. Be light. | A heavy car will fall through. | A heavy car will make the bridge sag. | M and H state the problem (fall through, sag), not the fix. "sag" is a hard word. | M: Make the car light to cross.<br>H: Choose light parts so the bridge does not sag. |
| wobbly.weight L2 (A) | same | Very wobbly! Get a light car. | The bridge is very wobbly, so be light. | The bridge is very wobbly, so make your car very light. |  |  |
| wobbly.weight L2 (B) | same | Be very light. | Make the car very light to cross. | Take off heavy parts so the car is very light. |  |  |
| wobbly.weight L3 (A) | same | Get the lightest car. | Make the car as light as you can. | Make your car as light as it can be to cross. |  |  |
| wobbly.weight L3 (B) | same | Be as light as a feather. | The bridge is thin sticks. Be light. | The bridge is made of thin sticks, so use light parts. | M/H say "thin sticks" but the titles say Rope Bridge. | M: The bridge is weak. Be very light.<br>H: The bridge is weak, so use only light parts. |

### beach (Long trip to the beach)

Titles (one is picked at random per challenge, any level): "Beach Trip", "Long Drive", "Seaside Road"

Family note: "Long Drive" fits range only. Several lines are goals, not fixes.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| beach.range L1 (A) | Beach Trip / Long Drive / Seaside Road | The beach is far. Go far. | Drive a long way to the beach. | Your car must go a long way to the beach. | E repeats "far" and is not a fix. M "do not stop" is vague. | E: Get an engine that goes far.<br>M: Get an engine that goes far. |
| beach.range L1 (B) | same | Get an engine to go far. | Go far and do not stop. | Pick parts that let the car go far. | M "do not stop" is vague. |  |
| beach.range L2 (A) | same | Go very far to the beach. | Drive a very long way to the beach. | The beach is very far, so your car must go very far. |  |  |
| beach.range L2 (B) | same | A very long trip! | Go very far and do not run out. | Pick parts that let the car drive a very long way. | E is not an instruction. M "do not run out" (of what?). | E: Pick parts that go far.<br>M: Go very far on one tank. |
| beach.range L3 (A) | same | The longest trip! Go the farthest. | Go the farthest you can to the beach. | Go as far as you can on the longest trip of all. |  |  |
| beach.range L3 (B) | same | Go super far. | This is the longest trip of all. | Only the car that goes farthest will reach the beach. | M is not an instruction (no fix). | M: Go the farthest you can. |
| beach.load L1 (A) | same | Get room for beach toys. | Make room for the beach things. | Your car needs room for all the beach things. |  |  |
| beach.load L1 (B) | same | Carry toys and towels. | Carry all the toys to the beach. | Pick a car with space for toys and towels. | E is a goal, not a fix. | E: Get room for toys and towels. |

### parade (Color parade)

Titles (one is picked at random per challenge, any level): "Parade Day", "Color Parade", "Party Parade"

Family note: Color lines are clear. Hard repeats Easy/Medium in more words.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| parade.color L1 (A) | Parade Day / Color Parade / Party Parade | Paint the car red. | The parade needs a red car. | The parade needs a car that is red. | M and H say the same as E (Hard adds nothing). |  |
| parade.color L1 (B) | same | The car must be red. | Make the car red. | Pick the color red for your car. | Easy longer than Medium |  |
| parade.color L2 (A) | same | Paint the car green. | The parade needs a green car. | The parade needs a car that is green. | M and H say the same as E (Hard adds nothing). |  |
| parade.color L2 (B) | same | The car must be green. | Make the car green. | Pick the color green for your car. | Easy longer than Medium |  |
| parade.color L3 (A) | same | Paint the car with all colors. | The parade needs every color. | The parade needs a car with every color on it. | Easy longer than Medium |  |
| parade.color L3 (B) | same | Use every color. | Make the car have many colors. | Pick paint that shows all the colors at once. | M "have many colors" is awkward. | M: Use paint with every color. |

### night (Sleepy town at night (quiet, hide-and-seek))

Titles (one is picked at random per challenge, any level): "Sleepy Town", "Night Drive", "Hide and Seek"

Family note: "Hide and Seek" duplicates a Dino Lab title. "Sleepy Town" only fits the quiet requirement.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| night.quiet L1 (A) | Sleepy Town / Night Drive / Hide and Seek | Get a quiet engine. | Make the car quiet for the sleepers. | Your car must be quiet so no one wakes up. |  |  |
| night.quiet L1 (B) | same | Make the car quiet. | Do not wake the town. | Pick a part that makes less noise. | H is vague (what part?). M is the goal. | H: Pick an engine that makes less noise. |
| night.quiet L2 (A) | same | Shh! Be very quiet. | Make the car very quiet. | Your car must be very quiet so the baby sleeps. |  |  |
| night.quiet L2 (B) | same | Make no sound. | Make almost no sound at all. | Pick a part that makes almost no noise. | E "Make no sound" is absolute (check allows almost none). | E: Make almost no sound. |
| night.hide L1 (A) | same | Paint the car dark. | Make the car dark to hide. | Your car must be dark so it is hard to see. |  |  |
| night.hide L1 (B) | same | Hide in the dark. | The car must be hard to see. | Pick a dark color to hide at night. | E and M state the goal, not the fix. E repeats the row above. Title "Hide and Seek" duplicates a Dino Lab title. | E: Use dark paint.<br>M: Pick dark paint to hide. |

## Dino Lab


### snack (Snack time: gulp a cartoon critter)

Titles (one is picked at random per challenge, any level): "Snack Time", "Lunch Hunt", "Gulp!"

Family note: Medium uses "mouth", not a part (Teeth). The two facets share titles ("Gulp!" only fits the big gulp).

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| snack.bite L1 (A) | Snack Time / Lunch Hunt / Gulp! | Get teeth for a hard shell. | Make a mouth that can crunch shells. | Give your dino a big bite to crunch a hard beetle shell. | M says "mouth", but the part is Teeth. | M: Get teeth that can crunch a shell. |
| snack.bite L1 (B) | same | Pick teeth that can crunch. | A beetle shell is hard, so bite big. | The beetle has a hard shell, so you need a big bite. | M "so bite big" is awkward. | M: A beetle shell is hard. Get big teeth. |
| snack.bite L2 (A) | same | Get strong teeth to catch frogs. | Make a mouth strong enough for a frog. | Give your dino a strong mouth that can hold a slippery frog. | M "a mouth" is not a part (Teeth). | M: Get strong teeth to hold a frog. |
| snack.bite L2 (B) | same | Pick teeth that hold a frog. | A frog is slippery, so bite strong. | The frog is big and slippery, so you need a strong bite. | M "so bite strong" is bad grammar. H adds "big" frog (not in E/M). Hard word(s) in E/M: slippery | M: A frog is slippery. Get strong teeth. |
| snack.bite L3 (A) | same | Get the biggest, strongest teeth. | Make a super big, strong mouth. | Give your dino the biggest and strongest mouth for a huge lizard. | M "mouth", not Teeth. E "biggest, strongest" is a double superlative. | E: Get the strongest teeth.<br>M: Get super big, strong teeth.<br>H: Give your dino the strongest teeth for a huge lizard. |
| snack.bite L3 (B) | same | Get teeth for a huge lizard. | The lizard is huge, so bite very hard. | Make the bite super strong so it can gulp a huge lizard. | M "bite very hard" is awkward. | M: The lizard is huge, so get strong teeth. |
| snack.bigGulp L1 (A) | same | Get a big dino with teeth. | Your dino must be big to gulp this. | Make your dino big and strong enough to gulp a giant beetle. | Needs big teeth AND a big body, but E says "a big dino with teeth" (any teeth would seem to work). M names no teeth. | E: Get big teeth and be big.<br>M: Be big and get big teeth. |
| snack.bigGulp L1 (B) | same | Big beetle, so be big. | Make a big dino with a strong bite. | A giant beetle needs a big body and a strong mouth. | E "Big beetle, so be big." is awkward and has no teeth. M "strong bite" is not a part. | E: Be big, get big teeth.<br>M: Make a big dino with big teeth. |
| snack.bigGulp L2 (A) | same | Be a huge dino. | The beetle is huge, so be huge too. | Make your dino huge, with a mouth strong enough for this beetle. | E has no teeth; M "huge too" is odd. | E: Be huge and get huge teeth.<br>M: Be huge, with huge teeth. |
| snack.bigGulp L2 (B) | same | Get the biggest dino and teeth. | Make a huge dino with a huge bite. | Only the biggest and strongest dino can gulp this huge beetle. | E "biggest dino and teeth" is ambiguous. M "huge bite" is not a part. | E: Get a huge body, huge teeth.<br>M: Be huge and get huge teeth. |

### chase (Chase a speedy lizard (top view))

Titles (one is picked at random per challenge, any level): "Lizard Chase", "Catch Me", "Zoom Zoom"

Family note: The speed facet is a chase, the quiet facet is a sneak: one title cannot fit both.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| chase.speed L1 (A) | Lizard Chase / Catch Me / Zoom Zoom | Run fast to catch the lizard. | Your dino must run faster than the lizard. | Make your dino light and quick so it can catch the lizard. | H "light and quick": "light" is not something the player sees. | H: Make your dino quick so it can catch the lizard. |
| chase.speed L1 (B) | same | Get legs that run fast. | Make a dino built for speed. | The lizard is fast, so your dino must run fast too. |  |  |
| chase.speed L2 (A) | same | Run very fast. | This lizard is very fast, so be faster. | Make your dino very light and quick to catch this lizard. |  |  |
| chase.speed L2 (B) | same | Get legs that run very fast. | Make your dino a very fast runner. | The lizard zooms, so your dino needs to be even faster. |  |  |
| chase.speed L3 (A) | same | Be the fastest runner. | Make your dino the fastest runner ever. | Make your dino super light and the fastest runner of all. |  |  |
| chase.speed L3 (B) | same | Be super fast. | The lizard is super fast, so be faster. | No lizard is faster, so your dino must be faster still. | H is illogical ("No lizard is faster"). | H: This lizard is the fastest, so be faster still. |
| chase.quiet L1 (A) | same | Be small and sneak up. | Your dino must be small and quiet. | Make your dino small and quiet so the lizard does not wake. | Title "Lizard Chase" does not fit sneaking. H says the lizard sleeps; speed lines say it runs. |  |
| chase.quiet L1 (B) | same | Sneak close to the lizard. | Make a dino that sneaks up softly. | A big dino is loud, so your dino must be small. | E is a goal. H states the problem, not the fix. | E: Be small to sneak up.<br>H: Make your dino small so it can sneak up. |
| chase.quiet L2 (A) | same | Be very quiet. | This lizard wakes up fast, so be quiet. | The lizard hears well, so make your dino very small. | E/M say "quiet" but the fix is size (H says small). No quiet part exists. | E: Be very small.<br>M: This lizard wakes up fast. Be very small. |
| chase.quiet L2 (B) | same | Be very small and sneaky. | Make your dino super small and quiet. | Make your dino so quiet that the lizard hears nothing. | Title "Zoom Zoom" does not fit sneaking. Hard word(s) in E/M: sneaky |  |

### ferns (Hide in the ferns from a big sniffing dino)

Titles (one is picked at random per challenge, any level): "Fern Hide", "Hide and Seek", "Sniff Sniff"

Family note: "Hide and Seek" duplicates a Race Shop title. Many lines leave out the skin color the check needs.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| ferns.hide L1 (A) | Fern Hide / Hide and Seek / Sniff Sniff | Get skin that hides in ferns. | Make your skin match the ferns. | Pick a skin color that helps your dino hide in the ferns. |  |  |
| ferns.hide L1 (B) | same | Hide in the ferns. | Your dino must hide in the ferns. | The big dino must not see your dino in the leaves. | E is a goal; H states the problem. Neither names skin color. | E: Match the ferns.<br>H: Pick a skin color like the ferns so nobody sees your dino. |
| ferns.hide L2 (A) | same | Hide in short ferns. | The ferns are short, so be small. | Match the color of the ferns and be small to hide. | Needs skin color AND small. E is a goal; M leaves out color. | E: Match the ferns and be small.<br>M: Match the short ferns and be small. |
| ferns.hide L2 (B) | same | Be small and hide. | Match the ferns and stay small. | Short ferns cannot hide a big dino, so be small. | E leaves out skin color. H states the problem. | E: Match the ferns, be small.<br>H: Short ferns hide only a small dino, so match them. |
| ferns.hide L3 (A) | same | Hide in a few thin ferns. | There are few ferns, so be very small. | Only a few thin ferns are here, so be very small. | E is a goal. M leaves out color. | E: Match the ferns and be tiny.<br>M: Few ferns. Match them and be very small. |
| ferns.hide L3 (B) | same | Be very small and hide. | Match the ferns and be super small. | Match the ferns and be as small as you can. | E leaves out color. | E: Match the ferns, be tiny. |
| ferns.flowers L1 (A) | same | Get skin the color of flowers. | Make your skin the color of the flowers. | Choose a skin color that matches the flowers so your dino hides. |  |  |
| ferns.flowers L1 (B) | same | Hide in the flowers. | Your dino must match the flowers. | The flowers are a special color, so copy that color. | H "a special color" is vague (which color?). | H: Pick the same color as the flowers. |

### ledge (Jump up onto a high ledge)

Titles (one is picked at random per challenge, any level): "High Ledge", "Jump Up", "Rock Hop"

Family note: Mostly goals ("Jump up...") rather than fixes. Legs is named only a few times.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| ledge.jump L1 (A) | High Ledge / Jump Up / Rock Hop | Jump up onto the ledge. | Your dino must jump up to the ledge. | Make your dino jump high enough to reach the ledge. | E and M state the goal, not the fix (Legs). Hard word(s) in E/M: ledge | E: Get legs that jump high. |
| ledge.jump L1 (B) | same | Get legs that jump. | Make a dino that can jump well. | A light dino with strong legs can jump up. | H is a statement, not an instruction. | H: Pick strong legs to jump up. |
| ledge.jump L2 (A) | same | Jump up to a high ledge. | The ledge is high, so jump higher. | Make your dino light and able to jump very high. | Hard word(s) in E/M: ledge |  |
| ledge.jump L2 (B) | same | Jump very high. | Make your dino a very high jumper. | This ledge is very high, so your dino must jump higher. |  |  |
| ledge.jump L3 (A) | same | Jump up to the highest ledge. | Make your dino the best jumper ever. | Make your dino light and the best jumper of all. | E and M are goals, no fix named. Hard word(s) in E/M: ledge | E: Get the best jumping legs.<br>M: Get legs for the best jump. |
| ledge.jump L3 (B) | same | Be the best jumper. | The ledge is super high, so jump higher. | No ledge is higher, so your dino must jump the highest. | H "No ledge is higher" is a story line, not a fix. Hard word(s) in E/M: ledge | H: The ledge is very high, so use the best jumping legs. |

### burrow (Squeeze into a small burrow)

Titles (one is picked at random per challenge, any level): "Small Hole", "Burrow Visit", "Tunnel Time"

Family note: Three different problems (small, dirt, dark) share the title "Small Hole". Lines say "hands" for Claws and "thin" for size.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| burrow.fit L1 (A) | Small Hole / Burrow Visit / Tunnel Time | Be small to fit the hole. | Your dino must be small enough to fit. | Make your dino small enough to squeeze into the hole. |  |  |
| burrow.fit L1 (B) | same | Get a small dino. | Make a dino that fits the little hole. | The hole is little, so your dino must be small. |  |  |
| burrow.fit L2 (A) | same | Be tiny and thin. | The hole is tiny, so be very small. | Make your dino very small and thin to fit the hole. | E "tiny and thin": thin is not a part or stat (Size only). | E: Be tiny.<br>H: Make your dino very small to fit the hole. |
| burrow.fit L2 (B) | same | Fit a very tiny hole. | Make your dino small and thin. | This hole is tiny, so your dino must be the smallest. | E is a goal. M "small and thin": thin is not a part. | E: Get the smallest dino.<br>M: Make your dino very small. |
| burrow.dig L1 (A) | same | Dig through the dirt. | Your dino must dig through the dirt. | Give your dino hands that can dig through a pile of dirt. | H says "hands" but the part is Claws. | H: Give your dino claws that can dig through a pile of dirt. |
| burrow.dig L1 (B) | same | Get claws that dig. | Make a dino that can dig well. | Dirt blocks the door, so your dino must dig. | H states the problem, not the fix. | H: Pick claws that can dig through the dirt. |
| burrow.dig L2 (A) | same | Dig through hard dirt. | The dirt is hard, so dig very well. | Give your dino strong hands to dig through hard dirt. | H says "hands", not Claws. | H: Give your dino strong claws to dig through hard dirt. |
| burrow.dig L2 (B) | same | Get claws that dig well. | Make your dino a great digger. | This dirt is hard and deep, so dig harder. | H states the problem; "dig harder" is odd. | H: Pick claws that dig very well in hard dirt. |
| burrow.dark L1 (A) | same | Make light in the dark. | Your dino needs its own light. | Give your dino something extra that makes light in the dark. |  |  |
| burrow.dark L1 (B) | same | Get glow for the dark. | Make a dino that lights the dark. | The tunnel is dark, so your dino must glow. |  |  |

### tallGrass (Find the nest in the tall grass)

Titles (one is picked at random per challenge, any level): "Tall Grass", "High Grass", "Hidden Nest"

Family note: Title is about the grass; the second facet is about hiding in it. "big body" is not a part.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| tallGrass.peek L1 (A) | Tall Grass / High Grass / Hidden Nest | Stand, long neck, or big body. | Stand up, use long neck or big body. | Stand up, grow a long neck, or get a big body. | "big body" is not a part (it is Size: Big/Huge). M is missing "a": "use long neck". | E: Stand, long neck, or big size.<br>M: Stand up, long neck, or big size.<br>H: Stand up, grow a long neck, or get big size. |
| tallGrass.peek L1 (B) | same | Big body, long neck, or stand. | Get big, stand up, or use long neck. | Use a big body or long neck, or stand up tall. | "big body" is not a part (Size). M "Get big, stand up, or use long neck" breaks the list. | E: Big size, long neck, or stand.<br>M: Be big, stand up, or get long neck.<br>H: Get big size or a long neck, or stand up tall. |
| tallGrass.peek L2 (A) | same | See over very tall grass. | The grass is very tall, so be taller. | Make your dino tall enough to see over the very tall grass. | E is a goal, not a fix. | E: Get taller to see over it. |
| tallGrass.peek L2 (B) | same | Be much taller. | Make your dino tall enough for this grass. | Stand up high so your head is above the grass. | E "much taller" does not say how. | E: Be much taller. Stand or grow. |
| tallGrass.peek L3 (A) | same | Be the tallest dino. | The grass is huge, so be super tall. | Make your dino the tallest it can be to see the nest. |  |  |
| tallGrass.peek L3 (B) | same | See over the tallest grass. | Make your dino as tall as can be. | Only a super tall dino can see over grass this high. |  |  |
| tallGrass.sneak L1 (A) | same | Hide in the tall grass. | Make your dino blend in with grass. | Give your dino a pattern that looks like grass shadows. | Title "Tall Grass" is about peeking; this is hiding. H "pattern" and "grass shadows" are hard and not a part (Tiger Stripes). | E: Get stripes to hide.<br>H: Give your dino stripes that look like grass. |
| tallGrass.sneak L1 (B) | same | Pick an extra that hides. | Your dino must hide in the grass. | The big dino must not see your dino in the grass. | E "Pick an extra" is vague. H repeats the ferns/desert line. | E: Get stripes to hide.<br>H: Pick stripes so the big dino cannot see you. |

### tallTree (Get the fruit from a tall tree)

Titles (one is picked at random per challenge, any level): "Fruit Tree", "Snack Up High", "Tall Tree"

Family note: Titles fine. "Be strong and push" repeats the log lines exactly.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| tallTree.fruit L1 (A) | Fruit Tree / Snack Up High / Tall Tree | Reach up for the fruit. | Your dino must reach the low fruit. | Make your dino tall enough to reach the fruit on the branch. |  |  |
| tallTree.fruit L1 (B) | same | Get the fruit from the tree. | Make your dino able to grab fruit. | The fruit is just above your dino, so reach up. | E is a goal; H states the problem. | E: Get a long neck to reach.<br>H: The fruit is above your dino, so reach up. |
| tallTree.fruit L2 (A) | same | Reach the high fruit. | The fruit is high, so reach higher. | Make your dino tall, with a head that can go very high. |  |  |
| tallTree.fruit L2 (B) | same | Get fruit up high. | Make your dino able to reach very high. | This fruit hangs on a high branch, so reach up high. |  |  |
| tallTree.fruit L3 (A) | same | Reach the fruit at the top. | Make your dino reach the very top. | Make your dino very tall with a head up high. |  |  |
| tallTree.fruit L3 (B) | same | Reach super high. | Be super tall to reach the top fruit. | The last fruit is at the very top, so reach the highest. |  |  |
| tallTree.shake L1 (A) | same | Shake the tree to drop fruit. | Your dino must be strong to shake it. | Make your dino strong enough to shake the fruit down. | E is a goal; no part named. |  |
| tallTree.shake L1 (B) | same | Be strong and push. | Make a dino that can shake the tree. | Push the tree hard so the fruit falls down. | E repeats log.push exactly. H is a command with no part. | E: Get a big body to push.<br>H: Pick parts that can push the tree hard. |
| tallTree.shake L2 (A) | same | Shake a big tree. | This tree is big, so be very strong. | Make your dino big and very strong to shake the thick tree. | E is a goal, not a fix. | E: Be big and strong. |
| tallTree.shake L2 (B) | same | Be very strong. | Make your dino strong enough for this tree. | The tree trunk is thick, so your dino needs lots of strength. | E repeats log.push. | E: Be big and strong. |

### rocks (Climb the big rocks)

Titles (one is picked at random per challenge, any level): "Big Rocks", "Rock Climb", "Up We Go"

Family note: Titles "Up We Go"/"Rock Climb" do not fit the falling-pebbles facet. rocks/pile/wall/cliff are mixed.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| rocks.climb L1 (A) | Big Rocks / Rock Climb / Up We Go | Climb up the rocks. | Your dino must climb the pile of rocks. | Give your dino a good grip so it can climb the rocks. | E is a goal, not a fix. | E: Get claws to climb. |
| rocks.climb L1 (B) | same | Get claws that climb. | Make a dino that can climb well. | The rocks make a hill, so your dino must climb up. |  |  |
| rocks.climb L2 (A) | same | Climb the steep rocks. | The rock wall is steep, so climb well. | Make your dino light, with a good grip for a steep wall. | "rock wall" vs titles "Big Rocks / Rock Climb": rocks/pile/wall/cliff are mixed. |  |
| rocks.climb L2 (B) | same | Be a good climber. | Make your dino a strong climber. | This wall is steep, so your dino must grip and climb. |  |  |
| rocks.climb L3 (A) | same | Climb the steepest rocks. | The rocks are slippery, so grip very well. | Make your dino light, with a super grip for the slippery cliff. | Hard word(s) in E/M: slippery |  |
| rocks.climb L3 (B) | same | Be the best climber. | Make your dino the best climber ever. | This cliff is tall and slippery, so your dino must grip hard. | rocks / pile / wall / cliff mix. |  |
| rocks.tough L1 (A) | same | Be tough like a rock. | Your dino must be tough enough for pebbles. | Give your dino a strong back so pebbles bounce off. | H "a strong back" is not a part (Armor Plates). Hard word(s) in E/M: pebbles | H: Give your dino armor so pebbles bounce off. |
| rocks.tough L1 (B) | same | Pebbles bounce off tough dinos. | Make a dino that pebbles bounce off. | Make your dino tough enough to walk under falling pebbles. | E is a statement, not an instruction. Title "Up We Go" does not fit. Hard word(s) in E/M: pebbles | E: Get armor. Pebbles bounce off. |
| rocks.tough L2 (A) | same | Be very tough. | Big rocks fall here, so be very tough. | Give your dino a very tough back so big rocks bounce off. | H "tough back" is not a part. | H: Give your dino tough armor so big rocks bounce off. |
| rocks.tough L2 (B) | same | Be tough for big rocks. | Make your dino tough enough for big rocks. | Make your dino strong enough to walk under falling rocks. |  |  |

### river (Cross the river)

Titles (one is picked at random per challenge, any level): "River Crossing", "Splash", "Fishy River"

Family note: "Splash" is not a problem. Fix lines often describe instead of instruct.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| river.swim L1 (A) | River Crossing / Splash / Fishy River | Swim across the river. | Your dino must swim to the other side. | Give your dino a way to swim across the calm river. |  |  |
| river.swim L1 (B) | same | Get a way to swim. | Make a dino that can cross the water. | The river is calm, so your dino can paddle over. | H is a statement, not a fix. | H: Give your dino a way to paddle across the river. |
| river.swim L2 (A) | same | Swim across the wide river. | The river is wide, so swim well. | Make your dino a strong swimmer for the wide river. |  |  |
| river.swim L2 (B) | same | Be a good swimmer. | Make your dino a strong swimmer. | Give your dino parts that swim well across wide water. | H "parts that swim" is awkward. | H: Pick flippers or a swim body for the wide water. |
| river.swim L3 (A) | same | Swim in a fast river. | The water is fast, so swim very hard. | Make your dino swim strong against the fast river. | E is a goal; M "swim very hard" is effort, not a part. | E: Get parts to swim fast. |
| river.swim L3 (B) | same | Be a super swimmer. | Make your dino the best swimmer. | The river pushes hard, so your dino must swim very well. |  |  |
| river.fish L1 (A) | same | Pick a skin like the water. | Make your skin match the water. | Pick a skin color that blends in with the river water. |  |  |
| river.fish L1 (B) | same | Hide in the water. | A fish must not see your dino. | Hide from the fish so your dino can catch it. | E/M state the goal or the problem, not the fix. | E: Get skin like the water.<br>M: Match the water so fish miss you. |

### canyon (Fly across a deep canyon)

Titles (one is picked at random per challenge, any level): "Deep Canyon", "Sky Trip", "No Bridge"

Family note: Check is "not too big" but lines say "light".

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| canyon.fly L1 (A) | Deep Canyon / Sky Trip / No Bridge | Fly across the canyon. | Your dino must go over by air. | Give your dino a way to fly over the deep canyon. | Hard word(s) in E/M: canyon |  |
| canyon.fly L1 (B) | same | Get a way to fly. | There is no bridge, so go by air. | The bridge is gone, so your dino must cross by air. | E "a way to fly" is vague (Flying move). | E: Get wings to fly. |
| canyon.fly L2 (A) | same | Fly across the wide canyon. | The canyon is wide, so fly far. | Make your dino light so it can fly across the wide canyon. | The check is "not too big" but H says "light" (not something the player sees). Hard word(s) in E/M: canyon | H: Fly across the wide canyon with a small dino. |
| canyon.fly L2 (B) | same | Fly far and stay light. | Make your dino light enough to fly far. | Fly a long way, so do not make your dino too big. | "light" is not a size/part word; the fix is smaller size. | E: Fly far and stay small.<br>M: Make your dino small enough to fly far. |
| canyon.fly L3 (A) | same | Fly across the widest canyon. | The canyon is huge, so be very light. | Make your dino small and light to cross the huge canyon. | M "be very light": the check is small size. Hard word(s) in E/M: canyon | M: The canyon is huge, so be very small. |
| canyon.fly L3 (B) | same | Be small and fly far. | Make your dino small enough to fly far. | Only a tiny, light dino can fly this far. |  |  |

### nut (Crack a giant nut)

Titles (one is picked at random per challenge, any level): "Nut Crack", "Crunch Time", "Tough Nut"

Family note: Nut becomes "coconut" at level 2; the level 3 line is illogical.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| nut.crack L1 (A) | Nut Crack / Crunch Time / Tough Nut | Crack open the hard nut. | Your dino must break open the nut. | Give your dino a strong bite to crack the hard nut. |  |  |
| nut.crack L1 (B) | same | Get strong teeth. | Make a dino that can crack nuts. | Break the hard shell to get the treat inside. | H is a goal, not a fix. | H: Pick strong teeth to break the hard shell. |
| nut.crack L2 (A) | same | Crack a very hard nut. | The coconut is hard, so crunch very hard. | Give your dino a very strong bite to crack the coconut. | M says "coconut" while the title and level 1 say "nut". Hard word(s) in E/M: coconut | M: The nut is very hard. Crunch very hard.<br>H: Give your dino a very strong bite to crack the nut. |
| nut.crack L2 (B) | same | Crunch a big coconut. | Make your dino able to break a coconut. | The coconut shell is thick, so your dino must crunch hard. | "coconut" appears suddenly. Hard word(s) in E/M: coconut | E: Crunch a big nut.<br>M: Get teeth that can break a big nut.<br>H: The nut shell is thick, so your dino must crunch hard. |
| nut.crack L3 (A) | same | Crack the hardest nut. | This nut is rock hard, so crunch hardest. | Give your dino the strongest bite to crack this giant nut. | M "crunch hardest" is bad grammar. | M: This nut is hard. Get the best teeth. |
| nut.crack L3 (B) | same | Crunch super hard. | Make your dino the strongest cruncher ever. | Nobody can crack this nut, so your dino needs super power. | H is illogical ("Nobody can crack this nut") and "super power" is vague. Hard word(s) in E/M: cruncher | H: This nut is giant, so your dino needs the strongest teeth. |

### log (Push a log off the path)

Titles (one is picked at random per challenge, any level): "Log Push", "Blocked Path", "Heave Ho"

Family note: Repeats lines from tallTree.shake.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| log.push L1 (A) | Log Push / Blocked Path / Heave Ho | Push the log away. | Your dino must push the log away. | Make your dino strong enough to push the log off the path. | E and M are goals; no part named. | E: Get a horn head to push. |
| log.push L1 (B) | same | Be strong and push. | Make a dino strong enough to move logs. | The log blocks the path, so your dino must shove it. | E repeats tallTree.shake. H "shove" is hard to read. | E: Get a horn head to push.<br>H: The log blocks the path, so push it away. |
| log.push L2 (A) | same | Push a big, heavy log. | The log is heavy, so be very strong. | Make your dino big and very strong to shove the heavy log. | E is a goal. |  |
| log.push L2 (B) | same | Be very strong. | Make your dino big and strong. | This log is thick and heavy, so push with lots of power. | E repeats tallTree.shake. | E: Be big and push. |
| log.push L3 (A) | same | Push the giant log. | The log is giant, so be super strong. | Make your dino huge and super strong to move the giant log. |  |  |
| log.push L3 (B) | same | Be super strong. | Make your dino the strongest of all. | Only the strongest dino can push a log this big. |  |  |

### snow (Walk over the snowy mountain)

Titles (one is picked at random per challenge, any level): "Snowy Mountain", "Brrr", "Ice Hill"

Family note: "Brrr" is a noise, not a problem. Warmth lines never say how to get warm.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| snow.warm L1 (A) | Snowy Mountain / Brrr / Ice Hill | Stay warm in the snow. | Your dino must not get cold. | Make your dino warm enough for the cold snow. |  |  |
| snow.warm L1 (B) | same | Get a warm dino. | Make a dino that stays warm. | Snow is cold, so your dino needs to keep warm. | E/M/H do not say how (feathers, big body). | E: Get feathers to stay warm. |
| snow.warm L2 (A) | same | Stay warm in the storm. | The storm is freezing, so be very warm. | Make your dino very warm for the freezing snowstorm. | Title "Brrr" is not a problem. Hard word(s) in E/M: freezing |  |
| snow.warm L2 (B) | same | Be very warm. | Make your dino super warm. | The wind is icy, so your dino needs lots of warmth. |  |  |
| snow.slope L1 (A) | same | Climb up the snowy hill. | Your dino must not slide on snow. | Give your dino a good grip to climb the icy hill. | M states the problem, not the fix. | M: Get claws that do not slide on snow. |
| snow.slope L1 (B) | same | Get a grip on snow. | Make a dino that can climb ice. | The hill is slippery, so your dino must grip well. | E "Get a grip" is an idiom. H states the problem. | E: Get claws that grip snow.<br>H: The hill is slippery, so use claws that grip well. |
| snow.slope L2 (A) | same | Climb the steep, icy hill. | The ice is steep, so grip very well. | Make your dino light, with a super grip for the steep ice. |  |  |
| snow.slope L2 (B) | same | Be a great climber. | Make your dino climb up a steep hill. | This icy wall is steep, so your dino must grip hard. | M is a goal. | M: Get claws that climb a steep hill. |

### birds (Shoo the pesky birds away)

Titles (one is picked at random per challenge, any level): "Pesky Birds", "Shoo Shoo", "Noisy Nest"

Family note: Mix of noise / honk / roar. "shoo" and "flock" are hard words.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| birds.roar L1 (A) | Pesky Birds / Shoo Shoo / Noisy Nest | Make a loud noise. | Your dino must be loud to shoo birds. | Give your dino a loud voice to shoo the birds away. | M "Make a noise" is not a fix. E/M "shoo" is hard for beginners. | E: Get a loud voice.<br>M: Get a loud head to chase birds. |
| birds.roar L1 (B) | same | Shoo the birds away. | Make a noise that chases birds away. | The birds are on the nest, so make a loud noise. | E "Shoo" is hard to read. | E: Chase the birds away. |
| birds.roar L2 (A) | same | Make a very loud honk. | The flock is big, so be very loud. | Give your dino a very loud voice to shoo the big flock. | E "honk" vs level 3 "roar" (mixed sounds). M "flock" is hard. | E: Make a very loud roar.<br>M: There are many birds, so be very loud. |
| birds.roar L2 (B) | same | Shoo a big flock. | Make a honk that is very loud. | Many birds are here, so your dino must be much louder. | M "honk" vs "roar" elsewhere. Hard word(s) in E/M: shoo, flock | M: Make a roar that is very loud. |
| birds.roar L3 (A) | same | Make the loudest roar. | Make a roar that is the loudest ever. | Give your dino the loudest roar so every bird flies away. | M "the loudest ever" is a double superlative. |  |
| birds.roar L3 (B) | same | Roar super loud. | Every bird must fly away, so roar loudest. | Your dino needs a roar even louder than thunder. |  |  |

### desert (Hot sandy desert)

Titles (one is picked at random per challenge, any level): "Hot Desert", "Sand Dunes", "Sunny Sands"

Family note: Level 2/3 lines often drop the sand color. "cool" is ambiguous.

| Level | Title | Easy | Medium | Hard | Problems | Suggested rewrite |
|---|---|---|---|---|---|---|
| desert.hide L1 (A) | Hot Desert / Sand Dunes / Sunny Sands | Pick a skin like sand. | Make your skin match the sand. | Pick a skin color that helps your dino hide in sand. |  |  |
| desert.hide L1 (B) | same | Hide in the sand. | Your dino must hide in the desert. | The big dino must not see your dino in the dunes. | E is a goal. | E: Get skin like the sand. |
| desert.hide L2 (A) | same | Hide behind a small dune. | The dune is small, so be small too. | Match the color of the sand and be small to hide. | E is a goal. M leaves out sand color. Hard word(s) in E/M: dune | E: Match the sand and be small.<br>M: Small dune. Match the sand, be small. |
| desert.hide L2 (B) | same | Match the sand and be small. | Match the sand and stay low. | Only a small dune is here, so your dino must be small. | M "stay low" is not a size word. | M: Match the sand and stay small. |
| desert.hide L3 (A) | same | Hide on flat, open sand. | No dunes are here, so be very small. | There is nowhere to hide, so match the sand and be tiny. | E is a goal. M leaves out color. Hard word(s) in E/M: dunes | E: Match the sand and be tiny.<br>M: No dunes. Match the sand, be tiny. |
| desert.hide L3 (B) | same | Match the sand and be tiny. | Match the sand and be super small. | On flat sand, your dino must be tiny and match the color. |  |  |
| desert.cool L1 (A) | same | Stay cool in the sun. | Your dino must not get too hot. | Make your dino stay cool under the hot desert sun. | E is a goal. No part or way named (Extra). |  |
| desert.cool L1 (B) | same | Do not get too hot. | Make a dino that stays cool. | The sand is hot, so your dino must keep cool. | E is a goal. |  |
| desert.cool L2 (A) | same | Stay cool in the hottest sand. | The sand is super hot, so stay cool. | Make your dino cool and light for the very hot sand. | H "cool and light": "light" is not part of the check. | H: Make your dino as cool as can be for the hot sand. |
| desert.cool L2 (B) | same | Be very cool. | Make your dino very cool and light. | This is the hottest day, so your dino must stay cool. | E "Be very cool" reads as slang. M "cool and light": "light" is extra. | E: Stay very cool.<br>M: Make your dino very cool. |