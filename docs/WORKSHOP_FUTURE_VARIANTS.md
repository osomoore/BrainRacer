# Adventure Workshop — future variants to develop

New parts, skins and options we want later. Adding one means: a variant (id, name, stats, tags) in
`content/<workshop>/variants.ts`, a place in the unlock order, facets/phrases that use it where it matters,
a look entry + drawing (art jobs), and the engine's catalog tests passing. Keep this list growing; pick from it
when planning a content wave.

## Race Shop
- **Size: Giant** (above Big): huge, slow, tough, very tall/wide; fails low bridges and narrow paths spectacularly.
- **Racing stripe option**: a stripe in the paint's accent color. Needs a design decision: likely a new "Decals"
  station (None / Racing Stripe / Flames / Stars / Checkers…) rather than doubling every paint.
- **More paint skins**, each with its own fixed accent (a different accent = a different skin):
  e.g. Red with White, Red with Green, Police Blue & White, Taxi Yellow & Checker, Camo.
- Submarine / airplane vehicles (much later; new workshop or body families).

## Dino Lab
- **Beak variants**: the approved profiles not yet used: Wide Duckbill, Long and Pointed, Tall Parrot Beak
  (Short and Curved is `teeth.beak`).
- **More skins**, each with its own fixed accent (e.g. Orange with Black Stripes as a distinct skin).
- Per-part size scaling ideas (bigger heads on small dinos) may lead to "Baby" / "Giant" sizes.

## Both
- Accent-color-aware extras (decals, patterns) once accents exist (Codex job C2).
