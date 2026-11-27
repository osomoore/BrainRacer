# Adventure World — design and build guide

Third app next to Brain Racer and Adventure Workshop (`world.html`, code in `apps/world/`). Kids 5–9 drive their
own Race Shop car or Dino Lab dino around an endless overhead world made of hexagon biomes, try optional
activities, do simple reading quests, and earn stars. Branch `feature/world` (integration) in `.worktrees/world`.

## Decisions (orchestrator, 2026-11-27; flag any the user changes)

- **Phaser 3.90, 1920×1080, overhead, heading-up camera** (user, 2026-11-27): each player's camera rotates smoothly
  with their creation's heading, like Brain Racer (`CAMERA.rotTau`-style smoothing). The minimap stays north-up with
  a rotating player arrow. Two players = side-by-side split screen, each view 960×1080, one shared world scene with two cameras.
  Both players see each other. Mobile = 1 player.
- **No Matter physics.** Movement and collision are pure kinematics in `apps/world/logic/move.ts` (circle collider
  vs circle obstacles and polygon solids). Cheaper on the Mali TV box and unit-testable. Terrain must *feel*
  different, not just change top speed: per-surface acceleration, drag, sideways grip (ice and mud slide and drift,
  deep mud bogs down without grip), water drag, rough-ground shake/bumps, geyser bounces. Suited traits restore grip.
- **Reuse, don't copy:** World imports from `apps/workshop/` read-only: catalogs (`content/index.ts` `CATALOGS`),
  `logic/stats.ts` (`computeModel`, `defaultModel`), `art/index.ts` (`buildRig(scene, ws, model, 'top')` for the
  player sprites), `core/rng.ts` (`Rng`), `logic/wording.ts` + `content/starterWords.ts` (word checks). It never
  edits them. The Workshop never imports from World except the tiny return link (W3).
- **Reading levels** are the Workshop's: Starter / Easy / Medium / Hard (= the spec's Starter / Beginning /
  Intermediate / Advanced). Read from the player's Workshop save (`workshop.players.v1`), default Easy.
  Tracked quests: 1 / 1 / 2 / 3 (`QUEST_SLOTS`).
- **World seed** = hash of the family-sync code when the device is in a family, else a random per-device seed
  saved once in shared storage (`hub.worldSeed.v1`). Same seed = same world everywhere. Nothing about the world is
  saved; only per-player state is (stars, slots, claimed ids, active quests, last position).
- **Homes:** every profile has a home base in a hex picked from (seed, profile id) within rings 2–4 of (0,0), so a
  family's homes are neighbors. Public home bases ("camps") also appear in about 1 of 12 hexes. A home base has a swap
  pad (pick primary/alternate, take a frozen copy), a Workshop door, and is the respawn point.
  1P starts at their own home (or `last` position); 2P both start at Player 1's home.
- **Creations:** each player has a primary slot and an alternate slot (`CreationSlot`). `live` = follows the
  current Workshop build of that workshop; `copy` = a frozen build taken at a swap pad, so two cars or two dinos are
  possible. Default: primary = live build of the player's last Workshop, alternate = live build of the other one.
  Quick swap anywhere with one button (comic poof). Players with no Workshop save get the default car and dino.
- **Workshop round trip:** the Workshop door opens `workshop.html?from=world`; the Workshop shows a "Back to World"
  button that opens `world.html`. The World restores players at their `last` position.
- **Traits:** every creation maps to small integer traits (`Traits`, `logic/traits.ts`) from its Workshop stats and
  tags. Every rule in the world reads traits only, never raw part ids.
- **Almost every hex is traversable with any build:** roads and paths connect each hex's linked edges, and every road
  is drivable by the default car and default dino (slow is fine). Off-road terrain is where builds differ: a suited
  build should be at least 1.6× faster across its biome than an unsuited one. Water on a road is always bridged
  (some bridges are low or narrow, those always have a `bypass` ford or detour).
- **Stars:** activities 1–3, quests 2–3, treasures 5. Claimed ids are saved so a site pays once (capped list).
  No spending yet.
- **Kid rules from CLAUDE.md apply:** no violence, things bounce or go "poof"; no word popups (only "+N" star numbers
  and banners); gameplay text ≥ 40 px; bake rounded shapes to textures.

## Biomes (10)

| Biome | Ground and features | Suited builds |
|---|---|---|
| meadow | grass, flowers, gentle roads; homes prefer it | anything |
| mud | mud and deep mud pools, logs | mud grip (mud tires, 4x4; dino big feet/claws) |
| rocky | rough rock fields, boulders, ramps | rough (clearance, toughness, climbing) |
| lake | shallow and deep water, islands, bridges | water (floaties, snorkel; swimming dinos) |
| darkwood | dark forest, caves, glowing mushrooms | light (glow, bright paint), stealth |
| snow | snow, ice patches, ice blocks | snow grip, cold (warmth) |
| desert | sand, dunes, cactus, hot sun | heat tolerance, speed |
| jungle | tall grass, vines, narrow paths, fruit trees | small width, reach |
| canyon | cliffs, narrow valleys, gaps to jump, tunnels | jump, small width/height |
| geyser | hot springs, bubbling vents that bounce you | heat, rough |

## Activities (10) — 2–3 sites per ordinary hex, 1–3 targets each

`duckParade`, `hideSeek`, `ringJump`, `boulderPush`, `fruitShake`, `digSpot`, `islandSwim`, `gateDash`,
`lanternCave`, `herdSheep` (descriptions in `core/types.ts`). Each has soft trait needs: a suited build can finish
it, others can try and get a gentle funny miss. Stars on completion.

## Quests

Quest givers (friendly animals) stand in some hexes (about 1 in 3). Each offers a fetch (bring a rock from a rocky
hex) or a deliver (take this duck to a lake) quest. Text is generated at all four reading levels from phrase banks
under `apps/world/quests/` and checked with the Workshop word rules (Starter word list and per-level word limits).
Kid wording gets a review pass with the user before release. A player can track `QUEST_SLOTS[reading]` quests;
the HUD shows the tracked quest text and an arrow; the minimap marks targets.

## Minimap

Hex minimap per player view (corner), biome colors, player dots, home and quest markers. Revealed hexes only
(visited + neighbors) so exploring fills it in; reveal list is per session, not saved.

## Package map (who owns what)

| Path | Owner |
|---|---|
| `apps/world/core/types.ts`, this doc | orchestrator (propose diffs) |
| `apps/world/config.ts` | add keys in your own section only |
| `apps/world/gen/**` | W1 gen: hex math, biome field, links/roads, terrain blobs, features, obstacles, sites, items, givers, homes, treasures, `surfaceAt` |
| `apps/world/logic/traits.ts`, `logic/rules.ts`, `logic/move.ts` | W2 traits + movement |
| `apps/world/logic/save.ts`, `logic/seed.ts`, `logic/slots.ts`, `apps/world/shell/**`, `apps/world/main.ts`, `world.html`, vite entry, `shared/hub.ts` tile, Workshop "Back to World" link | W3 save + shell |
| `apps/world/quests/**` | W4 quests (pure) |
| `apps/world/render/**`, `apps/world/dev/**` | W5 renderer + minimap (wave 2) |
| `apps/world/play/**` | W6 player control, features, obstacles, swap, homes (wave 2) |
| `apps/world/activities/**` | W7 activities runtime (wave 2) |
| `apps/world/hud/**`, quest runtime | W8 quests runtime + HUD (wave 2) |

Ports: W1 5211, W2 5212, W3 5213, W4 5214, W5 5215, W6 5216, W7 5217, W8 5218. Integration play server 5210.
