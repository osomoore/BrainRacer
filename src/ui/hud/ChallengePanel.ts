import Phaser from 'phaser';
import { ANSWER_COLORS } from '../../config/gameConfig';
import { CHALLENGE } from '../../config/gameConfig';
import { sceneTex, TEX } from '../../core/assetKeys';
import type {
  AnswerSlot, Challenge, ChallengeOption, ChallengePrompt, ChallengeResult, Rect,
} from '../../core/types';
import { bigText, FONT_BODY, FONT_HEAD, hexNum } from '../menu/style';
import { HUD } from './hudConfig';
import { dockZone, easeInOut, easeOutBack, fitScale, lerp } from './hudMath';

const CARD_W = 210, CARD_H = 170, CELL_GAP = 20;
const PROMPT_H = 230;
const BADGE_DY = CARD_H / 2 + 38;
const BIG_W = 3 * CARD_W + 2 * CELL_GAP + 80;
const NAVY = HUD.colors.navy;

type Phase = 'pop' | 'hold' | 'slide' | 'docked';

interface Pose { x: number; y: number; s: number }

interface Cell {
  root: Phaser.GameObjects.Container;    // posed by the panel
  inner: Phaser.GameObjects.Container;   // animated by result effects
  card: Phaser.GameObjects.Graphics;
  content: Phaser.GameObjects.Container;
  hint: Phaser.GameObjects.Graphics;
  big: Pose;
  dock: Pose;
}

export interface PanelHooks {
  /** Called with screen coords when a correct answer's "+1" should fly to the score. */
  onCorrect(x: number, y: number): void;
  depth: number;
}

function fitImage(img: Phaser.GameObjects.Image, size: number) {
  const m = Math.max(img.width, img.height) || 1;
  img.setScale(size / m);
}

/** One player's challenge: big pop-in, slide-up into a docked strip, result feedback. */
export class ChallengePanel {
  finished = false;
  readonly root: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private header?: Phaser.GameObjects.Text;
  private promptRoot: Phaser.GameObjects.Container;
  private promptBig: Pose = { x: 0, y: 0, s: 1 };
  private promptDock: Pose = { x: 0, y: 0, s: 1 };
  private cells: Cell[] = [];
  private promptW = 250;
  private headerBigY = 0;
  private bigH = 0;
  private dockW = 0;
  private dockH = 0;
  private dockScale = 1;
  private bigScale = 1;

  private phase: Phase = 'pop';
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
    this.root = scene.add.container(0, 0).setDepth(hooks.depth);
    this.bg = scene.add.graphics();
    this.root.add(this.bg);

