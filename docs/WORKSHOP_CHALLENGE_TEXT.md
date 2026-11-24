# Adventure Workshop: challenge text review (regraded after the rework)

> **Since C38** the cards no longer show these guideline lines. They show the story lines in `content/race/stories.ts` and `content/dino/stories.ts`, and a failed run adds lines that name a part. The guidelines below still define each level's named fixes. This file is hand-written, not generated, so it was not regenerated.

For the designer. Every row below was rendered by the real text builder (`apps/workshop/logic/text.ts`, `resolveSpec`) from the phrase banks in `content/race/phrases.ts` and `content/dino/phrases.ts`, then graded against the facet checks. The Problems column was graded by script (word limits, row order, part names, hard words, whether the named parts alone solve the level from the default build) and then by hand. The previous review's suggestions were applied, and improved where they still broke a rule.

## Summary

- **30 challenge families** (15 Race Shop, 15 Dino Lab), **48 requirements** (22 + 26), **224 table rows** (102 + 122: 2 authored rows per requirement level), **672 guideline lines**.
- **Rows changed: 224 of 224** (672 of 672 lines). Every line was rewritten so it names the fix by the part names shown at the stations; the old text is in the narrow "Was" column.
- **Titles: all rewritten.** The title is no longer picked at random from 3 per scenario. A stage with one requirement shows that requirement's **level title** (for example Muddy Road, Deep Mud, Very Deep Mud); a stage with two or more requirements shows the scenario's single **stage title**, written to fit every requirement in it (for example Muddy Farm Road). Two stages still join with "&", three or more use "<first> Adventure". No title is shared between the workshops ("Hide and Seek" is gone).
- **A row is a unit now.** One draw picks row A or B for all three reading levels, so Easy, Medium and Hard on a card always say the same fix. Saved cards keep their stored text.
- **Remaining flags: 6 rows** (0 Race Shop, 6 Dino Lab), all the same kind: at the top level of a stat, the fix needs four parts, and six Easy words cannot name all four. Medium and Hard name the full fix in those rows. Two of them also use a Leaf Pattern or Tiger Stripes in the desert, which works in the rules but reads oddly.
  - chase.speed L3 (A): E names only part of the fix (it needs more parts than the word limit allows)
  - chase.speed L3 (B): E names only part of the fix (it needs more parts than the word limit allows)
  - rocks.climb L3 (A): E names only part of the fix (it needs more parts than the word limit allows)
  - rocks.climb L3 (B): E names only part of the fix (it needs more parts than the word limit allows)
  - desert.hide L3 (A): E names only part of the fix (it needs more parts than the word limit allows); M/H name a Leaf Pattern in the desert: it works (it adds hiding), but reads oddly for sand
  - desert.hide L3 (B): E names only part of the fix (it needs more parts than the word limit allows); M/H name Tiger Stripes in the desert: it works (it adds hiding), but reads oddly for sand
- **Now checked by `validateCatalog`** (fails `npm test`): word limits; Easy <= Medium <= Hard word count in each row; every line names a part that helps every check of its level (and every option of an any-of); no duplicate line in a workshop (and none across workshops, in `validateCatalog.test.ts`); no leftover placeholders; no hard words or idioms from the old review (part names are allowed); one title per facet level and one stage title per scenario, all unique, at most 4 words.

### Style used

- Part names are written as the stations show them, with capitals: "Get Mud Tires.", "Pick the Small size.", "Get Sky Blue skin." Approved short forms: Rocket, Spoiler, Turbo (Race Shop); stand, wings, Frill, Sandy (Dino Lab).
- When the fix needs two or three parts and the word limit is tight, Easy uses a short list ("Climbing Gears and a Big Engine.", "Hoppy Legs, Long Tail, Slim Body."). These are noun phrases that answer the title, written to be read like labels.
- Size words (Small, Tiny, Big, Huge) are the Size station's names, so "the Small size" names a part.

### Legend

- **Level**: requirement id and level (L1 = easiest), then A/B = the two authored rows (a card shows one row at every reading level).
- **Title**: the card title for a stage with only this requirement at this level.
- **Easy / Medium / Hard**: exact text. Max words 6 / 8 / 12.
- **Problems**: E, M, H = the Easy, Medium and Hard line. Blank = no problem found.
- **Was**: the old line, only where it changed (old rows A/B were picked separately per reading level).

Part names the player sees. Race Shop: Wheels, Engine, Gears, Springs, Bumper, Paint, Body, Shape, Size, Extra. Dino Lab: Color, Head, Teeth, Claws, Legs, Moving, Tail, Body, Size, Extra.

## Race Shop

### mud (Deep mud on the farm road)

Two-requirement title: "Muddy Farm Road". Was: "Deep Mud" / "Muddy Field" / "Mud Rescue", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| mud.grip L1 (A) | Muddy Road | Get Mud Tires. | Get Mud Tires so you do not slip. | Put on Mud Tires so the wheels grip the soft mud. |  | E: Get wheels that grip mud.<br>M: Get something that grips mud well.<br>H: Get a part that keeps the car from slipping in mud. |
| mud.grip L1 (B) | Muddy Road | Pick Mud Tires for the mud. | Pick Mud Tires or 4x4 Drive. | Pick Mud Tires or 4x4 Drive to grip the mud. |  | E: Get wheels that do not slip.<br>M: Do not get stuck in the mud.<br>H: Pick something with a strong grip for soft mud. |
| mud.grip L2 (A) | Deep Mud | Get Mud Tires and a Jeep. | Deep mud needs Mud Tires and a Jeep. | Put Mud Tires on a Jeep so it grips the deep mud. |  | E: Get wheels with more grip.<br>M: Get a lot of grip for deep mud.<br>H: Get a part with a very strong grip for deep mud. |
| mud.grip L2 (B) | Deep Mud | Use Monster Wheels and a Jeep. | Monster Wheels on a Jeep grip deep mud. | Pick Monster Wheels and a Jeep to get through deep mud. |  | E: Deep mud needs strong grip.<br>M: Deep mud needs a very good grip.<br>H: Deep, sticky mud needs the best grip you can get. |
| mud.grip L3 (A) | Very Deep Mud | Get Mud Tires and 4x4 Drive. | Deep mud needs Mud Tires and 4x4 Drive. | Mud this deep needs Mud Tires with 4x4 Drive to grip. |  | E: Get the most grip for mud.<br>M: Get the best grip for gooey mud.<br>H: Get the strongest grip you can for very deep, gooey mud. |
| mud.grip L3 (B) | Very Deep Mud | Use Monster Wheels and 4x4 Drive. | Monster Wheels and 4x4 Drive grip best. | Put on Monster Wheels and 4x4 Drive for this very deep mud. |  | E: This mud needs top grip.<br>M: This mud is deep, so grip the most.<br>H: Only the best grip will move through this deep mud. |
| mud.pull L1 (A) | Stuck Tractor | Get a Winch to pull. | Get a Winch to pull the tractor out. | Put a Winch on your car to pull the stuck tractor out. |  | E: Get a way to pull.<br>M: Get a tool to pull the tractor out.<br>H: Bring something that can hook and pull a stuck tractor. |
| mud.pull L1 (B) | Stuck Tractor | Use a Winch on the tractor. | Hook a Winch to the stuck tractor. | Hook your Winch to the tractor and pull it from the mud. |  | E: Pull the stuck tractor out.<br>M: You need to pull a stuck tractor.<br>H: Pick a tool that can pull a tractor out. |
| mud.pull L2 (A) | Heavy Tractor | Get a Winch and Climbing Gears. | Pull with a Winch and Climbing Gears. | The tractor is heavy, so use a Winch and Climbing Gears. |  | E: The tractor is heavy. Get power.<br>M: Pull a heavy tractor with power.<br>H: A heavy tractor needs a pulling tool and strong power. |
| mud.pull L2 (B) | Heavy Tractor | A Winch and a Big Engine. | Get a Winch and a Big Engine. | The tractor is heavy, so get a Winch and a Big Engine. |  | E: Pull a heavy tractor with power.<br>M: You need a tool and strong power.<br>H: Bring a tool to pull and plenty of power. |

### jump (Ramp jump over a gap)

Two-requirement title: "Ramp Jump". Was: "Long Jump" / "Big Ramp" / "Canyon Leap", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| jump.speed L1 (A) | Jump the Gap | Get Speed Gears to go fast. | Get Speed Gears to jump the gap. | Put in Speed Gears so your car goes fast enough to jump. |  | E: Go fast to jump the gap.<br>M: Go fast enough to jump the gap.<br>H: Your car needs enough speed to fly over the gap. |
| jump.speed L1 (B) | Jump the Gap | Use a Rocket Booster to jump. | A Rocket Booster gets you over the gap. | Use a Rocket Booster to fly fast over the gap. |  | E: Get speed for the jump.<br>M: Get speed to fly over the gap.<br>H: Go fast so you do not land short. |
| jump.speed L2 (A) | Long Gap | Use Speed Gears and a Rocket. | Get Speed Gears and a Rocket Booster. | The gap is long, so get Speed Gears and a Rocket Booster. |  | E: Long gap. Go very fast.<br>M: Go very fast to jump the long gap.<br>H: Your car must be very fast to jump the long gap. |
| jump.speed L2 (B) | Long Gap | Get a Sleek Sports Car. | A Sleek Sports Car can jump this gap. | Pick a Sports Car with a Sleek shape for the long gap. |  | E: A long jump needs more speed.<br>M: A long gap needs a very fast car.<br>H: The gap is long, so you need a lot of speed. |
| jump.speed L3 (A) | Huge Gap | Turbo Engine, Rocket, Speed Gears. | Add Speed Gears, Turbo Engine, and Rocket. | Use Speed Gears, a Turbo Engine, and a Rocket Booster. |  | E: Huge gap. Go super fast.<br>M: Get top speed to jump the huge gap.<br>H: Go as fast as you can to jump the huge gap. |
| jump.speed L3 (B) | Huge Gap | A Sleek Sports Car with Turbo. | A Sleek Sports Car with a Turbo Engine. | Pick a Sleek Sports Car with a Turbo Engine for this gap. |  | E: Get the most speed.<br>M: Go super fast to cross the big gap.<br>H: Only the fastest car can jump this big gap. |
| jump.landing L1 (A) | Hard Landing | Get Bouncy Springs to land. | Get Bouncy Springs for a soft landing. | Put in Bouncy Springs so the car lands soft after the jump. |  | E: Get springs for a soft landing.<br>M: Land soft after the big jump.<br>H: Your car must land soft after the jump. |
| jump.landing L1 (B) | Hard Landing | Land soft with Bouncy Springs. | Bouncy Springs make the landing soft. | Pick Bouncy Springs so the landing is soft, not a bump. |  | E: Land soft, not with a bump.<br>M: Make the landing soft, not hard.<br>H: Pick a part that makes the landing soft. |
| jump.landing L2 (A) | Big Drop | Get Bouncy Springs and Monster Wheels. | Land soft on Bouncy Springs and Monster Wheels. | The drop is big, so get Bouncy Springs and Monster Wheels. |  | E: Big drop! Land very soft.<br>M: The drop is big, so land very soft.<br>H: The drop is high, so make the landing very soft. |
| jump.landing L2 (B) | Big Drop | Use Bouncy Springs and Rubber Bumpers. | Land on Bouncy Springs and Rubber Bumpers. | Pick Bouncy Springs and Rubber Bumpers to land soft from up high. |  | E: Get springs that are very soft.<br>M: Make a very soft landing from up high.<br>H: Pick a part that makes a very soft landing. |

