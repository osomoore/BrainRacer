/**
 * Dino Lab scene kit, layer 4: cute cartoon creatures built from the baked pictures in art.ts.
 * Critter (beetle, frog, lizard: swap moods), Bird (flapping wing), Friend (waves), BigDino (the big goofy
 * sniffing dino: plods, sniffs, licks, sneezes, shrugs). All faces +x; use `box.scaleX = -1` to turn around.
 * Everything is added to `act.world` and animated with the Act's recorded tweens.
 */
import type Phaser from 'phaser';
import type { Act } from './act';
import { hasDef, image, swap } from './paint';
import type { Mood } from './art';

type Img = Phaser.GameObjects.Image;
type Cont = Phaser.GameObjects.Container;

// ------------------------------------------------------------------ Critter
export class Critter {
  readonly box: Cont;
  readonly body: Img;
  constructor(private a: Act, readonly kind: 'beetle' | 'frog' | 'lizard', x: number, y: number, scale: number, mood: Mood = 'happy') {
    this.box = a.scene.add.container(x, y);
    this.body = image(a.scene, `${kind}:${mood}`, 0, 0, scale);
    this.box.add(this.body);
    a.world.add(this.box);
  }
  mood(m: Mood): void { if (hasDef(`${this.kind}:${m}`)) swap(this.a.scene, this.body, `${this.kind}:${m}`); }
  /** Little idle bounce. Returns stop(). */
  bounce(h = 8, ms = 380): () => void {
    return this.a.loop({ targets: this.body, y: -h, duration: ms, yoyo: true, ease: 'Sine.easeInOut' });
  }
  /** Giggling wriggle: shake + squash. */
  async giggle(times = 6): Promise<void> {
    this.mood('giggle');
    await this.a.tw({ targets: this.body, angle: { from: -9, to: 9 }, scaleY: { from: this.body.scaleY, to: this.body.scaleY * 0.92 }, duration: 90, yoyo: true, repeat: times, onComplete: () => { this.body.angle = 0; } });
  }
  /** Hop along the ground to x in n little jumps, then stay. */
  async skipTo(x: number, ms: number, hops = 3, h = 50): Promise<void> {
    const x0 = this.box.x, dir = Math.sign(x - x0) || 1;
    this.box.scaleX = Math.abs(this.box.scaleX) * dir;
    this.a.go({ targets: this.box, x, duration: ms, ease: 'Linear' });
    for (let i = 0; i < hops; i++) {
      await this.a.tw({ targets: this.body, y: -h, duration: ms / hops / 2, ease: 'Quad.easeOut' });
      await this.a.tw({ targets: this.body, y: 0, duration: ms / hops / 2, ease: 'Quad.easeIn' });
    }
  }
}

// ------------------------------------------------------------------ Bird
export class Bird {
  readonly box: Cont;
  readonly body: Img;
  readonly wing: Img;
  private stopFlap: (() => void) | null = null;
  constructor(private a: Act, x: number, y: number, scale = 1, mood: 'happy' | 'laugh' | 'peck' = 'happy') {
    this.box = a.scene.add.container(x, y);
    this.body = image(a.scene, `bird:${mood}`, 0, 0, scale);
    this.wing = image(a.scene, 'birdWing', 0, -48 * scale, scale);
    this.box.add([this.body, this.wing]);
    a.world.add(this.box);
  }
  mood(m: 'happy' | 'laugh' | 'peck'): void { swap(this.a.scene, this.body, `bird:${m}`); }
  flap(ms = 130): void {
    this.stopFlap?.();
    this.wing.setOrigin(0.15, 0.5);
    this.stopFlap = this.a.loop({ targets: this.wing, angle: { from: 25, to: -75 }, duration: ms, yoyo: true });
  }
  rest(): void { this.stopFlap?.(); this.stopFlap = null; this.wing.angle = 10; }
}

// ------------------------------------------------------------------ Friend
export class Friend {
  readonly box: Cont;
  readonly im: Img;
  private frame = false;
  constructor(private a: Act, x: number, y: number, scale = 1, readonly variant: 'friend' | 'friend2' = 'friend') {
    this.box = a.scene.add.container(x, y);
    this.im = image(a.scene, `${variant}:a`, 0, 0, scale);
    this.box.add(this.im);
    a.world.add(this.box);
  }
  /** Wave an arm (frame swap). Returns stop(). */
  wave(ms = 260): () => void {
    const t = { v: 0 };
    return this.a.loop({ targets: t, v: 1, duration: ms, onRepeat: () => { this.frame = !this.frame; swap(this.a.scene, this.im, `${this.variant}:${this.frame ? 'b' : 'a'}`); } });
  }
  async cheer(h = 30, n = 3): Promise<void> {
    for (let i = 0; i < n; i++) {
      await this.a.tw({ targets: this.box, y: this.box.y - h, duration: 150, ease: 'Quad.easeOut' });
      await this.a.tw({ targets: this.box, y: this.box.y + h, duration: 150, ease: 'Quad.easeIn' });
    }
  }
}

