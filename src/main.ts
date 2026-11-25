import '../shared/offline';
import Phaser from 'phaser';
import { DINO_RIDE, GAME_HEIGHT, GAME_WIDTH, VEHICLE_CONDITION } from './config/gameConfig';
import { dinoBoardDistance } from './entities/dinoRide';
import { touchActionView } from './input/touch/touchMap';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { SetupScene } from './scenes/SetupScene';
import { TrackSelectScene } from './scenes/TrackSelectScene';
import { RaceScene } from './scenes/RaceScene';
import { HudScene } from './scenes/HudScene';
import { ResultsScene } from './scenes/ResultsScene';
import { ConfigScene } from './scenes/ConfigScene';
import { REG, SCENE } from './scenes/keys';
import { getTuning } from './config/deviceTuning';
import { services } from './core/services';
import type { TouchLayout } from './core/types';
import type { RaceContext } from './core/race';
import { installMobileShell } from '../shared/mobile';
import { isMobile } from '../shared/device';
import { familySync } from '../shared/sync/runtime';
import { loadoutForProfile, loadSettings } from './core/settings';
import type { Settings } from './core/types';

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

const unwatchProfiles = familySync.subscribeProfiles(id => {
  const settings = game.registry.get(REG.settings) as Settings | undefined;
  if (!settings) return;
  const loadout = loadoutForProfile(id);
  const players = settings.players.map(p => p.profile === id && loadout ? { ...p, ...loadout } : p);
  game.registry.set(REG.settings, { ...settings, players, racerProfiles: loadSettings().racerProfiles });
});
game.events.once(Phaser.Core.Events.DESTROY, unwatchProfiles);

// Exposed for Playwright tests / debugging.
(window as unknown as { __game: Phaser.Game }).__game = game;

installMobileShell();

// Touch controls: race running -> 'race' buttons (hidden during a pause-style question break, answers are tapped).
// Mobile (single player): Title / Setup / Track select are fully tappable -> 'actions' (A/B only), Results -> 'none' (its buttons are tapped).
// Everything else (and every screen on desktop) -> 'menu'.
const mobile = isMobile();
const ACTIONS_SCENES = [SCENE.title, SCENE.setup, SCENE.track];
game.events.on(Phaser.Core.Events.POST_STEP, () => {
  const input = services.input;
  if (!input?.setTouchLayout) return;
  const mgr = game.scene;
  let layout: TouchLayout = 'menu';
  if (mgr.isActive(SCENE.race) && !mgr.isPaused(SCENE.race)) {
    const ctx = game.registry.get(REG.race) as RaceContext | undefined;
    const pauseOpen = (mgr.getScene(SCENE.hud) as unknown as { overlay?: { visible: boolean } } | null)?.overlay?.visible;
    if (pauseOpen || ctx?.paused) layout = 'menu';
    else if (ctx?.questionBreak && (ctx.settings?.questionStyle ?? 'pause') === 'pause') layout = 'none';
    else layout = 'race';
  }
  else if (mobile) {
    if (ACTIONS_SCENES.some((k) => mgr.isActive(k))) layout = 'actions';
    else if (mgr.isActive(SCENE.results)) layout = 'none';
  }
  input.setTouchLayout(layout);
  if (layout === 'race') {
    // Action button look (same transfer action as pad B): boss crystal in reach -> ride (pulsing), riding -> laser.
    const ctx = game.registry.get(REG.race) as RaceContext | undefined;
    const car = ctx?.players?.[0];
    if (ctx && car) {
      const d = ctx.dino;
      const dist = d ? dinoBoardDistance(d, car, DINO_RIDE.boardReach) : Infinity;
      input.setTouchAction?.(
        touchActionView(d ?? { active: false }, 0, dist, VEHICLE_CONDITION.transferReach));
    }
  }
});