### turn (Sharp turns (top view))

Two-requirement title: "Corners Ahead" (never shown: one requirement only). Was: "Sharp Turn" / "Twisty Road" / "Zigzag Track", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| turn.handling L1 (A) | Sharp Turn | Get Sport Springs to turn. | Get Sport Springs to turn without a slide. | Put in Sport Springs so the car turns without a slide. |  | E: Get springs that help you turn.<br>M: Turn the sharp corner without a slide.<br>H: Your car must turn the sharp corner without sliding. |
| turn.handling L1 (B) | Sharp Turn | Use Racing Tires to turn. | Racing Tires help you take the sharp turn. | Pick Racing Tires or a Big Spoiler to take the sharp turn. |  | E: Turn fast without a slide.<br>M: Get a car that turns well.<br>H: Pick a part that helps the car turn well. |
| turn.handling L2 (A) | Many Turns | Get Sport Springs and Racing Tires. | Get Sport Springs and Racing Tires for turns. | Many turns are coming, so get Sport Springs and Racing Tires. |  | E: The road twists. Turn well.<br>M: The road twists, so turn very well.<br>H: The road has many turns, so your car must turn well. |
| turn.handling L2 (B) | Many Turns | Use Sport Springs and a Spoiler. | Use Sport Springs and a Big Spoiler. | Pick Sport Springs and a Big Spoiler for all the turns. |  | E: Get a car that turns well.<br>M: Turn many corners without a slide.<br>H: Pick a part that helps with turn after turn. |
| turn.handling L3 (A) | Super Tight Turns | Sport Springs, Racing Tires, Big Spoiler. | Add Sport Springs, Racing Tires, and a Spoiler. | Use Sport Springs, Racing Tires, and a Big Spoiler for tight turns. |  | E: Super twisty road! Turn best.<br>M: The road is super twisty. Turn best.<br>H: Turn as well as you can on this very twisty road. |
| turn.handling L3 (B) | Super Tight Turns | Sport Springs, Racing Tires, Tiny size. | Add Sport Springs, Racing Tires, and Tiny size. | Pick Sport Springs, Racing Tires, and Tiny size for super tight turns. |  | E: Turn super well.<br>M: Zigzag with no slide at all.<br>H: Only the best turner can zigzag along this road. |

### hill (Steep hill climb)

Two-requirement title: "Hill Climb" (never shown: one requirement only). Was: "Steep Hill" / "Mountain Climb" / "Up, Up, Up", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| hill.power L1 (A) | Steep Hill | Get a Big Engine to climb. | Get a Big Engine to climb the hill. | Put in a Big Engine so the car can climb the hill. |  | E: Get an engine for the hill.<br>M: Get power to climb the steep hill.<br>H: Your car needs power to climb the steep hill. |
| hill.power L1 (B) | Steep Hill | Use Climbing Gears for the hill. | Climbing Gears give power to go up. | Pick Climbing Gears or a Big Engine to climb the steep hill. |  | E: Climb the hill with power.<br>M: The hill is steep, so get power.<br>H: Pick a part with strong power for the hill. |
| hill.power L2 (A) | Very Steep Hill | Climbing Gears and a Big Engine. | Get Climbing Gears and a Big Engine. | A very steep hill needs Climbing Gears and a Big Engine. |  | E: Steep hill. Get much more power.<br>M: Get lots of power for the steep hill.<br>H: A very steep hill needs a lot of power. |
| hill.power L2 (B) | Very Steep Hill | Climbing Gears and a Turbo Engine. | Use Climbing Gears and a Turbo Engine. | Pick Climbing Gears and a Turbo Engine for lots of power. |  | E: Get lots of power.<br>M: The hill is very steep. Be strong.<br>H: Pick a part with much more power for this hill. |
| hill.power L3 (A) | Super Steep Hill | Big Engine with Climbing Gears. | Get a Big Engine with Climbing Gears. | A super steep hill needs a Big Engine with Climbing Gears. |  | E: Huge hill! Get top power.<br>M: Get the most power for the steepest hill.<br>H: Get the most power you can to climb this very steep hill. |
| hill.power L3 (B) | Super Steep Hill | Top power: Big Engine, Climbing Gears. | Put a Big Engine and Climbing Gears together. | Use a Turbo Engine, Climbing Gears, and a Jeep for top power. |  | E: Be super strong.<br>M: This hill is a wall, so be strong.<br>H: Only the strongest car can climb this hill. |

### fog (Foggy road, ducks waiting to cross)

Two-requirement title: "Fog and Ducks" (never shown: one requirement only). Was: "Foggy Road" / "Thick Fog" / "Duck Crossing", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| fog.bright L1 (A) | Foggy Road | Paint it Bright Yellow. | Use Bright Yellow so the ducks see you. | Pick Bright Yellow paint so the ducks can see you in fog. |  | E: Get bright paint.<br>M: Make the car bright so ducks see it.<br>H: Pick a bright color so the ducks can see your car. |
| fog.bright L1 (B) | Foggy Road | Use Fire Red or Rainbow paint. | Bright paint like Fire Red or Rainbow works. | Pick a bright paint, like Fire Red or Rainbow, for the fog. |  | E: Paint the car bright.<br>M: Pick a color ducks can see in fog.<br>H: A dull car hides in fog, so make it bright. |

### lowBridge (Low bridge)

Two-requirement title: "Bridge Ahead" (never shown: one requirement only). Was: "Low Bridge" / "Duck Under" / "Squeeze Under", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| lowBridge.height L1 (A) | Low Bridge | Get the Small size. | Pick the Small size to fit under. | Make your car the Small size so it fits under the bridge. |  | E: Make the car short to fit.<br>M: Make the car short to fit under.<br>H: Your car must be short enough to go under the bridge. |
| lowBridge.height L1 (B) | Low Bridge | Get a Sports Car to fit. | A low Sports Car fits under the bridge. | Pick a Sports Car or Sleek shape to fit under the bridge. |  | E: The bridge is low. Be short.<br>M: Get low to go under the bridge.<br>H: Make sure nothing on the car is too tall. |
| lowBridge.height L2 (A) | Very Low Bridge | Get the Tiny size. | Pick the Tiny size to fit under. | The bridge is very low, so make your car the Tiny size. |  | E: Very low bridge. Be very short.<br>M: The bridge is very low. Be very short.<br>H: The bridge is very low, so make your car very short. |
| lowBridge.height L2 (B) | Very Low Bridge | Small size and a Sports Car. | Get a Sports Car in the Small size. | Pick a Small Sports Car so it fits under this low bridge. |  | E: Get a very short car.<br>M: Make the car very short and flat.<br>H: Take off anything tall so the car fits under. |
| lowBridge.height L3 (A) | Super Low Bridge | Get a Tiny Sports Car. | Pick a Tiny Sports Car to fit under. | A Tiny Sports Car can fit under this super low bridge. |  | E: Low gap! Be the shortest.<br>M: Make the car as short as you can.<br>H: Make your car as short and flat as it can be. |
| lowBridge.height L3 (B) | Super Low Bridge | Tiny size and a Sleek shape. | Use the Tiny size and a Sleek shape. | Pick the Tiny size and a Sleek shape to fit under. |  | E: Get the shortest car.<br>M: Get the lowest car to fit under.<br>H: Only the lowest car can fit under this bridge. |

### narrow (Narrow alley between trees (top view))

Two-requirement title: "Tree Path" (never shown: one requirement only). Was: "Narrow Path" / "Skinny Alley" / "Between the Trees", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| narrow.width L1 (A) | Narrow Path | Pick the Small size to fit. | Make the car thin with the Small size. | Pick the Small size so the car fits the narrow path. |  | E: Get a thin car to fit.<br>M: Make the car thin to fit through.<br>H: Your car must be thin enough to go through the gap. |
| narrow.width L1 (B) | Narrow Path | Get a thin, Sleek shape. | A Sleek shape makes the car thin. | Pick a Sleek shape so your car can fit between the trees. |  | E: The path is thin. Be small.<br>M: Go through the thin gap.<br>H: A wide car gets stuck, so make yours thin. |
| narrow.width L2 (A) | Very Narrow Path | Pick the Tiny size to fit. | Make the car very thin with Tiny size. | The path is very narrow, so make your car the Tiny size. |  | E: Very thin path. Be very thin.<br>M: The gap is very thin. Be very thin.<br>H: The gap is very thin, so make your car very thin. |
| narrow.width L2 (B) | Very Narrow Path | Small size and a Sleek shape. | Get the Small size and a Sleek shape. | Pick the Small size and a Sleek shape for this path. |  | E: Get the thinnest car.<br>M: Make the car very small to fit.<br>H: Only a very thin car can go through here. |

### delivery (Heavy delivery)

