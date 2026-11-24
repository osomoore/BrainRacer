import Phaser from 'phaser';
import { BUDDY_DINO_FRAMES, buddyPulse, buddyTexture, dinoFlapTexture, type BuddyKind } from '../../../../shared/buddies';
import { WS_BUDDIES } from '../../config';
import type { RigAnim } from '../../core/runtime';
import type { StageContext } from '../types';
import { buddyReaction, type BuddyCues, type BuddyReaction } from './buddyReaction';

const T = WS_BUDDIES.run;

/** One sprite in the stage layer. Reads the rig and never writes to it. */
export function runBuddy(ctx: StageContext, kind: BuddyKind, origin: { x: number; y: number }) {
  const { scene, layer, rig, size } = ctx;
  const top = ctx.stage.view === 'top';
  const px = size.w >= 1600 ? T.size.wide : T.size.tall;
  const image = scene.add.image(0, 0, buddyTexture(kind)).setName('run-buddy').setVisible(false);
  const scale = px / Math.max(image.width, image.height);
  const dino = BUDDY_DINO_FRAMES.some(key => key === image.texture.key);
  const world = new Phaser.GameObjects.Components.TransformMatrix();
  const parent = new Phaser.GameObjects.Components.TransformMatrix();
  const cues: BuddyCues = { leading: true, searching: false, slowed: false, passed: ctx.result.passed, ended: false };
  let elapsed = 0;
  let poseAge = 0;
  let reaction: BuddyReaction | undefined;
  let slowMs = 0;
  let wasMoving = false;
  let lastX = rig.root.x;
  let lastY = rig.root.y;
  let x = 0;
  let y = 0;

  function update(_time: number, dt: number): void {
    const ms = Math.min(dt, 50) * scene.tweens.timeScale;
    if (ms <= 0) return;
    elapsed += ms;
    cues.leading = elapsed < T.leadMs;
    const { x: rx, y: ry } = rig.root;
    const speed = (top ? Math.hypot(rx - lastX, ry - lastY) : Math.abs(rx - lastX)) * 1000 / ms;
    const gait = cues.anim === 'drive' || cues.anim === 'walk' || cues.anim === 'run';
    wasMoving = gait && (wasMoving || speed >= T.movingPxSec);
    slowMs = wasMoving && speed < T.slowPxSec ? slowMs + ms : 0;
    cues.slowed = slowMs >= T.slowHoldMs;
    lastX = rx;
    lastY = ry;

    const next = buddyReaction(cues);
    poseAge = next === reaction ? poseAge + ms : 0;
    reaction = next;
    const t = poseAge / 1000;
    rig.root.getWorldTransformMatrix(world, parent);
    const magnitude = Math.hypot(world.a, world.b);
    const dx = top && magnitude ? world.a / magnitude : Math.sign(rig.root.scaleX) || 1;
    const dy = top && magnitude ? world.b / magnitude : 0;
    const edge = rig.width * magnitude / 2;
    const flank = top ? rig.height * Math.hypot(world.c, world.d) / 2 + px * 0.35 : 0;
    let along = -edge - px * 0.55;
    let across = flank;
    let lift = Math.abs(Math.sin(t * 16)) * px * 0.1;
    let angle = 0;
    let squash = 1;
    let facing = dx < 0 ? -1 : 1;

    switch (reaction) {
      case 'lead':
        along = edge + px * (0.55 + Math.min(t * 2, 1.8));
        lift *= 2.5;
        angle = facing * 0.16;
        break;
      case 'push':
        along = -edge - px * (0.37 + 0.12 * Math.cos(t * 20));
        across = 0;
        lift = 0;
        angle = facing * 0.32;
        squash = 0.88 + 0.09 * Math.cos(t * 20);
        break;
      case 'search':
        along = edge + px * (1 + 0.65 * Math.sin(t * 5));
        lift = px * (0.55 + 0.35 * Math.sin(t * 5 + 1));
        angle = 0.28 * Math.sin(t * 8);
        facing *= Math.cos(t * 5) < 0 ? -1 : 1;
        break;
      case 'celebrate':
        lift = Math.abs(Math.sin(t * 9)) * px * 0.65;
        angle = 0.24 * Math.sin(t * 12);
        break;
      case 'shrug':
        lift = px * 0.17 * Math.sin(t * 7);
        angle = -facing * (0.25 + 0.2 * Math.sin(t * 8));
        squash = 0.85;
        break;
    }

    // The active stage is at its resting transform. Clamp to its pane even when the rig exits.
    const margin = px * 0.65;
    const targetX = Phaser.Math.Clamp(world.tx - origin.x + dx * along - dy * across, margin, size.w - margin);
    const targetY = Phaser.Math.Clamp(world.ty - origin.y + dy * along + dx * across - (top ? 0 : px * 0.42), margin, size.h - margin);
    const blend = image.visible ? 1 - Math.exp(-ms * T.followRate / 1000) : 1;
    x += (targetX - x) * blend;
    y += (targetY - y) * blend;
    const pulse = dino ? 1 : buddyPulse(elapsed / 1000, 8, reaction === 'celebrate');
    image.setPosition(x, y - lift).setVisible(true).setRotation(angle)
      .setScale(scale * pulse, scale * pulse * squash).setFlipX(facing < 0);
    if (dino) {
      const key = dinoFlapTexture(elapsed / 1000, reaction === 'shrug' ? 5 : 10);
      if (image.texture.key !== key) image.setTexture(key);
    }
  }

  const stop = () => scene.events.off('postupdate', update);
  layer.add(image);
  image.once('destroy', stop);
  return {
    start() {
      layer.bringToTop(image);
      lastX = rig.root.x;
      lastY = rig.root.y;
      scene.events.on('postupdate', update);
    },
    stop,
    finish() { cues.ended = true; },
    search(active: boolean) { cues.searching = active; },
    rigAnim(anim: RigAnim) { cues.anim = anim; },
  };
}
