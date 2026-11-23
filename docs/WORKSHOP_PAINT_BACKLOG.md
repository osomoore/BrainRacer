# Adventure Workshop — paint backlog (placeholder textures waiting for ComfyUI jobs)

Placeholder shape textures that should become paint jobs in `apps/workshop/art/paint/jobs.ts`
(see `docs/WORKSHOP_ART_PIPELINE.md`). Model parts (car/dino rigs) are enumerated by the pipeline itself;
this list covers scenery, props and critters drawn by run scenes and screens.

## Dino Lab run scenes (`run/dino/kit`, keys `ws:dino-run:<name>`; origins noted in `kit/art.ts`)
- **Props:** `cloud` soft white cloud · `sun` cartoon sun with rays · `bush` round green bush with pink dots ·
  `flowers` purple flower patch · `trunk` tree trunk · `canopy` leafy tree crown · `palm` palm tree · `cactus` ·
  `stump` tree stump · `log` log side view · `logEnd` log end with rings · `pebble` small rock · `dirt` dirt mound ·
  `dune` sand dune · `snowmound` snow pile.
- **Nest / hole / food:** `dome` grassy hill · `hole` burrow hole · `glow` soft glow spot · `nestBack`/`nestFront` twig
  nest · `egg` spotted egg · `treat` golden kernel · `nutHalfL`/`nutHalfR` nut shell halves.
- **Water / misc:** `plank` broken bridge planks · `waveTop` wave crest strip · `water` water tile · `heat` heat
  shimmer · `windline` wind streak · `shade` soft shadow oval · `arrow` yellow down arrow · `icicle` ·
  `shades` sunglasses · `bulge` cream belly bulge.
- **Characters:** `birdWing` · `bigBody`/`bigLeg` big friendly goofy purple dino · `friend:a|b`, `friend2:a|b` small
  waving dino (pink, blue).
- **Top view:** `hole:top` · `tuftTop` grass tuft · `rockTop` · `flowerTop`.
- **Particles (keep simple, maybe never paint):** `p:leaf p:dust p:drop p:snow p:spark p:star p:heart p:puff p:feather
  p:bubble p:sweat p:ring p:twig p:snore p:question p:exclaim`, `px`.
- **Families:** `beetle:{happy,giggle,oops,scared,sleep}` ladybug-like beetle · `frog:{happy,giggle,oops,scared}` ·
  `lizard:{happy,giggle,oops,scared,sleep}` side view · `lizardTop:{happy,sleep,scared}` · `bird:{happy,laugh,peck}`
  round blue bird · `fish:{happy,scared}` orange fish · `bigHead:{normal,sniff,lick,surprised,sneeze,shrug,laugh}`
  big goofy dino head · `nut:{1,2,3}` hard nut / hairy coconut / stone-banded giant nut · `fern:{3,5,7}` fern clump ·
  `grass:{0,1,2}` tall grass · `fruit:{hex}` mango-style fruit · `far:{hills,peaks,mesas,dunes,forest}` far backdrop
  strips · `wall:{cliff,red,ice,dirt}` rock wall tiles · `rock:{a,b,c,d}` boulders.
- **Procedural strips (probably stay code):** `sky:{top}:{bottom}`, `edge:{top}:{body}:{0|1}`, `cap:{hex}`,
  `ramp:{kind}:{w}:{pw}:{h}`.

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
