import Phaser from 'phaser';
import type { GoalState } from '../../core/events';
import { sceneTex } from '../../core/assetKeys';
import type { Rect, Vec2 } from '../../core/types';
import { bigText, FONT_HEAD, hexNum } from '../menu/style';
import { GOALS } from '../../config/gameConfig';
import { HUD } from './hudConfig';
import { isOnScreen } from './hudMath';

const TAG_H = 78;
const CARD_SCALE = 0.78;

/** Destination card (icon + word) at the top of the view, plus an upright label over the goal when it is on screen. */
export class GoalIndicator {
  private root: Phaser.GameObjects.Container;
  private tag: Phaser.GameObjects.Container;
  private card: Phaser.GameObjects.Container;
  private tagW = 200;
  private goalId = -1;
  private onScreen = false;
  /** Goal id whose first on-screen scale-in already started, and seconds since it did. */
  private introGoalId = -1;
  private introT = 99;
  private clock = 0;
  /** Seconds since the destination card last changed (drives its attention pulse). */
  private cardT = 99;
  private avoid?: Rect;

  constructor(private scene: Phaser.Scene, private color: string, depth: number) {
    this.tag = scene.add.container(0, 0);
    this.card = scene.add.container(0, 0);
    this.root = scene.add.container(0, 0, [this.card, this.tag]).setDepth(depth).setVisible(false);
  }

  private buildTag(target: Phaser.GameObjects.Container, goal: GoalState) {
    target.removeAll(true);
    const word = (goal.placeWord ?? 'goal').toUpperCase();
    const hasIcon = !!goal.sceneId && this.scene.textures.exists(sceneTex(goal.sceneId));
    const t = bigText(this.scene, 0, 0, word, 46, '#14213d', { font: FONT_HEAD, stroke: 0, shadow: false, origin: [0, 0.5] });
    const iconSize = 62;
    const w = 24 + (hasIcon ? iconSize + 10 : 0) + t.width + 24;
    this.tagW = w;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0xffffff, 0.97).fillRoundedRect(-w / 2, -TAG_H / 2, w, TAG_H, 24);
    bg.lineStyle(7, hexNum(this.color), 1).strokeRoundedRect(-w / 2, -TAG_H / 2, w, TAG_H, 24);
    target.add(bg);
    let x = -w / 2 + 24;
    if (hasIcon) {
      const img = this.scene.add.image(x + iconSize / 2, 0, sceneTex(goal.sceneId!));
      img.setScale(iconSize / Math.max(img.width, img.height));
      target.add(img);
      x += iconSize + 10;
    }
    t.setPosition(x, 0);
    target.add(t);
  }

  hide() { this.root.setVisible(false); }

  /**
   * @param w2s world→screen mapping of the view (ctx.camera.worldToScreen, includes rotation/zoom)
   * @param mapRect screen rect that view occupies (player's view, or whole screen when merged)
   * @param cars world positions of the car(s) this indicator speaks for (distance = nearest)
   */
  update(
    dt: number, goal: GoalState | null, w2s: (x: number, y: number) => Vec2, mapRect: Rect, _cars: Vec2[], magnet: boolean, avoid?: Rect,
  ) {
    this.avoid = avoid;
    if (!goal) { this.root.setVisible(false); return; }
    this.clock += dt;
    if (goal.id !== this.goalId) { this.goalId = goal.id; this.buildTag(this.tag, goal); this.buildTag(this.card, goal); this.cardT = 0; }
    this.cardT += dt;
    this.root.setVisible(true);

    if (this.introGoalId !== goal.id && this.goalVisible(w2s, goal, mapRect)) { this.introGoalId = goal.id; this.introT = 0; }
    this.introT += dt;
    const gs = w2s(goal.x, goal.y);
    const zx = w2s(goal.x + 1, goal.y);
    const zoom = Math.hypot(zx.x - gs.x, zx.y - gs.y);
    this.onScreen = isOnScreen(gs, mapRect, this.onScreen ? HUD.goal.onScreenMargin - 30 : HUD.goal.onScreenMargin + 20);

    // Small destination card (icon + word) at the top of the view: reading practice, no arrow.
    this.placeTag(this.card, mapRect, mapRect.x + mapRect.w / 2, mapRect.y + 16 + TAG_H * CARD_SCALE / 2, CARD_SCALE, mapRect.y + mapRect.h);
    // New goal: the card pops and pulses for a moment instead of a big banner covering the view.
    const pk = this.cardT / HUD.goalPulse.sec;
    const pulse = pk < 1 ? 1 + HUD.goalPulse.amp * Math.abs(Math.sin(pk * Math.PI * HUD.goalPulse.beats)) * (1 - pk * 0.4) : 1;
    this.card.setScale(CARD_SCALE * pulse);

    // Upright label bouncing above the goal while the goal is on screen.
    this.tag.setVisible(this.onScreen);
    if (this.onScreen) {
      const bounce = Math.abs(Math.sin(this.clock * 5)) * 18;
      const top = gs.y - goal.radius * zoom * 0.35 - 40 - bounce;
      this.placeTag(this.tag, mapRect, gs.x, Math.max(mapRect.y + 100, top - TAG_H / 2), 1, mapRect.y + mapRect.h - 150);
      const u = Math.min(1, this.introT / GOALS.labelIntroSec);
      const intro = 1 + (GOALS.labelIntroScale - 1) * (1 - easeOutBack(u));
      this.tag.setScale((magnet ? 1.15 : 1) * intro);
    }
  }

  private goalVisible(w2s: (x: number, y: number) => Vec2, goal: GoalState, rect: Rect): boolean {
    return isOnScreen(w2s(goal.x, goal.y), rect, HUD.goal.onScreenMargin + 20);
  }

  private placeTag(obj: Phaser.GameObjects.Container, rect: Rect, x: number, y: number, scale: number, maxBottom: number) {
    const hw = (this.tagW * scale) / 2 + 12;
    const th = TAG_H * scale;
    const minY = rect.y + 16 + th / 2;
    const cx = Math.min(rect.x + rect.w - hw, Math.max(rect.x + hw, x));
    const cy = Math.min(maxBottom, Math.max(minY, y));
    let fx = cx;
    const a = this.avoid;
    if (a && cy - th / 2 - 20 < a.y + a.h && cy + th / 2 + 20 > a.y && fx + hw > a.x && fx - hw < a.x + a.w) {
      // Slide sideways out from under the scoreboard (toward whichever side is nearer).
      const left = a.x - hw - 10, right = a.x + a.w + hw + 10;
      fx = Math.abs(fx - left) < Math.abs(fx - right) ? left : right;
      fx = Math.min(rect.x + rect.w - hw, Math.max(rect.x + hw, fx));
    }
    obj.setPosition(fx, cy);
  }

  destroy() { this.root.destroy(); }
}

function easeOutBack(u: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}
