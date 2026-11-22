# BrainRacer music files

## Where to edit

The built-in editable song data is in [tracks](../tracks/). Each JSON filename is the track ID. This is the simplest place to revise notes, tempo, instruments, and arrangement.

Optional MIDI overrides go in this folder with the same ID and a `.mid` extension. For example, `race.mid` replaces `race.json` at build time. The renderer and game use a valid MIDI override automatically. Rebuild the audio with `npm run audio:render` after changing song data so the shipped Ogg files are refreshed.

## Track list and direction

| File ID | World or use | Current track | Mood and theme |
| --- | --- | --- | --- |
| `race` | City | Rocket Wheel Rally | Bright, fast urban arcade race |
| `industrial` | Factory | Industrial | Mechanical factory motion |
| `harbor` | Beach & Harbor | Buoy to Buoy | Breezy coastal bounce with buoy-like melodic calls |
| `underground` | Mine | Crystal Switchback | Mysterious, rhythmic cave adventure |
| `farm` | Farm | Farm | Warm, playful country drive |
| `sky` | Sky City | Sky | Airy, upbeat high-altitude flight |
| `forest` | Dark Forest | Forest | Curious woodland adventure |
| `underwater` | Underwater | Bubble Circuit | Flowing, bright underwater motion |
| `brickworks` | Brickworks | Studs and Steam | Clipped, sturdy quarry rhythm |
| `mushroom` | Mushroom Island | Spore Ferry | Dreamy island ferry in a lilting five-beat pulse |
| `tundra` | Frozen Tundra | First Snow, Last Run | Sparse, bell-like snowy motion |
| `volcano` | Volcano | Magma Switchback | Driving low-register eruption energy |
| `candy` | Candyland | The Taffy Trot | Bouncy, swung major-key plucks |
| `castle` | Castle | Banner Parade | Lilting, heraldic march |
| `airport` | Airport | Runway Lights | Steady runway pulse and takeoff lift |
| `house` | In My House | Under the Sofa Express | Playful toy-train chase with comic turns |
| `dino` | Every world's boss encounter | Thunder Lizard Run | Fast, bold boss energy |
| `title` | Title screen | Title | Welcoming game-opening theme |
| `results` | Results screen | Results | Short victory and results cue |

Beach & Harbor has its own track. The current race music resumes after the boss is defeated or leaves.

## MIDI notes

- MIDI files use the track IDs above, such as `airport.mid` or `dino.mid`.
- Use MIDI channel 10 for drums.
- MIDI overrides are optional. Without a matching MIDI file, the JSON in [tracks](../tracks/) plays.
- The project converts MIDI instruments to its built-in synth palette. The track's assigned game level determines its theme and gameplay context.
- Preview all tracks at `/?dev=AudioTest`. On the world selection screen, moving the selection previews that world's music.
