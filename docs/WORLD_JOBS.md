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
