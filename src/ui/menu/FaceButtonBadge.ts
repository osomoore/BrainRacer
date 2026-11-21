import Phaser from 'phaser';
import type { ControllerFamily } from '../../core/types';
import { ANSWER_POSITIONS, faceButton, type FacePosition } from '../../input/buttonPrompts';
import { bigText, hexNum } from './style';

const DOT_OFFSETS = [[-1, 0], [0, -1], [1, 0], [0, 1]] as const;

/** Draws the printed face button, or highlights its position on a generic four-button diamond. */
export class FaceButtonBadge extends Phaser.GameObjects.Container {
  private readonly cap: Phaser.GameObjects.Arc;
  private readonly label: Phaser.GameObjects.Text;
  private readonly diamond: Phaser.GameObjects.Container;
  private family?: ControllerFamily;

  constructor(
    scene: Phaser.Scene, x: number, y: number, size: number,
    private readonly facePosition: FacePosition, family: ControllerFamily = 'other', private readonly keyLabel?: string,
  ) {
    super(scene, x, y);
    this.cap = scene.add.circle(0, 0, size / 2).setStrokeStyle(4, 0xffffff);
    this.label = bigText(scene, 0, 0, '', size * 0.7, '#ffffff', { stroke: 5, shadow: false });
    const dots = DOT_OFFSETS.map(([dx, dy], i) => {
      const active = ANSWER_POSITIONS[i] === facePosition;
      return scene.add.circle(dx * size * 0.25, dy * size * 0.25, size * (active ? 0.13 : 0.10), active ? 0xffffff : 0x8294b8);
    });
    this.diamond = scene.add.container(0, 0, dots);
    this.add([this.cap, this.label, this.diamond]);
    this.setFamily(family);
    scene.add.existing(this);
  }

  setFamily(family: ControllerFamily) {
    if (family === this.family) return;
    this.family = family;
    const { label, color } = faceButton(family, this.facePosition);
    const shown = this.keyLabel ?? label;
    this.cap.setFillStyle(hexNum(color));
    this.label.setText(shown).setVisible(!!shown);
    this.diamond.setVisible(!shown && family === 'other');  // xbox: plain colored cap, no letter
  }
}

/** A centered bottom-button prompt that works for a shared screen before either player joins. */
export class ConfirmPrompt extends Phaser.GameObjects.Container {
  private readonly badge: FaceButtonBadge;

  constructor(scene: Phaser.Scene, x: number, y: number, action: string, textSize = 52) {
    super(scene, x, y);
    const before = bigText(scene, 0, 0, 'Press', textSize);
    const after = bigText(scene, 0, 0, action, textSize);
    const badgeSize = 62, gap = 20;
    const left = -(before.width + badgeSize + after.width + gap * 2) / 2;
    before.setX(left + before.width / 2);
    this.badge = new FaceButtonBadge(scene, left + before.width + gap + badgeSize / 2, 0, badgeSize, 'bottom');
    after.setX(left + before.width + badgeSize + gap * 2 + after.width / 2);
    this.add([before, this.badge, after]);
    scene.add.existing(this);
  }

  setFamily(family: ControllerFamily) { this.badge.setFamily(family); }
}
