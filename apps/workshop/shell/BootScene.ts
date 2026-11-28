/** Boot: preloads the audio package's files, then shows the title. */
import Phaser from 'phaser';
import { preloadWorkshopAudio } from '../audio';
import { paintedReady, preloadPaintedArt } from '../art/paint/painted';
import { takeHandoff } from '../../../shared/handoff';
import { shell } from './shell';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload(): void { preloadWorkshopAudio(this); preloadPaintedArt(); }

  create(): void {
    shell.initAudio();
    void paintedReady().then(() => {
      // Coming from the World: same players and devices, straight into their workshop rooms.
      const handoff = takeHandoff('workshop');
      if (handoff) shell.startPanes(handoff.players.map((p) => p.device), handoff.players);
      else shell.toTitle(true);
    });
  }
}
