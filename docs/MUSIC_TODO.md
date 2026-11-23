# Music TODO

Written 2026-11-22. The user reports that music on most worlds sounds **much quieter and far simpler than City**, and that **City has competing parts**. These notes list what was found by measurement and code reading (nobody has listened by ear yet), and suggested fixes in priority order.

No music change happened on 11-21 or 11-22. Everything below dates from 11-19 (City/title/dino songs) and 11-20 (eight new worlds, world music mix, commits `aed9b45` and `dcc6824`).

## How music works (quick map)

- Songs are note data in `src/audio/music/tracks/<track>.json` (`bpm`, `lengthBeats`, 4–5 layers with `instrument`, `volume`, `notes`). The eight newest worlds are wired up in `src/audio/music/queuedTracks.ts`; the rest in `BUILTIN` in `src/audio/musicPlayer.ts`.
- Default audio mode is `files`: pre-rendered Ogg Opus loops in `public/audio/music/*.ogg` plus `public/audio/manifest.json`, made by `npm run audio:render` (`scripts/renderAudio.ts`, needs ffmpeg + Edge). A Vitest guard fails when the sources change and the files are stale, so **re-render after any song or synth change**. `live` mode plays the same JSON through Tone.js.
- Layer level = `layer.volume * 0.32` (`buildLayer`, `src/audio/musicPlayer.ts`). Bus chain (`src/audio/mixer.ts`): music bus gain 0.7 (volume slider squared × 0.8) → low-pass filter → world-mix gain → master 0.8 → compressor (−18 dB, 3:1) → limiter (−3 dB).
- World music mix: `RaceScene.updateMusicMix()` picks `driving` / `rush` / `quiet` every frame; values are `WORLD_MUSIC.mix` in `src/config/gameConfig.ts`.

## Problems

### 1. Loudness differs by up to 11 dB between worlds
Mean / peak level of the shipped files (`ffmpeg -i <file> -af volumedetect -f null -`):

| Track (world) | Mean dB | Peak dB | Loop |
|---|---|---|---|
| dino (boss) | −14.3 | −1.6 | 49 s |
| race (City) | −15.5 | −2.2 | 49 s |
| results | −17.3 | −3.4 | 9 s |
| title | −17.8 | −4.8 | 29 s |
| sky | −18.1 | −4.3 | 41 s |
| farm | −19.9 | −5.3 | 58 s |
| airport | −20.0 | −7.7 | 14 s |
| castle | −20.5 | −8.3 | 12 s |
| industrial (Factory) | −20.9 | −9.0 | 34 s |
| brickworks | −21.0 | −7.8 | 15 s |
| candy | −21.8 | −8.5 | 14 s |
| underground (Mine) | −22.1 | −6.7 | 14 s |
| forest | −22.6 | −7.1 | 45 s |
| volcano | −23.7 | −10.3 | 13 s |
| underwater | −23.8 | −8.8 | 16 s |
| tundra | −24.9 | −10.0 | 12 s |
| house | −25.3 | −9.2 | 16 s |
| mushroom | −25.7 | −8.8 | 18 s |

Cause: there is no loudness normalization. Each song's level is just the sum of its layer volumes and note density, and City's song is the densest by far.

### 2. The eight newest worlds also get filtered and turned down (only them)
`updateMusicMix()` returns early unless `isQueuedMap(map)`, so the world mix only runs on Airport, Brickworks, Candy, Castle, House, Mushroom, Tundra and Volcano:
- `driving` (most of the race): gain 0.9 and a **5.6 kHz low-pass** → muffled.
- `quiet` (every question break and pause): gain **0.52** and a **1.3 kHz low-pass** → very muffled and much quieter.
- `rush` (turbo / final stretch): gain 1, 18 kHz.

The other worlds (City, Factory, Farm, Mine, Sky City, Dark Forest, Underwater) always play unfiltered, so the eight new worlds sound duller and quieter on top of problem 1. Question breaks are now longer with JBQ questions (reading time plus a 5 s wrong-answer reveal), so these worlds spend more time in the muffled `quiet` mix.

