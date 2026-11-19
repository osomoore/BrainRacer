import Phaser from 'phaser';
import type { GoalState } from '../../core/events';
import { sceneTex, TEX } from '../../core/assetKeys';
import type { Rect, Vec2 } from '../../core/types';
import { bigText, FONT_HEAD, hexNum } from '../menu/style';
import { GOALS } from '../../config/gameConfig';
import { HUD } from './hudConfig';
import { distanceMeters, edgeArrow, isOnScreen } from './hudMath';

const TAG_H = 78;

/** Goal arrow at the view edge (off-screen goal) or bouncing marker over the goal (on-screen). */
export class GoalIndicator {
  private root: Phaser.GameObjects.Container;
  private arrow: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  private tag: Phaser.GameObjects.Container;
  private tagW = 200;
  private dist: Phaser.GameObjects.Text;
  private goalId = -1;
  private onScreen = false;
  /** Goal id whose first on-screen scale-in already started, and seconds since it did. */
  private introGoalId = -1;
  private introT = 99;
  private clock = 0;
  private hasTex: boolean;
  private avoid?: Rect;

  constructor(private scene: Phaser.Scene, private color: string, depth: number) {
    this.hasTex = scene.textures.exists(TEX.arrow);
    this.arrow = this.hasTex ? scene.add.image(0, 0, TEX.arrow) : this.fallbackArrow();
    this.tag = scene.add.container(0, 0);
    this.dist = bigText(scene, 0, 0, '', 46, '#ffffff', { font: FONT_HEAD, stroke: 9 });
    this.root = scene.add.container(0, 0, [this.arrow, this.tag, this.dist]).setDepth(depth).setVisible(false);
  }

