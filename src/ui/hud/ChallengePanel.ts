import Phaser from 'phaser';
import { ANSWER_COLORS } from '../../config/gameConfig';
import { sceneTex, TEX } from '../../core/assetKeys';
import type {
  AnswerSlot, Challenge, ChallengeOption, ChallengePrompt, ChallengeResult, Rect,
} from '../../core/types';
import { bigText, FONT_BODY, FONT_HEAD, hexNum } from '../menu/style';
import { challengeRegion, HUD } from './hudConfig';
import { easeInOut, lerp } from './hudMath';

const CARD_W = 270, CARD_H = 160;
const PROMPT_H = 190;
const QUESTION_FILL = 0xfff1b8;
const BADGE_DY = CARD_H / 2 + 22;
const NAVY = HUD.colors.navy;

type Phase = 'show' | 'shrink' | 'docked';

interface Pose { x: number; y: number; s: number }

interface Cell {
  root: Phaser.GameObjects.Container;    // posed by the panel
  inner: Phaser.GameObjects.Container;   // animated by result effects
  card: Phaser.GameObjects.Graphics;
  content: Phaser.GameObjects.Container;
  hint: Phaser.GameObjects.Graphics;
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

/** One player's challenge: appears large at the top of the view (shake + glow), shrinks to a docked strip, result feedback. */
export class ChallengePanel {
  finished = false;
  readonly root: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private header?: Phaser.GameObjects.Text;
  private promptRoot: Phaser.GameObjects.Container;
  private promptDock: Pose = { x: 0, y: 0, s: 1 };
  private cells: Cell[] = [];
  private promptW = 250;
  private glow: Phaser.GameObjects.Graphics;
  private dockW = 0;
  private dockH = 0;

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
    this.root = scene.add.container(0, 0).setDepth(hooks.depth);
    this.glow = scene.add.graphics();
    this.bg = scene.add.graphics();
    this.root.add([this.glow, this.bg]);

    this.promptRoot = this.buildPrompt(challenge.prompt);
    this.root.add(this.promptRoot);
    challenge.options.forEach((o, i) => this.cells.push(this.buildCell(o, i)));
    if (challenge.source === 'place') {
      this.header = bigText(scene, 0, 0, '\u{1F4CD} Look!', 56, '#ffd43b', { font: FONT_BODY, stroke: 9 });
      this.root.add(this.header);
    }
    this.layoutPoses();
    this.drawBg();
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
      this.promptW = 230;
      this.drawCard(card, this.promptW, PROMPT_H, QUESTION_FILL, hexNum(this.color), 10);
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
      this.drawCard(card, this.promptW, PROMPT_H, QUESTION_FILL, hexNum(this.color), 10);
      c.add(t);
    }
    if (!(p.kind === 'text' && /^\s*\d+\s*\+\s*\d+\s*$/.test(p.text))) {
      const q = this.scene.add.graphics();
      q.fillStyle(hexNum(this.color), 1).fillCircle(0, 0, 26).lineStyle(4, 0xffffff, 1).strokeCircle(0, 0, 26);
      const qt = bigText(this.scene, 0, 0, '?', 40, '#ffffff', { font: FONT_BODY, stroke: 0 });
      c.add(this.scene.add.container(-this.promptW / 2 + 6, -PROMPT_H / 2 + 6, [q, qt]));
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
        fitImage(img, 135);
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
    return { root, inner, card, content, hint, dock: { x: 0, y: 0, s: 1 } };
  }

  /** Stacked layout (local coords, panel center = 0,0): question on top, three answers below. */
  private layoutPoses() {
    const pad = 14, gap = 10, cg = 14;
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

  private zone(): Rect { return challengeRegion(this.view); }

  private drawBg() {
    const w = this.dockW, h = this.dockH;
    this.bg.clear();
    this.bg.fillStyle(NAVY, 0.97).fillRoundedRect(-w / 2, -h / 2, w, h, 36);
    this.bg.lineStyle(8, hexNum(this.color), 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 36);
  }

  /** Big fills the region (width- or height-limited); docked is slightly smaller, same top-center anchor. */
  private scales(): { big: number; dock: number } {
    const z = this.zone();
    const big = Math.max(0.3, Math.min(HUD.panel.maxBigScale, (z.w - 2 * HUD.panel.shakePx) / this.dockW, z.h / this.dockH));
    const dock = Math.min(1, big * HUD.panel.dockFrac);
    return { big, dock };
  }

  /** Root pose for slide progress t (0 big, 1 docked): top edge pinned below the car, centered on it. */
  private rootPose(t: number): { x: number; y: number; s: number } {
    const z = this.zone();
    const sc = this.scales();
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
    this.root.setPosition(rp.x + offX, rp.y).setScale(rp.s).setRotation(rot);
    this.root.setAlpha(alpha * this.fadeAlpha);

    // attention glow: pulsing gold halo while shown, fading out as it shrinks
    const w = this.dockW, h = this.dockH;
    this.glow.clear();
    const ga = 1 - e;
    if (ga > 0.01 && !this.resolved) {
      const pulse = 0.6 + 0.4 * Math.sin(this.age * 18);
      for (let i = 4; i >= 1; i--) {
        this.glow.fillStyle(HUD.colors.gold, 0.16 * ga * pulse).fillRoundedRect(-w / 2 - i * 10, -h / 2 - i * 10, w + i * 20, h + i * 20, 36 + i * 10);
      }
    }

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
