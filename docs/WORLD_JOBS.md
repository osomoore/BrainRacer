# Adventure World — Codex jobs

Read `docs/WORLD.md` (design, decisions, package map) and `apps/world/core/types.ts` (contracts) first.
Common rules for every job: work only in your worktree and owned paths; do not edit `apps/world/core/types.ts`
(propose diffs in your report); add config keys only in your section of `apps/world/config.ts`; pure modules have no
Phaser imports and get Vitest tests next to the source; seeded `Rng` from `apps/workshop/core/rng.ts`, never
`Math.random` in generation/gameplay; `npm run typecheck && npm test` must pass; follow the AGENTS.md budget rules,
except the budget for these jobs is about 25% of the 5-hour window. Report: files, tests, how to see it, known gaps,
proposed contract changes, sub-agents used.

## Wave 1 (pure logic + shell, run in parallel)

### W1 gen — `apps/world/gen/**`
Deterministic world generation. `generateHex(seed: number, coord: HexCoord): HexPlan` (memoizable, no global
state) plus helpers.
- `gen/hex.ts`: pointy-top axial math with `WORLD.hexSize`: hexToWorld, worldToHex (rounding), corners, neighbors
  (edge index 0..5, fixed documented order), ring, distance, edge midpoints.
- `gen/biome.ts`: biome per hex from a smooth low-frequency value-noise field over hex coords so biomes form
  regions of 1–4 hexes, all 10 biomes appear with reasonable frequency (test: in a 20-ring area each biome is
  4–20% of hexes). Home hexes are meadow. `homeHexFor(seed, profileId)` in rings 2–4 (distinct for distinct ids
  where possible; deterministic). Camps in about 1 of 12 hexes, treasure in about 1 of 25, givers in about 1 of 3.
- Links: each edge's link decision and crossing point are derived from the sorted pair of hex coords, so both
  neighbors agree (test symmetry). Every hex has at least 2 links; the link graph is connected (test: BFS from
  (0,0) over a 6-ring area reaches all hexes through links).
- Roads: winding road/path polylines from each linked edge crossing to the hex hub (roads between hubs, paths to
  activity sites). Width ~ 220 px road, ~140 px path. Smooth (Catmull-Rom sampled).
- Terrain blobs per biome (mud pools, lakes with islands, rock fields, ice, sand, tall grass, hot springs, dark
  areas with `dark`, cave interiors with `covered`, cliffs lining canyon valleys). Blobs must not cover roads
  except where a feature handles it (bridges over deep water, a ford beside a low bridge as `bypass`).
- Features: jumps (ramps, canyon gaps with a jump need and a detour path), bridges (some with width/height max and
  a bypass), tunnels and caves (height/width max, dark), narrow valleys (width max) — with a road-side alternative
  so no build is stuck. Obstacles (boulders, logs, bushes, ice blocks, cactus, trees) with optional needs/effects.
- Activity sites: 2–3 per ordinary hex (0–1 in home/camp hexes), kinds that fit the biome (e.g. islandSwim in lake,
  lanternCave in darkwood/canyon, herdSheep in meadow), 1–3 targets each placed on reachable ground, soft needs,
  stars 1–3. Ids `${q},${r}:a${i}`. Item spots (2–4) with biome items (rock: rocky, mudPie: mud, shell: lake,
  pinecone: darkwood/jungle, snowball: snow, cactusFlower: desert, fern: jungle, crystal: canyon/geyser,
  feather: meadow, egg: any). Ducks/lambs come from givers, not spots.
- `gen/surface.ts`: `surfaceAt(seed, x, y): SurfaceSample` using cached hex plans (bridges > roads > later blobs >
  earlier blobs > biome default ground). Fast enough to call per player per frame and per pixel-cell when baking
  (point-in-polygon with bounding-box prefilter; cache plans in an LRU map).
- `gen/world.ts`: `WorldGen` class: `plan(coord)`, `surfaceAt(x,y)`, `hexesNear(x, y, rings)`, LRU cache.
- Dev scene `apps/world/dev/GenMap.ts` (default export Phaser.Scene): draws a 4-ring area zoomed out with plain
  Graphics (dev only; baking rule waived): biome fills, roads, blobs, sites, homes. Loaded via `world.html?dev=GenMap`
  once W3's `main.ts` exists; until then add a temporary loader only if needed and say so.
