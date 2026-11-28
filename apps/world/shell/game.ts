import Phaser from 'phaser';
import { isMobile } from '../../../shared/device';
import { takeHandoff } from '../../../shared/handoff';
import { createDeviceInput } from '../../../shared/input/deviceInput';
import { resumeSelections } from '../logic/resume';
import { preloadPaintedArt } from '../../workshop/art/paint/painted';
import { WORLD } from '../config';
import { ProfileScene } from './ProfileScene';
import { TitleScene } from './TitleScene';
import { WorldScene } from './WorldScene';

export function createWorldGame(parent: HTMLElement): Phaser.Game {
  const mobile = isMobile();
  const input = createDeviceInput();
  // Coming back from the Workshop: keep the same players and devices (no join, no profile pick).
  const resume = resumeSelections(takeHandoff('world'));
  preloadPaintedArt();
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: WORLD.width, height: WORLD.height, backgroundColor: '#102c2c',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true },
    scene: [new TitleScene(input, mobile, resume), new ProfileScene(input, mobile), new WorldScene(input)],
  });
  game.events.once(Phaser.Core.Events.DESTROY, () => input.dispose());
  return game;
}
