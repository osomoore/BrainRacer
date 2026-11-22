/**
 * Banner / toast: a rounded message strip that pops in, stays `ms`, and removes itself.
 *
 *   showBanner(scene, { x: w / 2, y: 140, text: 'New part unlocked!', color: COLORS.yellow, ms: 2200 });
 *
 * Returns the container (destroy it early if the screen closes). Text >= 40 px, no comic word popups (rule 14):
 * use it for messages, not for "POW!".
 */
import Phaser from 'phaser';
import { COLORS, makeText, roundedOriginY, roundedTexture } from './style';

export interface BannerOpts { x: number; y: number; text: string; color?: number; textColor?: number; ms?: number; maxW?: number; depth?: number }

export function showBanner(scene: Phaser.Scene, o: BannerOpts): Phaser.GameObjects.Container {
  const t = makeText(scene, 0, 0, o.text, { size: 48, color: o.textColor ?? COLORS.ink, wrap: (o.maxW ?? 900) - 60 });
  const w = Math.min(o.maxW ?? 900, Math.ceil(t.width) + 80);
  const h = Math.ceil(t.height) + 50;
  const bg = scene.add.image(0, 0, roundedTexture(scene, w, h, o.color ?? COLORS.yellow, { radius: h / 2 })).setOrigin(0.5, roundedOriginY(h));
  const c = scene.add.container(o.x, o.y, [bg, t]).setDepth(o.depth ?? 800).setScale(0.6).setAlpha(0);
  scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 160, ease: 'Back.Out' });
  scene.tweens.add({
    targets: c, alpha: 0, delay: o.ms ?? 2000, duration: 250,
    onComplete: () => { if (c.scene) c.destroy(); },
  });
  return c;
}
