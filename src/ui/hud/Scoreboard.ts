import Phaser from 'phaser';
import { PLAYER_COLORS } from '../../config/gameConfig';
import { bigText, FONT_HEAD } from '../menu/style';
import { HUD, scoreboardRect } from './hudConfig';
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

  constructor(private scene: Phaser.Scene, numPlayers: number, depth: number) {
    this.numPlayers = numPlayers;
    const { x, y, w, h } = scoreboardRect(numPlayers);
    const two = numPlayers > 1;
    const bg = scene.add.graphics();
    bg.fillStyle(HUD.colors.navy, 0.9).fillRoundedRect(-w / 2, 0, w, h, 34);
    bg.lineStyle(7, HUD.colors.gold, 1).strokeRoundedRect(-w / 2, 0, w, h, 34);
    const label = bigText(scene, -w / 2 + 28, 66, 'TEAM', 46, '#ffd43b', { font: FONT_HEAD, stroke: 8, origin: [0, 0.5] });
    this.teamText = bigText(scene, w / 2 - 28, 66, '0', 104, '#ffffff', { font: FONT_HEAD, stroke: 12, origin: [1, 0.5] });
    this.plusText = bigText(scene, 0, h + 40, '', 64, '#7dff8a', { font: FONT_HEAD, stroke: 9 }).setAlpha(0);
    const y2 = 138, y3 = two ? 208 : 152;
    this.timer = bigText(scene, 0, y3, '00:00', 60, '#ffffff', { font: FONT_HEAD, stroke: 9 });
    const items: Phaser.GameObjects.GameObject[] = [bg, label, this.teamText, this.timer];
    if (numPlayers > 1) {
      for (let p = 0; p < numPlayers; p++) {
        const sign = p === 0 ? -1 : 1;
        const t = bigText(scene, sign * 95, y2, `P${p + 1} 0`, 48, PLAYER_COLORS[p], { font: FONT_HEAD, stroke: 9 });
        this.pText.push(t);
        items.push(t);
      }
    }
    this.plusY = h + 40;
    items.push(this.plusText);
    this.root = scene.add.container(x + w / 2, y, items).setDepth(depth);
  }

  /** Screen point the "+1" should fly to. */
  target(): { x: number; y: number } { return { x: this.root.x + 60, y: this.root.y + 66 }; }

  setScore(team: number, perPlayer: number[]) {
    const d = team - this.team;
    this.team = team;
    this.teamText.setText(String(team));
    this.pText.forEach((t, p) => t.setText(`P${p + 1} ${perPlayer[p] ?? 0}`));
    if (d > 0) this.bump(d);
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
    this.timer.setText(formatTime(this.remaining));
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

  private timerColor = '#ffffff';
  private setTimerColor(c: string) {
    if (c === this.timerColor) return; // setColor re-renders the text texture: only on change
    this.timerColor = c;
    this.timer.setColor(c);
  }

  get players() { return this.numPlayers; }
  destroy() { this.root.destroy(); }
}
