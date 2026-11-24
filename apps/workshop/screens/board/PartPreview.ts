/** Interactive focus/highlight layer over the workshop's existing composed side-view rig: zoom, name label, cycle arrows. */
import Phaser from 'phaser';
import { WS_PARTVIEW } from '../../config';
import type { AspectDef, AspectId, Model, Variant } from '../../core/types';
import type { ModelRig } from '../../core/runtime';
import { makeText, ringTexture, roundedOriginY, roundedTexture } from '../../ui/style';
import type { PartPreviewLayout } from './layout';
import { partWalkOrder, stepPart } from './partWalk';

export interface PartPreviewOptions {
  layout: PartPreviewLayout;
  model: Model;
  variants: readonly Variant[];
  /** A touch tap selected a part or an arrow: the screen enters part mode (and plays its sound). */
  onTap?: (kind: 'part' | 'arrow') => void;
}

interface Box { cx: number; cy: number; w: number; h: number }

/** The same symmetric easing runs the focus tween in either direction. */
const partZoomEase = (v: number): number => Phaser.Math.Easing.Sine.InOut(v);

export class PartPreview {
  private readonly order: AspectId[];
  private readonly darkRing: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly labelBg: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly arrows: { prev: Phaser.GameObjects.Image; next: Phaser.GameObjects.Image };
  private readonly rest: { x: number; y: number; s: number; vehicle: Box };
  private restBox: Box | undefined;
  private zoomTween: Phaser.Tweens.Tween | undefined;
  private targetScale = 1;
  private selected: AspectId | undefined;
  private dead = false;
  private readonly listeners = new Map<Phaser.GameObjects.Image, { down: (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Event) => void }>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rig: ModelRig,
    private readonly aspects: readonly AspectDef[],
    private readonly options: PartPreviewOptions,
  ) {
    this.order = partWalkOrder(aspects.map((a) => a.id));
    const P = options.layout;

    const scale = Math.min(P.maxW / Math.max(1, rig.width), P.maxH / Math.max(1, rig.height));
    rig.root.setPosition(P.x, P.y).setScale(scale).setDepth(-200);
    rig.play('idle');
    const vb = rig.root.getBounds();
    this.rest = { x: P.x, y: P.y, s: scale, vehicle: { cx: vb.centerX, cy: vb.centerY, w: vb.width, h: vb.height } };
    this.targetScale = scale;
    // Clip the zoomed vehicle to its viewport (the mask shape is a never-rendered Graphics, drawn once).
    const maskShape = scene.make.graphics({}, false);
    maskShape.fillStyle(0xffffff, 1).fillRect(P.view.x - P.view.w / 2, P.view.y - P.view.h / 2, P.view.w, P.view.h);
    rig.root.setMask(maskShape.createGeometryMask());

    this.darkRing = scene.add.image(0, 0, ringTexture(scene, 80, 80, 0x17172e, 24, 30)).setDepth(200);
    this.ring = scene.add.image(0, 0, ringTexture(scene, 80, 80, 0xffd23f, 10, 30)).setDepth(201);
    const labelH = 58;
    this.labelBg = scene.add.image(P.labelX, P.labelY,
      roundedTexture(scene, P.labelW, labelH, 0x22223f, { radius: 18, shadow: 4, stroke: 0xffffff, strokeW: 3, gloss: false }))
      .setOrigin(0.5, roundedOriginY(labelH, 4)).setDepth(201);
    this.label = makeText(scene, P.labelX, P.labelY, '', { size: 40, wrap: P.labelW - 24, color: 0xffffff, stroke: 0x22223f, strokeW: 5 });
    this.label.setDepth(202);

    const mkArrow = (spec: { x: number; y: number; angle: number }, delta: -1 | 1) => {
      const img = scene.add.image(spec.x, spec.y, arrowTexture(scene, WS_PARTVIEW.arrowSize)).setAngle(spec.angle).setDepth(203)
        .setInteractive({ useHandCursor: true }).setVisible(false).setAlpha(0.9);
      img.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Event) => {
        event.stopPropagation();
        this.options.onTap?.('arrow');
        this.step(delta);
      });
      return img;
    };
    this.arrows = { prev: mkArrow(P.arrows.prev, -1), next: mkArrow(P.arrows.next, 1) };

    // A rig may intentionally share an image between semantic aspects. Install one handler per image and choose the
    // most recognizable station once, instead of stacking handlers whose last callback wins or leaking listeners.
    const owners = new Map<Phaser.GameObjects.Image, AspectId[]>();
    for (const id of this.order) for (const part of rig.parts[id] ?? []) {
      if (!(part instanceof Phaser.GameObjects.Image)) continue;
      owners.set(part, [...(owners.get(part) ?? []), id]);
    }
    for (const [part, ids] of owners) {
      const id = [...ids].sort((a, b) => this.hitPriority(a) - this.hitPriority(b))[0];
      // No hover select: the zoom moves parts under a resting mouse pointer, which would flip the selection back and forth.
      const down = (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Event) => {
        this.options.onTap?.('part');
        this.select(id);
        event.stopPropagation();
      };
      part.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 12 });
      part.on('pointerdown', down);
      this.listeners.set(part, { down });
    }
    this.clear();
  }

  /** Hides the highlight, the name and the arrows, and zooms back out to the whole vehicle. */
  clear(): void {
    this.selected = undefined;
    this.labelBg.setVisible(false); this.label.setVisible(false);
    this.zoomTo(this.rest.x, this.rest.y, this.rest.s, true);
    this.arrows.prev.setVisible(false); this.arrows.next.setVisible(false);
  }

  /** Enters part selection on the first component. */
  showFirst(): void { if (this.order.length > 0) this.select(this.order[0]); }

  /** Step through catalog aspects without taking keyboard focus from board controls. */
  step(delta: -1 | 1): void {
    const next = stepPart(this.selected, this.order, delta);
    if (!next) return;
    this.pulse(delta === 1 ? this.arrows.next : this.arrows.prev);
    this.select(next);
  }

  private select(id: AspectId): void {
    if (this.dead || !this.order.includes(id)) return;
    this.selected = id;
    this.arrows.prev.setVisible(true); this.arrows.next.setVisible(true);
    const V = this.options.layout.view;
    const { x: x0, y: y0, s: s0 } = this.rest;
    // Centre on the rig's own focus point for the part (sprites carry transparent padding, so image bounds are only
    // used for the ring size) and zoom by its hint.
    const f = this.rig.focus(id);
    const z = Math.max(1, Math.min(WS_PARTVIEW.zoomMax, f.zoom));
    const bb = this.restBounds(id);
    const box: Box = { cx: x0 + f.x * s0, cy: y0 + f.y * s0, w: Math.min(bb.w, (V.w * WS_PARTVIEW.fill) / z), h: Math.min(bb.h, (V.h * WS_PARTVIEW.fill) / z) };
    const pad = 24;
    const w = Math.max(50, Math.ceil(box.w * z + pad * 2));
    const h = Math.max(50, Math.ceil(box.h * z + pad * 2));
    const radius = Math.min(30, h / 3, w / 3);
    this.darkRing.setTexture(ringTexture(this.scene, w, h, 0x17172e, 24, radius)).setVisible(true);
    this.ring.setTexture(ringTexture(this.scene, w, h, 0xffd23f, 10, radius)).setVisible(true);
    for (const highlight of [this.darkRing, this.ring, this.labelBg, this.label]) highlight.setAlpha(1);
    this.restBox = box;
    this.targetScale = s0 * z;
    this.zoomTo(V.x - (box.cx - x0) * z, V.y - (box.cy - y0) * z, this.targetScale);

    const aspect = this.aspects.find((a) => a.id === id);
    const variantId = this.options.model[id];
    const name = this.options.variants.find((v) => v.id === variantId)?.name ?? variantId;
    this.label.setVisible(true);
    this.labelBg.setVisible(true);
    this.label.setText(`${aspect?.label ?? id}: ${name}`);
    const labelH = Math.min(106, Math.max(58, Math.ceil(this.label.height + 16)));
    this.labelBg.setTexture(roundedTexture(this.scene, this.options.layout.labelW, labelH, 0x22223f,
      { radius: 18, shadow: 4, stroke: 0xffffff, strokeW: 3, gloss: false }))
      .setOrigin(0.5, roundedOriginY(labelH, 4));
  }

  /** Animate the vehicle to a root transform; the rings follow the selected part (textures are sized for the end state). */
  private zoomTo(x: number, y: number, s: number, reverse = false): void {
    this.zoomTween?.stop();
    const root = this.rig.root;
    const from = { x: root.x, y: root.y, s: root.scaleX };
    if (Math.abs(from.x - x) < 0.001 && Math.abs(from.y - y) < 0.001 && Math.abs(from.s - s) < 0.001) {
      if (reverse) {
        this.restBox = undefined;
        this.darkRing.setVisible(false); this.ring.setVisible(false);
      }
      return;
    }
    const t = { v: 0 };
    this.zoomTween = this.scene.tweens.add({
      targets: t, v: 1, duration: WS_PARTVIEW.zoomMs,
      ease: partZoomEase,
      onUpdate: () => {
        root.setPosition(from.x + (x - from.x) * t.v, from.y + (y - from.y) * t.v).setScale(from.s + (s - from.s) * t.v);
        if (reverse) {
          const alpha = 1 - t.v;
          this.darkRing.setAlpha(alpha); this.ring.setAlpha(alpha);
        }
        this.placeRings();
      },
      onComplete: () => {
        if (!reverse) return;
        this.restBox = undefined;
        this.darkRing.setVisible(false).setAlpha(1); this.ring.setVisible(false).setAlpha(1);
      },
    });
  }

  private placeRings(): void {
    const b = this.restBox;
    if (!b) return;
    const root = this.rig.root;
    const k = root.scaleX / this.rest.s;
    const x = root.x + (b.cx - this.rest.x) * k, y = root.y + (b.cy - this.rest.y) * k;
    const ringScale = root.scaleX / this.targetScale;
    for (const r of [this.darkRing, this.ring]) r.setPosition(x, y).setScale(ringScale);
  }

  /** Quick scale/brightness pulse on a cycle arrow. */
  private pulse(img: Phaser.GameObjects.Image): void {
    this.scene.tweens.killTweensOf(img);
    img.setScale(1).setAlpha(0.9);
    this.scene.tweens.add({ targets: img, scale: WS_PARTVIEW.pulseScale, alpha: 1, duration: WS_PARTVIEW.pulseMs / 2, yoyo: true, ease: 'Quad.easeOut' });
  }

  private hitPriority(id: AspectId): number {
    if (/wheel|tire/.test(id)) return 0;
    if (/head|face/.test(id)) return 1;
    if (/body|shape|torso/.test(id)) return 2;
    if (/engine|gear/.test(id)) return 3;
    if (/tail|teeth|horn/.test(id)) return 4;
    return 10;
  }

  /** The part's bounds mapped to the vehicle's rest (unzoomed) transform; the whole vehicle if it has no image parts. */
  private restBounds(id: AspectId): Box {
    const parts = this.rig.parts[id] ?? [];
    const bounds = parts.filter((p): p is Phaser.GameObjects.Image => p instanceof Phaser.GameObjects.Image)
      .map((p) => p.getBounds()).filter((b) => b.width > 0 && b.height > 0);
    if (bounds.length === 0) return this.rest.vehicle;
    const left = Math.min(...bounds.map((b) => b.left));
    const top = Math.min(...bounds.map((b) => b.top));
    const right = Math.max(...bounds.map((b) => b.right));
    const bottom = Math.max(...bounds.map((b) => b.bottom));
    const root = this.rig.root;
    const k = this.rest.s / root.scaleX;
    const map = (x: number, y: number) => ({ x: this.rest.x + (x - root.x) * k, y: this.rest.y + (y - root.y) * k });
    const a = map(left, top), b = map(right, bottom);
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, w: b.x - a.x, h: b.y - a.y };
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.zoomTween?.stop();
    for (const [part, listeners] of this.listeners) {
      part.off('pointerdown', listeners.down);
      part.disableInteractive();
    }
    this.listeners.clear();
    this.scene.tweens.killTweensOf([this.arrows.prev, this.arrows.next]);
    this.rig.root.clearMask(true);
    this.arrows.prev.destroy(); this.arrows.next.destroy();
    this.darkRing.destroy(); this.ring.destroy(); this.labelBg.destroy(); this.label.destroy();
  }
}

/** Baked rounded button with an up-pointing triangle (rotate for other directions). */
function arrowTexture(scene: Phaser.Scene, size: number): string {
  const key = `ws:partArrow:${size}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  g.fillStyle(0xffd23f, 1).fillRoundedRect(3, 3, size - 6, size - 6, size / 4);
  g.lineStyle(6, 0x1b1b3a, 1).strokeRoundedRect(3, 3, size - 6, size - 6, size / 4);
  g.fillStyle(0x1b1b3a, 1).fillTriangle(size / 2, size * 0.24, size * 0.76, size * 0.68, size * 0.24, size * 0.68);
  g.generateTexture(key, size, size);
  g.destroy();
  return key;
}
