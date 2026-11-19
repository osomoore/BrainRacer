export const SCENE = {
  boot: 'Boot',
  title: 'Title',
  setup: 'Setup',
  race: 'Race',
  hud: 'Hud',
  results: 'Results',
} as const;

/** Phaser registry keys for passing data between scenes. */
export const REG = {
  settings: 'settings',     // Settings
  results: 'results',       // RoundResults
  race: 'raceCtx',          // RaceContext (set by RaceScene for HudScene)
} as const;
