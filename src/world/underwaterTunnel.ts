import type Phaser from 'phaser';
import { ellipse, fillStroke, rr } from '../art/draw';
import { DEPTH, UNDERWATER_CROSSING, UNDERWATER_TUNNEL } from '../config/gameConfig';
import { Tile, type Vec2, type WorldData } from '../core/types';
import { submarineTexture } from './underwaterLife';
import { paintTube, underwaterTexture } from './underwaterPaint';

const { cycleSec, warningSec, openSec, retractSec, blinkHz } = UNDERWATER_TUNNEL;
const openAt = cycleSec - openSec;
export const UNDERWATER_WARNING_START = openAt - warningSec;

export function advanceUnderwaterTunnel(phase: number, dt: number, occupied: boolean): number {
  const next = phase + dt;
  if (occupied && phase < openAt && next >= openAt) return phase;
  return next % cycleSec;
}

export function underwaterTunnelFrame(phase: number): { warning: boolean; open: boolean; retract: number; progress: number } {
  const open = phase >= openAt;
  return {
    warning: phase >= UNDERWATER_WARNING_START,
    open,
    retract: open ? Math.min(1, (phase - openAt) / retractSec, (cycleSec - phase) / retractSec) : 0,
    progress: open ? (phase - openAt) / openSec : 0,
  };
}

export function setUnderwaterTunnelOpen(world: WorldData, open: boolean): void {
  const { top, bottom, left, right } = UNDERWATER_CROSSING;
  for (let y = top; y < bottom; y++) {
    const row = y * world.widthTiles;
    world.tiles.fill(open ? Tile.Water : Tile.Road, row + left, row + right);
  }
}

export function underwaterCrossingOccupied(position: Vec2, clearance: number, tileSize: number): boolean {
  const { top, bottom, left, right } = UNDERWATER_CROSSING;
  return position.x + clearance >= left * tileSize && position.x - clearance <= right * tileSize &&
    position.y + clearance >= top * tileSize && position.y - clearance <= bottom * tileSize;
}

export function makeUnderwaterTunnel(scene: Phaser.Scene, ts: number, objects: Phaser.GameObjects.GameObject[]) {
  const { top, bottom, left, right } = UNDERWATER_CROSSING;
  const cx = (left + right) / 2, cy = (top + bottom) / 2;
  const w = (right - left) * 128 / 2;
  const key = underwaterTexture(scene, 'lock_deck', w, 256, c => paintTube(c, w, 256));
  const leaf = (x: number, side: number, name: string) => {
    const image = scene.add.image(x * ts, cy * ts, key).setOrigin(side, 0.5).setDepth(DEPTH.decal - 1).setName(name);
    objects.push(image);
    return image;
  };
  const west = leaf(left, 0, 'underwater-retractable-west');
  const east = leaf(right, 1, 'underwater-retractable-east');
  const collarKey = underwaterTexture(scene, 'lock_arch', 62, 282, c => {
    for (const y of [9, 238]) {
      rr(c, 5, y, 52, 36, 10);
      fillStroke(c, '#27667a', '#122d46', 4);
      rr(c, 11, y + 6, 39, 19, 5);
      fillStroke(c, '#629d9e', '#9bd4bd', 2);
    }
    c.strokeStyle = '#71b4ba70';
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(22, 33);
    c.bezierCurveTo(59, 83, 59, 199, 22, 250);
    c.stroke();
  });
  const lightKey = underwaterTexture(scene, 'lock_signal', 43, 43, c => {
    ellipse(c, 21.5, 21.5, 18, 18);
    fillStroke(c, '#132d47', '#96c3a4', 4);
    ellipse(c, 21.5, 21.5, 12, 12);
    fillStroke(c, '#ffffff', null);
    ellipse(c, 21.5, 21.5, 4, 4);
    fillStroke(c, '#f0ffff', null);
  });
  const lights: Phaser.GameObjects.Image[] = [];
  for (const x of [left, right]) {
    objects.push(scene.add.image(x * ts, cy * ts, collarKey).setDepth(DEPTH.prop + 1).setFlipX(x === right));
    for (const y of [top + 0.12, bottom - 0.12]) {
      const light = scene.add.image(x * ts, y * ts, lightKey).setDepth(DEPTH.prop + 2).setName('underwater-tunnel-signal');
      objects.push(light);
      lights.push(light);
    }
  }
  const submarine = scene.add.image(cx * ts, cy * ts, submarineTexture(scene)).setRotation(Math.PI / 2)
    .setScale(0.9).setDepth(DEPTH.decal - 2).setName('underwater-lock-submarine');
  objects.push(submarine);

  return (phase: number, clock: number) => {
    const { warning, open, retract, progress } = underwaterTunnelFrame(phase);
    const width = (right - left) * ts / 2 * (1 - retract * 0.96);
    west.setDisplaySize(width, (bottom - top) * ts);
    east.setDisplaySize(width, (bottom - top) * ts);
    const bright = !warning || Math.floor(clock * blinkHz) % 2 === 0;
    const color = open ? 0xff615c : warning ? 0xffcb70 : 0x8bffd2;
    for (const light of lights) light.setTint(color).setAlpha(bright ? 1 : 0.35);
    const run = 4;
    submarine.setVisible(open).setY((cy + (progress * 2 - 1) * run) * ts)
      .setAlpha(Math.min(1, progress * 7, (1 - progress) * 7));
  };
}
