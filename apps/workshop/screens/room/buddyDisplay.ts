import type Phaser from 'phaser';
import { animateBuddyIdle, BUDDY_KINDS, buddyTexture, type BuddyKind } from '../../../../shared/buddies';
import { WS_BUDDIES } from '../../config';
import type { WorkshopBuddies } from '../../core/types';
import { COLORS, makeText, roundedTexture } from '../../ui/style';
import { facesLeft, flightPose, pointAngle } from './buddyFlight';
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
  if (w > h) {
    const inset = 14, iconW = 54;
    const stepW = Math.floor((w - 2 * inset - iconW - (steps - 1) * gap) / steps);
    const empty = roundedTexture(scene, stepW, stepHeight, 0x586091, segmentStyle);
    const filled = roundedTexture(scene, stepW, stepHeight, COLORS.yellow, segmentStyle);
    for (let i = 0; i < steps; i++) {
      const x = -w / 2 + inset + stepW / 2 + i * (stepW + gap);
      children.push(scene.add.image(x, 0, i < buddies.progress ? filled : empty));
    }
    if (buddies.unlocked.length < BUDDY_KINDS.length) {
      children.push(makeText(scene, w / 2 - inset - iconW / 2, 0, '?', { size: 46, color: COLORS.paper }));
    }
    return scene.add.container(at.x, at.y, children).setName('buddy-progress');
  }
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

export interface BuddyPose { x: number; y: number; angle: number }

/**
 * Flies the buddy along a curved, gently looping path to `to`, tilting along the path and ending pointing at `pointAt`
 * (or at a fixed `endAngle`). Returns the tween so the caller can cancel it.
 */
export function flyBuddy(
  scene: Phaser.Scene, buddy: Phaser.GameObjects.Image, pose: BuddyPose, to: { x: number; y: number },
  target: { pointAt?: { x: number; y: number }; endAngle?: number; endFlipX?: boolean },
): Phaser.Tweens.Tween {
  const from = { x: pose.x, y: pose.y };
  const endFlipX = target.pointAt ? facesLeft(to, target.pointAt, buddy.flipX) : target.endFlipX ?? (to.x < from.x ? true : to.x > from.x ? false : buddy.flipX);
  const endAngle = target.pointAt ? pointAngle(to, target.pointAt, endFlipX) : target.endAngle ?? 0;
  const side = to.x < from.x ? 1 : -1;
  const opts = { side, startAngle: pose.angle, startFlipX: buddy.flipX, endAngle, endFlipX } as const;
  const progress = { t: 0 };
  return scene.tweens.add({
    targets: progress, t: 1, duration: WS_BUDDIES.driftMs, ease: 'Sine.easeInOut',
    onUpdate: () => {
      const p = flightPose(from, to, progress.t, opts);
      pose.x = p.x; pose.y = p.y; pose.angle = p.angle;
      buddy.setFlipX(p.flipX);
    },
    onComplete: () => { pose.x = to.x; pose.y = to.y; pose.angle = endAngle; buddy.setFlipX(endFlipX); },
  });
}