Two-requirement title: "Heavy Delivery". Was: "Big Delivery" / "Delivery Day" / "Box Hauler", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| delivery.load L1 (A) | Box Delivery | Get a Pickup Truck for boxes. | Get a Pickup Truck with room for boxes. | Pick a Pickup Truck so there is room for all the boxes. |  | E: Get room for lots of boxes.<br>M: Make room to carry many boxes.<br>H: Your car needs room to carry many boxes. |
| delivery.load L1 (B) | Box Delivery | Use a Van to carry boxes. | A Van has lots of room for boxes. | Pick a Van or the Big size to make room for boxes. |  | E: Carry boxes to the shop.<br>M: The car must carry a big load.<br>H: Pick a car with space for a big load. |
| delivery.load L2 (A) | Big Delivery | Get a Van. It holds more. | Get a Van to carry this big load. | This load is big, so get a Van with lots of room. |  | E: Carry a very big load.<br>M: Make lots of room for the boxes.<br>H: The pile of boxes is very big, so you need much room. |
| delivery.load L2 (B) | Big Delivery | Pickup Truck and Big size. | Get a Pickup Truck in the Big size. | Pick a Big Pickup Truck to carry this big load. |  | E: Get lots of room.<br>M: The pile of boxes is very big.<br>H: Pick a car with lots of space in the back. |
| delivery.load L3 (A) | Giant Delivery | Get a Big Van. | Get a Van in the Big size. | Only a Van in the Big size can carry this giant load. |  | E: Carry the biggest load!<br>M: Get the most room you can for boxes.<br>H: Get as much room as you can for this giant load. |
| delivery.load L3 (B) | Giant Delivery | A Big Van holds the most. | Pick a Big Van for the giant load. | Get a Van in the Big size so every box fits. |  | E: Get the most room.<br>M: The load is giant, so make room.<br>H: Only a car with the most space can carry it all. |
| delivery.power L1 (A) | Heavy Boxes | Get a Big Engine for boxes. | Get a Big Engine to pull heavy boxes. | Heavy boxes need power, so put in a Big Engine. |  | E: The boxes are heavy. Get power.<br>M: The boxes are heavy, so get power.<br>H: Heavy boxes need a car with strong power. |
| delivery.power L1 (B) | Heavy Boxes | Use Climbing Gears for power. | Climbing Gears give power for the heavy load. | Pick Climbing Gears or a Turbo Engine to carry the heavy load. |  | E: Heavy boxes need a strong engine.<br>M: Get strong power to pull a heavy load.<br>H: Pick a part with enough power for the ramp. |

### snow (Snowy mountain pass)

Two-requirement title: "Snowy Pass" (never shown: one requirement only). Was: "Snowy Pass" / "Snow Day" / "Icy Road", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| snow.grip L1 (A) | Snowy Road | Get Snow Tires. | Get Snow Tires so you do not slide. | Put on Snow Tires so the wheels grip the snowy road. |  | E: Get wheels that grip snow.<br>M: Get a grip so you do not slide.<br>H: Pick a part that grips the road in snow. |
| snow.grip L1 (B) | Snowy Road | Use 4x4 Drive in the snow. | Snow Tires or 4x4 Drive will grip snow. | Pick Snow Tires or 4x4 Drive so the car does not slide. |  | E: Do not slide on snow.<br>M: Drive on snow without a slide.<br>H: Your car must not slide on the snowy road. |
| snow.grip L2 (A) | Deep Snow | Get Snow Tires for deep snow. | Deep snow needs Snow Tires to grip. | Put on Snow Tires so your car can get through deep snow. |  | E: Deep snow! Get more grip.<br>M: Get a lot of grip for deep snow.<br>H: Pick a part with a strong grip for deep snow. |
| snow.grip L2 (B) | Deep Snow | Snow Tires grip deep snow. | Pick Snow Tires to drive in deep snow. | Pick Snow Tires so the car can drive through deep snow. |  | E: Get wheels for deep snow.<br>M: Drive through deep snow without a slide.<br>H: Deep snow is slippery, so you need more grip. |
| snow.grip L3 (A) | Snow and Ice | Snow Tires and 4x4 Drive. | Get Snow Tires and 4x4 Drive for ice. | Snow and ice need both Snow Tires and 4x4 Drive. |  | E: Snow and ice! Get top grip.<br>M: Get the best grip for snow and ice.<br>H: Get the best grip you can for deep snow and ice. |
| snow.grip L3 (B) | Snow and Ice | Get Snow Tires and a Jeep. | Put Snow Tires on a Jeep for ice. | Pick a Jeep with Snow Tires to grip the snow and ice. |  | E: Ice is slippery. Get top grip.<br>M: Ice is very slippery, so grip the most.<br>H: Only the strongest grip will work on this icy road. |

### rocks (Rocky forest trail)

Two-requirement title: "Rocky Trail". Was: "Rocky Road" / "Bumpy Trail" / "Forest Trail", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| rocks.tough L1 (A) | Bumpy Rocks | Get Rubber Bumpers for rocks. | Get Rubber Bumpers to bump off the rocks. | Put on Rubber Bumpers so the rocks just bounce off. |  | E: Get a tough car for rocks.<br>M: Make the car tough to bump rocks.<br>H: Your car must be tough enough for a rocky road. |
| rocks.tough L1 (B) | Bumpy Rocks | Use Big Bumpers on rocks. | Big Bumpers make the car tough. | Pick Big Bumpers or a Jeep so the car is tough enough. |  | E: Get strong bumpers for rocks.<br>M: The road is rocky, so be tough.<br>H: Pick parts that can take bumps from rocks. |
| rocks.tough L2 (A) | Big Rocks | Rubber Bumpers and a Jeep. | Get Rubber Bumpers and a Jeep for rocks. | Big rocks need a tough Jeep with Rubber Bumpers. |  | E: Lots of rocks! Be more tough.<br>M: Get a very tough car for big rocks.<br>H: Many big rocks need a car that is very tough. |
| rocks.tough L2 (B) | Big Rocks | Get Big Bumpers and a Jeep. | Put Big Bumpers on a tough Jeep. | Pick Big Bumpers and Monster Wheels to roll over big rocks. |  | E: Get a very tough car.<br>M: The rocks are big, so be tough.<br>H: Pick parts that can take bump after bump. |
| rocks.tough L3 (A) | Giant Rocks | Jeep, Rubber Bumpers, Monster Wheels. | Get a Jeep, Rubber Bumpers, and Monster Wheels. | Giant rocks need a Jeep, Rubber Bumpers, and Monster Wheels. |  | E: The rockiest road! Be the toughest.<br>M: Get the toughest car for giant rocks.<br>H: Make your car as tough as you can for giant rocks. |
| rocks.tough L3 (B) | Giant Rocks | Rubber Bumpers, Monster Wheels, Round shape. | Monster Wheels, Rubber Bumpers, and Round shape. | Pick Rubber Bumpers, Monster Wheels, and a Round shape for giant rocks. |  | E: Get a super tough car.<br>M: Giant rocks need a super strong car.<br>H: Only the toughest car will get past these rocks. |
| rocks.clearance L1 (A) | Tall Rocks | Get a Lift Kit. | Get a Lift Kit to ride up high. | Put on a Lift Kit so the car rides over the rocks. |  | E: Ride high over the rocks.<br>M: Ride high so rocks go under.<br>H: Your car must ride high so rocks go underneath. |
| rocks.clearance L1 (B) | Tall Rocks | Use Monster Wheels to ride high. | Monster Wheels lift the car over rocks. | Pick Monster Wheels or a Jeep to ride high over the rocks. |  | E: Lift the car up.<br>M: Get space under the car.<br>H: Lift your car up to go over the rocks. |
| rocks.clearance L2 (A) | Very Tall Rocks | A Jeep with a Lift Kit. | Put a Lift Kit on a Jeep. | Put a Lift Kit on a Jeep to ride over tall rocks. |  | E: Big rocks! Ride very high.<br>M: Ride very high over the huge rocks.<br>H: Huge rocks need a car that rides very high. |
| rocks.clearance L2 (B) | Very Tall Rocks | Lift Kit and Monster Wheels. | Get a Lift Kit and Monster Wheels. | Pick a Lift Kit and Monster Wheels to ride very high. |  | E: Lift the car way up.<br>M: Get lots of space under the car.<br>H: Lift your car up a lot to pass over them. |
| rocks.log L1 (A) | Log on the Road | Get a Push Bumper. | Get a Push Bumper to move the log. | Put on a Push Bumper so your car can push the log. |  | E: Push the log off the road.<br>M: Push the log out of the way.<br>H: Your car must push the log off the road. |
| rocks.log L1 (B) | Log on the Road | A Push Bumper moves logs. | Use a Push Bumper on the big log. | Pick a Push Bumper to push the log off the road. |  | E: Get a front that can push.<br>M: The car must push a big log.<br>H: Pick a strong front that can push a log. |
| rocks.log L2 (A) | Huge Log | Push Bumper and a Wedge shape. | Get a Push Bumper and a Wedge shape. | A huge log needs a Push Bumper and a Wedge shape. |  | E: A giant log! Push hard.<br>M: Push hard to move the huge log.<br>H: The log is huge, so your car must push very hard. |
| rocks.log L2 (B) | Huge Log | Push Bumper and a Winch. | Use a Push Bumper and a Winch. | Pick a Push Bumper and a Winch to move the huge log. |  | E: Push the huge log.<br>M: The log is giant, so push hard.<br>H: Pick a strong front that can move a giant log. |

### river (River crossing (deep stream, then a wide river))

Two-requirement title: "River Ahead" (never shown: one requirement only). Was: "River Crossing" / "Water Ahead" / "Deep Water", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| river.cross L1 (A) | Deep Stream | Use Floaties or a Snorkel. | Use a Snorkel or Floaties to cross. | Use a Snorkel to drive under, or Floaties to float on top. |  | E: Use floaties or a snorkel.<br>M: Use a snorkel or floaties to cross.<br>H: Use a snorkel to go under or floaties to stay up. |
| river.cross L1 (B) | Deep Stream | Pick a Snorkel or Floaties. | Get Floaties or a Snorkel for the stream. | Floaties keep the car up, or a Snorkel lets it drive under. |  | E: Pick a snorkel or floaties.<br>M: Cross with floaties or use a snorkel.<br>H: Floaties keep you up, or a snorkel lets you drive under. |
| river.cross L2 (A) | Big River | Get Floaties to float. | Get Floaties so the car floats across. | The river is wide and deep, so use Floaties to float across. |  | E: The river is deep. Float.<br>M: The river is very deep, so float.<br>H: The river is very deep, so your car must float. |
| river.cross L2 (B) | Big River | Use Floaties on the river. | Floaties keep the car on top of water. | Pick Floaties so your car floats like a boat across the river. |  | E: Make the car float.<br>M: Float across like a boat.<br>H: Pick a part that keeps the car on top of the water. |

