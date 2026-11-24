/** Interactive focus/highlight layer over the workshop's existing composed side-view rig. */
import Phaser from 'phaser';
import type { AspectDef, AspectId, Model, Variant } from '../../core/types';
import type { ModelRig } from '../../core/runtime';
import { makeText, ringTexture, roundedOriginY, roundedTexture } from '../../ui/style';
import { stepPart } from './partWalk';

export interface PartPreviewBounds { x: number; y: number; maxW: number; maxH: number }
export interface PartPreviewLabel { x: number; y: number; w: number }
export interface PartPreviewOptions {
  bounds: PartPreviewBounds;
  label: PartPreviewLabel;
  model: Model;
  variants: readonly Variant[];
}

export class PartPreview {
  private readonly order: AspectId[];
  private readonly darkRing: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly labelBg: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private selected: AspectId | undefined;
  private dead = false;
  private readonly listeners = new Map<Phaser.GameObjects.Image, { over: () => void; down: (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Event) => void }>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rig: ModelRig,
    private readonly aspects: readonly AspectDef[],
    private readonly options: PartPreviewOptions,
  ) {
    // Keep every station in the walk, including semantic aspects without a dedicated image (e.g. gears/None).
    this.order = aspects.map((a) => a.id);

    const scale = Math.min(options.bounds.maxW / Math.max(1, rig.width), options.bounds.maxH / Math.max(1, rig.height));
    rig.root.setPosition(options.bounds.x, options.bounds.y).setScale(scale).setDepth(-200);
    rig.play('idle');

    this.darkRing = scene.add.image(0, 0, ringTexture(scene, 80, 80, 0x17172e, 24, 30)).setDepth(200);
    this.ring = scene.add.image(0, 0, ringTexture(scene, 80, 80, 0xffd23f, 10, 30)).setDepth(201);
    const labelH = 58;
    this.labelBg = scene.add.image(options.label.x, options.label.y,
      roundedTexture(scene, options.label.w, labelH, 0x22223f, { radius: 18, shadow: 4, stroke: 0xffffff, strokeW: 3, gloss: false }))
      .setOrigin(0.5, roundedOriginY(labelH, 4)).setDepth(201);
    this.label = makeText(scene, options.label.x, options.label.y, '', { size: 40, wrap: options.label.w - 24, color: 0xffffff, stroke: 0x22223f, strokeW: 5 });
    this.label.setDepth(202);

    // A rig may intentionally share an image between semantic aspects. Install one handler per image and choose the
    // most recognizable station once, instead of stacking handlers whose last callback wins or leaking listeners.
    const owners = new Map<Phaser.GameObjects.Image, AspectId[]>();
    for (const id of this.order) for (const part of rig.parts[id] ?? []) {
      if (!(part instanceof Phaser.GameObjects.Image)) continue;
      owners.set(part, [...(owners.get(part) ?? []), id]);
    }
    for (const [part, ids] of owners) {
      const id = [...ids].sort((a, b) => this.hitPriority(a) - this.hitPriority(b))[0];
      const over = () => this.select(id);
      const down = (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Event) => { this.select(id); event.stopPropagation(); };
      part.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 12 });
      part.on('pointerover', over);
      part.on('pointerdown', down);
      this.listeners.set(part, { over, down });
    }
    if (this.order.length > 0) this.select(this.order[0]);
    else { this.darkRing.setVisible(false); this.ring.setVisible(false); this.labelBg.setVisible(false); this.label.setVisible(false); }
  }

  /** Step through catalog aspects without taking keyboard focus from board controls. */
  step(delta: -1 | 1): void {
    const next = stepPart(this.selected, this.order, delta);
    if (next) this.select(next);
  }

  private select(id: AspectId): void {
    if (this.dead || !this.order.includes(id)) return;
    this.selected = id;
    const bounds = this.partBounds(id);
    const pad = 24;
    const w = Math.max(50, Math.ceil(bounds.width + pad * 2));
    const h = Math.max(50, Math.ceil(bounds.height + pad * 2));
    const radius = Math.min(30, h / 3, w / 3);
    const position = { x: bounds.centerX, y: bounds.centerY };
    this.darkRing.setTexture(ringTexture(this.scene, w, h, 0x17172e, 24, radius)).setPosition(position.x, position.y).setVisible(true);
    this.ring.setTexture(ringTexture(this.scene, w, h, 0xffd23f, 10, radius)).setPosition(position.x, position.y).setVisible(true);

    const aspect = this.aspects.find((a) => a.id === id);
    const variantId = this.options.model[id];
    const name = this.options.variants.find((v) => v.id === variantId)?.name ?? variantId;
    this.label.setText(`${aspect?.label ?? id}: ${name}`);
    const labelH = Math.min(106, Math.max(58, Math.ceil(this.label.height + 16)));
    this.labelBg.setTexture(roundedTexture(this.scene, this.options.label.w, labelH, 0x22223f,
      { radius: 18, shadow: 4, stroke: 0xffffff, strokeW: 3, gloss: false }))
      .setOrigin(0.5, roundedOriginY(labelH, 4));
  }

  private hitPriority(id: AspectId): number {
    if (/wheel|tire/.test(id)) return 0;
    if (/head|face/.test(id)) return 1;
    if (/body|shape|torso/.test(id)) return 2;
    if (/engine|gear/.test(id)) return 3;
    if (/tail|teeth|horn/.test(id)) return 4;
    return 10;
  }

  private partBounds(id: AspectId): Phaser.Geom.Rectangle {
    const parts = this.rig.parts[id] ?? [];
    const bounds = parts.filter((p): p is Phaser.GameObjects.Image => p instanceof Phaser.GameObjects.Image)
      .map((p) => p.getBounds()).filter((b) => b.width > 0 && b.height > 0);
    if (bounds.length === 0) {
      const f = this.rig.focus(id);
      const scaleX = this.rig.root.scaleX;
      const scaleY = this.rig.root.scaleY;
      return new Phaser.Geom.Rectangle(this.rig.root.x + f.x * scaleX - 1, this.rig.root.y + f.y * scaleY - 1, 2, 2);
    }
    const left = Math.min(...bounds.map((b) => b.left));
    const top = Math.min(...bounds.map((b) => b.top));
    const right = Math.max(...bounds.map((b) => b.right));
    const bottom = Math.max(...bounds.map((b) => b.bottom));
    return new Phaser.Geom.Rectangle(left, top, right - left, bottom - top);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const [part, listeners] of this.listeners) {
      part.off('pointerover', listeners.over);
      part.off('pointerdown', listeners.down);
      part.disableInteractive();
    }
    this.listeners.clear();
    this.darkRing.destroy(); this.ring.destroy(); this.labelBg.destroy(); this.label.destroy();
  }
}
