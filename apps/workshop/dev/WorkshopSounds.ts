import Phaser from 'phaser';
import { WS_LOOP_SFX, WS_MUSIC_NAMES, WS_SFX_NAMES, WS_STING_NAMES, type WsAudioSfx } from '../audio/manifest';
import { createWorkshopAudio, playWorkshopSfx, preloadWorkshopAudio } from '../audio';
import type { WorkshopAudio } from '../core/runtime';

/** `workshop.html?dev=WorkshopSounds`: click a button (or press its key) to audition every music loop, sting and sfx. */
export default class WorkshopSounds extends Phaser.Scene {
  private audio!: WorkshopAudio;
  private status!: Phaser.GameObjects.Text;
  private readonly loops = new Map<string, () => void>();

  constructor() { super('WorkshopSounds'); }

  preload(): void { preloadWorkshopAudio(this); }

  create(): void {
    this.audio = createWorkshopAudio(this.game);
    this.add.text(40, 20, 'Workshop sounds (click or press the key; engine and spin toggle loops)', { fontFamily: 'Arial', fontSize: '34px', color: '#ffffff' });
    this.status = this.add.text(40, 1030, 'click anywhere first if the browser blocks audio', { fontFamily: 'Arial', fontSize: '28px', color: '#ffe08a' });
    const keys = '1234567890abcdefghijklmnopqrstuvwxyz'.split('');
    let ki = 0;
    const nextKey = (): string => keys[ki++] ?? '';

    let y = 80;
    const row = (label: string, items: { name: string; run: () => void }[]): void => {
      this.add.text(40, y, label, { fontFamily: 'Arial', fontSize: '30px', color: '#9ad1ff' });
      y += 44;
      const w = 170;
      const h = 60;
      const cols = Math.floor((1920 - 80) / (w + 10));
      items.forEach((it, i) => {
        const x = 40 + (i % cols) * (w + 10);
        const yy = y + Math.floor(i / cols) * (h + 10);
        const key = nextKey();
        const bg = this.add.rectangle(x, yy, w, h, 0x2b4a8a).setOrigin(0).setInteractive({ useHandCursor: true });
        this.add.text(x + w / 2, yy + h / 2, `${key ? `[${key}] ` : ''}${it.name}`, { fontFamily: 'Arial', fontSize: '26px', color: '#ffffff' }).setOrigin(0.5);
        bg.on('pointerdown', () => { bg.setFillStyle(0x4a7ae0); it.run(); });
        bg.on('pointerup', () => bg.setFillStyle(0x2b4a8a));
        bg.on('pointerout', () => bg.setFillStyle(0x2b4a8a));
        if (key) this.input.keyboard?.on(`keydown-${key.toUpperCase()}`, it.run);
      });
      y += Math.ceil(items.length / cols) * (h + 10) + 20;
    };

    row('Music (crossfades)', [
      ...WS_MUSIC_NAMES.map((n) => ({ name: n, run: () => { this.audio.music(n); this.status.setText(`music: ${n}`); } })),
      { name: 'silence', run: () => { this.audio.music(null); this.status.setText('music: none'); } },
    ]);
    row('Stings (duck the music)', WS_STING_NAMES.map((n) => ({ name: n, run: () => { this.audio.sting(n); this.status.setText(`sting: ${n}`); } })));
    row('Sfx', WS_SFX_NAMES.map((n) => ({ name: WS_LOOP_SFX.some((loop) => loop === n) ? `${n} (loop)` : n, run: () => this.trigger(n) })));
  }

  private trigger(n: WsAudioSfx): void {
    const loop = WS_LOOP_SFX.find((name) => name === n);
    if (loop) {
      const stop = this.loops.get(n);
      if (stop) { stop(); this.loops.delete(n); this.status.setText(`${n} loop: off`); return; }
      this.loops.set(n, this.audio.loop(loop));
      this.status.setText(`${n} loop: on`);
      return;
    }
    playWorkshopSfx(this.audio, n);
    this.status.setText(`sfx: ${n}`);
  }
}
