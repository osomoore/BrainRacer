/**
 * Art review sheet. `workshop.html?dev=WorkshopParts[&workshop=dino][&aspect=teeth][&page=random|beaks][&seed=3]`
 * Keys: Left/Right = aspect, Up/Down or 1/2 = workshop, R = random combos page / reseed, A = aspect page.
 * Every variant of the aspect is drawn on the default model, side view on top and top view below.
 */
import Phaser from 'phaser';
import { buildDetail, buildRig } from '../art';
import { WS_ART } from '../config';
import { BEAK_LOOKS } from '../art/dino/looks';
import { DinoRig } from '../art/dino/rig';
import { CATALOGS } from '../content';
import type { ModelRig } from '../core/runtime';
import { Rng } from '../core/rng';
import type { Model, WorkshopId } from '../core/types';

interface RowItem {
  name: string; side: ModelRig; top: ModelRig;
  /** Replaces the rig drawing in that cell (the rig is still built, but hidden). */
  sideDetail?: Phaser.GameObjects.Container | null;
  topDetail?: Phaser.GameObjects.Container | null;
}

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
    const compareSizes = aspect.id === 'size';
    this.label(960, 10, compareSizes
      ? `${cat.title} / Size · same scale`
      : `${cat.title} / ${aspect.label}   (arrows = aspect, 1/2 = workshop, R = random)`, 40);
    const gears = this.workshop === 'race' && aspect.id === 'gears';
    const springs = this.workshop === 'race' && aspect.id === 'springs';
    this.drawRow(vars.map((v) => {
      const m = { ...base, [aspect.id]: v.id };
      const item: RowItem = {
        name: v.name,
        side: buildRig(this, this.workshop, m, 'side'),
        top: buildRig(this, this.workshop, m, 'top'),
      };
      // Gears: the game's hood-open view in both cells. Springs: fade the body so they show.
      if (gears) { item.sideDetail = buildDetail(this, this.workshop, m, 'gears'); item.topDetail = buildDetail(this, this.workshop, m, 'gears'); }
      if (springs) {
        item.side.parts.size.forEach((o) => (o as Phaser.GameObjects.Container).setAlpha(WS_ART.reviewSpringsBodyAlpha));
        item.side.parts.wheels.forEach((o) => (o as Phaser.GameObjects.Image).setAlpha(WS_ART.reviewSpringsWheelAlpha));
      }
      return item;
    }), compareSizes, compareSizes);
  }

  private drawRow(items: RowItem[], sharedScale: boolean, sizes = false): void {
    const cw = 1920 / Math.max(items.length, 3);
    const modelW = cw - (sizes ? 56 : 0);
    const scale = sharedScale
      ? Math.min(...items.flatMap(({ side, top }) => [this.fit(side, modelW, 440), this.fit(top, modelW, 400)]))
      : undefined;
    if (sizes) this.annotations.push(this.add.rectangle(960, 506, 1920, 2, 0x1b1b3a, 0.38).setDepth(-1));
    items.forEach(({ name, side, top, sideDetail, topDetail }, i) => {
      const cx = cw * i + cw / 2;
      const comparisonScale = sizes ? (scale ?? 1) : 0;
      const modelX = cx - (sizes ? 28 : 0);
      this.place(side, modelX - side.root.getBounds().centerX * comparisonScale, 70, modelW, 440, scale);
      this.place(top, modelX - top.root.getBounds().centerX * comparisonScale, 580, modelW, 400, scale);
      if (sizes) this.drawCone(cx + cw / 2 - 32, comparisonScale * 1.35);
      this.rigs.push(side, top);
      for (const [rig, detail, cy, h] of [[side, sideDetail, 70, 440], [top, topDetail, 580, 400]] as const) {
        if (!detail) continue;
        rig.root.setVisible(false);
        const b = detail.getBounds();
        const s = Math.min(2, (modelW - 24) / b.width, (h - 8) / b.height);
        detail.setScale(s).setPosition(cx - (b.centerX - detail.x) * s, cy + h / 2 - (b.centerY - detail.y) * s);
        this.annotations.push(detail);
      }
      this.label(cx, 520, name, 36);
    });
  }

  /** The same traffic cone sits beside every model, at the same design scale. */
  private drawCone(x: number, scale: number): void {
    const ink = 0x1b1b3a, orange = 0xff9130, white = 0xfff3dc;
    const side = this.add.container(x, 506).setScale(scale);
    side.add([
      this.add.triangle(0, -38, 0, 65, 18, 0, 36, 65, orange).setStrokeStyle(3, ink),
      this.add.rectangle(0, -34, 17, 9, white),
      this.add.rectangle(0, -4, 48, 8, orange).setStrokeStyle(3, ink),
    ]);
    const top = this.add.container(x, 780).setScale(scale);
    top.add([
      this.add.rectangle(0, 0, 48, 48, orange).setStrokeStyle(3, ink),
      this.add.circle(0, 0, 16, white).setStrokeStyle(2, ink),
      this.add.circle(0, 0, 8, orange),
    ]);
    this.annotations.push(side, top);
  }
}
