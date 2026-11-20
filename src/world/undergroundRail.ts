import type Phaser from 'phaser';
import { DEPTH, UNDERGROUND } from '../config/gameConfig';
import type { Vec2 } from '../core/types';
import { UNDERGROUND_RAIL_LOOPS } from './gen/underground';
import { block, glow, undergroundTexture } from './undergroundArt';
import { mineTrainPart, RAIL_COLORS } from './undergroundRailArt';

type Palette = typeof RAIL_COLORS[number];
type Image = Phaser.GameObjects.Image;
interface Track { path: Vec2[]; starts: number[]; length: number }

const TRAIN_PARTS = ['engine', 'ore', 'tail'] as const;
const CAR_DISTANCE = [0, 98, 184] as const;
// The 180 × 144 textures include transparent padding and glow around these chassis.
const CAR_LENGTH = [100, 76, 76] as const;
const CAR_WIDTH = 54;
const TRAINS_PER_LOOP = 2;
const LAMP_STEP = 144;

function buildTrack(points: readonly Vec2[], size: number): Track {
  const path: Vec2[] = [];
  for (let i = 0; i < points.length; i++) {
    const corner = points[i], prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
    const entry = { x: corner.x * .82 + prev.x * .18, y: corner.y * .82 + prev.y * .18 };
    const exit = { x: corner.x * .82 + next.x * .18, y: corner.y * .82 + next.y * .18 };
    for (let step = 0; step <= 6; step++) {
      const t = step / 6, u = 1 - t;
      path.push({ x: size * (u * u * entry.x + 2 * u * t * corner.x + t * t * exit.x),
        y: size * (u * u * entry.y + 2 * u * t * corner.y + t * t * exit.y) });
    }
  }
  const starts: number[] = [];
  let length = 0;
  for (let i = 0; i < path.length; i++) {
    starts.push(length);
    const a = path[i], b = path[(i + 1) % path.length];
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return { path, starts, length };
}

const wrap = (value: number, span: number) => ((value % span) + span) % span;

function trackPose(track: Track, distance: number): Vec2 & { angle: number } {
  const d = wrap(distance, track.length);
  let i = 0;
  while (i + 1 < track.starts.length && track.starts[i + 1] <= d) i++;
  const a = track.path[i], b = track.path[(i + 1) % track.path.length];
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = (d - track.starts[i]) / Math.hypot(dx, dy);
  return { x: a.x + dx * t, y: a.y + dy * t, angle: Math.atan2(dy, dx) };
}

function railTexture(scene: Phaser.Scene, track: Track, color: Palette) {
  const x = Math.floor(Math.min(...track.path.map(p => p.x))) - 52;
  const y = Math.floor(Math.min(...track.path.map(p => p.y))) - 52;
  const w = Math.ceil(Math.max(...track.path.map(p => p.x))) - x + 52;
  const h = Math.ceil(Math.max(...track.path.map(p => p.y))) - y + 52;
  const key = undergroundTexture(scene, `neon_rail_${color.name}`, w, h, c => {
    c.translate(-x, -y);
    const stroke = (offset: number, width: number, tint: string) => {
      c.strokeStyle = tint; c.lineWidth = width; c.lineJoin = 'round'; c.beginPath();
      for (let d = 0; d < track.length; d += 8) {
        const pose = trackPose(track, d);
        const xx = pose.x - Math.sin(pose.angle) * offset, yy = pose.y + Math.cos(pose.angle) * offset;
        if (d) c.lineTo(xx, yy); else c.moveTo(xx, yy);
      }
      c.closePath(); c.stroke();
    };
    stroke(0, 82, `rgba(${color.rgb},.06)`);
    stroke(0, 66, '#181830');
    for (let d = 0; d < track.length; d += 34) {
      const pose = trackPose(track, d);
      c.save(); c.translate(pose.x, pose.y); c.rotate(pose.angle);
      block(c, '#574b69', -6, -31, 12, 62);
      block(c, '#82738e', -5, -30, 3, 60);
      c.restore();
    }
    for (const offset of [-19, 19]) {
      stroke(offset, 26, `rgba(${color.rgb},.09)`);
      stroke(offset, 16, `rgba(${color.rgb},.15)`);
      stroke(offset, 9, color.shadow);
      stroke(offset, 5, color.edge);
      stroke(offset, 2.5, color.mid);
      stroke(offset, 1, color.hot);
    }
  });
  return { x, y, key };
}

interface MineTrain {
  headAt(elapsed: number): number;
  poseAt(elapsed: number, carIndex: number): Vec2 & { angle: number };
  cars: { image: Image; length: number; width: number }[];
  couplers: Image[];
}

/** Build Mine rail art and routes. FreightTrainSystem owns the car poses and bodies. */
export function addUndergroundRail(scene: Phaser.Scene, tileSize: number) {
  const scenery: Image[] = [];
  const decorate = (x: number, y: number, key: string, name: string, depth: number): Image => {
    const sprite = scene.add.image(x, y, key).setName(`underground-${name}`).setDepth(depth);
    scenery.push(sprite);
    return sprite;
  };
  const couplerKey = undergroundTexture(scene, 'mine_coupler', 24, 12, c => {
    block(c, '#101126', 0, 1, 24, 10);
    block(c, '#83869e', 0, 4, 24, 4);
    block(c, '#e0d1cb', 8, 4, 8, 4);
  });
  const circuits = UNDERGROUND_RAIL_LOOPS.map((path, i) => {
    const color = RAIL_COLORS[i % RAIL_COLORS.length];
    const track = buildTrack(path, tileSize), rail = railTexture(scene, track, color);
    decorate(rail.x, rail.y, rail.key, 'rail', DEPTH.decal - 2).setOrigin(0);
    const lampKey = undergroundTexture(scene, `rail_lamp_${color.name}`, 28, 98, c => {
      for (const y of [14, 84]) {
        glow(c, 14, y, 13, color.rgb, .83);
        block(c, '#141a32', 10, y - 5, 8, 10);
        block(c, color.hot, 12, y - 3, 4, 6);
      }
    });
    const lamps: { distance: number; sprite: Image }[] = [];
    for (let distance = 0; distance < track.length; distance += LAMP_STEP) {
      const pose = trackPose(track, distance);
      lamps.push({ distance, sprite: decorate(pose.x, pose.y, lampKey, 'rail-signal', DEPTH.decal - 1).setRotation(pose.angle) });
    }
    const trains: MineTrain[] = Array.from({ length: TRAINS_PER_LOOP }, (_, index) => {
      const start = index * track.length / TRAINS_PER_LOOP + tileSize * 3;
      const headAt = (elapsed: number) => wrap(start + elapsed * UNDERGROUND.mineCartSpeed, track.length);
      return {
        headAt,
        poseAt(elapsed, carIndex) {
          const distance = headAt(elapsed) - CAR_DISTANCE[carIndex];
          const nose = trackPose(track, distance + 22), rear = trackPose(track, distance - 22);
          return { ...trackPose(track, distance), angle: Math.atan2(nose.y - rear.y, nose.x - rear.x) };
        },
        cars: TRAIN_PARTS.map((part, index) => ({
          image: scene.add.image(0, 0, mineTrainPart(scene, part, color))
            .setName(part === 'engine' ? 'underground-mine-engine' : 'underground-mine-cart').setDepth(DEPTH.vehicle - 1),
          length: CAR_LENGTH[index], width: CAR_WIDTH,
        })),
        couplers: TRAIN_PARTS.slice(1).map(() => decorate(0, 0, couplerKey, 'mine-coupler', DEPTH.vehicle - 2)),
      };
    });
    return { track, lamps, trains };
  });

  const update = (elapsed: number) => {
    for (const { track, lamps, trains } of circuits) {
      for (const train of trains) {
        for (let i = 1; i < train.cars.length; i++) {
          const front = train.cars[i - 1].image, back = train.cars[i].image;
          const coupler = train.couplers[i - 1].setVisible(front.visible && back.visible);
          if (!coupler.visible) continue;
          const endX = front.x - Math.cos(front.rotation) * (i === 1 ? 47 : 36);
          const endY = front.y - Math.sin(front.rotation) * (i === 1 ? 47 : 36);
          const startX = back.x + Math.cos(back.rotation) * 35;
          const startY = back.y + Math.sin(back.rotation) * 35;
          const dx = endX - startX, dy = endY - startY;
          coupler.setPosition(startX + dx / 2, startY + dy / 2)
            .setRotation(Math.atan2(dy, dx)).setDisplaySize(Math.hypot(dx, dy) + 8, 12);
        }
      }
      for (const { distance, sprite } of lamps) {
        let ahead = track.length;
        for (const train of trains) ahead = Math.min(ahead, wrap(distance - train.headAt(elapsed), track.length));
        sprite.setAlpha(.22 + .78 * Math.max(0, 1 - ahead / (LAMP_STEP * 2)));
      }
    }
  };
  return {
    trains: circuits.flatMap(circuit => circuit.trains),
    update,
    destroy: () => { for (const sprite of scenery) sprite.destroy(); },
  };
}
