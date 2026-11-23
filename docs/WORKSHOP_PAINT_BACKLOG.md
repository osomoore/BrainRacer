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

## Race Shop run scenes (`run/common/props.ts`, ~80 props `P.*`, and `run/common/top.ts` `T.*`)
- To be listed when the pipeline adds scenery jobs (backdrops, mud/water/snow pools, ducks, frog, hay, bridges, people).

## Screens
- Workshop room backdrops (`screens/room/backdrop.ts`: garage, lab), station icons and kid character
  (`screens/room/icons.ts`), launcher/workshop tiles (`ui/icons.ts`).
