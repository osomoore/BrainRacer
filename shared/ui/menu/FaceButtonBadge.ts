import Phaser from 'phaser';
import { bigText, hexNum } from './style';
import { ANSWER_POSITIONS, faceButton, type ControllerFamily, type FacePosition } from './promptMapping';
export type { ControllerFamily, FacePosition } from './promptMapping';
const DOT_OFFSETS = [[-1, 0], [0, -1], [1, 0], [0, 1]] as const;

/** Controller face button or a highlighted position on a generic four-button diamond. */
export class FaceButtonBadge extends Phaser.GameObjects.Container {
  private readonly cap: Phaser.GameObjects.Arc;
  private readonly label: Phaser.GameObjects.Text;
  private readonly diamond: Phaser.GameObjects.Container;
  private family?: ControllerFamily;
  constructor(scene: Phaser.Scene, x: number, y: number, size: number, private readonly facePosition: FacePosition, family: ControllerFamily = 'other', private readonly keyLabel?: string) {
    super(scene, x, y);
    this.cap = scene.add.circle(0, 0, size / 2).setStrokeStyle(4, 0xffffff);
    this.label = bigText(scene, 0, 0, '', size * 0.7, '#ffffff', { stroke: 5, shadow: false });
    this.diamond = scene.add.container(0, 0, DOT_OFFSETS.map(([dx, dy], i) => scene.add.circle(dx * size * 0.25, dy * size * 0.25, size * (ANSWER_POSITIONS[i] === facePosition ? 0.13 : 0.10), ANSWER_POSITIONS[i] === facePosition ? 0xffffff : 0x8294b8)));
    this.add([this.cap, this.label, this.diamond]); this.setFamily(family); scene.add.existing(this);
  }
  setFamily(family: ControllerFamily): void {
    if (family === this.family) return;
    this.family = family;
    const { label, color } = faceButton(family, this.facePosition), shown = this.keyLabel ?? label;
    this.cap.setFillStyle(hexNum(color)); this.label.setText(shown).setVisible(!!shown);
    this.diamond.setVisible(!shown && family === 'other');
  }
}

/** Centered prompt with an app-independent label for a confirm button. */
export class ConfirmPrompt extends Phaser.GameObjects.Container {
  private readonly badge: FaceButtonBadge;
  constructor(scene: Phaser.Scene, x: number, y: number, action: string, textSize = 52) {
    super(scene, x, y);
    const before = bigText(scene, 0, 0, 'Press', textSize);
    const after = bigText(scene, 0, 0, action, textSize);
    const badgeSize = 62, gap = 20, left = -(before.width + badgeSize + after.width + gap * 2) / 2;
    before.setX(left + before.width / 2);
    this.badge = new FaceButtonBadge(scene, left + before.width + gap + badgeSize / 2, 0, badgeSize, 'bottom');
    after.setX(left + before.width + badgeSize + gap * 2 + after.width / 2);
    this.add([before, this.badge, after]); scene.add.existing(this);
  }
  setFamily(family: ControllerFamily): void { this.badge.setFamily(family); }
}
