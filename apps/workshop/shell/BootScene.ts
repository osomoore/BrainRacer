/** Boot: preloads the audio package's files, then shows the title. */
import Phaser from 'phaser';
import { preloadWorkshopAudio } from '../audio';
import { paintedReady, preloadPaintedArt } from '../art/paint/painted';
import { shell } from './shell';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload(): void { preloadWorkshopAudio(this); preloadPaintedArt(); }

  create(): void {
    shell.initAudio();
    void paintedReady().then(() => shell.toTitle(true));
  }
}