  private fallbackArrow(): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.fillStyle(0xffffff, 1).fillTriangle(-32, -30, 32, 0, -32, 30);
    return g;
  }

  private buildTag(goal: GoalState) {
    this.tag.removeAll(true);
    const word = (goal.placeWord ?? 'goal').toUpperCase();
    const hasIcon = !!goal.sceneId && this.scene.textures.exists(sceneTex(goal.sceneId));
    const t = bigText(this.scene, 0, 0, word, 46, '#14213d', { font: FONT_HEAD, stroke: 0, shadow: false, origin: [0, 0.5] });
    const iconSize = 62;
    const w = 24 + (hasIcon ? iconSize + 10 : 0) + t.width + 24;
    this.tagW = w;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0xffffff, 0.97).fillRoundedRect(-w / 2, -TAG_H / 2, w, TAG_H, 24);
    bg.lineStyle(7, hexNum(this.color), 1).strokeRoundedRect(-w / 2, -TAG_H / 2, w, TAG_H, 24);
    this.tag.add(bg);
    let x = -w / 2 + 24;
    if (hasIcon) {
      const img = this.scene.add.image(x + iconSize / 2, 0, sceneTex(goal.sceneId!));
      img.setScale(iconSize / Math.max(img.width, img.height));
      this.tag.add(img);
      x += iconSize + 10;
    }
    t.setPosition(x, 0);
    this.tag.add(t);
  }

  hide() { this.root.setVisible(false); }

  /**
   * @param w2s world→screen mapping of the view (ctx.camera.worldToScreen, includes rotation/zoom)
   * @param mapRect screen rect that view occupies (player's view, or whole screen when merged)
   * @param cars world positions of the car(s) this indicator speaks for (distance = nearest)
   */
  update(
    dt: number, goal: GoalState | null, w2s: (x: number, y: number) => Vec2, mapRect: Rect, cars: Vec2[], magnet: boolean, avoid?: Rect,
  ) {
    this.avoid = avoid;
    if (!goal) { this.root.setVisible(false); return; }
    this.clock += dt;
    if (goal.id !== this.goalId) { this.goalId = goal.id; this.buildTag(goal); }
    this.root.setVisible(true);

    if (this.introGoalId !== goal.id && this.goalVisible(w2s, goal, mapRect)) { this.introGoalId = goal.id; this.introT = 0; }
    this.introT += dt;
    const gs = w2s(goal.x, goal.y);
    const zx = w2s(goal.x + 1, goal.y);
    const zoom = Math.hypot(zx.x - gs.x, zx.y - gs.y);
    this.onScreen = isOnScreen(gs, mapRect, this.onScreen ? HUD.goal.onScreenMargin - 30 : HUD.goal.onScreenMargin + 20);
    const k = magnet ? HUD.goal.magnetScale : 1;
    const pulse = 1 + 0.08 * Math.sin(this.clock * 8);
    const arrowImg = this.arrow as Phaser.GameObjects.Image;
    if (this.hasTex) { if (magnet) arrowImg.setTintFill(HUD.goal.magnetColor); else arrowImg.clearTint(); }
    const scale = HUD.goal.arrowScale * k * pulse;
    const ring = arrowImg;

    if (this.onScreen) {
      const bounce = Math.abs(Math.sin(this.clock * 5)) * 26;
      const top = gs.y - goal.radius * zoom * 0.35 - 70 - bounce;
      ring.setPosition(gs.x, top).setRotation(Math.PI / 2).setScale(scale);
      const ty = Math.max(mapRect.y + 100, top - 62 * k - TAG_H / 2);
      this.placeTag(mapRect, gs.x, ty);
      this.dist.setVisible(false);
    } else {
      const car = this.nearest(cars, goal);
      const cs = w2s(car.x, car.y);
      // Off-screen arrow lives in the TOP band of the view (challenge panel is below the car now):
      // position is clamped to the band's top/side edges, the angle still points at the goal.
      const band: Rect = { x: mapRect.x, y: mapRect.y, w: mapRect.w, h: Math.min(mapRect.h * GOALS.arrowBandFrac, GOALS.arrowBandMaxH) };
      let dx = gs.x - cs.x, dy = gs.y - cs.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const px = Math.abs(dx) < 0.02 && dy >= 0 ? 1 : dx;   // goal straight behind: park at a side edge
      const e = edgeArrow(band, HUD.goal.edgeMargin, { x: 0, y: 0 }, { x: px, y: Math.min(dy, 0) });
      const angle = Math.atan2(dy, dx);
      ring.setPosition(e.x, e.y).setRotation(angle).setScale(scale);
      const back = 70 * k + 90;
      this.placeTag(mapRect, e.x - Math.cos(angle) * back, e.y - Math.sin(angle) * back, band.y + band.h);
      const m = distanceMeters(car.x, car.y, goal.x, goal.y);
      this.dist.setText(`${m} m`).setVisible(true).setPosition(this.tag.x, this.tag.y + TAG_H / 2 + 34);
    }
    const u = Math.min(1, this.introT / GOALS.labelIntroSec);
    const intro = this.onScreen ? 1 + (GOALS.labelIntroScale - 1) * (1 - easeOutBack(u)) : 1;
    this.tag.setScale((magnet ? 1.15 : 1) * intro);
  }

  private goalVisible(w2s: (x: number, y: number) => Vec2, goal: GoalState, rect: Rect): boolean {
    return isOnScreen(w2s(goal.x, goal.y), rect, HUD.goal.onScreenMargin + 20);
  }

  private nearest(cars: Vec2[], goal: GoalState): Vec2 {
    let best = cars[0] ?? { x: goal.x, y: goal.y }, bd = Infinity;
    for (const c of cars) {
      const d = Math.hypot(c.x - goal.x, c.y - goal.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  private placeTag(rect: Rect, x: number, y: number, maxBottom = rect.y + rect.h - 150) {
    const hw = this.tagW / 2 + 12;
    // Keep tag (and the distance line under it) inside the view and below the dock row.
    const minY = rect.y + 16 + TAG_H / 2;
    const cx = Math.min(rect.x + rect.w - hw, Math.max(rect.x + hw, x));
    const cy = Math.min(maxBottom, Math.max(minY, y));
    let fx = cx;
    const a = this.avoid;
    if (a && cy - TAG_H / 2 - 50 < a.y + a.h && cy + TAG_H / 2 + 60 > a.y && fx + hw > a.x && fx - hw < a.x + a.w) {
      // Slide sideways out from under the scoreboard (toward whichever side is nearer).
      const left = a.x - hw - 10, right = a.x + a.w + hw + 10;
      fx = Math.abs(fx - left) < Math.abs(fx - right) ? left : right;
      fx = Math.min(rect.x + rect.w - hw, Math.max(rect.x + hw, fx));
    }
    this.tag.setPosition(fx, cy);
  }

  destroy() { this.root.destroy(); }
}

function easeOutBack(u: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}