- Tests: determinism, symmetry, connectivity, frequency, every road point's surface is road/path/bridge, every
  activity target lies on non-cliff ground, home hex is meadow.

### W2 traits + movement — `apps/world/logic/traits.ts`, `logic/rules.ts`, `logic/move.ts`
- `traitsOf(creation: Creation): Traits` using `CATALOGS` + `computeModel` from the Workshop (read-only). Map Race
  Shop stats (speed, power, handling, mudGrip, snowGrip, toughness, load, weight, height, width, clearance, push,
  noise, bounce...) and tags (canFloat, snorkel, winch, rocket, bright, roofRack...) and Dino Lab stats (speed,
  jump, reach, climb, swim, strength, bite, dig, size, stealth, toughness, warmth, loudness) and tags (canSwim,
  flippers, paddleTail, glow, digger, longNeck, canFly, wings...) into `Traits`. Read the variants and stats files
  to choose the mapping and document it in a table at the top of traits.ts. Default car and default dino must both
  be "ok but unremarkable" (mostly 1s); good builds reach 3 in their specialty. Size variants drive width/height.
- `rules.ts`: `surfaceEffect(kind, sample, traits)` → `{ speedMult, grip (0..1 steering/accel control), passable,
  bounce? }` table in config; `meets(needs, traits)`; obstacle passability; feature checks (fits tunnel, can jump
  gap); darkness visibility radius from `light`. Rule: on road/path/bridge everyone is at least 0.85× speed.
  Off-road a suited build is at least 1.6× faster than an unsuited one in each biome's main surface (test this
  for every biome with the default car, default dino and a hand-picked suited build per biome).
- `move.ts`: pure kinematic step `step(state, input, traits, world: { surfaceAt, solids near }, dt)` for an
  overhead vehicle (car: steer + throttle, can reverse; dino: direct 8-way-ish analog steering with turn rate) with
  circle collision and slide along solids, bounce off obstacles (no damage). Input `{ x, y, throttle, brake }`
  analog -1..1. Deterministic for a fixed dt (test). Jumps: a ramp gives an airborne timer during which surface and
  obstacle effects are skipped; gap features require the jump trait or you bounce back to the lip.
- Tests next to each file.

### W3 save + shell — `apps/world/logic/save.ts`, `logic/seed.ts`, `logic/slots.ts`, `apps/world/shell/**`, `apps/world/main.ts`, `world.html`, vite entry, `shared/hub.ts`, small Workshop return link
- `world.html` + `apps/world/main.ts` modeled on `workshop.html` / `apps/workshop/main.ts` (offline, mobile shell,
  profiles, family sync start, `?dev=<Name>` loader for `apps/world/dev/<Name>.ts`). Add the Vite input. Add the hub
  tile `{ id: 'world', title: 'Adventure World', page: 'world.html', ready: true, beta: true }` and make the
  launcher show it (check `apps/launcher`).
