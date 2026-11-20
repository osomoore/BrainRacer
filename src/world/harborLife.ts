import Phaser from 'phaser';
import { DEPTH, HARBOR, TILE_SIZE } from '../config/gameConfig';
import type { IVehicle, RaceContext } from '../core/race';
import { Rng } from '../core/rng';
import { Tile } from '../core/types';
import { tileAt } from './geometry';
import { harborTexture } from './harborTexture';

/** Additional non-physical beach and water life, advanced only while the race runs. */
export function makeHarborLife(ctx: RaceContext, objects: Phaser.GameObjects.GameObject[]): (dt: number, elapsed: number, vehicles: IVehicle[]) => void {
  const { scene, world } = ctx;
  const rng = new Rng(world.seed ^ 0x62454143);
  const add = (x: number, y: number, key: string, depth: number, name: string) => {
    const image = scene.add.image(x * TILE_SIZE, y * TILE_SIZE, key).setDepth(depth).setName(name);
    objects.push(image);
    return image;
  };
  const colors = ['#ed675d', '#45aeb8', '#e9a838', '#9e75bd'];
  const skins = ['#f3c39b', '#c98761', '#85513d', '#e3aa7f'];
  const people = colors.map((color, i) => harborTexture(scene, `life_person_${i}`, 74, 72, c => {
    // Broad hat, arms and legs make this silhouette distinct from the standing swimmers.
    c.fillStyle = 'rgba(67,51,49,.25)'; c.beginPath(); c.ellipse(37, 56, 27, 11, 0, 0, 7); c.fill();
    c.strokeStyle = skins[i]; c.lineWidth = 9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(28, 39); c.lineTo(15, 47); c.moveTo(46, 39); c.lineTo(59, 47);
    c.moveTo(30, 51); c.lineTo(24, 63); c.moveTo(44, 51); c.lineTo(50, 63); c.stroke();
    c.fillStyle = color; c.beginPath(); c.ellipse(37, 40, 17, 16, 0, 0, 7); c.fill();
    c.fillStyle = skins[i]; c.beginPath(); c.arc(37, 23, 11, 0, 7); c.fill();
    c.fillStyle = '#fff0c7'; c.beginPath(); c.ellipse(37, 17, 20, 8, 0, 0, 7); c.fill();
    c.fillStyle = color; c.fillRect(26, 12, 22, 5);
  }));
  const swimmers = colors.map((color, i) => harborTexture(scene, `life_swimmer_${i}`, 74, 72, c => {
    c.fillStyle = 'rgba(67,51,49,.25)'; c.beginPath(); c.ellipse(37, 57, 23, 10, 0, 0, 7); c.fill();
    c.strokeStyle = skins[i]; c.lineWidth = 9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(27, 34); c.lineTo(15, 25); c.moveTo(47, 34); c.lineTo(59, 25);
    c.moveTo(31, 48); c.lineTo(27, 63); c.moveTo(43, 48); c.lineTo(47, 63); c.stroke();
    c.fillStyle = color; c.beginPath(); c.roundRect(24, 29, 26, 23, 7); c.fill();
    c.fillStyle = '#fff4d2'; c.fillRect(24, 40, 26, 5);
    c.fillStyle = skins[i]; c.beginPath(); c.arc(37, 20, 11, 0, 7); c.fill();
    c.fillStyle = '#483936'; c.beginPath(); c.arc(37, 16, 10, Math.PI, Math.PI * 2); c.fill();
  }));
  const spots = [[28.8, 12.6], [35.5, 16.8], [38.1, 18.5], [28.8, 25.5], [34.5, 27], [38.5, 30], [28.9, 32.5], [36.5, 35.5]];
  const beachgoers = spots.map(([x, y], i) => ({
    image: add(x, y, (i % 2 ? swimmers : people)[(i + rng.int(0, 3)) % people.length], DEPTH.vehicle - 1, 'harbor-beachgoer'),
    x: x * TILE_SIZE, y: y * TILE_SIZE, fromX: x * TILE_SIZE, fromY: y * TILE_SIZE,
    toX: x * TILE_SIZE, toY: y * TILE_SIZE, jump: 0, phase: rng.range(0, 6.28),
  }));
  const board = harborTexture(scene, 'life_board', 132, 58, c => {
    c.fillStyle = '#edf9e9'; c.beginPath(); c.ellipse(66, 31, 62, 20, 0, 0, 7); c.fill();
    c.fillStyle = '#eaa449'; c.beginPath(); c.ellipse(66, 29, 45, 10, 0, 0, 7); c.fill();
    c.fillStyle = '#3d6882'; c.beginPath(); c.ellipse(64, 27, 12, 14, 0, 0, 7); c.fill();
    c.fillStyle = '#b77d59'; c.beginPath(); c.arc(71, 23, 8, 0, 7); c.fill();
  });
  const boat = harborTexture(scene, 'life_sailboat', 100, 112, c => {
    c.fillStyle = '#334f63'; c.beginPath(); c.ellipse(50, 56, 22, 48, 0, 0, 7); c.fill();
    c.fillStyle = '#f9e9ca'; c.beginPath(); c.moveTo(48, 11); c.lineTo(76, 71); c.lineTo(48, 70); c.closePath(); c.fill();
    c.fillStyle = '#ec7762'; c.beginPath(); c.moveTo(42, 26); c.lineTo(42, 70); c.lineTo(20, 70); c.closePath(); c.fill();
  });
  const gull = harborTexture(scene, 'life_gull', 74, 40, c => {
    c.strokeStyle = 'rgba(57,73,79,.5)'; c.lineWidth = 10; c.lineCap = 'round';
    c.beginPath(); c.moveTo(7, 13); c.quadraticCurveTo(23, 10, 37, 27); c.quadraticCurveTo(51, 10, 67, 13); c.stroke();
    c.strokeStyle = '#fff9e8'; c.lineWidth = 6; c.stroke();
  });
  const craft = [[23, 15, board], [25, 26, board], [22.7, 33, boat], [24.5, 12, boat]].map(([x, y, key], i) => ({
    image: add(x as number, y as number, key as string, DEPTH.decal + 1, i < 2 ? 'harbor-extra-surfer' : 'harbor-extra-sailboat'),
    x: x as number, y: y as number, phase: rng.range(0, Math.PI * 2), speed: rng.range(.18, .35),
  }));
  const birds = [[24, 17], [34, 18], [24, 31], [36, 34]].map(([x, y]) => ({
    image: add(x, y, gull, DEPTH.vehicle + 1, 'harbor-gull'), x, y, phase: rng.range(0, Math.PI * 2), speed: rng.range(.25, .42),
  }));
  return (dt, elapsed, vehicles) => {
    for (const p of beachgoers) {
      if (p.jump <= 0) {
        let nearest: IVehicle | undefined;
        let distance = HARBOR.beachgoerClearance;
        for (const vehicle of vehicles) {
          const gap = Math.hypot(vehicle.x - p.x, vehicle.y - p.y);
          if (gap >= distance) continue;
          nearest = vehicle;
          distance = gap;
        }
        if (nearest) {
          const angle = Math.atan2(p.y - nearest.y, p.x - nearest.x);
          for (const turn of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
            const x = p.x + Math.cos(angle + turn) * HARBOR.beachgoerJumpDistance;
            const y = p.y + Math.sin(angle + turn) * HARBOR.beachgoerJumpDistance;
            if (tileAt(world, Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE)) !== Tile.Dirt) continue;
            p.fromX = p.x; p.fromY = p.y; p.toX = x; p.toY = y; p.jump = HARBOR.beachgoerJumpSec; break;
          }
        }
      }
      if (p.jump > 0) {
        p.jump = Math.max(0, p.jump - dt);
        const progress = 1 - p.jump / HARBOR.beachgoerJumpSec, t = 1 - (1 - progress) ** 2;
        p.x = Phaser.Math.Linear(p.fromX, p.toX, t); p.y = Phaser.Math.Linear(p.fromY, p.toY, t);
        p.image.setPosition(p.x, p.y - Math.sin(progress * Math.PI) * 50);
      } else p.image.setRotation(Math.sin(elapsed * 1.3 + p.phase) * .06);
    }
    for (const c of craft) {
      const t = elapsed * c.speed + c.phase;
      c.image.setPosition((c.x + Math.sin(t) * .45) * TILE_SIZE, (c.y + Math.cos(t) * .6) * TILE_SIZE).setRotation(Math.sin(t) * .25);
    }
    for (const b of birds) {
      const t = elapsed * b.speed + b.phase;
      b.image.setPosition((b.x + Math.cos(t) * 1.1) * TILE_SIZE, (b.y + Math.sin(t) * .65) * TILE_SIZE).setRotation(t + Math.PI / 2).setScale(1, .65 + .35 * Math.abs(Math.sin(t * 4)));
    }
  };
}
