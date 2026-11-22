import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config/gameConfig';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { SetupScene } from './scenes/SetupScene';
import { TrackSelectScene } from './scenes/TrackSelectScene';
import { RaceScene } from './scenes/RaceScene';
import { HudScene } from './scenes/HudScene';
import { ResultsScene } from './scenes/ResultsScene';
import { ConfigScene } from './scenes/ConfigScene';
import { SCENE } from './scenes/keys';
import { getTuning } from './config/deviceTuning';

/**
 * Dev scenes: any file in src/scenes/dev/*.ts whose default export is a Phaser.Scene subclass
 * becomes reachable via ?dev=<FileName> (e.g. ?dev=ArtGallery). Boot still runs first so
 * textures/services exist; BootScene reads the query and jumps there instead of Title.
 */
const devModules = import.meta.glob<{ default: typeof Phaser.Scene }>('./scenes/dev/*.ts', { eager: true });
const devScenes = Object.values(devModules).map((m) => m.default).filter(Boolean);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#101820',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { gamepad: false, keyboard: true }, // gamepads read via navigator.getGamepads in src/input
  physics: { default: 'matter', matter: { gravity: { x: 0, y: 0 }, debug: false } },
  fps: { target: 60, smoothStep: true, limit: getTuning().fpsCap === 30 ? 30 : 0 },
  scene: [BootScene, TitleScene, SetupScene, TrackSelectScene, RaceScene, HudScene, ResultsScene, ...devScenes, ConfigScene],
});

// Hidden settings menu: always running, on top of everything (see ConfigScene).
game.events.once(Phaser.Core.Events.READY, () => game.scene.start(SCENE.config));

// Exposed for Playwright tests / debugging.
(window as unknown as { __game: Phaser.Game }).__game = game;
