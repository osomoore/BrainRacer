/**
 * Art review sheet. `workshop.html?dev=WorkshopParts[&workshop=dino][&aspect=teeth][&page=random|beaks][&seed=3]`
 * Keys: Left/Right = aspect, Up/Down or 1/2 = workshop, R = random combos page / reseed, A = aspect page.
 * Every variant of the aspect is drawn on the default model, side view on top and top view below.
 */
import Phaser from 'phaser';
import { buildRig } from '../art';
import { BEAK_LOOKS } from '../art/dino/looks';
import { DinoRig } from '../art/dino/rig';
import { CATALOGS } from '../content';
import type { ModelRig } from '../core/runtime';
import { Rng } from '../core/rng';
import type { Model, WorkshopId } from '../core/types';

export default class WorkshopParts extends Phaser.Scene {
  private workshop: WorkshopId = 'race';
  private aspectIdx = 0;
  private random = false;
  private beaks = false;
  private seed = 1;
  private rigs: ModelRig[] = [];
  private annotations: Phaser.GameObjects.GameObject[] = [];

  constructor() { super('WorkshopParts'); }

  create(): void {
    const q = new URLSearchParams(location.search);
    if (q.get('workshop') === 'dino') this.workshop = 'dino';
    const cat = CATALOGS[this.workshop];
    const ai = cat.aspects.findIndex((a) => a.id === q.get('aspect'));
    if (ai >= 0) this.aspectIdx = ai;
    this.random = q.get('page') === 'random';
    this.beaks = this.workshop === 'dino' && q.get('page') === 'beaks';
    this.seed = Number(q.get('seed') ?? 1) || 1;
    const k = this.input.keyboard!;
    k.on('keydown-RIGHT', () => this.step(1));
    k.on('keydown-LEFT', () => this.step(-1));
    k.on('keydown-UP', () => this.setWorkshop('race'));
    k.on('keydown-DOWN', () => this.setWorkshop('dino'));
    k.on('keydown-ONE', () => this.setWorkshop('race'));
    k.on('keydown-TWO', () => this.setWorkshop('dino'));
    k.on('keydown-R', () => { this.beaks = false; this.random = true; this.seed++; this.draw(); });
    k.on('keydown-A', () => { this.beaks = false; this.random = false; this.draw(); });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.step(p.x > 960 ? 1 : -1));
    this.draw();
  }

  private setWorkshop(w: WorkshopId): void { this.workshop = w; this.aspectIdx = 0; this.random = false; this.beaks = false; this.draw(); }
  private step(d: number): void {
    const n = CATALOGS[this.workshop].aspects.length;
    this.aspectIdx = (this.aspectIdx + d + n) % n;
    this.random = false;
    this.beaks = false;
    this.draw();
  }

  private clear(): void {
    for (const r of this.rigs) r.destroy();
    for (const annotation of this.annotations) annotation.destroy();
    this.rigs = []; this.annotations = [];
  }

  private label(x: number, y: number, s: string, size = 34, wrap = 0): void {
    this.annotations.push(this.add.text(x, y, s, { fontSize: `${size}px`, wordWrap: wrap ? { width: wrap } : undefined, color: '#1b1b3a', fontStyle: 'bold', backgroundColor: '#ffffffcc', padding: { x: 8, y: 2 } }).setOrigin(0.5, 0));
  }

  private fit(rig: ModelRig, w: number, h: number): number {
    return Math.min(1.2, (w - 24) / Math.max(1, rig.width), (h - 8) / Math.max(1, rig.height));
  }

  /** Scale a rig to fit a cell; side view: ground at the bottom of the cell, top view: centred. */
  private place(rig: ModelRig, cx: number, cy: number, w: number, h: number, s = this.fit(rig, w, h)): void {
    rig.root.setScale(s);
    rig.root.setPosition(cx, rig.view === 'side' ? cy + h - 4 : cy + h / 2);
  }

  private draw(): void {
    this.clear();
    const cat = CATALOGS[this.workshop];
    const base: Model = Object.fromEntries(cat.aspects.map((a) => [a.id, a.starters[0]]));
    if (this.beaks) {
      const model = { ...base, teeth: 'teeth.beak' };
      this.label(960, 10, 'Dino Lab / Beak profiles', 40);
      this.drawRow(BEAK_LOOKS.map((look) => ({
        name: look.name,
        side: new DinoRig(this, model, 'side', look),
        top: new DinoRig(this, model, 'top', look),
      })), true);
      return;
    }
    if (this.random) {
      this.label(960, 10, `${cat.title}: random combos (seed ${this.seed}, R = new)`, 40);
      const rng = new Rng(this.seed * 7919);
      const cols = 3, cw = 1920 / cols, ch = 500;
      for (let i = 0; i < 6; i++) {
        const m: Model = {};
        for (const a of cat.aspects) { const vs = cat.variants.filter((v) => v.aspect === a.id); m[a.id] = vs[rng.int(0, vs.length - 1)].id; }
        const cx = cw * (i % cols) + cw / 2, y0 = 70 + Math.floor(i / cols) * (ch + 10);
        const side = buildRig(this, this.workshop, m, 'side'); this.place(side, cx, y0, cw, ch * 0.56);
        const top = buildRig(this, this.workshop, m, 'top'); this.place(top, cx, y0 + ch * 0.58, cw, ch * 0.3);
        this.rigs.push(side, top);
        this.label(cx, y0 + ch - 30, Object.values(m).map((v) => v.split('.')[1]).join(' '), 18, cw - 40);
      }
      return;
    }
    const aspect = cat.aspects[this.aspectIdx];
    const vars = cat.variants.filter((v) => v.aspect === aspect.id);
    const compareSizes = this.workshop === 'dino' && aspect.id === 'size';
    this.label(960, 10, compareSizes
      ? `${cat.title} / Size · same scale · Medium is the reference`
      : `${cat.title} / ${aspect.label}   (arrows = aspect, 1/2 = workshop, R = random)`, 40);
    this.drawRow(vars.map((v) => {
      const m = { ...base, [aspect.id]: v.id };
      return {
        name: v.name,
        side: buildRig(this, this.workshop, m, 'side'),
        top: buildRig(this, this.workshop, m, 'top'),
      };
    }), compareSizes, compareSizes);
  }

  private drawRow(items: { name: string; side: ModelRig; top: ModelRig }[], sharedScale: boolean, baseline = false): void {
    const cw = 1920 / Math.max(items.length, 3);
    const scale = sharedScale
      ? Math.min(...items.flatMap(({ side, top }) => [this.fit(side, cw, 440), this.fit(top, cw, 400)]))
      : undefined;
    if (baseline) this.annotations.push(this.add.rectangle(960, 506, 1920, 2, 0x1b1b3a, 0.38).setDepth(-1));
    items.forEach(({ name, side, top }, i) => {
      const cx = cw * i + cw / 2;
      this.place(side, cx, 70, cw, 440, scale);
      this.place(top, cx, 580, cw, 400, scale);
      this.rigs.push(side, top);
      this.label(cx, 520, name, 36);
    });
  }
}
