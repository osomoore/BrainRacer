import Phaser from 'phaser';
import policeStationArt from '../../images/scenes/scene_185.png?inline';
import { generateTextures } from '../art';
import { services } from '../core/services';
import { createInput } from '../input';
import { createAudio } from '../audio';
import { migrateLegacyRacers } from '../core/legacyRacers';
import { ensureProfiles } from '../../shared/profiles';
import { isRaceMap, loadSettings, savedSecondPlayer } from '../core/settings';
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
    // Bundle this art so the question can show it even if the standalone PNG is unavailable.
    for (const s of SCENES) this.load.image(s.id, s.id === 'scene_185' ? policeStationArt : s.file);
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
    ensureProfiles();      // shared profiles (first run on a device with old Brain Racer data migrates it)
    migrateLegacyRacers(); // remaps Brain Racer's own saved data to the shared profile ids, once
    const startup = loadSettings();
    services.audio.setVolumes(startup.musicVolume, startup.sfxVolume);
    this.placeholderForMissingScenes();
    this.registry.set(REG.settings, startup);
    const params = new URLSearchParams(location.search);
    const dev = params.get('dev');
    const quick = Number(params.get('race'));
    if (dev && this.scene.get(dev)) this.scene.start(dev);
    else if (quick >= 1 && quick <= 4) this.quickRace(quick, params.get('map'));
    else this.scene.start(SCENE.title);
  }

  /** ?race=1|2 — skip menus: gamepads if connected, else keyboard WASD (P1) / arrows (P2). 3-4: P1/P2 keyboard, P3/P4 gamepads 0/1 (none = no input). */
  private quickRace(count: number, map: string | null) {
    const base = loadSettings();
    services.input.poll();
    const pads = services.input.devices().filter((d) => d.type === 'gamepad');
    const kb: InputDevice[] = [{ type: 'keyboard', layout: 'left' }, { type: 'keyboard', layout: 'right' }];
    const cars: CarKind[] = ['dino', 'kart', 'dino', 'kart'];
    const settings: Settings = {
      ...base,
      map: isRaceMap(map) ? map : base.map,
      players: Array.from({ length: count }, (_, i) => {
        const saved = base.players[i] ?? (i === 1 ? savedSecondPlayer() : undefined);
        return {
          ...saved,
          device: count > 2 ? (i < 2 ? kb[i] : pads[i - 2] ?? { type: 'gamepad', index: 100 + i }) : pads[i] ?? kb[i],
          difficulty: saved?.difficulty ?? 'normal',
          car: saved?.car ?? cars[i],
        };
      }),
    };
    this.registry.set(REG.settings, settings);
    services.input.reset();
    settings.players.forEach((p, i) => services.input.assign(i as PlayerId, p.device));
    const previewMap = import.meta.env.DEV || import.meta.env.VITE_QA_QUICK_MAPS === '1'
      ? (isRaceMap(map) ? map : undefined) : undefined;
    this.scene.start(SCENE.race, { previewMap });
  }
}
