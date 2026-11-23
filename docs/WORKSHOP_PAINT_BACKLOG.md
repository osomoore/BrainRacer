# Adventure Workshop — paint backlog (placeholder textures waiting for ComfyUI jobs)

Placeholder shape textures that should become paint jobs in `apps/workshop/art/paint/jobs.ts`
(see `docs/WORKSHOP_ART_PIPELINE.md`). Model parts (car/dino rigs) are enumerated by the pipeline itself;
this list covers scenery, props and critters drawn by run scenes and screens.

## Dino Lab run scenes (`run/dino/kit`, keys `ws:dino-run:<name>`)

| Group | Status | Texture names |
| --- | --- | --- |
| Props | job added | `cloud`, `sun`, `bush`, `flowers`, `trunk`, `canopy`, `palm`, `cactus`, `stump`, `log`, `logEnd`, `pebble`, `dirt`, `dune`, `snowmound` |
| Nest, hole and food | job added | `dome`, `hole`, `glow`, `nestBack`, `nestFront`, `egg`, `treat`, `nutHalfL`, `nutHalfR` |
| Water and effects | job added | `plank`, `waveTop`, `water`, `heat`, `windline`, `shade`, `arrow`, `icicle`, `shades`, `bulge` |
| Character parts | job added | `birdWing`, `bigBody`, `bigLeg` |
| Waving dinos | job added | `friend:a`, `friend:b`, `friend2:a`, `friend2:b` |
| Top view props | job added | `hole:top`, `tuftTop`, `rockTop`, `flowerTop` |
| Beetles | job added | `beetle:happy`, `beetle:giggle`, `beetle:oops`, `beetle:scared`, `beetle:sleep` |
| Frogs | job added | `frog:happy`, `frog:giggle`, `frog:oops`, `frog:scared` |
| Lizards | job added | `lizard:happy`, `lizard:giggle`, `lizard:oops`, `lizard:scared`, `lizard:sleep`, `lizardTop:happy`, `lizardTop:sleep`, `lizardTop:scared` |
| Birds | job added | `bird:happy`, `bird:laugh`, `bird:peck` |
| Fish | job added | `fish:happy`, `fish:scared` |
| Big dino faces | job added | `bigHead:normal`, `bigHead:sniff`, `bigHead:lick`, `bigHead:surprised`, `bigHead:sneeze`, `bigHead:shrug`, `bigHead:laugh` |
| Nuts, ferns, grass and fruit | job added | `nut:1`, `nut:2`, `nut:3`, `fern:3`, `fern:5`, `fern:7`, `grass:0`, `grass:1`, `grass:2`, `fruit:ff8a2a` |
| Far backdrops | job added | `far:hills`, `far:peaks`, `far:mesas`, `far:dunes`, `far:forest` |
| Wall tiles | job added | `wall:cliff`, `wall:red`, `wall:ice`, `wall:dirt` |
| Boulders | job added | `rock:a`, `rock:b`, `rock:c`, `rock:d` |
| Particles and utility pixel | stays code | `p:leaf`, `p:dust`, `p:drop`, `p:snow`, `p:spark`, `p:star`, `p:heart`, `p:puff`, `p:feather`, `p:bubble`, `p:sweat`, `p:ring`, `p:twig`, `p:snore`, `p:question`, `p:exclaim`, `px` |
| Procedural strips | stays code | `sky:*`, `edge:*`, `cap:*`, `ramp:*` |

The fruit job uses the orange mango key currently registered by Dino Lab. Fixed water, wall and backdrop keys have jobs.
The procedural strip patterns cover dimensions and colors generated at runtime.

## Race Shop run scenes (`run/common/props.ts` and `run/common/top.ts`, keys `wsr:<name>`)

Entries use drawer names (`P.*` for side view, `T.*` for overhead). Paint jobs use the original texture keys,
including the existing arguments for each listed variant. Jobs added in C15 for the seven groups below.

- **Sky props:** `cloud`, `moon`, `sun`.
- **Plants and farm:** `tree` (green, muted green and forest green), `pine` (bare and snowy), `bush` (green,
  grass green and night green), `flower`, `fence`, `reeds`, `barn`, `tractor`, `hay`, `haystack`, `hayTop`, `melon`.
- **Buildings and roadside:** `house` (daytime wall colors and night lighting), `store`, `gasPump`, `signpost`
  (blue and yellow arrows, blank yellow sign), `window` (lit and dark), `mileSign` (one through six dots), `flag`
  (four course colors), `flagPole`, `checker`, `cone`, `crate`, `box` (delivery colors).
- **Beach:** `umbrella`, `sandcastle`, `bucket`, `shovel`, `towel`, `beachBall`.
- **Obstacles and loose props:** `rock` (forest trail and river variants), `boulder`, `log`, `logRound`, `lily`,
  `plank` (wood, rope and stick bridge decks), `postTall`, `ice` (three lengths), `snowbank`, `hat`, `hook`,
  `hubcap`, `bandage`, `stroller`, `balloon`, `bunting`, `floatWagon` (parade colors).
- **Characters (face-safe):** `sheep`, `duck` (side-view sizes), `frog`, `pigeon`, `squirrel`, `fish`, `turtle`,
  `crab`, `gull`, `puppy` (awake and asleep), `snowman`, `person` (the scene-specific outfits and poses),
  `grandpa`, `band`.
- **Overhead:** `T.hayTop`, `T.cone`, `T.treeTop` (fixed trees in Fog and Narrow Path),
  `T.squirrelTop` and `T.duckTop` (both face-safe), `T.puddle` (wide and split-pane sizes).
- **Particles and UI (code):** `dust`, `leaf`, `bubble`, `zzz`, `note`, `heart`, `exclaim`, `star`,
  `fuel`, `card`, `marshalCard`. The parade marshal card is a color cue.
- **Procedural scenery (code):** `sky`, `hills`, `stars`, `ground`, `ramp`, `arch`, `rope`, `T.wall` and the
  seed-sized `T.treeTop` decorations. These cover repeated strips, star fields, or dimensions chosen by scene logic.
  The `hash` helper does not draw a texture. Side-view mud, water and snow pools are drawn to fit the terrain in `run/common/side.ts`.

## Screens
- Workshop room backdrops (`screens/room/backdrop.ts`: garage, lab), station icons and kid character
  (`screens/room/icons.ts`), launcher/workshop tiles (`ui/icons.ts`).