### wobbly (Wobbly old bridge)

Two-requirement title: "Old Bridge" (never shown: one requirement only). Was: "Wobbly Bridge" / "Creaky Crossing" / "Rope Bridge", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| wobbly.weight L1 (A) | Wobbly Bridge | Get a light Electric Motor. | An Electric Motor makes the car light. | Put in a light Electric Motor to cross the old bridge. |  | E: Get a light car.<br>M: Make the car light for the bridge.<br>H: Your car must be light to cross the old bridge. |
| wobbly.weight L1 (B) | Wobbly Bridge | The Small size is light. | Make the car light with the Small size. | Pick the Small size or a Sports Car to be light. |  | E: The bridge is wobbly. Be light.<br>M: A heavy car will fall through.<br>H: A heavy car will make the bridge sag. |
| wobbly.weight L2 (A) | Very Wobbly Bridge | Tiny size makes it very light. | Pick the Tiny size to be very light. | The bridge is very wobbly, so make your car the Tiny size. |  | E: Very wobbly! Get a light car.<br>M: The bridge is very wobbly, so be light.<br>H: The bridge is very wobbly, so make your car very light. |
| wobbly.weight L2 (B) | Very Wobbly Bridge | Small size and an Electric Motor. | Use the Small size and an Electric Motor. | Pick an Electric Motor and the Small size to be very light. |  | E: Be very light.<br>M: Make the car very light to cross.<br>H: Take off heavy parts so the car is very light. |
| wobbly.weight L3 (A) | Super Wobbly Bridge | Tiny size and an Electric Motor. | Use the Tiny size and an Electric Motor. | A Tiny car with an Electric Motor is light enough. |  | E: Get the lightest car.<br>M: Make the car as light as you can.<br>H: Make your car as light as it can be to cross. |
| wobbly.weight L3 (B) | Super Wobbly Bridge | A Tiny Sports Car is light. | Pick a Tiny Sports Car to be light. | Pick a Tiny Sports Car so the bridge does not wobble. |  | E: Be as light as a feather.<br>M: The bridge is thin sticks. Be light.<br>H: The bridge is made of thin sticks, so use light parts. |

### beach (Long trip to the beach)

Two-requirement title: "Beach Trip". Was: "Beach Trip" / "Long Drive" / "Seaside Road", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| beach.range L1 (A) | Long Drive | Get an Efficient Engine. | Get an Efficient Engine to go far. | Put in an Efficient Engine so the car goes a long way. |  | E: The beach is far. Go far.<br>M: Drive a long way to the beach.<br>H: Your car must go a long way to the beach. |
| beach.range L1 (B) | Long Drive | A Tiny car goes far. | The Tiny size lets the car go far. | Pick an Efficient Engine or the Tiny size to drive far. |  | E: Get an engine to go far.<br>M: Go far and do not stop.<br>H: Pick parts that let the car go far. |
| beach.range L2 (A) | Very Long Drive | An Efficient Engine goes far. | Get an Efficient Engine for the long drive. | The beach is very far, so put in an Efficient Engine. |  | E: Go very far to the beach.<br>M: Drive a very long way to the beach.<br>H: The beach is very far, so your car must go very far. |
| beach.range L2 (B) | Very Long Drive | Pick an Efficient Engine. | Pick an Efficient Engine to go very far. | Pick an Efficient Engine so the car can go very far. |  | E: A very long trip!<br>M: Go very far and do not run out.<br>H: Pick parts that let the car drive a very long way. |
| beach.range L3 (A) | Longest Drive | Efficient Engine and Tiny size. | Get an Efficient Engine and the Tiny size. | The longest drive needs an Efficient Engine and the Tiny size. |  | E: The longest trip! Go the farthest.<br>M: Go the farthest you can to the beach.<br>H: Go as far as you can on the longest trip of all. |
| beach.range L3 (B) | Longest Drive | Tiny size plus an Efficient Engine. | Pick the Tiny size and an Efficient Engine. | Pick a Tiny car with an Efficient Engine to go the farthest. |  | E: Go super far.<br>M: This is the longest trip of all.<br>H: Only the car that goes farthest will reach the beach. |
| beach.load L1 (A) | Beach Toys | Get a Pickup Truck for toys. | Get a Pickup Truck for the beach toys. | Pick a Pickup Truck so there is room for toys and towels. |  | E: Get room for beach toys.<br>M: Make room for the beach things.<br>H: Your car needs room for all the beach things. |
| beach.load L1 (B) | Beach Toys | Use the Big size for toys. | The Big size has room for beach toys. | Pick the Big size or a Van to fit the beach toys. |  | E: Carry toys and towels.<br>M: Carry all the toys to the beach.<br>H: Pick a car with space for toys and towels. |

### parade (Color parade)

Two-requirement title: "Color Parade" (never shown: one requirement only). Was: "Parade Day" / "Color Parade" / "Party Parade", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| parade.color L1 (A) | Red Parade | Paint the car Fire Red. | Paint the car Fire Red for the parade. | The parade needs a red car, so pick Fire Red paint. |  | E: Paint the car red.<br>M: The parade needs a red car.<br>H: The parade needs a car that is red. |
| parade.color L1 (B) | Red Parade | Use Fire Red paint. | Pick Fire Red paint for your car. | Make your car red with Fire Red paint for the parade. |  | E: The car must be red.<br>M: Make the car red.<br>H: Pick the color red for your car. |
| parade.color L2 (A) | Green Parade | Paint the car Leaf Green. | Paint the car Leaf Green for the parade. | The parade needs a green car, so pick Leaf Green paint. |  | E: Paint the car green.<br>M: The parade needs a green car.<br>H: The parade needs a car that is green. |
| parade.color L2 (B) | Green Parade | Use Leaf Green paint. | Pick Leaf Green paint for your car. | Make your car green with Leaf Green paint for the parade. |  | E: The car must be green.<br>M: Make the car green.<br>H: Pick the color green for your car. |
| parade.color L3 (A) | Rainbow Parade | Paint the car Rainbow. | Paint the car Rainbow for the parade. | The parade needs every color, so pick Rainbow paint. |  | E: Paint the car with all colors.<br>M: The parade needs every color.<br>H: The parade needs a car with every color on it. |
| parade.color L3 (B) | Rainbow Parade | Use Rainbow paint. | Pick Rainbow paint for your car. | Make your car every color with Rainbow paint for the parade. |  | E: Use every color.<br>M: Make the car have many colors.<br>H: Pick paint that shows all the colors at once. |

### night (Sleepy town at night (quiet, hide-and-seek))

Two-requirement title: "Sleepy Town". Was: "Sleepy Town" / "Night Drive" / "Hide and Seek", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| night.quiet L1 (A) | Quiet Night | Get an Electric Motor. | Get a quiet Electric Motor for the town. | Put in an Electric Motor so the car is quiet at night. |  | E: Get a quiet engine.<br>M: Make the car quiet for the sleepers.<br>H: Your car must be quiet so no one wakes up. |
| night.quiet L1 (B) | Quiet Night | Use a quiet Efficient Engine. | An Efficient Engine is quiet enough here. | Pick an Efficient Engine or Electric Motor so nobody wakes up. |  | E: Make the car quiet.<br>M: Do not wake the town.<br>H: Pick a part that makes less noise. |
| night.quiet L2 (A) | Sleeping Baby | Use an Electric Motor. Shh! | Only an Electric Motor is this quiet. | The baby is asleep, so put in a quiet Electric Motor. |  | E: Shh! Be very quiet.<br>M: Make the car very quiet.<br>H: Your car must be very quiet so the baby sleeps. |
| night.quiet L2 (B) | Sleeping Baby | Pick the Electric Motor. | Pick the Electric Motor to make no noise. | Pick the Electric Motor so the car makes almost no sound. |  | E: Make no sound.<br>M: Make almost no sound at all.<br>H: Pick a part that makes almost no noise. |
| night.hide L1 (A) | Hide at Night | Paint the car Night Black. | Paint the car Night Black to hide. | Pick Night Black paint so your car is hard to see. |  | E: Paint the car dark.<br>M: Make the car dark to hide.<br>H: Your car must be dark so it is hard to see. |
| night.hide L1 (B) | Hide at Night | Use Night Black paint. | Night Black paint hides you in the dark. | Make your car dark with Night Black paint to hide at night. |  | E: Hide in the dark.<br>M: The car must be hard to see.<br>H: Pick a dark color to hide at night. |

## Dino Lab

### snack (Snack time: gulp a cartoon critter)

Two-requirement title: "Snack Time". Was: "Snack Time" / "Lunch Hunt" / "Gulp!", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| snack.bite L1 (A) | Beetle Snack | Get Big Teeth to crunch. | Get Big Teeth to crunch the beetle shell. | Give your dino Big Teeth so it can crunch a hard shell. |  | E: Get teeth for a hard shell.<br>M: Make a mouth that can crunch shells.<br>H: Give your dino a big bite to crunch a hard beetle shell. |
| snack.bite L1 (B) | Beetle Snack | Pick Big Teeth for the beetle. | Big Teeth can bite the hard beetle. | Pick Big Teeth or a Rex Head for a big bite. |  | E: Pick teeth that can crunch.<br>M: A beetle shell is hard, so bite big.<br>H: The beetle has a hard shell, so you need a big bite. |
| snack.bite L2 (A) | Frog Snack | Get Sharp Teeth for the frog. | Get Sharp Teeth to hold the frog. | Give your dino Sharp Teeth so it can hold the frog. |  | E: Get strong teeth to catch frogs.<br>M: Make a mouth strong enough for a frog.<br>H: Give your dino a strong mouth that can hold a slippery frog. |
| snack.bite L2 (B) | Frog Snack | Big Teeth and a Rex Head. | Use Big Teeth and a Rex Head. | Pick Sharp Teeth, or Big Teeth and a Rex Head. |  | E: Pick teeth that hold a frog.<br>M: A frog is slippery, so bite strong.<br>H: The frog is big and slippery, so you need a strong bite. |
| snack.bite L3 (A) | Lizard Snack | Get Mega Teeth for the lizard. | Get Mega Teeth to gulp the huge lizard. | The lizard is huge, so give your dino Mega Teeth. |  | E: Get the biggest, strongest teeth.<br>M: Make a super big, strong mouth.<br>H: Give your dino the biggest and strongest mouth for a huge lizard. |
| snack.bite L3 (B) | Lizard Snack | Sharp Teeth and a Rex Head. | Use Sharp Teeth and a Rex Head. | Pick Mega Teeth, or Sharp Teeth and a Rex Head. |  | E: Get teeth for a huge lizard.<br>M: The lizard is huge, so bite very hard.<br>H: Make the bite super strong so it can gulp a huge lizard. |
| snack.bigGulp L1 (A) | Giant Beetle | Mega Teeth and the Big size. | Get Mega Teeth and the Big size. | A giant beetle needs Mega Teeth and the Big size to gulp. |  | E: Get a big dino with teeth.<br>M: Your dino must be big to gulp this.<br>H: Make your dino big and strong enough to gulp a giant beetle. |
| snack.bigGulp L1 (B) | Giant Beetle | Sharp Teeth and the Huge size. | Use Sharp Teeth and the Huge size. | Pick Sharp Teeth and the Huge size to gulp it down. |  | E: Big beetle, so be big.<br>M: Make a big dino with a strong bite.<br>H: A giant beetle needs a big body and a strong mouth. |
| snack.bigGulp L2 (A) | Huge Beetle | Mega Teeth and the Huge size. | Get Mega Teeth and the Huge size. | Only Mega Teeth and the Huge size can gulp this beetle. |  | E: Be a huge dino.<br>M: The beetle is huge, so be huge too.<br>H: Make your dino huge, with a mouth strong enough for this beetle. |
| snack.bigGulp L2 (B) | Huge Beetle | Huge size with Mega Teeth. | Make a Huge dino with Mega Teeth. | Pick the Huge size with Mega Teeth to gulp the huge beetle. |  | E: Get the biggest dino and teeth.<br>M: Make a huge dino with a huge bite.<br>H: Only the biggest and strongest dino can gulp this huge beetle. |

