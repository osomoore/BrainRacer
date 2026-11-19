import Phaser from 'phaser';
import { createAudio } from '../../audio';
import type { IAudio, IEngineSound } from '../../core/services';
import type { MusicTrack, SfxName } from '../../core/types';

const SFX: SfxName[] = [
  'correct', 'wrong', 'timeout', 'turbo', 'crash', 'crashBig', 'skid', 'siren', 'policeBump', 'jump', 'land', 'goal',
  'goalArrive', 'countdown', 'go', 'roar', 'stomp', 'squash', 'shockwave', 'pop', 'menuMove', 'menuSelect', 'join',
];
const SFX_KEYS = '1234567890qwertyuiopasd'.split('');
const TRACKS: { name: MusicTrack; key: string }[] = [
  { name: 'title', key: 'z' }, { name: 'race', key: 'x' }, { name: 'dino', key: 'c' }, { name: 'results', key: 'v' },
];
const FONT = 'Arial, sans-serif';

export default class AudioTest extends Phaser.Scene {
  private audio!: IAudio;
  private engine: IEngineSound | null = null;
  private speed = 0.4;
  private boost = false;
  private music = 0.7;
  private sfxVol = 0.8;
  private status!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private sliderKnob!: Phaser.GameObjects.Rectangle;
  private stopSiren: (() => void) | null = null;
  private stopSkid: (() => void) | null = null;
  private readonly SL_X = 200;
  private readonly SL_W = 800;
  private readonly SL_Y = 900;
  private readonly unlockHandler = (): void => { void this.doUnlock(); };

  constructor() { super('AudioTest'); }