### 3. The eight newest songs are short, simple and come from one template
All eight have the same layer volumes (lead 0.49, bass 0.55, pluck/counter 0.24, noise 0.28, extra 0.2), only 24–32 beats (12–18 s loops) and about 130–230 notes. They repeat every few seconds and sound alike. Underground and Underwater are also only 32 beats.

### 4. City's song is far denser than anything else ("competing parts")
Notes per minute (all layers / pitched layers only):

| Track | BPM | Beats | Notes/min | Pitched/min |
|---|---|---|---|---|
| **race (City)** | 156 | 128 | **2381** | **1600** |
| dino | 156 | 128 | 1939 | 1158 |
| underground | 132 | 32 | 1081 | 619 |
| title | 130 | 64 | 1073 | 634 |
| volcano | 144 | 32 | 1035 | 603 |
| results | 140 | 16 | 998 | 700 |
| airport | 136 | 32 | 918 | 553 |
| sky | 138 | 96 | 878 | 594 |
| candy | 132 | 32 | 875 | 520 |
| castle | 120 | 24 | 815 | 485 |
| underwater | 116 | 32 | 812 | 544 |
| brickworks | 124 | 32 | 779 | 461 |
| farm | 132 | 128 | 776 | 512 |
| industrial | 112 | 64 | 756 | 511 |
| house | 116 | 32 | 660 | 399 |
| tundra | 114 | 24 | 632 | 418 |
| mushroom | 105 | 32 | 597 | 361 |
| forest | 126 | 96 | 550 | 440 |

`race.json` has square (0.53), pulse25 (0.29) and sawtooth (0.13) melodic layers on top of triangle bass and noise drums, at 156 BPM. With engines, sirens and sfx on top, it is busy. Dino (the boss track that interrupts a race) is nearly as dense.

## Suggested fixes (in order)

1. **Normalize loudness at render time.** In `scripts/renderAudio.ts`, measure each music render (RMS or integrated LUFS over the loop) and scale it to one target, for example around −16 dB mean (City's level) with peaks below −1 dB. Store the applied gain in `manifest.json` if useful. Do the same per-track trim in `live` mode (a per-track gain in `BUILTIN` / `QUEUED_TRACKS`, or computed once from the JSON) so both modes match. Add a test that every music entry in the manifest is within ±1.5 dB of the target.
2. **Make the world mix gentle and the same everywhere.** Either apply `updateMusicMix()` to every map or to none. Suggested values: `driving` = gain 1, no filter (20 kHz); `quiet` = gain about 0.7, cutoff about 3 kHz (still clearly softer for question breaks, but not muddy); keep `rush`. Keep everything in `WORLD_MUSIC` (gameConfig).
3. **Re-compose the eight template songs** (Airport, Brickworks, Candy, Castle, House, Mushroom, Tundra, Volcano), and lengthen Underground and Underwater:
   - 96–128 beats each, with an A section and a contrasting B section (and maybe a short bridge), so a loop lasts 40–60 s.
   - Give each world its own character: tempo, key/mode, lead instrument and drum pattern (e.g. Tundra sparse and bell-like, Volcano driving with low saw bass, Candy bouncy major pluck, Castle march-like, Airport steady pulse, House playful).
   - Aim for 700–1200 notes per minute: busy enough to feel like a race, well below City's current 2381.
4. **Thin out City (and Dino).** Drop or simplify one of the three melodic layers in `race.json` (e.g. make the sawtooth sit out every other phrase or play long notes only, or turn the pulse25 counter-line into sparse stabs), aiming for roughly 1400–1700 notes per minute. Do the same lightly for `dino.json`. Keep City's energy; just stop the lines fighting each other.
5. **Check the result by ear** in `?dev=AudioTest`: play each track back to back at the default volume, and in a real race on City plus two of the eight new worlds, including a question break. Re-run the loudness table above and put the new numbers in `docs/STATUS.md`.

## Done means
- `npm run audio:render` re-run, `npm run typecheck && npm test` pass (including the stale-audio guard), `npm run e2e` passes.
- The loudness table shows all race-world tracks within about ±1.5 dB of each other.
- The user has listened and approved before the branch is merged into `dev`.
