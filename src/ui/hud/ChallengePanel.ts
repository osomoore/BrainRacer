import Phaser from 'phaser';
import { CHALLENGE, GAME_WIDTH } from '../../config/gameConfig';
import { sceneTex, TEX } from '../../core/assetKeys';
import { services } from '../../core/services';
import type {
  AnswerSlot, Challenge, ChallengeOption, ChallengePrompt, ChallengeResult, ControllerFamily, InputDevice, Rect,
} from '../../core/types';
import { ANSWER_POSITIONS, keyboardAnswerLabel } from '../../input/buttonPrompts';
import { FaceButtonBadge } from '../menu/FaceButtonBadge';
import { bigText, FONT_BODY, FONT_HEAD, hexNum } from '../menu/style';
import { bakedImage, circle, glowRect, resizeRR, rrectImage, type RRectSpec } from './bake';
import { breakSplitRegion, challengeRegion, HUD } from './hudConfig';
import { easeInOut, easeOutBack, lerp } from './hudMath';

const CARD_W = 270, CARD_H = 160;
const D_CARD_W = 330, D_CARD_H = 150, D_GAP = 10;   // diamond (pause style) cards
const PROMPT_H = 190;
const DIVIDER_GAP = 48;   // space between question card and answers; holds the divider bar
const QUESTION_FILL = 0xfff1b8;
const BADGE_DY = CARD_H / 2 + 22;
const NAVY = HUD.colors.navy;

type Phase = 'show' | 'shrink' | 'docked';

interface Pose { x: number; y: number; s: number }

interface Cell {
  root: Phaser.GameObjects.Container;    // posed by the panel
  inner: Phaser.GameObjects.Container;   // animated by result effects
  card: Phaser.GameObjects.Image;
  content: Phaser.GameObjects.Container;
  hint: Phaser.GameObjects.Container;
  dock: Pose;
}

export interface PanelHooks {
  /** Called with screen coords when a correct answer's "+1" should fly to the score. */
  onCorrect(x: number, y: number): void;
  depth: number;
  /** Pause-style break: big, centered in the view, no timer; 4 options are laid out as a diamond. */
  centered?: boolean;
  controllerDevice?: InputDevice;
  /** 4-player quadrants: px of the view's inner side (towards the screen centre) kept free for the centre scoreboard. */
  innerInset?: number;
}

function fitImage(img: Phaser.GameObjects.Image, size: number) {
  const m = Math.max(img.width, img.height) || 1;
  img.setScale(size / m);
}

/** One player's challenge: appears large at the top of the view (shake + glow), shrinks to a docked strip, result feedback. */
export class ChallengePanel {
  finished = false;
  readonly root: Phaser.GameObjects.Container;
  private bg!: Phaser.GameObjects.Image;
  private header?: Phaser.GameObjects.Text;
  private promptRoot: Phaser.GameObjects.Container;
  private promptDock: Pose = { x: 0, y: 0, s: 1 };
  private cells: Cell[] = [];
  private promptW = 250;
  private glow: Phaser.GameObjects.NineSlice;
  private dockW = 0;
  private dockH = 0;
  private readonly diamond: boolean;
  private readonly centered: boolean;
  private readonly cardW: number;
  private readonly cardH: number;
  private readonly controllerFamily: ControllerFamily;

  private phase: Phase = 'show';
  private age = 0;
  private slideT = 0;       // 0 big .. 1 docked
  private resolved = false;
  private resolveAge = 0;
  private result: ChallengeResult | null = null;
  private hintShown = false;
  private fadeAlpha = 1;
  private view: Rect;
  private fxObjects: Phaser.GameObjects.GameObject[] = [];
  private extraTargets: object[] = [];

  constructor(
    private scene: Phaser.Scene, private color: string, readonly challenge: Challenge,
    view: Rect, private hooks: PanelHooks,
  ) {
    this.view = { ...view };
    this.diamond = challenge.options.length >= 4;
    this.centered = !!hooks.centered;
    this.cardW = this.diamond ? D_CARD_W : CARD_W;
    this.cardH = this.diamond ? D_CARD_H : CARD_H;
    this.controllerFamily = hooks.controllerDevice
      ? services.input.controllerFamily?.(hooks.controllerDevice) ?? 'other'
      : 'xbox';
    if (this.centered) this.phase = 'docked';
    this.root = scene.add.container(0, 0).setDepth(hooks.depth);
    this.glow = glowRect(scene, HUD.colors.gold, 0.16, 4, 10, 36, 0, 0, 100, 100).setVisible(false);
    this.root.add(this.glow);

    this.promptRoot = this.buildPrompt(challenge.prompt);
    this.root.add(this.promptRoot);
    challenge.options.forEach((o, i) => this.cells.push(this.buildCell(o, i as AnswerSlot)));
    if (this.centered) this.slideT = 0;
    if (challenge.source === 'place') {
      this.header = bigText(scene, 0, 0, '\u{1F4CD} Look!', 56, '#ffd43b', { font: FONT_BODY, stroke: 9 });
      this.root.add(this.header);
    }
    this.layoutPoses();
    this.drawBg();
    this.apply();
  }

