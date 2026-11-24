import type Phaser from 'phaser';
import { makeCanvas, type Ctx } from '../art/draw';
import { BUDDY_KINDS, buddyTexture, type UnlockBuddy } from './catalog';
import { paintCloudPuff } from './cloudArt';
import { EARLY_BUDDY_PAINTERS } from './earlyArt';
import { paintFirefly } from './fireflyArt';
import { paintJelly } from './jellyArt';
import { QUEUED_BUDDY_PAINTERS } from './queuedArt';
import { bakeStarterBuddies } from './starters';

const painters: Record<UnlockBuddy, (ctx: Ctx) => void> = {
  ...EARLY_BUDDY_PAINTERS,
  cloudPuff: paintCloudPuff,
  firefly: paintFirefly,
  jelly: paintJelly,
  ...QUEUED_BUDDY_PAINTERS,
};

/** Generate any missing buddy textures in the game's texture manager. */
export function bakeBuddyTextures(scene: Phaser.Scene): void {
  bakeStarterBuddies(scene);
  for (const kind of BUDDY_KINDS) {
    if (kind === 'dino' || kind === 'star') continue;
    const key = buddyTexture(kind);
    if (scene.textures.exists(key)) continue;
    const [width, height] = kind === 'cloudPuff' ? [94, 82] : [58, 58];
    const { ctx, done } = makeCanvas(scene, key, width, height);
    painters[kind](ctx);
    done();
  }
}
