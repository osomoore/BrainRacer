import Phaser from 'phaser';
import { WORLD_ACTIVITIES } from '../../config';
import { DEPTH, type ActivityKindDef, type WorldContext } from '../../core/runtime';
import type { ActivitySite, Vec } from '../../core/types';
import { lanternScale, startCave, stepCave } from './lanternCave/state';

const TUNING = WORLD_ACTIVITIES.lanternCave;
const lanternsFor = (site: ActivitySite) => site.targets.filter(target => target.role === 'lantern').map(target => target.at);
const lanternAngle = (from: Vec, at: Vec) => Math.atan2(at.y - from.y, at.x - from.x) + Math.PI / 2;

function glowTexture(scene: Phaser.Scene): string {
  const key = 'world-activity-lantern-glow';
  if (scene.textures.exists(key)) return key;
  const r = 64;
  const texture = scene.textures.createCanvas(key, 2 * r, 2 * r)!;
  const g = texture.context;
  const glow = g.createRadialGradient(r, r, 0, r, r, r);
  glow.addColorStop(0, 'rgba(255,185,74,0.58)');
  glow.addColorStop(0.42, 'rgba(255,169,66,0.26)');
  glow.addColorStop(1, 'rgba(255,162,59,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 2 * r, 2 * r);
  texture.refresh();
  return key;
}

function drawLantern(ctx: WorldContext, at: Vec, scale: number, angle: number, active: boolean) {
  const { add } = ctx.scene;
  const metal = active ? 0xe4c693 : 0xa1856c;
  const handle = add.circle(0, -13, 9, 0x503e35).setStrokeStyle(3, metal);
  const frame = add.rectangle(0, 2, 26, 26, 0x503e35).setStrokeStyle(3, metal);
  const glass = add.rectangle(0, 2, 16, 17, active ? 0xb27949 : 0x907967);
  const wick = add.rectangle(0, 7, 4, 7, 0x503e35);
  const foot = add.rectangle(0, 16, 30, 5, metal);
  const sprite = add.container(at.x, at.y, [handle, frame, glass, wick, foot]).setScale(scale).setRotation(angle)
    .setDepth(active ? DEPTH.darkness + 1 : DEPTH.canopy + 1);
  return { sprite, glass };
}

const lanternCave: ActivityKindDef = {
  kind: 'lanternCave',
  decorate(ctx, site) {
    const lanterns = lanternsFor(site);
    const size = Math.max(0.6, lanternScale(lanterns));
    const objects = lanterns.map(at => drawLantern(ctx, at, size, lanternAngle(site.at, at), false).sprite);
    return () => objects.forEach(object => object.destroy());
  },
  start(ctx, site, player) {
    const lanterns = lanternsFor(site);
    const scale = lanternScale(lanterns);
    const size = Math.max(0.6, scale);
    const texture = glowTexture(ctx.scene);
    const glowSize = 2 * size * TUNING.glowRadius;
    const glows = lanterns.map(at => ctx.scene.add.image(at.x, at.y, texture)
      .setDisplaySize(glowSize, glowSize).setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.darkness + 0.5).setVisible(false));
    const props = lanterns.map(at => drawLantern(ctx, at, size, lanternAngle(site.at, at), true));
    const objects = [...glows, ...props.map(prop => prop.sprite)];
    objects.forEach(object => ctx.showOnlyTo(object, player));
    const banner = (text: string) => ctx.bus.emit('ui:banner', { player, text });
    banner(player.traits.height > TUNING.maxHeight ? 'Low roof! Try a shorter ride.' : 'Touch the lanterns!');
    let state = startCave(lanterns.length);

    return {
      update(dt) {
        const previous = state;
        state = stepCave(state, lanterns, player.move, player.traits.height, player.traits.light,
          player.surface.covered && player.move.airborne === 0, scale, dt);
        state.lit.forEach((on, index) => {
          if (!on || previous.lit[index]) return;
          props[index].glass.setFillStyle(0xfff6a4);
          glows[index].setVisible(true);
        });
        if (previous.celebrating === undefined && state.celebrating !== undefined) banner('All lit up!');
        return state.outcome;
      },
      destroy() { objects.forEach(object => object.destroy()); },
    };
  },
};

export default lanternCave;