  // ───────────────────────── building ─────────────────────────
  /** Baked card (rounded rect) of the given look. */
  private makeCard(w: number, h: number, fill: number, stroke: number, strokeW = 6, alpha = 0.97): Phaser.GameObjects.Image {
    const spec: RRectSpec = { r: 26, fill, fillA: alpha, stroke, strokeW };
    return rrectImage(this.scene, spec, 0, 0, w, h);
  }

  /** Swap a cell's card for another look (same slot in the display list). */
  private restyleCard(cell: Cell, fill: number, stroke: number, strokeW: number) {
    const old = cell.card;
    const next = this.makeCard(this.cardW, this.cardH, fill, stroke, strokeW);
    cell.inner.addAt(next, cell.inner.getIndex(old));
    old.destroy();
    cell.card = next;
  }

  private textFit(txt: string, size: number, maxW: number, maxH: number, minSize = 36): Phaser.GameObjects.Text {
    const t = this.scene.add.text(0, 0, txt, {
      fontFamily: FONT_HEAD, fontSize: `${size}px`, color: '#14213d', align: 'center',
      wordWrap: { width: maxW }, lineSpacing: -4,
    }).setOrigin(0.5);
    let s = size;
    while ((t.width > maxW || t.height > maxH) && s > minSize) { s -= 4; t.setFontSize(s); }
    if (t.width > maxW || t.height > maxH) t.setScale(Math.min(maxW / t.width, maxH / t.height));
    return t;
  }

