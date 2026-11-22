export const SCENE = {
  boot: 'Boot',
  title: 'Title',
  setup: 'Setup',          // the Join screen (panels, racer/car/buddy, ready)
  track: 'TrackSelect',
  race: 'Race',
  hud: 'Hud',
  results: 'Results',
  config: 'Config',
} as const;

/** Phaser registry keys for passing data between scenes. */
export const REG = {
  settings: 'settings',     // Settings
  results: 'results',       // RoundResults
  race: 'raceCtx',          // RaceContext (set by RaceScene for HudScene)
} as const;
