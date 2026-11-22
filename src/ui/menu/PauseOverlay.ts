import Phaser from 'phaser';
import type { PlayerInput } from '../../core/types';
import { services } from '../../core/services';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/gameConfig';
import { MenuButton } from './MenuButton';
import { PerfBox } from '../hud/perfBox';
import { bigText, FONT_HEAD, MENU } from './style';

export interface PauseCallbacks {
  onResume: () => void;
  onQuit: () => void;
  onRestart: () => void;
}

/** Full-screen pause menu. Built at scrollFactor 0 for a single-camera scene (e.g. the HUD scene). */
export class PauseOverlay {
  private root: Phaser.GameObjects.Container;
  private buttons: MenuButton[];
  private actions: (() => void)[];
  private index = 0;
  private perfBox?: PerfBox;
  visible = false;

  /** `perfBox`: admin perf overlay is on, so show the Performance box beside the menu. */
  constructor(scene: Phaser.Scene, cb: PauseCallbacks, perfBox = false) {
    const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
    const dim = scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x050a1a, 0.72);
    const panel = scene.add.graphics();
    panel.fillStyle(MENU.navy, 0.96).fillRoundedRect(cx - 440, cy - 400, 880, 800, 50);
    panel.lineStyle(10, 0xffd43b, 1).strokeRoundedRect(cx - 440, cy - 400, 880, 800, 50);
    const title = bigText(scene, cx, cy - 290, 'PAUSED', 120, '#ffd43b', { font: FONT_HEAD, stroke: 14 });
    const labels = ['Resume', 'Restart', 'Quit to Title'];
    const colors = [0x2ecc40, 0x1e6fff, 0xff3b30];
    this.buttons = labels.map((l, i) => new MenuButton(scene, cx, cy - 90 + i * 170, 640, 120, l, colors[i], 64));
    this.actions = [cb.onResume, cb.onRestart, cb.onQuit];
    this.root = scene.add.container(0, 0, [dim, panel, title, ...this.buttons]);
    if (perfBox) {
      this.perfBox = new PerfBox(scene, cx + 430, cy - 400);
      this.root.add(this.perfBox.objects);
    }
    this.root.setScrollFactor(0).setDepth(10_000).setVisible(false);
  }

  show() {
    this.visible = true;
    this.index = 0;
    this.root.setVisible(true);
    this.perfBox?.refresh();
    this.refresh();
    services.audio.sfx('menuSelect');
  }

  hide() {
    this.visible = false;
    this.root.setVisible(false);
  }

  private refresh() { this.buttons.forEach((b, i) => b.setSelected(i === this.index)); }

  update(input: PlayerInput) {
    if (!this.visible) return;
    if (input.pause || input.back) { this.actions[0](); return; }
    if (input.navY !== 0) {
      const n = Phaser.Math.Wrap(this.index + input.navY, 0, this.buttons.length);
      if (n !== this.index) { this.index = n; this.refresh(); services.audio.sfx('menuMove'); }
    }
    if (input.confirm) {
      services.audio.sfx('menuSelect');
      this.buttons[this.index].pulse();
      this.actions[this.index]();
    }
  }

  destroy() { this.root.destroy(); }
}