### chase (Chase a speedy lizard (top view))

Two-requirement title: "Lizard Chase". Was: "Lizard Chase" / "Catch Me" / "Zoom Zoom", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| chase.speed L1 (A) | Fast Lizard | Get Long Legs to run fast. | Get Long Legs to run after the lizard. | Give your dino Long Legs so it can catch the fast lizard. |  | E: Run fast to catch the lizard.<br>M: Your dino must run faster than the lizard.<br>H: Make your dino light and quick so it can catch the lizard. |
| chase.speed L1 (B) | Fast Lizard | Use a Slim Body for speed. | A Slim Body helps your dino run fast. | Pick a Slim Body or Long Legs to catch the lizard. |  | E: Get legs that run fast.<br>M: Make a dino built for speed.<br>H: The lizard is fast, so your dino must run fast too. |
| chase.speed L2 (A) | Very Fast Lizard | Long Legs and a Slim Body. | Get Long Legs and a Slim Body. | To catch it, get Long Legs and a Slim Body. |  | E: Run very fast.<br>M: This lizard is very fast, so be faster.<br>H: Make your dino very light and quick to catch this lizard. |
| chase.speed L2 (B) | Very Fast Lizard | Powerful Legs and a Slim Body. | Use Powerful Legs and a Slim Body. | Pick Powerful Legs and a Slim Body to run very fast. |  | E: Get legs that run very fast.<br>M: Make your dino a very fast runner.<br>H: The lizard zooms, so your dino needs to be even faster. |
| chase.speed L3 (A) | Super Fast Lizard | Run fastest with Powerful Legs. | Powerful Legs, Slim Body, Tiny Arms, Small size. | Pick Powerful Legs, a Slim Body, a Long Tail, and Small size. | E names only part of the fix (it needs more parts than the word limit allows) | E: Be the fastest runner.<br>M: Make your dino the fastest runner ever.<br>H: Make your dino super light and the fastest runner of all. |
| chase.speed L3 (B) | Super Fast Lizard | Get Powerful Legs. Be Small. | Powerful Legs, Slim Body, Long Tail, Small size. | Use Powerful Legs, a Slim Body, Tiny Arms, and the Small size. | E names only part of the fix (it needs more parts than the word limit allows) | E: Be super fast.<br>M: The lizard is super fast, so be faster.<br>H: No lizard is faster, so your dino must be faster still. |
| chase.quiet L1 (A) | Sneak Up | Be the Small size to sneak. | Pick the Small size to sneak up softly. | Pick the Small size so the lizard does not see you. |  | E: Be small and sneak up.<br>M: Your dino must be small and quiet.<br>H: Make your dino small and quiet so the lizard does not wake. |
| chase.quiet L1 (B) | Sneak Up | A Small dino can sneak. | Get the Small size and keep Crawling. | Pick the Small size and keep Crawling to sneak up close. |  | E: Sneak close to the lizard.<br>M: Make a dino that sneaks up softly.<br>H: A big dino is loud, so your dino must be small. |
| chase.quiet L2 (A) | Sneak Up Close | Small size, Slim Body, Spotty skin. | Pick Small size, a Slim Body, and Spotty. | Pick the Small size, a Slim Body, and Spotty skin to sneak. |  | E: Be very quiet.<br>M: This lizard wakes up fast, so be quiet.<br>H: The lizard hears well, so make your dino very small. |
| chase.quiet L2 (B) | Sneak Up Close | Small, Spotty, and a Leaf Pattern. | Small size, Spotty skin, and Leaf Pattern. | Pick the Small size, Spotty skin, and a Leaf Pattern to hide. |  | E: Be very small and sneaky.<br>M: Make your dino super small and quiet.<br>H: Make your dino so quiet that the lizard hears nothing. |

### ferns (Hide in the ferns from a big sniffing dino)

Two-requirement title: "Ferns and Flowers". Was: "Fern Hide" / "Hide and Seek" / "Sniff Sniff", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| ferns.hide L1 (A) | Sniffing Dino | Get Green skin for the ferns. | Pick Green skin to hide in the ferns. | Give your dino Green skin so it hides in the green ferns. |  | E: Get skin that hides in ferns.<br>M: Make your skin match the ferns.<br>H: Pick a skin color that helps your dino hide in the ferns. |
| ferns.hide L1 (B) | Sniffing Dino | Use a Leaf Pattern to hide. | A Leaf Pattern or Spotty skin hides you. | Pick Green, Spotty, or a Leaf Pattern to match the ferns. |  | E: Hide in the ferns.<br>M: Your dino must hide in the ferns.<br>H: The big dino must not see your dino in the leaves. |
| ferns.hide L2 (A) | Short Ferns | Green skin and the Small size. | Get Green skin and the Small size. | The ferns are short, so pick Green skin and the Small size. |  | E: Hide in short ferns.<br>M: The ferns are short, so be small.<br>H: Match the color of the ferns and be small to hide. |
| ferns.hide L2 (B) | Short Ferns | Spotty skin and a Leaf Pattern. | Use Spotty skin with a Leaf Pattern. | Pick Spotty skin and a Leaf Pattern to hide in short ferns. |  | E: Be small and hide.<br>M: Match the ferns and stay small.<br>H: Short ferns cannot hide a big dino, so be small. |
| ferns.hide L3 (A) | Few Ferns | Spotty, Leaf Pattern, and Small size. | Pick Spotty, a Leaf Pattern, and Small size. | Few ferns: pick Spotty skin, a Leaf Pattern, and Small size. |  | E: Hide in a few thin ferns.<br>M: There are few ferns, so be very small.<br>H: Only a few thin ferns are here, so be very small. |
| ferns.hide L3 (B) | Few Ferns | Spotty skin, Small size, Slim Body. | Pick Spotty, a Slim Body, and Small size. | Pick Spotty skin, a Slim Body, and the Small size to hide. |  | E: Be very small and hide.<br>M: Match the ferns and be super small.<br>H: Match the ferns and be as small as you can. |
| ferns.flowers L1 (A) | Flower Patch | Get Purple skin. | Pick Purple skin to match the flowers. | Give your dino Purple skin so it hides in the purple flowers. |  | E: Get skin the color of flowers.<br>M: Make your skin the color of the flowers.<br>H: Choose a skin color that matches the flowers so your dino hides. |
| ferns.flowers L1 (B) | Flower Patch | Use Purple to hide. | Purple skin hides you in the flowers. | The flowers are purple, so pick Purple skin to hide in them. |  | E: Hide in the flowers.<br>M: Your dino must match the flowers.<br>H: The flowers are a special color, so copy that color. |

### ledge (Jump up onto a high ledge)

Two-requirement title: "Rock Jump" (never shown: one requirement only). Was: "High Ledge" / "Jump Up" / "Rock Hop", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| ledge.jump L1 (A) | High Rock | Get Long Legs to jump. | Get Long Legs to jump up the rock. | Give your dino Long Legs so it can jump onto the rock. |  | E: Jump up onto the ledge.<br>M: Your dino must jump up to the ledge.<br>H: Make your dino jump high enough to reach the ledge. |
| ledge.jump L1 (B) | High Rock | Pick Long Legs for a jump. | Long Legs or Hoppy Legs can jump up. | Pick Long Legs or Hoppy Legs to jump up high. |  | E: Get legs that jump.<br>M: Make a dino that can jump well.<br>H: A light dino with strong legs can jump up. |
| ledge.jump L2 (A) | Very High Rock | Get Hoppy Legs to jump high. | Get Hoppy Legs to jump very high. | The rock is very high, so give your dino Hoppy Legs. |  | E: Jump up to a high ledge.<br>M: The ledge is high, so jump higher.<br>H: Make your dino light and able to jump very high. |
| ledge.jump L2 (B) | Very High Rock | Hoppy Legs jump very high. | Pick Hoppy Legs for a very high jump. | Pick Hoppy Legs so your dino can jump very high. |  | E: Jump very high.<br>M: Make your dino a very high jumper.<br>H: This ledge is very high, so your dino must jump higher. |
| ledge.jump L3 (A) | Super High Rock | Hoppy Legs, Long Tail, Slim Body. | Pick Hoppy Legs, Long Tail, and Slim Body. | Jump highest with Hoppy Legs, a Long Tail, and a Slim Body. |  | E: Jump up to the highest ledge.<br>M: Make your dino the best jumper ever.<br>H: Make your dino light and the best jumper of all. |
| ledge.jump L3 (B) | Super High Rock | Hoppy Legs, Slim Body, Small size. | Use Hoppy Legs, Slim Body, and Small size. | Pick Hoppy Legs, a Slim Body, and Small size for this jump. |  | E: Be the best jumper.<br>M: The ledge is super high, so jump higher.<br>H: No ledge is higher, so your dino must jump the highest. |

