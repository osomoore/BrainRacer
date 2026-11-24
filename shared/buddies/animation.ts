import type Phaser from 'phaser';
import { BUDDY_DINO_FRAMES } from './catalog';

const FLAP = [0, 1, 2, 1] as const;

export function dinoFlapTexture(elapsedSec: number, fps: number): string {
  return BUDDY_DINO_FRAMES[FLAP[Math.floor(elapsedSec * fps) % FLAP.length]];
}

export function buddyBob(elapsedSec: number, hz: number, amplitude: number): number {
  return Math.sin(elapsedSec * Math.PI * 2 * hz) * amplitude;
}

export function buddyPulse(elapsedSec: number, blinkRate: number, happy: boolean): number {
  return 1 + 0.13 * Math.sin(elapsedSec * blinkRate) + (happy ? 0.12 * Math.sin(elapsedSec * 14) : 0);
}

export function buddyWobble(elapsedSec: number): number {
  return Math.sin(elapsedSec * 3) * 0.18;
}

/** Animate a buddy image around its current pose. Updates stop when the image is destroyed. */
export function animateBuddyIdle(
  scene: Phaser.Scene, image: Phaser.GameObjects.Image, pose?: { x: number; y: number; angle: number },
): void {
  const { y, rotation, scaleX, scaleY } = image;
  const isDino = BUDDY_DINO_FRAMES.some(key => key === image.texture.key);
  let elapsedSec = 0;

  function update(_time: number, delta: number): void {
    elapsedSec += delta / 1000;
    if (pose) image.x = pose.x;
    image.y = (pose?.y ?? y) + buddyBob(elapsedSec, 1.4, 9);
    const tilt = pose ? pose.angle * Math.PI / 180 : rotation;
    if (isDino) {
      image.setRotation(tilt);
      const key = dinoFlapTexture(elapsedSec, 10);
      if (image.texture.key !== key) image.setTexture(key);
    } else {
      const pulse = buddyPulse(elapsedSec, 8, false);
      image.setScale(scaleX * pulse, scaleY * pulse).setRotation(tilt + buddyWobble(elapsedSec));
    }
  }

  scene.events.on('update', update);
  image.once('destroy', () => scene.events.off('update', update));
}