// ------------------------------------------------------------------ the big goofy sniffing dino
export class BigDino {
  readonly box: Cont;
  private legs: Img[] = [];
  private body: Img;
  private head: Img;
    private stopPlod: (() => void) | null = null;
  /** Local position of the nose (for sniff/lick effects), in box coords at scale 1 (multiply by box scale). */
  readonly nose = { x: 330, y: -190 };
  constructor(private a: Act, x: number, y: number, scale = 1) {
    this.box = a.scene.add.container(x, y).setScale(scale);
    const mk = (key: string, px: number, py: number): Img => { const im = image(a.scene, key, px, py, 1); this.box.add(im); return im; };
    this.legs = [mk('bigLeg', 20, -134), mk('bigLeg', 140, -134)];
    this.body = mk('bigBody', 0, -92);
    this.head = mk('bigHead:normal', 120, -208);
    this.legs[0].setTint(0xc9b2ff);
    a.world.add(this.box);
  }
  setScale(s: number, dir = 1): void { this.box.setScale(s * dir, s); }
  setMood(m: 'normal' | 'sniff' | 'lick' | 'surprised' | 'sneeze' | 'shrug' | 'laugh'): void { swap(this.a.scene, this.head, `bigHead:${m}`); }
  get x(): number { return this.box.x; }
  /** World position of the nose tip. */
  nosePos(): { x: number; y: number } {
    const k = this.box.scaleX, ks = this.box.scaleY;
    return { x: this.box.x + this.nose.x * k, y: this.box.y + this.nose.y * ks };
  }
  /** Plodding legs + bob. */
  plod(on = true): void {
    this.stopPlod?.(); this.stopPlod = null;
    this.legs.forEach((l) => { l.angle = 0; });
    if (!on) return;
    const t = { v: 0 };
    const stops = [
      this.a.loop({ targets: this.legs[0], angle: { from: -22, to: 22 }, duration: 380, yoyo: true, ease: 'Sine.easeInOut' }),
      this.a.loop({ targets: this.legs[1], angle: { from: 22, to: -22 }, duration: 380, yoyo: true, ease: 'Sine.easeInOut' }),
      this.a.loop({ targets: this.body, y: -98, duration: 190, yoyo: true, ease: 'Sine.easeInOut' }),
      this.a.loop({ targets: this.head, y: -214, duration: 190, yoyo: true, ease: 'Sine.easeInOut' }),
    ];
    void t;
    this.stopPlod = () => stops.forEach((s) => s());
  }
  /** Head rotation (degrees), eased. */
  tilt(deg: number, ms = 300): Promise<void> { return this.a.tw({ targets: this.head, angle: deg, duration: ms, ease: 'Sine.easeInOut' }); }
  /** Walk to x (box facing follows), plodding. */
  async walkTo(x: number, ms: number): Promise<void> {
    const k = Math.abs(this.box.scaleX);
    this.box.scaleX = (x >= this.box.x ? 1 : -1) * k;
    this.plod(true);
    await this.a.tw({ targets: this.box, x, duration: ms, ease: 'Linear' });
    this.plod(false);
  }
  /** Nose-down sniffing wiggle. */
  async sniff(times = 3): Promise<void> {
    this.setMood('sniff');
    this.a.sfx('sniff');
    await this.tilt(26, 220);
    for (let i = 0; i < times; i++) { await this.tilt(34, 150); await this.tilt(22, 150); this.a.sfx('sniff', { rate: 1 + i * 0.1 }); }
  }
  destroyNow(): void { this.stopPlod?.(); this.box.destroy(); }
}

// ------------------------------------------------------------------ belly bulge (a gulped critter shows inside)
export class Bulge {
  readonly box: Cont;
  constructor(private a: Act, critterKey: string | null, size: number) {
    this.box = a.scene.add.container(0, 0).setScale(0).setVisible(false);
    this.box.add(image(a.scene, 'bulge', 0, 0, 1));
    if (critterKey) this.box.add(image(a.scene, critterKey, 0, 24, 0.34).setAlpha(0.9));
    this.box.setData('size', size);
    a.fore.add(this.box);
  }
  /** Balloon up at (x, y). */
  async inflate(x: number, y: number, size = 1): Promise<void> {
    this.box.setPosition(x, y).setVisible(true);
    await this.a.tw({ targets: this.box, scaleX: size * 1.25, scaleY: size * 1.25, duration: 220, ease: 'Back.easeOut' });
    await this.a.tw({ targets: this.box, scaleX: size, scaleY: size, duration: 140 });
  }
  async deflate(): Promise<void> {
    await this.a.tw({ targets: this.box, scaleX: 0, scaleY: 0, duration: 380, ease: 'Back.easeIn' });
    this.box.setVisible(false);
  }
  follow(o: { x: number; y: number }, dx = 0, dy = 0): void { this.box.setPosition(o.x + dx, o.y + dy); }
}
