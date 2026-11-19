import Phaser from 'phaser';
import { generateTextures } from '../art';
import { services } from '../core/services';
import { createInput } from '../input';
import { createAudio } from '../audio';
import { loadSettings } from '../core/settings';
import type { CarKind, InputDevice, PlayerId, Settings } from '../core/types';
import { SCENES } from '../data/scenes';
import { REG, SCENE } from './keys';

export class BootScene extends Phaser.Scene {
  constructor() { super(SCENE.boot); }

  preload() {
    const { width, height } = this.scale;
    const bar = this.add.rectangle(width / 2 - 400, height / 2, 0, 24, 0x2ecc40).setOrigin(0, 0.5);
    this.add.text(width / 2, height / 2 - 60, 'BrainRacer', { fontFamily: 'Arial Black, Arial', fontSize: '64px', color: '#ffffff' }).setOrigin(0.5);
    this.load.on('progress', (p: number) => bar.setSize(800 * p, 24));
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.warn(`[boot] failed to load ${f.key} (${f.url})`));
    for (const s of SCENES) this.load.image(s.id, s.file);
  }

  /** Never leave a picture slot empty: any scene image that failed to load gets a labelled placeholder. */
  private placeholderForMissingScenes() {
    for (const s of SCENES) {
      if (this.textures.exists(s.id)) continue;
      console.warn(`[boot] scene texture missing: ${s.id} (${s.word}); using placeholder`);
      const c = this.textures.createCanvas(s.id, 256, 256);
      if (!c) continue;
      const g = c.getContext();
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = '#1c4fa8'; g.lineWidth = 10; g.strokeRect(5, 5, 246, 246);
      g.fillStyle = '#1c4fa8'; g.font = 'bold 120px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('?', 128, 100);
      g.font = 'bold 40px Arial'; g.fillText(s.word.slice(0, 12), 128, 205);
      c.refresh();
    }
  }

  create() {
    services.input = createInput();
    services.audio = createAudio();
    generateTextures(this);
    this.placeholderForMissingScenes();
    this.registry.set(REG.settings, loadSettings());
    const params = new URLSearchParams(location.search);
    const dev = params.get('dev');
    const quick = Number(params.get('race'));
    if (dev && this.scene.get(dev)) this.scene.start(dev);
    else if (quick === 1 || quick === 2) this.quickRace(quick, params.get('map'));
    else this.scene.start(SCENE.title);
  }

  /** ?race=1|2 — skip menus: gamepads if connected, else keyboard WASD (P1) / arrows (P2). */
  private quickRace(count: 1 | 2, map: string | null) {
    const base = loadSettings();
    const pads = services.input.devices().filter((d) => d.type === 'gamepad');
    const kb: InputDevice[] = [{ type: 'keyboard', layout: 'left' }, { type: 'keyboard', layout: 'right' }];
    const cars: CarKind[] = ['dino', 'kart'];
    const settings: Settings = {
      ...base,
      map: map === 'industrial' || map === 'city' ? map : base.map,
      players: Array.from({ length: count }, (_, i) => ({
        device: pads[i] ?? kb[i],
        difficulty: base.players[i]?.difficulty ?? 'normal',
        car: cars[i],
      })),
    };
    this.registry.set(REG.settings, settings);
    services.input.reset();
    settings.players.forEach((p, i) => services.input.assign(i as PlayerId, p.device));
    this.scene.start(SCENE.race);
  }
}
