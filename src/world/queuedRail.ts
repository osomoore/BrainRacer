import type Phaser from 'phaser';
import { makeCanvas, type Ctx } from '../art/draw';
import { DEPTH, FREIGHT, QUEUED_FEATURES as FEATURE } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { WorldData } from '../core/types';
import { carriagePose, measureCircuit, type RailCircuit } from '../systems/freightTiming';
import { queuedFeatureTextures, queuedRailPalette } from '../systems/queuedWorldFeatureArt';
import { queuedRailRoute, type QueuedRailMap } from './gen/queuedWorlds';

const TRACK_HALF_WIDTH = 39;
const CHUNK_LENGTH = 448;
const SAMPLE_STEP = 8;
const SLEEPER_STEP = 26;
const HITCH_WIDTH = 8;

/** Draw the closed route as small baked chunks so the split screens can cull track outside their views. */
function trackArt(scene: Phaser.Scene, map: QueuedRailMap, circuit: RailCircuit) {
  const colors = queuedRailPalette(map);
  const chunks: { image: Phaser.GameObjects.Image; key: string }[] = [];
  const chunkCount = Math.ceil(circuit.length / CHUNK_LENGTH);
  const chunkLength = circuit.length / chunkCount;
  const sleeperStep = circuit.length / Math.ceil(circuit.length / SLEEPER_STEP);
  const samplesPerChunk = Math.ceil(chunkLength / SAMPLE_STEP);
  const pose = (distance: number) => carriagePose(circuit, distance, 10);
  for (let i = 0; i < chunkCount; i++) {
    const start = i * chunkLength, end = (i + 1) * chunkLength;
    const points = Array.from({ length: samplesPerChunk + 1 }, (_, k) => pose(start + k / samplesPerChunk * chunkLength));
    const x = Math.floor(Math.min(...points.map(point => point.x))) - TRACK_HALF_WIDTH;
    const y = Math.floor(Math.min(...points.map(point => point.y))) - TRACK_HALF_WIDTH;
    const w = Math.ceil(Math.max(...points.map(point => point.x))) - x + TRACK_HALF_WIDTH;
    const h = Math.ceil(Math.max(...points.map(point => point.y))) - y + TRACK_HALF_WIDTH;
    const key = TEX.queuedFeature.track(`${map}-loop-${i}`);
    const { ctx, done } = makeCanvas(scene, key, w, h);
    ctx.translate(-x, -y);
    const stroke = (offset: number, width: number, color: string) => {
      ctx.beginPath();
      for (const point of points) ctx.lineTo(point.x - Math.sin(point.angle) * offset, point.y + Math.cos(point.angle) * offset);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    stroke(0, 72, colors.dark);
    stroke(0, 62, colors.deck);
    for (let mark = Math.ceil(start / sleeperStep); mark * sleeperStep < end; mark++) {
      const { x: px, y: py, angle } = pose(mark * sleeperStep);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      paintSleeper(ctx, map, colors);
      ctx.restore();
    }
    for (const offset of [-19, 19]) {
      stroke(offset, 9, colors.dark);
      stroke(offset, 4, colors.trim);
    }
    done();
    const image = scene.add.image(x, y, key).setOrigin(0).setDepth(DEPTH.decal - 2).setName('queued-mover-track');
    chunks.push({ image, key });
  }
  return chunks;
}

function paintSleeper(ctx: Ctx, map: QueuedRailMap, colors: ReturnType<typeof queuedRailPalette>): void {
  if (map === 'candy') {
    ctx.beginPath();
    ctx.moveTo(-11, -29);
    ctx.lineTo(0, 0);
    ctx.lineTo(-11, 29);
    ctx.lineTo(-3, 29);
    ctx.lineTo(8, 0);
    ctx.lineTo(-3, -29);
    ctx.closePath();
    ctx.fillStyle = colors.light;
    ctx.fill();
    return;
  }
  ctx.fillStyle = colors.dark;
  ctx.fillRect(-6, -29, 12, 58);
  ctx.fillStyle = colors.light;
  ctx.fillRect(-4, -29, 3, 58);
}

/** Make rail scenery and poses. FreightTrainSystem attaches and updates the carriage bodies. */
export function addQueuedRail(scene: Phaser.Scene, map: QueuedRailMap, world: WorldData) {
  const circuit = measureCircuit(queuedRailRoute(map, world));
  const track = trackArt(scene, map, circuit);
  const textures = queuedFeatureTextures(scene, map);
  const { count, scale, spacing, speed } = FEATURE.rail[map];
  const length = (map === 'candy' ? 118 : 111) * scale;
  const width = (map === 'candy' ? 52 : 62) * scale;
  const start = circuit.length / 4;
  const headAt = (elapsed: number) => start + elapsed * speed;
  const cars = Array.from({ length: count }, (_, i) => ({
    image: scene.add.image(0, 0, textures.mover).setName(`queued-mover-${i}`).setScale(scale).setDepth(DEPTH.vehicle - 1),
    length,
    width,
  }));
  const hitchTint = Number.parseInt(queuedRailPalette(map).dark.slice(1), 16);
  const couplers = cars.slice(1).map(() => scene.add.image(0, 0, '__WHITE')
    .setTint(hitchTint).setDepth(DEPTH.vehicle - 2));
  const signals = circuit.crossings.flatMap(crossing => [-1, 1].map(side => {
    const { center, width, dx, dy } = crossing;
    const offset = side * (width / 2 + 14);
    const image = scene.add.image(center.x + dx * offset - dy * side * 34, center.y + dy * offset + dx * side * 34, textures.signal)
      .setName('queued-rail-signal').setTint(0x88ddd0).setScale(.74).setDepth(DEPTH.prop);
    return { image, crossing, lit: false };
  }));
  return {
    trains: [{ cars, poseAt: (elapsed: number, index: number) => carriagePose(circuit, headAt(elapsed) - index * spacing, length * .56) }],
    update(elapsed: number) {
      const lead = FREIGHT.warningLeadSec * speed;
      const trainLength = spacing * (count - 1) + length;
      const front = headAt(elapsed) + length / 2;
      for (const signal of signals) {
        const phase = ((front - signal.crossing.start + lead) % circuit.length + circuit.length) % circuit.length;
        const lit = phase < lead + signal.crossing.width + trainLength && Math.floor(elapsed / FREIGHT.flashStepSec) % 2 === 0;
        if (lit !== signal.lit) signal.image.setTint(lit ? 0xffac5d : 0x88ddd0);
        signal.lit = lit;
      }
      for (const [i, link] of couplers.entries()) {
        const a = cars[i].image, b = cars[i + 1].image;
        link.setVisible(a.visible && b.visible);
        if (!link.visible) continue;
        link.setPosition((a.x + b.x) / 2, (a.y + b.y) / 2).setRotation(Math.atan2(a.y - b.y, a.x - b.x))
          .setDisplaySize(Math.hypot(a.x - b.x, a.y - b.y), HITCH_WIDTH);
      }
    },
    destroy() {
      for (const { image, key } of track) {
        image.destroy();
        scene.textures.remove(key);
      }
      for (const link of couplers) link.destroy();
      for (const { image } of signals) image.destroy();
    },
  };
}
