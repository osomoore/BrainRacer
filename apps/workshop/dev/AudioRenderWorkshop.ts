import Phaser from 'phaser';
import { api, type WsRenderApi } from '../audio/synth/render';

/** Host for scripts/renderWorkshopAudio.ts (`npm run audio:workshop`): exposes window.__wsAudioRender. Not meant for people. */
export default class AudioRenderWorkshop extends Phaser.Scene {
  constructor() { super('AudioRenderWorkshop'); }
  create(): void {
    (window as unknown as { __wsAudioRender: WsRenderApi }).__wsAudioRender = api;
    this.add.text(40, 40, 'workshop audio render host', { fontFamily: 'Arial', fontSize: '48px', color: '#ffffff' });
  }
}