### burrow (Squeeze into a small burrow)

Two-requirement title: "Little Tunnel". Was: "Small Hole" / "Burrow Visit" / "Tunnel Time", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| burrow.fit L1 (A) | Small Hole | Get the Small size to fit. | Pick the Small size for the little hole. | Make your dino the Small size so it fits in the hole. |  | E: Be small to fit the hole.<br>M: Your dino must be small enough to fit.<br>H: Make your dino small enough to squeeze into the hole. |
| burrow.fit L1 (B) | Small Hole | A Small dino fits the hole. | Only a Small dino can fit in here. | The hole is little, so pick the Small size to fit. |  | E: Get a small dino.<br>M: Make a dino that fits the little hole.<br>H: The hole is little, so your dino must be small. |
| burrow.fit L2 (A) | Tiny Hole | Small size and a Slim Body. | Get the Small size and a Slim Body. | For the tiny hole, pick Small size and a Slim Body. |  | E: Be tiny and thin.<br>M: The hole is tiny, so be very small.<br>H: Make your dino very small and thin to fit the hole. |
| burrow.fit L2 (B) | Tiny Hole | Be Small with a Slim Body. | Use a Slim Body in the Small size. | Only a Small dino with a Slim Body fits this tiny hole. |  | E: Fit a very tiny hole.<br>M: Make your dino small and thin.<br>H: This hole is tiny, so your dino must be the smallest. |
| burrow.dig L1 (A) | Dirt Pile | Get Digging Claws. | Get Digging Claws to dig through dirt. | Give your dino Digging Claws so it can dig through the dirt. |  | E: Dig through the dirt.<br>M: Your dino must dig through the dirt.<br>H: Give your dino hands that can dig through a pile of dirt. |
| burrow.dig L1 (B) | Dirt Pile | Dig with Digging Claws. | Digging Claws can dig the dirt away. | Pick Digging Claws to dig a way into the hole. |  | E: Get claws that dig.<br>M: Make a dino that can dig well.<br>H: Dirt blocks the door, so your dino must dig. |
| burrow.dig L2 (A) | Hard Dirt | Digging Claws and a Horn Head. | Get Digging Claws and a Horn Head. | The dirt is hard, so get Digging Claws and a Horn Head. |  | E: Dig through hard dirt.<br>M: The dirt is hard, so dig very well.<br>H: Give your dino strong hands to dig through hard dirt. |
| burrow.dig L2 (B) | Hard Dirt | A Horn Head and Digging Claws. | Dig with Digging Claws and a Horn Head. | Pick Digging Claws and a Horn Head to dig through hard dirt. |  | E: Get claws that dig well.<br>M: Make your dino a great digger.<br>H: This dirt is hard and deep, so dig harder. |
| burrow.dark L1 (A) | Dark Tunnel | Get Glow Spots. | Get Glow Spots to see in the dark. | Give your dino Glow Spots to light up the dark tunnel. |  | E: Make light in the dark.<br>M: Your dino needs its own light.<br>H: Give your dino something extra that makes light in the dark. |
| burrow.dark L1 (B) | Dark Tunnel | Use Glow Spots in the dark. | Glow Spots light up the dark tunnel. | Pick Glow Spots so your dino makes its own light. |  | E: Get glow for the dark.<br>M: Make a dino that lights the dark.<br>H: The tunnel is dark, so your dino must glow. |

### tallGrass (Find the nest in the tall grass)

Two-requirement title: "Nest in the Grass". Was: "Tall Grass" / "High Grass" / "Hidden Nest", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| tallGrass.peek L1 (A) | Tall Grass | Standing, Long Neck, or Big size. | Pick Standing, a Long Neck, or Big size. | To see over the grass, pick Standing, Long Neck, or Big. |  | E: Stand, long neck, or big body.<br>M: Stand up, use long neck or big body.<br>H: Stand up, grow a long neck, or get a big body. |
| tallGrass.peek L1 (B) | Tall Grass | Long Neck, Standing, or Big size. | Get a Long Neck, Standing, or Big size. | Peek over with a Long Neck, Standing, or the Big size. |  | E: Big body, long neck, or stand.<br>M: Get big, stand up, or use long neck.<br>H: Use a big body or long neck, or stand up tall. |
| tallGrass.peek L2 (A) | Very Tall Grass | Get a Long Neck to peek. | Get a Long Neck to see the nest. | The grass is very tall, so give your dino a Long Neck. |  | E: See over very tall grass.<br>M: The grass is very tall, so be taller.<br>H: Make your dino tall enough to see over the very tall grass. |
| tallGrass.peek L2 (B) | Very Tall Grass | Standing and the Big size. | Stand up tall with the Big size. | Pick Standing and the Big size to see over the grass. |  | E: Be much taller.<br>M: Make your dino tall enough for this grass.<br>H: Stand up high so your head is above the grass. |
| tallGrass.peek L3 (A) | Super Tall Grass | Long Neck, Huge size, and Standing. | Get a Long Neck, Huge size, and Standing. | Super tall grass needs a Long Neck, Huge size, and Standing. |  | E: Be the tallest dino.<br>M: The grass is huge, so be super tall.<br>H: Make your dino the tallest it can be to see the nest. |
| tallGrass.peek L3 (B) | Super Tall Grass | Long Neck, Big size, and Standing. | Pick a Long Neck, Big size, and Standing. | Pick Standing, a Long Neck, and the Big size to see. |  | E: See over the tallest grass.<br>M: Make your dino as tall as can be.<br>H: Only a super tall dino can see over grass this high. |
| tallGrass.sneak L1 (A) | Grass Hide | Get Tiger Stripes to hide. | Get Tiger Stripes to hide in the grass. | Give your dino Tiger Stripes so it looks like the tall grass. |  | E: Hide in the tall grass.<br>M: Make your dino blend in with grass.<br>H: Give your dino a pattern that looks like grass shadows. |
| tallGrass.sneak L1 (B) | Grass Hide | Tiger Stripes hide you. | Tiger Stripes look like the tall grass. | Pick Tiger Stripes so the big dino cannot see you. |  | E: Pick an extra that hides.<br>M: Your dino must hide in the grass.<br>H: The big dino must not see your dino in the grass. |

### tallTree (Get the fruit from a tall tree)

Two-requirement title: "Fruit Tree". Was: "Fruit Tree" / "Snack Up High" / "Tall Tree", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| tallTree.fruit L1 (A) | Fruit on a Branch | Get a Long Neck to reach. | Get a Long Neck to reach the fruit. | Give your dino a Long Neck so it can reach the fruit. |  | E: Reach up for the fruit.<br>M: Your dino must reach the low fruit.<br>H: Make your dino tall enough to reach the fruit on the branch. |
| tallTree.fruit L1 (B) | Fruit on a Branch | Be the Huge size to reach. | A Huge dino can reach the fruit. | Pick a Long Neck or the Huge size to reach up high. |  | E: Get the fruit from the tree.<br>M: Make your dino able to grab fruit.<br>H: The fruit is just above your dino, so reach up. |
| tallTree.fruit L2 (A) | High Fruit | Long Neck and Standing. | Get a Long Neck and stand up tall. | The fruit is high, so stand up with a Long Neck. |  | E: Reach the high fruit.<br>M: The fruit is high, so reach higher.<br>H: Make your dino tall, with a head that can go very high. |
| tallTree.fruit L2 (B) | High Fruit | A Long Neck and Big size. | Use a Long Neck and the Big size. | Pick a Long Neck and Big size for the high fruit. |  | E: Get fruit up high.<br>M: Make your dino able to reach very high.<br>H: This fruit hangs on a high branch, so reach up high. |
| tallTree.fruit L3 (A) | Fruit at the Top | Long Neck, Huge size, Standing. | Pick Standing, a Long Neck, and Huge size. | Reach the top with a Long Neck, Huge size, and Standing. |  | E: Reach the fruit at the top.<br>M: Make your dino reach the very top.<br>H: Make your dino very tall with a head up high. |
| tallTree.fruit L3 (B) | Fruit at the Top | Long Neck, Grabby Hands, Huge size. | A Long Neck, Grabby Hands, and Huge size. | Pick a Long Neck, Grabby Hands, and Huge size to grab it. |  | E: Reach super high.<br>M: Be super tall to reach the top fruit.<br>H: The last fruit is at the very top, so reach the highest. |
| tallTree.shake L1 (A) | Stuck Fruit | Get a Heavy Tail to shake. | Get a Heavy Tail to shake the tree. | Give your dino a Heavy Tail to shake the fruit down. |  | E: Shake the tree to drop fruit.<br>M: Your dino must be strong to shake it.<br>H: Make your dino strong enough to shake the fruit down. |
| tallTree.shake L1 (B) | Stuck Fruit | Be the Huge size to shake. | A Huge dino can shake the tree. | Pick a Heavy Tail or Huge size to shake the tree hard. |  | E: Be strong and push.<br>M: Make a dino that can shake the tree.<br>H: Push the tree hard so the fruit falls down. |
| tallTree.shake L2 (A) | Thick Tree | Heavy Tail and a Big Belly. | Get a Heavy Tail and a Big Belly. | For a thick tree, get a Heavy Tail and Big Belly. |  | E: Shake a big tree.<br>M: This tree is big, so be very strong.<br>H: Make your dino big and very strong to shake the thick tree. |
| tallTree.shake L2 (B) | Thick Tree | Huge size and a Horn Head. | Use the Huge size and a Horn Head. | Pick Huge size and a Horn Head to shake the thick tree. |  | E: Be very strong.<br>M: Make your dino strong enough for this tree.<br>H: The tree trunk is thick, so your dino needs lots of strength. |

### rocks (Climb the big rocks)

