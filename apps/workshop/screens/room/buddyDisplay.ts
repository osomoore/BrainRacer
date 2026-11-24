import type Phaser from 'phaser';
import { animateBuddyIdle, BUDDY_KINDS, buddyTexture, type BuddyKind } from '../../../../shared/buddies';
import { WS_BUDDIES } from '../../config';
import type { WorkshopBuddies } from '../../core/types';
import { COLORS, makeText, roundedTexture } from '../../ui/style';
import type { Rect } from './layout';

export function buddyImage(scene: Phaser.Scene, kind: BuddyKind, x: number, y: number, size: number): Phaser.GameObjects.Image {
  const image = scene.add.image(x, y, buddyTexture(kind));
  return image.setScale(size / Math.max(image.width, image.height));
}

export function buddyBar(scene: Phaser.Scene, at: Rect, buddies: WorkshopBuddies): Phaser.GameObjects.Container {
  const children: Phaser.GameObjects.GameObject[] = [];
  const { w, h } = at;
  const bg = roundedTexture(scene, w, h, 0x232a66, { shadow: 0, gloss: false });
  children.push(scene.add.image(0, 0, bg));
  const steps = WS_BUDDIES.winsPerUnlock;
  const stepHeight = 36;
  const gap = 6;
  const segmentStyle = { shadow: 0, gloss: false, strokeW: 2, radius: 8 };
  const empty = roundedTexture(scene, w - 22, stepHeight, 0x586091, segmentStyle);
  const filled = roundedTexture(scene, w - 22, stepHeight, COLORS.yellow, segmentStyle);
  for (let i = 0; i < steps; i++) {
    const y = h / 2 - 13 - stepHeight / 2 - i * (stepHeight + gap);
    children.push(scene.add.image(0, y, i < buddies.progress ? filled : empty));
  }
  if (buddies.unlocked.length < BUDDY_KINDS.length) {
    children.push(makeText(scene, 0, -h / 2 + 42, '?', { size: 58, color: COLORS.paper }));
  }
  return scene.add.container(at.x, at.y, children).setName('buddy-progress');
}

export function buddyCelebration(scene: Phaser.Scene, x: number, y: number, kind: BuddyKind): Phaser.GameObjects.Container {
  const panel = scene.add.image(0, 0, roundedTexture(scene, 330, 255, COLORS.yellow, { shadow: 0 }));
  const title = makeText(scene, 0, -80, 'New buddy!', { size: 48 });
  const image = buddyImage(scene, kind, 0, 32, 132);
  animateBuddyIdle(scene, image);
  return scene.add.container(x, y, [panel, title, image]).setDepth(700).setName('buddy-celebration');
}
