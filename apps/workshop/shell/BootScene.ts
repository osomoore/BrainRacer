/** Boot: preloads the audio package's files, then shows the title. */
import Phaser from 'phaser';
import { preloadWorkshopAudio } from '../audio';
import { shell } from './shell';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload(): void { preloadWorkshopAudio(this); }

  create(): void {
    shell.toTitle(true);
  }
}