  create(): void {
    this.audio = createAudio();
    this.audio.setVolumes(this.music, this.sfxVol);
    this.cameras.main.setBackgroundColor('#14203a');
    this.add.text(60, 30, 'Audio test', { fontFamily: FONT, fontSize: '56px', color: '#ffd23f', fontStyle: 'bold' });
    this.status = this.add.text(560, 40, '', { fontFamily: FONT, fontSize: '40px', color: '#ff8080' });
    this.add.text(60, 110, 'Click or press any key to unlock audio. SFX (click or hotkey):', { fontFamily: FONT, fontSize: '32px', color: '#cfe3ff' });

    SFX.forEach((name, i) => {
      const col = Math.floor(i / 8);
      const row = i % 8;
      this.button(60 + col * 610, 170 + row * 70, `[${SFX_KEYS[i].toUpperCase()}] ${name}`, () => this.playSfx(i), 580);
    });

    this.add.text(60, 760, 'Music:', { fontFamily: FONT, fontSize: '36px', color: '#cfe3ff' });
    TRACKS.forEach((t, i) => this.button(220 + i * 330, 750, `[${t.key.toUpperCase()}] ${t.name}`, () => this.audio.music(t.name), 300));
    this.button(1560, 750, '[M] stop', () => this.audio.music(null), 300);

    this.add.text(60, 840, 'Engine speed (drag, or Left/Right):', { fontFamily: FONT, fontSize: '36px', color: '#cfe3ff' });
    this.add.rectangle(this.SL_X, this.SL_Y, this.SL_W, 10, 0x6a7fa8).setOrigin(0, 0.5);
    this.sliderKnob = this.add.rectangle(this.SL_X, this.SL_Y, 28, 56, 0xffd23f).setInteractive({ draggable: true, useHandCursor: true });
    const track = this.add.rectangle(this.SL_X, this.SL_Y, this.SL_W, 60, 0x000000, 0.001).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    const setFromPointer = (p: Phaser.Input.Pointer): void => { this.speed = Phaser.Math.Clamp((p.x - this.SL_X) / this.SL_W, 0, 1); };
    track.on('pointerdown', setFromPointer);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.isDown && Math.abs(p.y - this.SL_Y) < 60) setFromPointer(p); });
    this.button(1100, 870, '[B] boost: off', () => { this.boost = !this.boost; }, 360, 'boost');
    this.button(1500, 870, 'siren loop', () => this.toggleSiren(), 300);
    this.button(1500, 940, 'skid loop', () => this.toggleSkid(), 300);

    this.button(60, 960, 'music -', () => this.setVol(-0.1, 0), 200);
    this.button(280, 960, 'music +', () => this.setVol(0.1, 0), 200);
    this.button(500, 960, 'sfx -', () => this.setVol(0, -0.1), 200);
    this.button(720, 960, 'sfx +', () => this.setVol(0, 0.1), 200);
    this.info = this.add.text(960, 965, '', { fontFamily: FONT, fontSize: '34px', color: '#ffffff' });

    // DOM listeners satisfy the browser's user-gesture rule for Tone.start().
    window.addEventListener('pointerdown', this.unlockHandler);
    window.addEventListener('keydown', this.unlockHandler);
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
    this.refreshText();
  }

  private boostLabel?: Phaser.GameObjects.Text;

  private button(x: number, y: number, label: string, onClick: () => void, w: number, tag?: string): void {
    const bg = this.add.rectangle(x, y, w, 56, 0x2b4a86).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    const txt = this.add.text(x + 14, y + 8, label, { fontFamily: FONT, fontSize: '36px', color: '#ffffff' });
    if (tag === 'boost') this.boostLabel = txt;
    bg.on('pointerover', () => bg.setFillStyle(0x3d66b8));
    bg.on('pointerout', () => bg.setFillStyle(0x2b4a86));
    bg.on('pointerdown', () => { void this.doUnlock().then(onClick); });
  }

  private async doUnlock(): Promise<void> {
    await this.audio.unlock();
    if (this.audio.unlocked && !this.engine) this.engine = this.audio.engine(0);
    this.refreshText();
  }

  private playSfx(i: number): void {
    const name = SFX[i];
    const pan = (i % 3 - 1) * 0.6;
    this.audio.sfx(name, { pan });
  }

  private toggleSiren(): void {
    if (this.stopSiren) { this.stopSiren(); this.stopSiren = null; } else this.stopSiren = this.audio.loop('siren');
  }
  private toggleSkid(): void {
    if (this.stopSkid) { this.stopSkid(); this.stopSkid = null; } else this.stopSkid = this.audio.loop('skid');
  }

  private setVol(dm: number, ds: number): void {
    this.music = Phaser.Math.Clamp(this.music + dm, 0, 1);
    this.sfxVol = Phaser.Math.Clamp(this.sfxVol + ds, 0, 1);
    this.audio.setVolumes(this.music, this.sfxVol);
    this.refreshText();
  }

  private onKey(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    const sfxIdx = SFX_KEYS.indexOf(k);
    if (sfxIdx >= 0 && sfxIdx < SFX.length) this.playSfx(sfxIdx);
    const tr = TRACKS.find((t) => t.key === k);
    if (tr) this.audio.music(tr.name);
    if (k === 'm') this.audio.music(null);
    if (k === 'b') this.boost = !this.boost;
    if (k === 'arrowleft') this.speed = Math.max(0, this.speed - 0.05);
    if (k === 'arrowright') this.speed = Math.min(1, this.speed + 0.05);
  }

  update(): void {
    this.sliderKnob.x = this.SL_X + this.speed * this.SL_W;
    this.engine?.set(this.speed, this.boost);
    this.boostLabel?.setText(`[B] boost: ${this.boost ? 'ON' : 'off'}`);
    this.refreshText();
  }

  private refreshText(): void {
    this.status.setText(this.audio.unlocked ? 'audio unlocked' : 'LOCKED - click or press a key');
    this.status.setColor(this.audio.unlocked ? '#7dff9a' : '#ff8080');
    this.info.setText(`speed ${this.speed.toFixed(2)}  music ${this.music.toFixed(1)}  sfx ${this.sfxVol.toFixed(1)}`);
  }

  private cleanup(): void {
    window.removeEventListener('pointerdown', this.unlockHandler);
    window.removeEventListener('keydown', this.unlockHandler);
    this.stopSiren?.();
    this.stopSkid?.();
    this.engine?.stop();
    this.engine = null;
    this.audio.music(null, 0.2);
  }
}