- `seed.ts`: `worldSeed()` per the design (family code hash, else `hub.worldSeed.v1`); URL override `?seed=N`.
- `save.ts`: load/normalize/save `world.players.v1` (`WorldPlayerSave`, tolerant of junk, capped `claimed`),
  `readingOf(profileId)` from `workshop.players.v1`, star add. `slots.ts`: resolve a `CreationSlot` to a `Creation`
  (live slot reads the Workshop save's current model, falls back to `defaultModel`), default slots, swap, take copy.
- Shell: title/join for 1–2 players reusing `shared/input` (deviceInput, menuInput) the way the Workshop shell does,
  profile pick per player (existing profiles, list and choose; creating profiles can link to the Workshop for now),
  then start the `World` scene key (W5/W6 fill it; ship a placeholder scene that shows each player's name, stars,
  resolved creation drawn with `buildRig(..., 'top')` and a "coming soon" text, split 960×1080 in 2P). Admin
  gear/F9 is not required yet.
- Workshop return: when `workshop.html?from=world`, the Workshop title/room shows a "Back to World" button (touch +
  pad reachable) that loads `world.html`. Keep the Workshop change minimal and say exactly what you touched.
- Family sync of `world.players.v1` is out of scope (stars stay on the device for now): note it as a follow-up.
- Tests: save normalize, seed stability, slot resolution. Run the one launcher/workshop e2e spec you touched.

### W4 quests — `apps/world/quests/**` (pure)
- `quests/gen.ts`: `questFor(seed, giver: QuestGiverSpot, giverHex, n, nearby: (biome) => boolean): Quest` —
  deterministic; fetch quests need an item whose biome exists within a few rings (caller passes a lookup);
  deliver quests (duck → lake biome, lamb → home, egg → giver of another hex is out of scope: keep to biome/home/giver
  goals). Stars 2–3.
- `quests/text.ts` + `quests/phrases.ts`: instruction text for all four reading levels from phrase banks with slots
  ({item}, {biome}, {who}). Starter: 2–5 words, sight words + item/biome names ("Get a rock. Go to rocks."); Easy:
  up to 8 words; Medium: up to 12 with a second clause; Hard: up to 16, richer sentences. Use Workshop
  `starterWordProblems`-style checks with a World word list (`quests/words.ts`: biome and item nouns allowed).
  A validator test runs every phrase with every item/biome fill. Biome display names: Meadow, Mud Marsh, Rocky Hills,
  Lake, Dark Woods, Snowy Hills, Desert, Jungle, Canyon, Hot Springs.
- `quests/track.ts`: pure tracker: accept (respecting `QUEST_SLOTS[reading]`), pickup when touching a matching item
  spot (fetch) or on accept (deliver: carrying true), complete when the goal is met (hex biome / home / back at
  giver), drop/abandon, stars awarded, `questSeq` advance. Respect `traits.carry` for how many carried at once.
- Tests: determinism, all text within limits at every level, tracker flows for each goal kind.

## Wave 2a (merged wave 1: gen, traits/move, shell, quests are in `feature/world`)

Runtime contract for all wave-2 jobs: `apps/world/core/runtime.ts` (WorldContext, WorldPlayer, WorldBus events,
WorldModule auto-registration, HexLive, ActivityKindDef). Heading-up cameras (docs/WORLD.md). Placeholder art is
code-drawn and **baked to textures** (CLAUDE.md rule 15); a later Sol art job replaces it, so keep one draw
function per object kind in one table.

### W1b gen richness — `apps/world/gen/**`, `apps/world/dev/GenMap.ts`, gen section of config
The first pass is too sparse: blobs are 2–4 ellipses of ~300 px in a 2400 px hex and roads are straight spokes.
- **Coverage per biome** (share of off-road area; GenMap prints the measured share per hex in debug text): lake
  40–60% deep water as one or two big organic lakes (radius 800–1400) with islands and shallow shores; mud 30–45%
  deepMud in big pools inside the mud ground; rocky boulder fields (many solid boulders 40–90 px) + rough + small
  cliffs; darkwood dense trees (solid) with clearings, whole hex dark 0.6+, a cave; snow 25–40% ice sheets + ice
  blocks; desert dunes (sand) + cactus clusters + rough mesas; jungle 40%+ tallGrass + dense trees/vines with narrow
  paths; canyon: one or two real valleys whose walls are long cliff polygons (narrow valley feature inside),
  gaps to jump with detours; geyser: many hot springs + a few vents (obstacle kind `vent`, effect `pass`, the play
  module bounces you) ; meadow: flowers, a few trees, ponds. Use organic polygons (noise-perturbed, 24–40 points),
  not plain ellipses.
- **Scatter obstacles**: trees, rocks, bushes etc. at biome densities (dozens per hex, not 2–6), never on roads or
  within `GEN.placementClearance` of road edges, sites, items, givers, homes.
- **Roads wind**: meandering curves (offset midpoints, 2–4 bends per edge-to-hub road), hub offset from the hex
  center, merge roads that arrive at similar angles; paths to sites curve too and avoid deep water/cliffs.
- Keep every W1 test passing; add coverage-range tests per biome and a reachability test (from the hub, every site
  target and item is reachable by the default car over passable surfaces, using a coarse grid flood fill with
  `logic/rules.ts` passability). Keep `surfaceAt` fast (bbox prefilter, per-hex spatial grid for blobs/obstacles);
  add a micro-benchmark test that 10k random samples run under ~50 ms.

### W5a host + objects — `apps/world/shell/WorldScene.ts` (replace the placeholder), `apps/world/host/**`, `apps/world/render/objects*`, `apps/world/render/players*`, host section of config
- WorldScene builds the `WorldContext` per `core/runtime.ts`: WorldGen + HexLive map (create on demand, drop beyond
  `WORLD.keepRings`), bus, players from the shell's selection (profile, device, save, reading, creation via
  `logic/slots.ts`, traits via `logic/traits.ts`), `award`, `save` (debounced), `setCreation`, `showOnlyTo`.