  private buildPrompt(p: ChallengePrompt): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0);
    // The card is baked once the prompt width is known; this slot keeps its place at the bottom of the list.
    const slot = this.scene.add.container(0, 0);
    c.add(slot);
    const bake = () => slot.add(this.makeCard(this.promptW, PROMPT_H, QUESTION_FILL, hexNum(this.color), 10));
    if (p.kind === 'image') {
      this.promptW = 230;
      bake();
      if (this.scene.textures.exists(sceneTex(p.sceneId))) {
        const img = this.scene.add.image(0, 0, sceneTex(p.sceneId));
        fitImage(img, 168);
        c.add(img);
      }
    } else {
      const isMath = /^\s*\d+\s*\+\s*\d+\s*$/.test(p.text);
      const txt = isMath ? `${p.text} = ?` : p.text;
      const t = this.textFit(txt, isMath ? 96 : 104, 540, PROMPT_H - 30, 60);
      this.promptW = Math.max(250, Math.min(600, t.width * t.scaleX + 70));
      bake();
      c.add(t);
    }
    if (!(p.kind === 'text' && /^\s*\d+\s*\+\s*\d+\s*$/.test(p.text))) {
      const q = circle(this.scene, { r: 26, fill: hexNum(this.color), stroke: 0xffffff, strokeW: 4 }, 0, 0);
      const qt = bigText(this.scene, 0, 0, '?', 40, '#ffffff', { font: FONT_BODY, stroke: 0 });
      c.add(this.scene.add.container(-this.promptW / 2 + 6, -PROMPT_H / 2 + 6, [q, qt]));
    }
    return c;
  }

  private buildCell(o: ChallengeOption, i: AnswerSlot): Cell {
    const root = this.scene.add.container(0, 0);
    const inner = this.scene.add.container(0, 0);
    root.add(inner);
    const content = this.scene.add.container(0, 0);
    const hint = this.scene.add.container(0, 0);
    const cw = this.cardW, ch = this.cardH, dia = this.diamond;
    const card = this.makeCard(cw, ch, HUD.colors.card, 0x9fb0d0, 5);
    const noBadge = this.hooks.controllerDevice?.type === 'touch';
    const cx = dia && !noBadge ? 36 : 0;
    content.setX(cx);
    inner.add([card, content]);
    if (o.kind === 'image') {
      if (this.scene.textures.exists(sceneTex(o.sceneId))) {
        const img = this.scene.add.image(0, 0, sceneTex(o.sceneId));
        fitImage(img, dia ? 124 : 135);
        content.add(img);
      }
    } else {
      content.add(this.textFit(o.text, 56, cw - 24 - (dia && !noBadge ? 84 : 0), ch - 20, 36));
    }
    inner.add(hint);
    const bx = dia ? -cw / 2 + 52 : 0, by = dia ? 0 : BADGE_DY;
    const device = this.hooks.controllerDevice;
    const key = device?.type === 'keyboard' ? keyboardAnswerLabel(device.layout, i) : undefined;
    if (device?.type !== 'touch') inner.add(new FaceButtonBadge(this.scene, bx, by, 64, ANSWER_POSITIONS[i], this.controllerFamily, key));
    // Big invisible hit area so a finger (or mouse) can answer directly.
    const hit = this.scene.add.zone(0, 0, cw + 20, ch + 20).setInteractive();
    hit.on('pointerdown', () => { if (!this.resolved) services.input.touchAnswer?.(i); });
    root.add(hit);
    this.root.add(root);
    return { root, inner, card, content, hint, dock: { x: 0, y: 0, s: 1 } };
  }

  /** Stacked layout (local coords, panel center = 0,0): question on top, three answers below. */
  private layoutPoses() {
    const pad = 14, gap = DIVIDER_GAP, cg = 14;
    if (this.diamond) {
      const off = D_CARD_W / 2 + D_GAP / 2;
      const rows = 3 * D_CARD_H + 2 * D_GAP;
      this.dockW = Math.max(2 * D_CARD_W + D_GAP, this.promptW) + pad * 2;
      this.dockH = pad + PROMPT_H + gap + rows + pad;
      const top = -this.dockH / 2 + pad;
      this.promptDock = { x: 0, y: top + PROMPT_H / 2, s: 1 };
      const y0 = top + PROMPT_H + gap + D_CARD_H / 2;
      const step = D_CARD_H + D_GAP;
      // slots: 0 left, 1 top, 2 right, 3 bottom
      const pos = [{ x: -off, y: y0 + step }, { x: 0, y: y0 }, { x: off, y: y0 + step }, { x: 0, y: y0 + 2 * step }];
      this.cells.forEach((c, k) => { c.dock = { ...pos[k], s: 1 }; });
      return;
    }
    const cellsW = 3 * CARD_W + 2 * cg;
    this.dockW = Math.max(cellsW, this.promptW) + pad * 2;
    this.dockH = pad + PROMPT_H + gap + CARD_H + 52 + 6;
    const top = -this.dockH / 2 + pad;
    this.promptDock = { x: 0, y: top + PROMPT_H / 2, s: 1 };
    const cy = top + PROMPT_H + gap + CARD_H / 2;
    this.cells.forEach((c, k) => { c.dock = { x: -cellsW / 2 + CARD_W / 2 + k * (CARD_W + cg), y: cy, s: 1 }; });
  }

  // ───────────────────────── layout / update ─────────────────────────
  setView(view: Rect) { this.view = view; }

  private inset(): number { return this.hooks.innerInset ?? 0; }

  private zone(): Rect { return challengeRegion(this.view); }

  private drawBg() {
    const w = this.dockW, h = this.dockH;
    this.bg = rrectImage(this.scene, { r: 36, fill: NAVY, fillA: 0.97, stroke: hexNum(this.color), strokeW: 8 }, 0, 0, w, h);
    this.root.addAt(this.bg, 1);
    this.root.addAt(this.buildDivider(), 2);
    resizeRR(this.glow, w, h);
  }

  /** Question-area tint + bold divider bar, so question and answers read as two zones. */
  private buildDivider(): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0);
    const w = this.dockW, pad = 14;
    const top = -this.dockH / 2;
    const qH = pad + PROMPT_H + DIVIDER_GAP / 2 - 4;
    // tinted question zone (hugging the top of the panel inside its border)
    c.add(rrectImage(this.scene, { r: 28, fill: hexNum(this.color), fillA: 0.28 }, 0, top + 8 + (qH - 8) / 2, w - 16, qH - 8));
    // bold divider bar
    const by = top + pad + PROMPT_H + DIVIDER_GAP / 2;
    c.add(rrectImage(this.scene, { r: 6, fill: 0xffffff, fillA: 1 }, 0, by, w - 40, 12));
    return c;
  }

  /** Big fills the region (width- or height-limited); docked is slightly smaller, same top-center anchor. */
  private scales(): { big: number; dock: number } {
    if (this.centered) {
      const v = this.view;
      const sr = breakSplitRegion(v);
      const big = Math.max(0.3, Math.min(CHALLENGE.breakMaxScale, (v.w - 40 - this.inset()) / this.dockW, sr.h / this.dockH));
      return { big, dock: big };
    }
    const z = this.zone();
    const big = Math.max(0.3, Math.min(HUD.panel.maxBigScale, (z.w - 2 * HUD.panel.shakePx) / this.dockW, z.h / this.dockH));
    const dock = Math.min(1, big * HUD.panel.dockFrac);
    return { big, dock };
  }

  /** Root pose for slide progress t (0 big, 1 docked): top edge pinned below the car, centered on it. */
  private rootPose(t: number): { x: number; y: number; s: number } {
    const sc = this.scales();
    if (this.centered) {
      const v = this.view;
      const sr = breakSplitRegion(v);
      const inset = this.inset();
      const cx = v.x + v.w / 2 + (v.x < GAME_WIDTH / 2 ? -inset / 2 : inset / 2);
      return { x: cx, y: sr.top + sr.h / 2, s: sc.big };
    }
    const z = this.zone();
    const s = lerp(sc.big, sc.dock, easeInOut(t));
    return { x: z.x + z.w / 2, y: z.y + (this.dockH * s) / 2, s };
  }

  private apply() {
    const e = easeInOut(this.slideT);
    const rp = this.rootPose(this.slideT);
    let offX = 0, rot = 0, alpha = 1;
    const showing = this.phase === 'show';
    if (showing) {
      const k = Math.min(1, this.age / HUD.panel.showSec);
      const decay = 1 - k * 0.6;
      offX = Math.sin(this.age * 52) * HUD.panel.shakePx * decay;
      rot = Math.sin(this.age * 41 + 1) * 0.025 * decay;
      alpha = Math.min(1, this.age * 12);
    }
    const pop = this.centered ? 0.8 + 0.2 * easeOutBack(Math.min(1, this.age / 0.2)) : 1;
    if (this.centered) alpha = Math.min(1, this.age * 10);
    this.root.setPosition(rp.x + offX, rp.y).setScale(rp.s * pop).setRotation(rot);
    this.root.setAlpha(alpha * this.fadeAlpha);

    // attention glow: pulsing gold halo while shown, fading out as it shrinks
    const h = this.dockH;
    const ga = 1 - e;
    if (ga > 0.01 && !this.resolved) {
      const pulse = 0.6 + 0.4 * Math.sin(this.age * 18);
      this.glow.setVisible(true).setAlpha(ga * pulse);
    } else this.glow.setVisible(false);

    const pp = this.promptDock;
    this.promptRoot.setPosition(pp.x, pp.y).setScale(pp.s);
    for (const c of this.cells) c.root.setPosition(c.dock.x, c.dock.y).setScale(c.dock.s);
    if (this.header) this.header.setPosition(0, -h / 2).setAlpha(1 - e).setVisible(e < 0.99);
  }

  update(dt: number) {
    if (this.finished) return;
    this.age += dt;
    switch (this.phase) {
      case 'show':
        if (this.age >= HUD.panel.showSec) { this.phase = 'shrink'; this.age = 0; }
        break;
      case 'shrink':
        this.slideT = Math.min(1, this.age / HUD.panel.shrinkSec);
        if (this.slideT >= 1) this.phase = 'docked';
        break;
      default: break;
    }
    if (this.resolved) {
      this.resolveAge += dt;
      if (this.result === 'wrong' && !this.hintShown && this.resolveAge >= HUD.panel.wrongHintDelaySec) this.showHint();
      const hold = this.result === 'timeout' ? 0 : HUD.panel.resultHoldSec;
      const fadeDur = this.result === 'timeout' ? HUD.panel.timeoutFadeSec : HUD.panel.fadeSec;
      if (this.resolveAge > hold) {
        this.fadeAlpha = Math.max(0, 1 - (this.resolveAge - hold) / fadeDur);
        if (this.fadeAlpha <= 0) this.finished = true;
      }
    }
    this.apply();
  }

  // ───────────────────────── results ─────────────────────────
  resolve(result: ChallengeResult, chosen: AnswerSlot | null) {
    if (this.resolved) return;
    this.resolved = true;
    this.result = result;
    this.resolveAge = 0;
    if (result === 'timeout' || chosen === null) return;
    const cell = this.cells[chosen];
    if (result === 'correct') this.celebrate(cell);
    else this.markWrong(cell);
  }

  private cellWorld(cell: Cell): { x: number; y: number } {
    const m = cell.root.getWorldTransformMatrix();
    return { x: m.tx, y: m.ty };
  }

  private celebrate(cell: Cell) {
    this.restyleCard(cell, HUD.colors.green, 0xffffff, 10);
    const { x, y } = this.cellWorld(cell);
    const sc = this.scene;
    sc.tweens.add({ targets: cell.inner, scale: { from: 1, to: 1.22 }, duration: 160, yoyo: true, repeat: 1, ease: 'Sine.easeOut' });
    if (sc.textures.exists(TEX.beacon)) {
      const glow = sc.add.image(x, y, TEX.beacon).setDepth(this.hooks.depth + 1).setTint(0x7dff8a)
        .setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(260, 260).setAlpha(0.9);
      this.fxObjects.push(glow);
      sc.tweens.add({ targets: glow, displayWidth: 640, displayHeight: 640, alpha: 0, duration: 800, ease: 'Cubic.easeOut', onComplete: () => glow.destroy() });
    }
    const starKey = sc.textures.exists(TEX.fxStar) ? TEX.fxStar : null;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
      const d = 110 + Math.random() * 90;
      const s: Phaser.GameObjects.Image | Phaser.GameObjects.Arc = starKey
        ? sc.add.image(x, y, starKey).setTint(i % 2 ? 0xffd43b : 0xffffff).setScale(1.3)
        : sc.add.circle(x, y, 10, 0xffd43b);
      s.setDepth(this.hooks.depth + 2);
      this.fxObjects.push(s);
      sc.tweens.add({
        targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 30, alpha: 0, scale: 0.2, angle: 180,
        duration: 700 + Math.random() * 200, ease: 'Cubic.easeOut', onComplete: () => s.destroy(),
      });
    }
    this.hooks.onCorrect(x, y);
  }

  private markWrong(cell: Cell) {
    this.restyleCard(cell, HUD.colors.gray, 0x7b8494, 5);
    cell.content.setAlpha(0.45);
    const x = this.scene.add.container(0, 0, [bakedImage(this.scene, 'xmark', 120, 120, 0, 0, (g, k) => {
      const c = 60 * k, a = 46 * k;
      g.lineStyle(18 * k, 0xffffff, 1).beginPath().moveTo(c - a, c - a).lineTo(c + a, c + a).moveTo(c + a, c - a).lineTo(c - a, c + a).strokePath();
      g.lineStyle(10 * k, HUD.colors.red, 1).beginPath().moveTo(c - a, c - a).lineTo(c + a, c + a).moveTo(c + a, c - a).lineTo(c - a, c + a).strokePath();
    })]);
    cell.inner.add(x);
    this.extraTargets.push(x);
    this.scene.tweens.add({ targets: cell.inner, x: { from: -14, to: 14 }, duration: 55, yoyo: true, repeat: 4, ease: 'Sine.easeInOut', onComplete: () => cell.inner.setX(0) });
    this.scene.tweens.add({ targets: x, scale: { from: 0.2, to: 1 }, duration: 220, ease: 'Back.easeOut' });
  }

  private showHint() {
    this.hintShown = true;
    const cell = this.cells[this.challenge.correct];
    cell.hint.add([
      rrectImage(this.scene, { r: 30, stroke: HUD.colors.green, strokeW: 12 }, 0, 0, this.cardW + 12, this.cardH + 12),
      rrectImage(this.scene, { r: 36, stroke: 0xffffff, strokeW: 4, strokeA: 0.9 }, 0, 0, this.cardW + 28, this.cardH + 28),
    ]);
    this.scene.tweens.add({ targets: cell.hint, alpha: { from: 0, to: 1 }, duration: 250 });
  }

  /** Screen rect covered by the docked panel (for overlap checks). */
  dockedBounds(): Rect {
    const rp = this.rootPose(1);
    return { x: rp.x - (this.dockW * rp.s) / 2, y: rp.y - (this.dockH * rp.s) / 2, w: this.dockW * rp.s, h: this.dockH * rp.s };
  }

  destroy() {
    this.finished = true;
    this.scene.tweens.killTweensOf([...this.cells.map((c) => c.inner), ...this.cells.map((c) => c.hint), ...this.extraTargets, ...this.fxObjects]);
    this.fxObjects.forEach((o) => { if (o.scene) o.destroy(); });
    this.fxObjects = [];
    this.root.destroy();
  }
}
