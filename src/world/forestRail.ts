import type Phaser from 'phaser';
import { bodyGrad, ellipse, fillStroke, makeCanvas, poly, radial, rr, type Ctx } from '../art/draw';
import { DEPTH, FOREST, FREIGHT } from '../config/gameConfig';
import type { Vec2, WorldData } from '../core/types';
import { carriagePose, measureCircuit } from '../systems/freightTiming';
import { forestRailRoute } from './gen/forest';

const TRACK_HALF_WIDTH = 36;
const CAR_LENGTHS = [122, 112, 112, 112];
const CAR_WIDTH = 62;
const SIGNAL_SIZE = 296;
const WOOD = '#b3794f';
const INK = '#142524';

function loggingTexture(scene: Phaser.Scene, name: string, width: number, height: number, draw: (c: Ctx) => void) {
  const key = `forest-rail-${name}`;
  if (!scene.textures.exists(key)) {
    const { ctx, done } = makeCanvas(scene, key, width, height);
    draw(ctx);
    done();
  }
  return key;
}

/** Paint each straight and each bend as a small texture with a common rail style. */
function addTrackChunk(scene: Phaser.Scene, points: Vec2[], index: number) {
  const left = Math.floor(Math.min(...points.map(p => p.x))) - TRACK_HALF_WIDTH;
  const top = Math.floor(Math.min(...points.map(p => p.y))) - TRACK_HALF_WIDTH;
  const width = Math.ceil(Math.max(...points.map(p => p.x))) - left + TRACK_HALF_WIDTH;
  const height = Math.ceil(Math.max(...points.map(p => p.y))) - top + TRACK_HALF_WIDTH;
  const key = loggingTexture(scene, `track-${index}`, width, height, c => {
    c.translate(-left, -top);
    const offsets = points.map((p, i) => {
      const previous = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
      const dx = next.x - previous.x, dy = next.y - previous.y;
      const length = Math.hypot(dx, dy);
      return { x: p.x, y: p.y, nx: -dy / length, ny: dx / length };
    });
    const stroke = (offset: number, w: number, color: string) => {
      c.beginPath();
      for (const { x, y, nx, ny } of offsets) c.lineTo(x + offset * nx, y + offset * ny);
      c.strokeStyle = color;
      c.lineWidth = w;
      c.lineJoin = 'round';
      c.stroke();
    };
    stroke(0, 70, '#1b2830');
    stroke(0, 58, '#333e3e');
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], dx = b.x - a.x, dy = b.y - a.y;
      const distance = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
      for (let d = 16; d <= distance; d += 32) {
        c.save();
        c.translate(a.x + dx * d / distance, a.y + dy * d / distance);
        c.rotate(angle);
        c.fillStyle = '#503a35'; c.fillRect(-5, -28, 10, 56);
        c.fillStyle = '#7b594a'; c.fillRect(-4, -28, 3, 56);
        c.restore();
      }
    }
    for (const offset of [-17, 17]) {
      stroke(offset, 7, '#1a2029');
      stroke(offset, 3.4, '#b7a5a2');
      stroke(offset - 1, 1.2, '#ebcb9e');
    }
  });
  return scene.add.image(left, top, key).setOrigin(0).setDepth(DEPTH.decal - 2).setName('forest-logging-rail');
}