- Module loader: `import.meta.glob('../{render,play,activities,hud}/**/*Module.ts', { eager: true })`, sort by
  `order`, init, update each frame.
- Input: map `shared/input` devices (pads + the two keyboard layouts + touch later) to `PlayerControls` each frame.
- Cameras: 1P full screen; 2P two 960×1080 viewports. **Heading-up**: camera rotation follows the creation's angle
  with smoothing (like Brain Racer's CameraRig), the creation sits lower than center (look-ahead). Zoom tunable.
- Minimal driving so the scene is playable before W6: call `logic/move.ts` `step` with `ctx.world` per player,
  update `hex`/`surface`, emit `player:hex`. Start positions per docs/WORLD.md (own home in 1P, P1's home in 2P,
  `last` if saved); save `last` on leave and every few seconds.
- Objects module: sprites for obstacles, items, givers, homes (pad + door), treasures, feature props (ramps, bridge
  decks, tunnel roofs that fade when a player is under them) for hexes near players; create/destroy as hexes enter
  and leave range; pooled; baked placeholder textures. Player sprites via `buildRig(scene, ws, model, 'top')`,
  rebuilt on `player:swap`; both players visible to both cameras.
- `window.__world` = ctx for tests. Dev quick start `world.html?play=1&seed=N` (skip title, default profile(s),
  `play=2` for two keyboard players).
- e2e: `tests/e2e/world.spec.ts` (one spec): quick start loads, a player moves when a key is held, no console errors.

### W5b terrain + minimap — `apps/world/render/terrain*`, `apps/world/render/minimap*`, `apps/world/dev/TerrainView.ts`, terrain section of config
- `TerrainModule`: bake the ground into chunk textures (e.g. 512 px chunks, sampling `ctx.world.surfaceAt` on a
  grid, ~8–16 px cells) with a distinct, readable look per SurfaceKind (grass, mud with puddle sheen, deep mud darker,
  rough pebbles, sand ripples, snow, ice shine, shallow and deep water with shore edge, hot springs, cliffs with a
  shadowed lip), soft transitions between kinds, roads/paths/bridges drawn on top with edges. Bake progressively
  (a few chunks per frame, nearest first, ahead of the heading); LRU cache sized for 2 players; no live Graphics.
  Darkness: a per-player dark overlay with a light circle sized by `logic/rules.ts` `visibilityRadius` (only that
  player's camera).
- `MinimapModule`: per player, a corner hex minimap (north-up, biome colors, distinct and kid-readable), revealed hexes
  (visited + neighbors this session), player arrows (both players), home markers, a marker for tracked quest targets
  (read `player.save.quests`). Baked hex tiles, updated only when the reveal set changes.
- Dev scene `TerrainView` renders terrain around a seed at a few zoom levels without the full host (for screenshots).
- Perf: report chunk bake time per chunk and steady-state FPS in Edge at 1920×1080 with 6× CPU throttle (TV box proxy).

## Wave 2b (after W1b, W5a, W5b are merged; all build on the running host)

### W6 play — `apps/world/play/**`, `apps/world/logic/move.ts` + `logic/rules.ts` (now W6-owned), play section of config
- `PlayModule` (order 100) takes over driving from the host's minimal loop (host keeps a fallback only when no play
  module is loaded; remove the duplicate cleanly and say how).
- **Terrain feel** (beyond speed multipliers; tune in config, test in logic): per-surface drag and acceleration;
  sideways grip so ice and mud drift and slide (suited traits restore grip); deep mud bogs down to a crawl without
  mud grip (never fully stuck: a slow wiggle always works); water drag and a wake; rough ground jitter (cosmetic
  sprite/camera wobble, no damage); geyser `vent` obstacles pop you up with a short airborne hop; snow slows without
  snow/cold; desert sun slowly tires low-heat builds (mild speed cap, recovers in shade/water). Dust, mud, splash
  and snow particles (baked particle textures, pooled).
- Obstacle effects from `step`: push (move the obstacle in `HexLive`, slide it, stop at solids), pass (bush bends),
  break (comic poof, gone for the session). Emit `obstacle:effect`.
- Jumps: ramp launches with a shadow and scale-up while airborne; gap features without enough jump bounce back to
  the lip with a funny boing. Bridges and tunnels: features with width/height max block unsuited builds with a soft
  bump and point to the `bypass` (no text popups; a small arrow sign).
- **Swap** (X / pad Y): quick swap primary <-> alternate anywhere with a poof (ctx.setCreation).
- **Homes**: entering a home base pad shows a small per-player swap-pad panel (pad + touch): choose primary and
  alternate from: My Race Car (live), My Dino (live), or "Keep a copy" of the current creation into a slot; and a
  Workshop door (emit `nav:workshop`; host saves and opens `workshop.html?from=world`). Respawn: hold B 2 s to poof
  back to the nearest home base.
- Text: panel labels at ≥ 40 px, short words; no word popups.

### W7a activities host + 5 kinds — `apps/world/activities/ActivitiesModule.ts`, `activities/kit/**`, `activities/kinds/{duckParade,hideSeek,ringJump,boulderPush,fruitShake}.ts`
- `ActivitiesModule` (order 200): loads `activities/kinds/*.ts` (`ActivityKindDef`, see core/runtime.ts), decorates
  sites in nearby hexes, shows a site marker (ring + kind icon, no words) and an "A" prompt badge when a player is
  inside a site, runs one `ActivityRun` per player, ends on success/fail, awards stars via `ctx.award` (claim id =
  site id; claimed sites show a gold check and can be replayed for fun with no stars). Banners via `ui:banner` with
  short reading-level-free words ("Yay!" is fine as a banner, not as a popup).
- Pure state machines for each kind under `activities/kit/` or next to the kind with tests (progress, success,
  fail, timeouts), deterministic.
- Kinds: duckParade (1–3 ducklings follow you if you go slow; pond target; too fast = they scatter back), hideSeek
  (a big friendly sniffing dino walks by; stay still inside matching foliage; stealth/color decides; caught = it
  sneezes and laughs), ringJump (ramp + 1–3 floating star rings; jump trait reaches higher rings), boulderPush (push
  1–3 boulders onto marked spots; push trait), fruitShake (bump 1–3 trees; reach decides if fruit drops; fruit rolls
  to a basket when you push it).
- Unsuited builds can always try; failure is gentle and funny.

### W7b 5 kinds — `apps/world/activities/kinds/{digSpot,islandSwim,gateDash,lanternCave,herdSheep}.ts` (+ tests, own helpers in `activities/kinds/<kind>/`)
- Conform to `ActivityKindDef`; do not edit ActivitiesModule or kit (written in parallel); if you need a shared
  helper, put it in your own folder and propose moving it.
- digSpot (park on X marks and hold A; dig trait speeds it, 0 = can't), islandSwim (reach the island star across
  deep water; water trait), gateDash (3 gates in order before a timer; speed/turn), lanternCave (drive into a dark
  cave and touch 1–3 lanterns; they light up the cave; light and height), herdSheep (nudge or honk/roar with A
  near 1–3 sheep to steer them into a pen; loud trait makes A scare them further).

### W8 quests runtime + HUD — `apps/world/hud/**`, `apps/world/play/questModule*` (only this file in play/)
- `HudScene` overlay per player view (1P full, 2P halves): star counter with star icon, tracked quest cards (text at
  the player's reading level, ≥ 40 px, high contrast, short), a heading-aware arrow to the tracked target (nearest
  item spot of the fetch biome / goal biome hex / home / giver), banners, "+N" popups, the "A" prompt badge
  position helper for other modules.
- `QuestModule`: givers in nearby hexes (friendly animals, baked placeholder sprites); near a giver press A to open
  a quest card dialog (read the text, A accept / B no thanks); respects `QUEST_SLOTS`; pickup on touching an item
  spot of the right biome (item shows above the creation; `carry` limit); deliver goals complete on entering the
  goal; `ctx.award` stars (claim id = quest id); `quest:*` events; save via `ctx.save`. Uses apps/world/quests/**.
- Quest text stays as written in quests/phrases.ts (user review pending); don't rewrite wording.

### W1c gen tuning (queued) — `apps/world/gen/**`, GenMap, gen config
From the W1b GenMap review (seed 29, 4 rings):
- Roads meander too tightly (a bend every ~200 px): use 1–3 wide, smooth bends per edge-to-hub road (min bend radius
  ~600 px for roads, ~350 px for paths) so a young child can follow a road without constant steering. Keep paths to
  sites gently curved.
- Biome balance: in a 4-ring area geyser was 0 and darkwood 1 while jungle was 11. Rebalance so each biome is about
  6–14% over a 20-ring area and every 3-ring neighborhood of a home has at least 6 different biomes; tighten the
  frequency test to that.
- Canyon: cliffs are ~5%. Make one or two real valleys per canyon hex: long cliff walls 150–300 px thick bounding a
  valley 400–900 px wide that the road runs through, a narrow side valley (width max) and a jump gap with a detour.
  Target 15–30% cliff coverage. Keep reachability tests green.
- **Road network (user, 2026-11-27: "roads are too busy").** Replace "every linked edge runs to a hub" with 2–4
  through-roads per hex, edge to edge, that cross the hex in simple wide arcs and meet at a clear crossroads or
  T-junction. Fewer, longer roads; paths to sites stay short side spurs. Roads still continue across hex edges
  (neighbors agree on edge points).
- **Road types:** dirt, rocky, paved. Contract change (orchestrator applies at launch): `RoadPath.surface?: 'paved' |
  'dirt' | 'rocky'`. Paved is fastest; dirt slightly slower with a little less grip; rocky is bumpy and slower but
  every build can drive it. Pick the type by biome and road importance (paved through meadow and home hexes, dirt in
  mud, jungle and darkwood, rocky in rocky, canyon and geyser). `surfaceAt` reports the road type; the terrain
  bake draws each one differently (W5c renders, W1c generates).

### W5c view, minimap, darkness (user feedback 2026-11-27) — `apps/world/render/**`, `apps/world/host/cameras.ts`, host + terrain sections of config
- **Closer view:** about 2× closer, so the creation looks twice as big on screen (`WORLD_HOST.camera.soloZoom`
  0.92 → about 1.8, `splitZoom` about 1.6). Keep the creation low on screen (`carScreenY`) so kids see ahead. Check
  chunk bake cost and texture memory still fit the TV box budget (fewer chunks are visible, but each is magnified:
  raise bake resolution only if it looks blurry).
- **Minimap heading-up:** rotates with the player's view (`ctx.viewRotation(player)`), player arrow fixed pointing
  up, smooth (no snapping), and the map scrolls smoothly as the player moves between hexes instead of jumping per hex.
  A small "N" marker on the rim shows north.
- **Darkness is just dark:** a creation without a light trait gets no glow circle; the darkwood/cave view is evenly
  dark (dim enough to feel like night, light enough that a 5-year-old can still steer along the road). Only builds
  with a light trait get a light pool, bigger with more light. Glowing mushrooms and lanterns stay visible as small
  lights.
- Road types from W1c: paved (grey, lane line), dirt (brown, tire tracks), rocky (grey-brown, pebbles).

## All remaining jobs: input rule
Every interaction must work with a pad button and with a tap (mobile is 1 player, touch only; see docs/WORLD.md
"Input"). Panels/dialogs: tap targets >= 120 px, pad badges only when a pad is in use. Touch players get their
controls from `apps/world/input/` (TouchModule writes `player.controls`); read `player.controls`, never raw input.

### S1 touch controls (Claude Sonnet) — `apps/world/input/**`, `apps/world/dev/TouchView.ts`, input section of config
- `TouchModule` (WorldModule, order 50, auto-loaded from `apps/world/input/*Module.ts`; if the host glob does not
  include `input/`, report the one-line host change needed): active only when the game runs in touch mode (1 player,
  `shared/device` isMobile or a `?touch=1` override). Draws a fixed-to-screen virtual stick (appears where the left
  thumb lands in the left 45% of the screen, max radius ~150 px logical) and A / B / X / Y buttons bottom-right
  (>= 130 px, high contrast, icons/letters), multi-touch (steer and press at once). Writes `player.controls`:
  stick -> x/y, throttle = stick push forward (heading-up: up = forward), brake = pull back, edges for buttons.
- Pure mapping logic (stick vector -> controls, dead zone, edge detection, pointer assignment) in a Phaser-free
  file with tests. Baked textures only. Hide when a pad connects; show again on touch.
- Dev scene `TouchView` to screenshot the overlay; e2e not required (note how to emulate touch in Playwright).
