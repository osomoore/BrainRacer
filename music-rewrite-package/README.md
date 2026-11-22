# BrainRacer music rewrite handoff

This package contains editable source songs, reference audio, and track metadata for revising the BrainRacer soundtrack. All music is original project material.

## Package contents

- `tracks/<id>.json` holds the current editable game song data for all 19 tracks.
- `reference-audio/<id>.ogg` is the current rendered version to compare against.
- `track-manifest.json` records each ID, display name, BPM, beat count, duration, layer instruments, and measured loudness.
- `TRACKS.md` gives the world association, current creative direction, and preview guidance.

## Creative brief

Make each track immediately recognizable as its assigned world or screen. Keep the racing tracks lively and memorable for children ages 5–9. World tracks should have distinct rhythms, melodic contours, and timbres. Race tracks should feel energetic while leaving room for engine sounds and questions. The Dino track plays during every world's boss encounter, so it should feel like a clear, exciting escalation. Title and results tracks support the menus.

Current world tracks generally run 96–128 beats and include contrasting sections. New revisions may vary when a musical idea needs it. Keep loop seams clean. A resolved final phrase should lead naturally into the opening.

Use the mood and theme notes in `TRACKS.md` as the direction for each level. Treat those as a starting point for creative choices, while preserving each world's recognizable identity.

## Return format

Return one file per track you revise, with the exact ID from `track-manifest.json`.

Preferred format is MIDI. Name it `<id>.mid`, such as `airport.mid`. Keep tempo in the MIDI file. Use General MIDI percussion on channel 10. Separate melodic and drum parts into MIDI tracks. Send the MIDI files in a folder named `midi/`.

JSON returns are also accepted. Name them `<id>.json` and retain the game's track shape: `name`, `bpm`, `loop`, `lengthBeats`, and `tracks[]` layers with `instrument`, `volume`, and `notes[]` containing `t`, `d`, `p`, and `v`. Time and duration are in quarter-note beats, pitch is MIDI 0–127, and velocity is 0–1. Supported layer instruments are `square`, `pulse25`, `triangle`, `sawtooth`, `pluck`, and `noise`. Use pitch 36 for kick, 38 for snare, and 42 for hat in noise layers.

If returning both formats, say which one is the intended final. Include a short note on the creative changes and any tempo, meter, or section changes.

## Plugging revisions into the game

Copy MIDI returns to `src/audio/music/midi/` with their exact IDs, or copy JSON returns over the corresponding files in `src/audio/music/tracks/`. MIDI overrides are converted to game synth layers, so the rendered sound uses the game's instrument palette rather than the DAW's instrument patches. Listen in `/?dev=AudioTest` and select each updated track.

After installing revisions, run `npm run audio:render`, then `npm run typecheck && npm test && npm run e2e`. The renderer updates the shipped Ogg files, manifest loudness measurements, and matching live-mode gains. Review `docs/STATUS.md` if measurements or music descriptions need updating.

## File map

```
music-rewrite-package/
  README.md
  TRACKS.md
  track-manifest.json
  tracks/             19 editable JSON source songs
  reference-audio/    19 current Ogg reference renders
```
