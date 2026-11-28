import type Phaser from 'phaser';
import { DEPTH } from '../core/runtime';
import type { Vec } from '../core/types';
import { objectTexture } from './objectsArt';

type Reaction = 'ring' | 'snore' | 'wake' | 'croak' | 'shake' | 'hop';

export function reactToObject(
  scene: Phaser.Scene, id: string, at: Vec, reaction: Reaction,
): void {
  const image = scene.children.getByName(id) as Phaser.GameObjects.Image | undefined;
  if (!image?.visible || (reaction !== 'wake' && scene.tweens.isTweening(image))) return;
  const wakes = reaction === 'wake';
  const hops = reaction === 'croak' || reaction === 'hop';
  const rolls = reaction === 'snore';
  if (wakes) {
    scene.tweens.killTweensOf(image);
    image.setAngle(0).setTexture(objectTexture(scene, 'bearAwake'));
  }
  scene.tweens.add({
    targets: image,
    ...(hops ? { y: at.y - 24 } : { angle: rolls ? -23 : 13 }),
    ease: 'Sine.InOut',
    yoyo: true,
    repeat: wakes || reaction === 'ring' ? 2 : 0,
    duration: wakes ? 180 : 145,
    onComplete: () => { if (wakes) image.setTexture(objectTexture(scene, 'bear')); },
  });
  // Audio hook: trigger the matching bell, croak, yawn or snore cue here when World has object audio.
  if (reaction === 'shake' || reaction === 'hop' || wakes) return;
  const rings = scene.add.image(at.x, at.y, objectTexture(scene, 'ripple')).setDepth(DEPTH.popups);
  scene.tweens.add({
    targets: rings, scale: { from: 0.45, to: reaction === 'ring' ? 1.7 : 1.05 }, alpha: 0,
    duration: 530, onComplete: () => rings.destroy(),
  });
}