function trainEngine(c: Ctx): void {
  // Brass boiler, red cowcatcher, roof hatch and a warm headlamp.
  rr(c, 9, 9, 112, 56, 11);
  fillStroke(c, bodyGrad(c, 9, 9, 112, 56, '#74978b', '#263f40'), INK, 4);
  rr(c, 13, 6, 47, 62, 7);
  fillStroke(c, bodyGrad(c, 13, 6, 47, 62, '#ba7652', '#684862'), INK, 4);
  for (const y of [11, 53]) {
    rr(c, 40, y, 14, 10, 2);
    fillStroke(c, '#edc384', '#6e4a3d', 1.5);
  }
  rr(c, 58, 20, 58, 34, 12);
  fillStroke(c, bodyGrad(c, 58, 20, 58, 34, '#d7a95c', '#735349'), INK, 3);
  for (const x of [72, 95]) {
    c.fillStyle = '#7c5945'; c.fillRect(x, 22, 4, 30);
    c.fillStyle = '#ffd286'; c.fillRect(x + 1, 22, 2, 30);
  }
  ellipse(c, 93, 36, 11, 11); fillStroke(c, '#354752', '#1c2830', 3);
  ellipse(c, 92, 34, 5, 5); fillStroke(c, '#182129', '#66808c', 2);
  poly(c, [116, 14, 130, 26, 130, 48, 116, 60]);
  fillStroke(c, '#ad5448', '#542e3b', 4);
  ellipse(c, 120, 37, 8, 8); fillStroke(c, '#fff2b5', '#976532', 3);
  c.fillStyle = radial(c, 124, 37, 0, 14, [[0, '#ffe886a0'], [1, '#ffe88600']]);
  c.fillRect(110, 23, 28, 28);
}

function logWagon(c: Ctx): void {
  rr(c, 5, 8, 112, 58, 7);
  fillStroke(c, bodyGrad(c, 5, 8, 112, 58, '#808482', '#444455'), INK, 4);
  for (const y of [19, 37, 54]) {
    rr(c, 13, y - 8, 94 + (y === 37 ? 5 : 0), 16, 7);
    fillStroke(c, bodyGrad(c, 13, y - 8, 90, 16, '#d7a06b', '#81523e'), '#573d36', 2);
    ellipse(c, 104, y, 5, 7); fillStroke(c, '#f0bc79', '#885c47', 1);
    ellipse(c, 104, y, 2.5, 4.2); c.strokeStyle = WOOD; c.lineWidth = 1; c.stroke();
    c.strokeStyle = '#81503b'; c.lineWidth = 1.5; c.beginPath();
    c.moveTo(20, y - 2); c.lineTo(49, y - 2); c.lineTo(56, y + 1); c.lineTo(88, y + 1); c.stroke();
  }
  for (const x of [23, 83]) {
    rr(c, x, 7, 7, 60, 2); fillStroke(c, '#c99458', '#483b39', 1.5);
  }
  for (const y of [12, 62]) { ellipse(c, 9, y, 3, 3); fillStroke(c, '#ff975b', null); }
}

function crossingTexture(scene: Phaser.Scene, lit: boolean) {
  return loggingTexture(scene, lit ? 'crossing-lit' : 'crossing-idle', 120, SIGNAL_SIZE, c => {
    for (const y of [20, SIGNAL_SIZE - 20]) {
      if (lit) {
        c.fillStyle = radial(c, 60, y, 1, 22, [[0, '#ffad6b'], [1, '#ff483800']]);
        c.fillRect(38, y - 22, 44, 44);
      }
      rr(c, 51, y - 9, 18, 18, 5); fillStroke(c, '#463544', '#1f2930', 3);
      ellipse(c, 60, y, 5, 5); fillStroke(c, lit ? '#ffd3ae' : '#ad6c50', '#392836', 1.5);
      for (const x of [22, 99]) {
        c.save();
        c.translate(x, y);
        c.rotate(Math.PI / 4);
        c.fillStyle = '#ecd997'; c.fillRect(-12, -2, 24, 4); c.fillRect(-2, -12, 4, 24);
        c.restore();
      }
    }
  });
}