Two-requirement title: "Rocky Hill". Was: "Big Rocks" / "Rock Climb" / "Up We Go", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| rocks.climb L1 (A) | Rock Pile | Get Hook Claws to climb. | Get Hook Claws to climb the rocks. | Give your dino Hook Claws to climb the pile of rocks. |  | E: Climb up the rocks.<br>M: Your dino must climb the pile of rocks.<br>H: Give your dino a good grip so it can climb the rocks. |
| rocks.climb L1 (B) | Rock Pile | Climb with Hook Claws. | Hook Claws or Grabby Hands can climb. | Pick Hook Claws or Grabby Hands to hold on and climb. |  | E: Get claws that climb.<br>M: Make a dino that can climb well.<br>H: The rocks make a hill, so your dino must climb up. |
| rocks.climb L2 (A) | Steep Rocks | Grabby Hands and a Long Tail. | Get Grabby Hands and a Long Tail. | The rocks are steep, so get Grabby Hands and a Long Tail. |  | E: Climb the steep rocks.<br>M: The rock wall is steep, so climb well.<br>H: Make your dino light, with a good grip for a steep wall. |
| rocks.climb L2 (B) | Steep Rocks | Grabby Hands and a Slim Body. | Climb with Grabby Hands and a Slim Body. | Pick Grabby Hands and a Slim Body to climb the steep rocks. |  | E: Be a good climber.<br>M: Make your dino a strong climber.<br>H: This wall is steep, so your dino must grip and climb. |
| rocks.climb L3 (A) | Very Steep Rocks | Grabby Hands, Long Tail, Slim Body. | Grabby Hands, Long Tail, Slim Body, Small size. | Pick Grabby Hands, a Long Tail, a Slim Body, and Small size. | E names only part of the fix (it needs more parts than the word limit allows) | E: Climb the steepest rocks.<br>M: The rocks are slippery, so grip very well.<br>H: Make your dino light, with a super grip for the slippery cliff. |
| rocks.climb L3 (B) | Very Steep Rocks | Climb best with Grabby Hands. | Grabby Hands, Powerful Legs, Long Tail, Slim Body. | Use Grabby Hands, Powerful Legs, a Long Tail, and a Slim Body. | E names only part of the fix (it needs more parts than the word limit allows) | E: Be the best climber.<br>M: Make your dino the best climber ever.<br>H: This cliff is tall and slippery, so your dino must grip hard. |
| rocks.tough L1 (A) | Falling Stones | Get Armor Plates. | Get Armor Plates so stones bounce off. | Give your dino Armor Plates so falling stones bounce off. |  | E: Be tough like a rock.<br>M: Your dino must be tough enough for pebbles.<br>H: Give your dino a strong back so pebbles bounce off. |
| rocks.tough L1 (B) | Falling Stones | A Spiked Tail makes you tough. | Armor Plates or a Spiked Tail are tough. | Pick Armor Plates or a Spiked Tail so stones bounce off. |  | E: Pebbles bounce off tough dinos.<br>M: Make a dino that pebbles bounce off.<br>H: Make your dino tough enough to walk under falling pebbles. |
| rocks.tough L2 (A) | Falling Rocks | Armor Plates and a Spiked Tail. | Get Armor Plates and a Spiked Tail. | Big rocks fall here, so get Armor Plates and a Spiked Tail. |  | E: Be very tough.<br>M: Big rocks fall here, so be very tough.<br>H: Give your dino a very tough back so big rocks bounce off. |
| rocks.tough L2 (B) | Falling Rocks | Armor Plates and the Huge size. | Use Armor Plates and the Huge size. | Pick Armor Plates and the Huge size so big rocks bounce off. |  | E: Be tough for big rocks.<br>M: Make your dino tough enough for big rocks.<br>H: Make your dino strong enough to walk under falling rocks. |

### river (Cross the river)

Two-requirement title: "Fishy River". Was: "River Crossing" / "Splash" / "Fishy River", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| river.swim L1 (A) | Calm River | Get Flippers to swim. | Get Flippers to swim across the river. | Give your dino Flippers so it can swim across the calm river. |  | E: Swim across the river.<br>M: Your dino must swim to the other side.<br>H: Give your dino a way to swim across the calm river. |
| river.swim L1 (B) | Calm River | Use a Paddle Tail to swim. | A Paddle Tail or Flippers help you swim. | Pick Flippers, a Paddle Tail, or Swimming to cross the river. |  | E: Get a way to swim.<br>M: Make a dino that can cross the water.<br>H: The river is calm, so your dino can paddle over. |
| river.swim L2 (A) | Wide River | Pick Swimming to cross. | Pick Swimming to cross the wide river. | The river is wide, so pick Swimming to get across. |  | E: Swim across the wide river.<br>M: The river is wide, so swim well.<br>H: Make your dino a strong swimmer for the wide river. |
| river.swim L2 (B) | Wide River | Get Flippers for the wide river. | Flippers help your dino swim a long way. | Pick Flippers or Swimming so your dino can swim far. |  | E: Be a good swimmer.<br>M: Make your dino a strong swimmer.<br>H: Give your dino parts that swim well across wide water. |
| river.swim L3 (A) | Fast River | Swimming and a Paddle Tail. | Use Swimming and a Paddle Tail. | The river is fast, so pick Swimming and a Paddle Tail. |  | E: Swim in a fast river.<br>M: The water is fast, so swim very hard.<br>H: Make your dino swim strong against the fast river. |
| river.swim L3 (B) | Fast River | Flippers and a Paddle Tail. | Get Flippers and a Paddle Tail to swim. | Pick Flippers and a Paddle Tail to swim in the fast river. |  | E: Be a super swimmer.<br>M: Make your dino the best swimmer.<br>H: The river pushes hard, so your dino must swim very well. |
| river.fish L1 (A) | Shy Fish | Get Sky Blue skin. | Pick Sky Blue skin to match the water. | Give your dino Sky Blue skin so fish do not see it. |  | E: Pick a skin like the water.<br>M: Make your skin match the water.<br>H: Pick a skin color that blends in with the river water. |
| river.fish L1 (B) | Shy Fish | Use Sky Blue to hide. | Sky Blue skin looks like the water. | Water is blue, so pick Sky Blue skin to hide from fish. |  | E: Hide in the water.<br>M: A fish must not see your dino.<br>H: Hide from the fish so your dino can catch it. |

### canyon (Fly across a deep canyon)

Two-requirement title: "No Bridge" (never shown: one requirement only). Was: "Deep Canyon" / "Sky Trip" / "No Bridge", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| canyon.fly L1 (A) | Deep Gap | Pick Flying to cross. | Pick Flying so your dino can cross. | There is no bridge, so pick Flying to cross the deep gap. |  | E: Fly across the canyon.<br>M: Your dino must go over by air.<br>H: Give your dino a way to fly over the deep canyon. |
| canyon.fly L1 (B) | Deep Gap | Use wings: pick Flying. | Flying lets your dino go over the gap. | Pick Flying so your dino can fly over the deep gap. |  | E: Get a way to fly.<br>M: There is no bridge, so go by air.<br>H: The bridge is gone, so your dino must cross by air. |
| canyon.fly L2 (A) | Wide Gap | Flying and a Slim Body. | Fly far with Flying and a Slim Body. | The gap is wide, so pick Flying and a Slim Body. |  | E: Fly across the wide canyon.<br>M: The canyon is wide, so fly far.<br>H: Make your dino light so it can fly across the wide canyon. |
| canyon.fly L2 (B) | Wide Gap | Pick Flying and be Small. | Pick Flying and the Small size. | Pick Flying and stay small, not Big or Huge, to fly far. |  | E: Fly far and stay light.<br>M: Make your dino light enough to fly far.<br>H: Fly a long way, so do not make your dino too big. |
| canyon.fly L3 (A) | Very Wide Gap | Flying and the Small size. | Use Flying and the Small size to cross. | The gap is very wide, so pick Flying and the Small size. |  | E: Fly across the widest canyon.<br>M: The canyon is huge, so be very light.<br>H: Make your dino small and light to cross the huge canyon. |
| canyon.fly L3 (B) | Very Wide Gap | A Small dino with Flying. | Pick Flying for a Small, light dino. | Pick Small size and Flying to fly over the very wide gap. |  | E: Be small and fly far.<br>M: Make your dino small enough to fly far.<br>H: Only a tiny, light dino can fly this far. |

### nut (Crack a giant nut)

Two-requirement title: "Nut Snack" (never shown: one requirement only). Was: "Nut Crack" / "Crunch Time" / "Tough Nut", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| nut.crack L1 (A) | Hard Nut | Get a Beak to crack it. | Get a Beak to crack the hard nut. | Give your dino a Beak so it can crack the hard nut. |  | E: Crack open the hard nut.<br>M: Your dino must break open the nut.<br>H: Give your dino a strong bite to crack the hard nut. |
| nut.crack L1 (B) | Hard Nut | Crack it with a Horn Head. | A Horn Head or a Beak cracks nuts. | Pick a Horn Head or a Beak to crack the hard shell. |  | E: Get strong teeth.<br>M: Make a dino that can crack nuts.<br>H: Break the hard shell to get the treat inside. |
| nut.crack L2 (A) | Very Hard Nut | Get a Beak for this nut. | Pick a Beak for the very hard nut. | The nut is very hard, so give your dino a strong Beak. |  | E: Crack a very hard nut.<br>M: The coconut is hard, so crunch very hard.<br>H: Give your dino a very strong bite to crack the coconut. |
| nut.crack L2 (B) | Very Hard Nut | Horn Head and Big Teeth. | Use a Horn Head and Big Teeth. | Pick a Horn Head and Big Teeth to crack this nut. |  | E: Crunch a big coconut.<br>M: Make your dino able to break a coconut.<br>H: The coconut shell is thick, so your dino must crunch hard. |
| nut.crack L3 (A) | Giant Nut | A Beak and a Horn Head. | Get a Beak and a Horn Head. | The nut is giant, so get a Beak and a Horn Head. |  | E: Crack the hardest nut.<br>M: This nut is rock hard, so crunch hardest.<br>H: Give your dino the strongest bite to crack this giant nut. |
| nut.crack L3 (B) | Giant Nut | Horn Head plus a Beak. | Crack it with a Beak and Horn Head. | Pick a Beak and a Horn Head to crack this giant nut. |  | E: Crunch super hard.<br>M: Make your dino the strongest cruncher ever.<br>H: Nobody can crack this nut, so your dino needs super power. |

### log (Push a log off the path)

