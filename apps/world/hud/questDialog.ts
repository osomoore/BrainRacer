import Phaser from 'phaser';
import { BUTTONS, WORLD, WORLD_QUEST_HUD } from '../config';
import type { WorldContext, WorldPlayer } from '../core/runtime';
import { bakeDisc, bakeIcons, bakePlate, iconKey } from './icons';

const KEY = 'WorldQuestDialog';
const C = BUTTONS.card;
const PANEL = 'world-quest-dialog';
const FONT = 'Arial, sans-serif';
type Choice = 'accept' | 'decline';
type View = { root: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text; hints: Phaser.GameObjects.Container[]; choices: Phaser.GameObjects.Text[] };

export function padConnected(): boolean {
  try { return Array.from(navigator.getGamepads?.() ?? []).some(pad => pad?.connected); }
  catch { return false; }
}

class QuestDialogScene extends Phaser.Scene {
  constructor(private readonly setup: (scene: Phaser.Scene) => void) { super(KEY); }
  create(): void { this.setup(this); }
}

/** Screen-space presentation. The quest runtime owns the offer and validates the choice. */
export class QuestDialog {
  private readonly views = new Map<WorldPlayer, View>();

  constructor(private readonly ctx: WorldContext, private readonly choose: (player: WorldPlayer, choice: Choice) => void) {
    const manager = ctx.scene.scene;
    if (manager.get(KEY)) manager.remove(KEY);
    manager.add(KEY, new QuestDialogScene(scene => this.build(scene)), true);
  }

  show(player: WorldPlayer, text: string): boolean {
    const view = this.views.get(player);
    if (!view) return false;
    view.text.setText(text);
    const simple = player.reading === 'starter' || player.reading === 'easy';
    view.choices[0].setText(simple ? 'Yes' : 'Accept');
    view.choices[1].setText(simple ? 'No' : 'No thanks');
    view.hints.forEach(hint => hint.setVisible(padConnected()));
    view.root.setVisible(true);
    return true;
  }

  hide(player: WorldPlayer): void { this.views.get(player)?.root.setVisible(false); }

  destroy(): void {
    const manager = this.ctx.scene.scene;
    if (manager.get(KEY)) manager.remove(KEY);
    this.views.clear();
  }

  private build(scene: Phaser.Scene): void {
    const width = WORLD.width / this.ctx.players.length;
    const panelW = C.width, panelH = 508;
    bakeIcons(scene);
    bakeDisc(scene, `${PANEL}:a`, 30, 0x13613b, 0xffffff);
    bakeDisc(scene, `${PANEL}:b`, 30, 0x84343c, 0xffffff);
    bakePlate(scene, PANEL, panelW, panelH, 0x152640, 0.98, 44, 0xffdf66);
    const buttons = [
      { id: 'accept', label: 'Accept', icon: 'tick', key: 'A', color: 0x13613b },
      { id: 'decline', label: 'No thanks', icon: 'cross', key: 'B', color: 0x84343c },
    ] as const;
    for (const { id, color } of buttons) bakePlate(scene, `${PANEL}:${id}`, 300, C.btnHeight, color, 1, 34);
    for (const player of this.ctx.players) {
      const root = scene.add.container(width * (player.index + 0.5), WORLD.height / 2).setVisible(false);
      const dim = scene.add.rectangle(0, 0, width, WORLD.height, 0x000000, C.dim);
      const panel = scene.add.image(0, 0, PANEL);
      const icon = scene.add.image(0, -185, iconKey('quest')).setDisplaySize(86, 86);
      const text = scene.add.text(0, -54, '', {
        fontFamily: FONT, fontStyle: 'bold', fontSize: `${C.fontSize}px`, color: '#fff7df', align: 'center',
        wordWrap: { width: panelW - 100, useAdvancedWrap: true },
      }).setOrigin(0.5);
      root.add([dim, panel, icon, text]);
      const hints: Phaser.GameObjects.Container[] = [];
      const choices: Phaser.GameObjects.Text[] = [];
      buttons.forEach(({ id, label, icon, key }, i) => {
        const x = i === 0 ? -165 : 165, y = 142;
        const button = scene.add.image(x, y, `${PANEL}:${id}`).setInteractive({ useHandCursor: true });
        button.on('pointerdown', () => { if (root.visible) this.choose(player, id); });
        const art = scene.add.image(x - 102, y, iconKey(icon)).setDisplaySize(54, 54);
        const caption = scene.add.text(x + 22, y, label, {
          fontFamily: FONT, fontStyle: 'bold', fontSize: `${WORLD_QUEST_HUD.questFont}px`, color: '#ffffff',
        }).setOrigin(0.5);
        const hintX = x + 111, hintY = y - 56;
        const hint = scene.add.text(0, -1, key, {
          fontFamily: FONT, fontStyle: 'bold', fontSize: '30px', color: '#ffffff',
        }).setOrigin(0.5);
        const badge = scene.add.container(hintX, hintY, [
          scene.add.image(0, 0, `${PANEL}:${key.toLowerCase()}`).setDisplaySize(60, 60), hint,
        ]);
        root.add([button, art, caption, badge]);
        hints.push(badge);
        choices.push(caption);
      });
      this.views.set(player, { root, text, hints, choices });
    }
  }
}
