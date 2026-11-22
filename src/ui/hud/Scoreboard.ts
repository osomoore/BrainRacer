import Phaser from 'phaser';
import { PLAYER_COLORS } from '../../config/gameConfig';
import { COMPLETION_OBJECTIVES } from '../../core/progression';
import { bigText, FONT_HEAD } from '../menu/style';
import { bakedImage, rrectImage } from './bake';
import { HUD, scoreboardLayout } from './hudConfig';
import { formatTime } from './hudMath';

/** Team score, per-player points and the round timer. */
export class Scoreboard {
  readonly root: Phaser.GameObjects.Container;
  private teamText: Phaser.GameObjects.Text;
  private plusText: Phaser.GameObjects.Text;
  private pText: Phaser.GameObjects.Text[] = [];
  private timer: Phaser.GameObjects.Text;
  private remaining = 0;
  private pulseT = 0;
  private team = 0;
  private numPlayers: number;
  private plusY = 0;
  private goals = 0;
  private goalsMax = COMPLETION_OBJECTIVES;
  private flagScale = 1;
  private fly = { x: 60, y: 66 };
  private flagOff!: Phaser.GameObjects.Image;
  private flagOn!: Phaser.GameObjects.Image;
  private goalText!: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene, numPlayers: number, depth: number) {
    this.numPlayers = numPlayers;
    const L = scoreboardLayout(numPlayers);
    const { x, y, w, h } = L.rect;
    const bg = rrectImage(scene, { r: 34, fill: HUD.colors.navy, fillA: 0.9, stroke: HUD.colors.gold, strokeW: 7 }, 0, h / 2, w, h);
    const label = bigText(scene, L.label.x, L.label.y, L.label.text, L.label.size, '#ffd43b', { font: FONT_HEAD, stroke: 8, origin: L.label.origin });
    this.teamText = bigText(scene, L.team.x, L.team.y, '0', L.team.size, '#ffffff', { font: FONT_HEAD, stroke: 12, origin: L.team.origin });
    this.plusText = bigText(scene, 0, h + 40, '', 64, '#7dff8a', { font: FONT_HEAD, stroke: 9 }).setAlpha(0);
    this.timer = bigText(scene, L.timer.x, L.timer.y, '00:00', L.timer.size, '#ffffff', { font: FONT_HEAD, stroke: 9 });
    this.flagScale = L.flagScale;
    this.flagOff = this.makeFlag(L.goals.x, L.goals.y, 0xffd43b).setScale(this.flagScale);
    this.flagOn = this.makeFlag(L.goals.x, L.goals.y, 0x7dff8a).setScale(this.flagScale).setVisible(false);
    this.goalText = bigText(scene, L.goals.x + L.goals.dx, L.goals.y, `0/${this.goalsMax}`, L.goals.size, '#ffffff', { font: FONT_HEAD, stroke: 9, origin: [0, 0.5] });
    const items: Phaser.GameObjects.GameObject[] = [bg, label, this.teamText, this.timer, this.flagOff, this.flagOn, this.goalText];
    for (let p = 0; p < L.pts.length; p++) {
      const t = bigText(scene, L.pts[p].x, L.pts[p].y, `P${p + 1} 0`, L.ptsSize, PLAYER_COLORS[p], { font: FONT_HEAD, stroke: 9 });
      this.pText.push(t);
      items.push(t);
    }
    this.plusY = h + 40;
    this.fly = L.fly;
    items.push(this.plusText);
    this.root = scene.add.container(x + w / 2, y, items).setDepth(depth);
  }

  /** Screen point the "+1" should fly to. */
  target(): { x: number; y: number } { return { x: this.root.x + this.fly.x, y: this.root.y + this.fly.y }; }

  setScore(team: number, perPlayer: number[]) {
    const d = team - this.team;
    this.team = team;
    this.teamText.setText(String(team));
    this.pText.forEach((t, p) => t.setText(`P${p + 1} ${perPlayer[p] ?? 0}`)); // Phaser skips unchanged text
    if (d > 0) this.bump(d);
  }

  /** World-completion goals done this race (clamped to max; shown green once complete). */
  setGoals(n: number, max = COMPLETION_OBJECTIVES) {
    const v = Math.min(n, max);
    if (v === this.goals && max === this.goalsMax) return;
    const up = v > this.goals;
    this.goals = v;
    this.goalsMax = max;
    const done = v >= max;
    this.goalText.setText(`${v}/${max}`).setColor(done ? '#7dff8a' : '#ffffff');
    this.flagOff.setVisible(!done);
    this.flagOn.setVisible(done);
    if (up) {
      const flag = done ? this.flagOn : this.flagOff;
      this.scene.tweens.killTweensOf([this.goalText, flag]);
      this.scene.tweens.add({ targets: this.goalText, scale: { from: 1.5, to: 1 }, duration: 420, ease: 'Back.easeOut' });
      this.scene.tweens.add({ targets: flag, scale: { from: 1.5 * this.flagScale, to: this.flagScale }, duration: 420, ease: 'Back.easeOut' });
    }
  }

  private makeFlag(x: number, y: number, color: number) {
    const img = bakedImage(this.scene, `goalflag:${color}`, 36, 48, x, y, (g, k) => {
      g.fillStyle(0x0b1226, 1).fillRect(4 * k, 2 * k, 6 * k, 44 * k); // outline pole
      g.fillStyle(0xffffff, 1).fillRect(5.5 * k, 3 * k, 3 * k, 42 * k);
      g.fillStyle(0x0b1226, 1).fillTriangle(8 * k, 2 * k, 34 * k, 14 * k, 8 * k, 28 * k);
      g.fillStyle(color, 1).fillTriangle(9 * k, 6 * k, 28 * k, 14 * k, 9 * k, 24 * k);
    });
    return img;
  }

  bump(delta: number) {
    this.scene.tweens.killTweensOf(this.teamText);
    this.scene.tweens.add({ targets: this.teamText, scale: { from: 1.6, to: 1 }, duration: 420, ease: 'Back.easeOut' });
    this.plusText.setText(`+${delta}`).setAlpha(1).setY(this.plusY + 20).setScale(0.6);
    this.scene.tweens.killTweensOf(this.plusText);
    this.scene.tweens.add({ targets: this.plusText, scale: 1.2, duration: 160, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: this.plusText, y: this.plusY - 25, alpha: 0, delay: 260, duration: 700, ease: 'Sine.easeIn' });
  }

  setRemaining(sec: number) { this.remaining = sec; }

  update(dt: number) {
    const label = formatTime(this.remaining);
    if (label !== this.timerLabel) { this.timerLabel = label; this.timer.setText(label); }
    const urgent = this.remaining <= HUD.timerWarnSec && this.remaining > 0;
    if (urgent) {
      this.pulseT += dt;
      const k = 1 + 0.12 * Math.abs(Math.sin(this.pulseT * 5));
      this.setTimerColor('#ff5a4d');
      this.timer.setScale(k);
    } else {
      this.pulseT = 0;
      this.setTimerColor('#ffffff');
      this.timer.setScale(1);
    }
  }

  private timerLabel = '00:00';
  private timerColor = '#ffffff';
  private setTimerColor(c: string) {
    if (c === this.timerColor) return; // setColor re-renders the text texture: only on change
    this.timerColor = c;
    this.timer.setColor(c);
  }

  get players() { return this.numPlayers; }
  destroy() { this.root.destroy(); }
}
