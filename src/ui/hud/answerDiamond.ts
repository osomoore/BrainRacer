import Phaser from 'phaser';
import type { AnswerSlot, ControllerFamily } from '../../core/types';
import { ANSWER_POSITIONS, faceButton } from '../../input/buttonPrompts';
import { bigText, hexNum } from '../menu/style';
import { bakedImage } from './bake';
import { diamondIconGeom } from './jbqLayout';

const RING = 0x14213d;       // dark ring around the active button (visible on the white row and on the green reveal)
const DIM = 0xb4bfd6;        // the three buttons this row does NOT use
const FAMILY_DIM_A = 0.5;    // Xbox: the other buttons keep their own colour, faded

/**
 * Mini face-button diamond for a JBQ answer row: four button circles in the pad's layout (left, top, right, bottom);
 * the one for `slot` is big and ringed in its colour (with its Switch letter or keyboard key on top), the rest small
 * and dim. The circles are baked into one texture per family x slot x size (cached); only the label is a Text.
 */
export function answerDiamondIcon(
  scene: Phaser.Scene, x: number, y: number, size: number, slot: AnswerSlot, family: ControllerFamily, keyLabel?: string,
): Phaser.GameObjects.Container {
  const geom = diamondIconGeom(size);
  const { color, label } = faceButton(family, ANSWER_POSITIONS[slot]);
  const key = `dia:${family}:${slot}:${size}`;
  const img = bakedImage(scene, key, size, size, 0, 0, (g, k) => {
    const c = (size / 2) * k;
    ANSWER_POSITIONS.forEach((_, i) => {
      const [dx, dy] = geom.centers[i];
      if (i === slot) return;
      const own = family === 'xbox' ? hexNum(faceButton(family, ANSWER_POSITIONS[i]).color) : DIM;
      g.fillStyle(own, family === 'xbox' ? FAMILY_DIM_A : 1).fillCircle(c + dx * k, c + dy * k, geom.small * k);
    });
    const [bx, by] = geom.centers[slot];
    g.fillStyle(0xffffff, 1).fillCircle(c + bx * k, c + by * k, geom.big * k + geom.ring * k);
    g.fillStyle(hexNum(color), 1).fillCircle(c + bx * k, c + by * k, geom.big * k);
    g.lineStyle(geom.ring * k, RING, 1).strokeCircle(c + bx * k, c + by * k, geom.big * k + geom.ring * k / 2);
  });
  const out = scene.add.container(x, y, [img]);
  const shown = keyLabel ?? label;
  if (shown) {
    const [bx, by] = geom.centers[slot];
    out.add(bigText(scene, bx, by, shown, Math.round(geom.big * (shown.length > 1 ? 0.9 : 1.1)), '#ffffff', { stroke: 4, shadow: false }));
  }
  return out;
}