Two-requirement title: "Blocked Path" (never shown: one requirement only). Was: "Log Push" / "Blocked Path" / "Heave Ho", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| log.push L1 (A) | Log on the Path | Push with a Horn Head. | Get a Horn Head to push the log. | Give your dino a Horn Head to push the log away. |  | E: Push the log away.<br>M: Your dino must push the log away.<br>H: Make your dino strong enough to push the log off the path. |
| log.push L1 (B) | Log on the Path | Get a Heavy Tail to push. | A Heavy Tail or Big Belly pushes logs. | Pick a Heavy Tail or Big Belly to push the log away. |  | E: Be strong and push.<br>M: Make a dino strong enough to move logs.<br>H: The log blocks the path, so your dino must shove it. |
| log.push L2 (A) | Heavy Log | Be the Huge size to push. | Pick the Huge size to push the log. | The log is heavy, so make your dino the Huge size. |  | E: Push a big, heavy log.<br>M: The log is heavy, so be very strong.<br>H: Make your dino big and very strong to shove the heavy log. |
| log.push L2 (B) | Heavy Log | Horn Head and a Heavy Tail. | Use a Horn Head and a Heavy Tail. | Pick a Horn Head and a Heavy Tail to push it away. |  | E: Be very strong.<br>M: Make your dino big and strong.<br>H: This log is thick and heavy, so push with lots of power. |
| log.push L3 (A) | Giant Log | Huge size and a Heavy Tail. | Get the Huge size and a Heavy Tail. | The log is giant, so pick Huge size and a Heavy Tail. |  | E: Push the giant log.<br>M: The log is giant, so be super strong.<br>H: Make your dino huge and super strong to move the giant log. |
| log.push L3 (B) | Giant Log | Be Huge with a Heavy Tail. | Make a Huge dino with a Heavy Tail. | Push the giant log with a Huge dino and a Heavy Tail. |  | E: Be super strong.<br>M: Make your dino the strongest of all.<br>H: Only the strongest dino can push a log this big. |

### snow (Walk over the snowy mountain)

Two-requirement title: "Snowy Mountain". Was: "Snowy Mountain" / "Brrr" / "Ice Hill", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| snow.warm L1 (A) | Cold Snow | Get a warm Back Sail. | Get a Back Sail to stay warm. | Give your dino a Back Sail to stay warm in the snow. |  | E: Stay warm in the snow.<br>M: Your dino must not get cold.<br>H: Make your dino warm enough for the cold snow. |
| snow.warm L1 (B) | Cold Snow | Keep Feathers and be Big. | Keep your Feathers and pick the Big size. | Pick a Big Belly or the Big size to stay warm. |  | E: Get a warm dino.<br>M: Make a dino that stays warm.<br>H: Snow is cold, so your dino needs to keep warm. |
| snow.warm L2 (A) | Snow Storm | A Back Sail and Big size. | Pick a Back Sail and the Big size. | For the cold storm, get a Back Sail and Big size. |  | E: Stay warm in the storm.<br>M: The storm is freezing, so be very warm.<br>H: Make your dino very warm for the freezing snowstorm. |
| snow.warm L2 (B) | Snow Storm | Big Belly and the Huge size. | Get a Big Belly and the Huge size. | Keep your Feathers and get a Big Belly and Huge size. |  | E: Be very warm.<br>M: Make your dino super warm.<br>H: The wind is icy, so your dino needs lots of warmth. |
| snow.slope L1 (A) | Snowy Hill | Get Hook Claws for the snow. | Get Hook Claws so you do not slide. | Give your dino Hook Claws so it can climb the snowy hill. |  | E: Climb up the snowy hill.<br>M: Your dino must not slide on snow.<br>H: Give your dino a good grip to climb the icy hill. |
| snow.slope L1 (B) | Snowy Hill | Hook Claws grip the snow. | Hook Claws or Grabby Hands grip snow. | Pick Hook Claws or Grabby Hands to climb without a slide. |  | E: Get a grip on snow.<br>M: Make a dino that can climb ice.<br>H: The hill is slippery, so your dino must grip well. |
| snow.slope L2 (A) | Icy Hill | Get Grabby Hands for ice. | Get Grabby Hands to climb the icy hill. | The hill is steep and icy, so get Grabby Hands. |  | E: Climb the steep, icy hill.<br>M: The ice is steep, so grip very well.<br>H: Make your dino light, with a super grip for the steep ice. |
| snow.slope L2 (B) | Icy Hill | Hook Claws and a Long Tail. | Use Hook Claws and a Long Tail. | Pick Hook Claws and a Long Tail to climb the icy hill. |  | E: Be a great climber.<br>M: Make your dino climb up a steep hill.<br>H: This icy wall is steep, so your dino must grip hard. |

### birds (Shoo the pesky birds away)

Two-requirement title: "Bird Trouble" (never shown: one requirement only). Was: "Pesky Birds" / "Shoo Shoo" / "Noisy Nest", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| birds.roar L1 (A) | Birds on the Nest | Shake a Neck Frill at them. | A loud Neck Frill chases the birds. | Give your dino a loud Neck Frill to chase the birds. |  | E: Make a loud noise.<br>M: Your dino must be loud to shoo birds.<br>H: Give your dino a loud voice to shoo the birds away. |
| birds.roar L1 (B) | Birds on the Nest | Honk with a Crest Head. | A Crest Head makes a loud honk. | Pick a Crest Head or a Neck Frill to make loud noise. |  | E: Shoo the birds away.<br>M: Make a noise that chases birds away.<br>H: The birds are on the nest, so make a loud noise. |
| birds.roar L2 (A) | Lots of Birds | Get a Crest Head to honk. | Get a Crest Head for a loud honk. | There are lots of birds, so give your dino a Crest Head. |  | E: Make a very loud honk.<br>M: The flock is big, so be very loud.<br>H: Give your dino a very loud voice to shoo the big flock. |
| birds.roar L2 (B) | Lots of Birds | Roar with a Rex Head. | A Rex Head makes a very loud roar. | Pick a Rex Head or a Crest Head to be very loud. |  | E: Shoo a big flock.<br>M: Make a honk that is very loud.<br>H: Many birds are here, so your dino must be much louder. |
| birds.roar L3 (A) | So Many Birds | Rex Head, Huge size, Neck Frill. | Use a Rex Head, Huge size, and Frill. | Get a Rex Head, the Huge size, and a Neck Frill. |  | E: Make the loudest roar.<br>M: Make a roar that is the loudest ever.<br>H: Give your dino the loudest roar so every bird flies away. |
| birds.roar L3 (B) | So Many Birds | Crest Head, Huge size, Neck Frill. | Pick a Crest Head, Huge size, and Frill. | Be loudest with a Crest Head, Huge size, and a Neck Frill. |  | E: Roar super loud.<br>M: Every bird must fly away, so roar loudest.<br>H: Your dino needs a roar even louder than thunder. |

### desert (Hot sandy desert)

Two-requirement title: "Hot Desert". Was: "Hot Desert" / "Sand Dunes" / "Sunny Sands", picked at random for every level.

| Level | Title | Easy | Medium | Hard | Problems | Was |
|---|---|---|---|---|---|---|
| desert.hide L1 (A) | Open Sand | Get Sandy Brown skin. | Pick Sandy Brown skin to match the sand. | Give your dino Sandy Brown skin so it hides in the sand. |  | E: Pick a skin like sand.<br>M: Make your skin match the sand.<br>H: Pick a skin color that helps your dino hide in sand. |
| desert.hide L1 (B) | Open Sand | Use Sandy Brown to hide. | Sandy Brown skin looks just like sand. | The sand is brown, so pick Sandy Brown skin to hide. |  | E: Hide in the sand.<br>M: Your dino must hide in the desert.<br>H: The big dino must not see your dino in the dunes. |
| desert.hide L2 (A) | Small Sand Hill | Sandy Brown and the Small size. | Get Sandy Brown skin and the Small size. | Behind a small sand hill, pick Sandy Brown skin and Small size. |  | E: Hide behind a small dune.<br>M: The dune is small, so be small too.<br>H: Match the color of the sand and be small to hide. |
| desert.hide L2 (B) | Small Sand Hill | Be Small and Sandy Brown. | Use Sandy Brown skin and be Small. | Pick Sandy Brown skin and the Small size to hide well. |  | E: Match the sand and be small.<br>M: Match the sand and stay low.<br>H: Only a small dune is here, so your dino must be small. |
| desert.hide L3 (A) | Flat Sand | Sandy Brown, Small, Slim Body. | Sandy Brown, Small size, Slim Body, Leaf Pattern. | Pick Sandy Brown, Small size, a Slim Body, and a Leaf Pattern. | E names only part of the fix (it needs more parts than the word limit allows); M/H name a Leaf Pattern in the desert: it works (it adds hiding), but reads oddly for sand | E: Hide on flat, open sand.<br>M: No dunes are here, so be very small.<br>H: There is nowhere to hide, so match the sand and be tiny. |
| desert.hide L3 (B) | Flat Sand | Sandy Brown skin and Small size. | Sandy Brown, Small, Slim Body, Tiger Stripes. | Use Sandy Brown skin, Small size, a Slim Body, and Tiger Stripes. | E names only part of the fix (it needs more parts than the word limit allows); M/H name Tiger Stripes in the desert: it works (it adds hiding), but reads oddly for sand | E: Match the sand and be tiny.<br>M: Match the sand and be super small.<br>H: On flat sand, your dino must be tiny and match the color. |
| desert.cool L1 (A) | Hot Sun | Swap Feathers for a Neck Frill. | Swap the warm Feathers for a Neck Frill. | Feathers are too hot here, so pick a Neck Frill instead. |  | E: Stay cool in the sun.<br>M: Your dino must not get too hot.<br>H: Make your dino stay cool under the hot desert sun. |
| desert.cool L1 (B) | Hot Sun | Pick Glow Spots, not Feathers. | Use Glow Spots or Tiger Stripes, not Feathers. | Pick any Extra but Feathers, like Glow Spots, to stay cool. |  | E: Do not get too hot.<br>M: Make a dino that stays cool.<br>H: The sand is hot, so your dino must keep cool. |
| desert.cool L2 (A) | Super Hot Sun | Slim Body and a Neck Frill. | Get a Slim Body and a Neck Frill. | Get a Slim Body and swap the Feathers for a Neck Frill. |  | E: Stay cool in the hottest sand.<br>M: The sand is super hot, so stay cool.<br>H: Make your dino cool and light for the very hot sand. |
| desert.cool L2 (B) | Super Hot Sun | Slim Body and Glow Spots. | Use a Slim Body and Glow Spots. | Pick a Slim Body and Glow Spots so your dino stays cool. |  | E: Be very cool.<br>M: Make your dino very cool and light.<br>H: This is the hottest day, so your dino must stay cool. |