    this.promptRoot = this.buildPrompt(challenge.prompt);
    this.root.add(this.promptRoot);
    challenge.options.forEach((o, i) => this.cells.push(this.buildCell(o, i)));
    if (challenge.source === 'place') {
      this.header = bigText(scene, 0, 0, '\u{1F4CD} Look!', 56, '#ffd43b', { font: FONT_BODY, stroke: 9 });
      this.root.add(this.header);
    }
    this.layoutPoses();
    this.root.setScale(0).setAlpha(0);
    this.apply();
  }

  // ───────────────────────── building ─────────────────────────
  private drawCard(g: Phaser.GameObjects.Graphics, w: number, h: number, fill: number, stroke: number, strokeW = 6, alpha = 0.97) {
    g.clear();
    g.fillStyle(fill, alpha).fillRoundedRect(-w / 2, -h / 2, w, h, 26);
    g.lineStyle(strokeW, stroke, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 26);
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
    const card = this.scene.add.graphics();
    c.add(card);
    if (p.kind === 'image') {
      this.promptW = 250;
      this.drawCard(card, this.promptW, PROMPT_H, HUD.colors.card, hexNum(this.color), 8);
      if (this.scene.textures.exists(sceneTex(p.sceneId))) {
        const img = this.scene.add.image(0, 0, sceneTex(p.sceneId));
        fitImage(img, 210);
        c.add(img);
      }
    } else {
      const isMath = /^\s*\d+\s*\+\s*\d+\s*$/.test(p.text);
      const txt = isMath ? `${p.text} = ?` : p.text;
      const t = this.textFit(txt, isMath ? 96 : 104, 540, PROMPT_H - 30, 60);
      this.promptW = Math.max(250, Math.min(600, t.width * t.scaleX + 70));
      this.drawCard(card, this.promptW, PROMPT_H, HUD.colors.card, hexNum(this.color), 8);
      c.add(t);
    }
    return c;
  }

  private buildCell(o: ChallengeOption, i: number): Cell {
    const root = this.scene.add.container(0, 0);
    const inner = this.scene.add.container(0, 0);
    root.add(inner);
    const card = this.scene.add.graphics();
    const content = this.scene.add.container(0, 0);
    const hint = this.scene.add.graphics();
    this.drawCard(card, CARD_W, CARD_H, HUD.colors.card, 0x9fb0d0, 5);
    inner.add([card, content]);
    if (o.kind === 'image') {
      if (this.scene.textures.exists(sceneTex(o.sceneId))) {
        const img = this.scene.add.image(0, 0, sceneTex(o.sceneId));
        fitImage(img, 150);
        content.add(img);
      }
    } else {
      content.add(this.textFit(o.text, 56, CARD_W - 24, CARD_H - 20, 36));
    }
    inner.add(hint);
    const badge = this.scene.add.image(0, BADGE_DY, TEX.buttonBadge[i]).setScale(0.9);
    // Fallback when art is missing: colored dot.
    if (!this.scene.textures.exists(TEX.buttonBadge[i])) badge.setVisible(false);
    inner.add(badge);
    if (!badge.visible) {
      const g = this.scene.add.graphics();
      g.fillStyle(hexNum(ANSWER_COLORS[i]), 1).fillCircle(0, BADGE_DY, 32);
      inner.add(g);
    }
    this.root.add(root);
    return { root, inner, card, content, hint, big: { x: 0, y: 0, s: 1 }, dock: { x: 0, y: 0, s: 1 } };
  }

  /** Compute big and docked poses (local coords, panel center = 0,0). */
  private layoutPoses() {
    const place = !!this.header;
    const top = place ? -385 : -315, bottom = 225;
    const oy = -(top + bottom) / 2;
    this.bigH = bottom - top;
    this.headerBigY = (place ? -345 : 0) + oy;
    this.promptBig = { x: 0, y: -175 + oy, s: 1 };
    this.cells.forEach((c, k) => { c.big = { x: (k - 1) * (CARD_W + CELL_GAP), y: 45 + oy, s: 1 }; });

    const os = 0.9;
    const ps = Math.min(0.72, 300 / this.promptW);
    const pad = 16, gap = 14, cg = 8;
    const pw = this.promptW * ps, cw = CARD_W * os;
    this.dockW = pad * 2 + pw + gap + 3 * cw + 2 * cg;
    const cellH = CARD_H * os + 6 + 60;
    this.dockH = cellH + pad * 2 - 6;
    const x0 = -this.dockW / 2 + pad;
    const cardY = -cellH / 2 + (CARD_H * os) / 2 + 2;
    this.promptDock = { x: x0 + pw / 2, y: cardY + 4, s: ps };
    this.cells.forEach((c, k) => { c.dock = { x: x0 + pw + gap + cw / 2 + k * (cw + cg), y: cardY, s: os }; });
  }

  // ───────────────────────── layout / update ─────────────────────────
  setView(view: Rect) { this.view = view; }

  private zone(): Rect { return dockZone(this.view, 960, HUD.scoreboard.clearHalf, HUD.margin); }

  /** Current scale/position of the root for slide progress t (0 big, 1 docked). */
  private rootPose(t: number): { x: number; y: number; s: number } {
    const v = this.view, z = this.zone();
    this.bigScale = fitScale(BIG_W, this.bigH, v.w - 60, v.h - 360, HUD.panel.maxBigScale);
    this.dockScale = Math.min(1, z.w / this.dockW);
    const bx = v.x + v.w / 2, by = v.y + v.h / 2 + 62;
    const dx = z.x + z.w / 2, dy = v.y + HUD.panel.dockTop + (this.dockH * this.dockScale) / 2;
    const e = easeInOut(t);
    return { x: lerp(bx, dx, e), y: lerp(by, dy, e), s: lerp(this.bigScale, this.dockScale, e) };
  }

  private apply() {
    const t = this.slideT;
    const e = easeInOut(t);
    const rp = this.rootPose(t);
    let popK = 1, offY = 0, rot = 0, alpha = 1;
    if (this.phase === 'pop') {
      const k = Math.min(1, this.age / CHALLENGE.popInSec);
      popK = easeOutBack(k);
      offY = (1 - k) * 160;
      rot = (1 - k) * -0.14;
      alpha = Math.min(1, k * 4);
    }
    this.root.setPosition(rp.x, rp.y + offY).setScale(Math.max(0.001, rp.s * popK)).setRotation(rot);
    this.root.setAlpha(alpha * this.fadeAlpha);

    const w = lerp(BIG_W, this.dockW, e), h = lerp(this.bigH, this.dockH, e);
    this.bg.clear();
    this.bg.fillStyle(NAVY, 0.97).fillRoundedRect(-w / 2, -h / 2, w, h, 36);
    this.bg.lineStyle(8, hexNum(this.color), 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 36);

    const pose = (a: Pose, b: Pose) => ({ x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), s: lerp(a.s, b.s, e) });
    const pp = pose(this.promptBig, this.promptDock);
    this.promptRoot.setPosition(pp.x, pp.y).setScale(pp.s);
    for (const c of this.cells) {
      const p = pose(c.big, c.dock);
      c.root.setPosition(p.x, p.y).setScale(p.s);
    }
    if (this.header) this.header.setPosition(0, this.headerBigY).setAlpha(1 - e).setVisible(e < 0.99);
  }

  update(dt: number) {
    if (this.finished) return;
    this.age += dt;
    switch (this.phase) {
      case 'pop':
        if (this.age >= CHALLENGE.popInSec) { this.phase = 'hold'; this.age = 0; }
        break;
      case 'hold':
        if (!this.resolved && this.age >= HUD.panel.holdSec) { this.phase = 'slide'; this.age = 0; }
        break;
      case 'slide':
        this.slideT = Math.min(1, this.age / CHALLENGE.slideUpSec);
        if (this.slideT >= 1) this.phase = 'docked';
        break;
      default: break;
    }
    if (this.resolved) {
      this.resolveAge += dt;
      if (this.result === 'wrong' && !this.hintShown && this.resolveAge >= HUD.panel.wrongHintDelaySec) this.showHint();
      const hold = this.result === 'timeout' ? 0 : CHALLENGE.resultHoldSec;
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
    this.drawCard(cell.card, CARD_W, CARD_H, HUD.colors.green, 0xffffff, 10);
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
    this.drawCard(cell.card, CARD_W, CARD_H, HUD.colors.gray, 0x7b8494, 5);
    cell.content.setAlpha(0.45);
    const x = this.scene.add.graphics();
    x.lineStyle(18, 0xffffff, 1).beginPath().moveTo(-46, -46).lineTo(46, 46).moveTo(46, -46).lineTo(-46, 46).strokePath();
    x.lineStyle(10, HUD.colors.red, 1).beginPath().moveTo(-46, -46).lineTo(46, 46).moveTo(46, -46).lineTo(-46, 46).strokePath();
    cell.inner.add(x);
    this.extraTargets.push(x);
    this.scene.tweens.add({ targets: cell.inner, x: { from: -14, to: 14 }, duration: 55, yoyo: true, repeat: 4, ease: 'Sine.easeInOut', onComplete: () => cell.inner.setX(0) });
    this.scene.tweens.add({ targets: x, scale: { from: 0.2, to: 1 }, duration: 220, ease: 'Back.easeOut' });
  }

  private showHint() {
    this.hintShown = true;
    const cell = this.cells[this.challenge.correct];
    cell.hint.lineStyle(12, HUD.colors.green, 1).strokeRoundedRect(-CARD_W / 2 - 6, -CARD_H / 2 - 6, CARD_W + 12, CARD_H + 12, 30);
    cell.hint.lineStyle(4, 0xffffff, 0.9).strokeRoundedRect(-CARD_W / 2 - 14, -CARD_H / 2 - 14, CARD_W + 28, CARD_H + 28, 36);
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