/** The shared FreightTrainSystem attaches the engine/wagon bodies and operates them. */
export function addForestRail(scene: Phaser.Scene, world: WorldData) {
  const route = forestRailRoute(), circuit = measureCircuit(route);
  const scenery: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < route.points.length; i += 7) {
    scenery.push(addTrackChunk(scene, route.points.slice(i, i + 7), i));
    scenery.push(addTrackChunk(scene, [route.points[i + 6], route.points[(i + 7) % route.points.length]], i + 6));
  }
  const warningKeys = [crossingTexture(scene, false), crossingTexture(scene, true)] as const;
  const signals = circuit.crossings.map(crossing => {
    const { center, dx, dy } = crossing;
    const image = scene.add.image(center.x, center.y, warningKeys[0])
      .setName('forest-logging-crossing').setDepth(DEPTH.prop).setRotation(Math.atan2(dy, dx) + Math.PI / 2);
    scenery.push(image);
    return { crossing, image, flash: false };
  });
  const engineKey = loggingTexture(scene, 'engine', 138, 74, trainEngine);
  const wagonKey = loggingTexture(scene, 'wagon', 122, 74, logWagon);
  const trainStart = circuit.crossings[0].start - FOREST.trainSpeed * FOREST.trainInitialLeadSec;
  // Put a wagon at the closest rail section in the development preview.
  const debug = new URLSearchParams(location.search).get('train') === 'near';
  const spawn = world.playerSpawns[0];
  let start = trainStart;
  if (debug) {
    let nearest = Infinity;
    for (let distance = 0; distance < circuit.length; distance += 24) {
      const pos = circuit.sample(distance);
      const difference = Math.hypot(pos.x - spawn.x, pos.y - spawn.y);
      if (difference >= nearest) continue;
      nearest = difference;
      start = distance + CAR_LENGTHS[0] + FOREST.trainGap + CAR_LENGTHS[1] / 2 - 1.5 * FOREST.trainSpeed;
    }
  }
  const trainLength = CAR_LENGTHS.reduce((total, length) => total + length, 0) + (CAR_LENGTHS.length - 1) * FOREST.trainGap;
  let distance = 0;
  const centers = CAR_LENGTHS.map(length => {
    const center = distance + length / 2;
    distance += length + FOREST.trainGap;
    return center;
  });
  // Both trains advance at one speed and stay half a lap apart, including when a wagon is scattered.
  const trains = [start, start + circuit.length / 2].map((initialHead, index) => {
    const suffix = index === 0 ? '' : '-2';
    const cars = CAR_LENGTHS.map((length, i) => {
      const name = i ? `forest-logging-wagon-${i}` : 'forest-logging-engine';
      const image = scene.add.image(0, 0, i ? wagonKey : engineKey)
        .setName(name + suffix).setDepth(DEPTH.vehicle - 1);
      return { image, length, width: CAR_WIDTH };
    });
    const couplers = cars.slice(1).map(() => {
      const image = scene.add.image(0, 0, '__WHITE').setTint(0x674948).setDepth(DEPTH.vehicle - 2);
      scenery.push(image);
      return image;
    });
    const headAt = (elapsed: number) => initialHead + elapsed * FOREST.trainSpeed;
    const poseAt = (elapsed: number, i: number) => carriagePose(circuit, headAt(elapsed) - centers[i], cars[i].length * .57);
    return { cars, couplers, headAt, poseAt };
  });
  return {
    trains,
    update(elapsed: number) {
      const lead = FOREST.trainWarningSec * FOREST.trainSpeed;
      const heads = trains.map(({ headAt }) => headAt(elapsed));
      const flashOn = Math.floor(elapsed / FREIGHT.flashStepSec) % 2 === 0;
      for (const signal of signals) {
        const lit = flashOn && heads.some(head => {
          const distance = ((head - signal.crossing.start + lead) % circuit.length + circuit.length) % circuit.length;
          return distance < lead + signal.crossing.width + trainLength;
        });
        if (lit !== signal.flash) signal.image.setTexture(warningKeys[Number(lit)]);
        signal.flash = lit;
      }
      for (const { cars, couplers } of trains) for (const [i, link] of couplers.entries()) {
        const front = cars[i], rear = cars[i + 1];
        const a = front.image, b = rear.image;
        link.setVisible(a.visible && b.visible);
        const ax = a.x - Math.cos(a.rotation) * front.length / 2;
        const ay = a.y - Math.sin(a.rotation) * front.length / 2;
        const bx = b.x + Math.cos(b.rotation) * rear.length / 2;
        const by = b.y + Math.sin(b.rotation) * rear.length / 2;
        link.setPosition((ax + bx) / 2, (ay + by) / 2).setRotation(Math.atan2(ay - by, ax - bx))
          .setDisplaySize(Math.hypot(ax - bx, ay - by) + 4, 7);
      }
    },
    destroy() { for (const item of scenery) item.destroy(); },
  };
}
