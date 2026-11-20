import type Phaser from 'phaser';
import { CAT, DEPTH, HARBOR } from '../config/gameConfig';
import type { BodyOwner, IVehicle, RaceContext } from '../core/race';
import { Rng } from '../core/rng';
import { Tile, type Vec2 } from '../core/types';
import { tileAt } from './geometry';
import { harborTexture } from './harborTexture';

type Kind = 'umbrella' | 'beachball' | 'sandcastle' | 'buoy' | 'fruit-crate' | 'fish-crate' | 'barrel';
type Draw = (c: CanvasRenderingContext2D) => void;
interface Piece {
  image: Phaser.Physics.Matter.Image;
  origin: Vec2;
  kind: Kind;
  key: string;
  flattened: boolean;
}

const SIZE = 80;
const RADII: Record<Kind, number> = { umbrella: 29, beachball: 20, sandcastle: 28, buoy: 24, 'fruit-crate': 32, 'fish-crate': 30, barrel: 23 };

function circle(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

function segments(c: CanvasRenderingContext2D, r: number, colors: string[]) {
  const angle = Math.PI * 2 / colors.length;
  for (const [i, color] of colors.entries()) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(40, 40);
    c.arc(40, 40, r, i * angle, (i + 1) * angle);
    c.fill();
  }
}

function recurringColors(color: string): string[] {
  return [color, '#fff2cf', color, '#fff2cf', color, '#fff2cf', color, '#fff2cf'];
}

function crate(c: CanvasRenderingContext2D, fruit: boolean) {
  c.fillStyle = '#704d3a'; c.fillRect(8, 16, 64, 48);
  c.fillStyle = '#a26943'; c.fillRect(12, 20, 56, 40);
  c.fillStyle = '#e0a96f'; c.fillRect(12, 20, 56, 6); c.fillRect(12, 54, 56, 6);
  if (fruit) {
    for (const [i, x] of [22, 34, 46, 58].entries()) {
      circle(c, x, 34, 6, i % 2 ? '#ed9651' : '#b7473f');
      circle(c, x, 47, 6, i % 2 ? '#bb6040' : '#ddb346');
    }
  } else {
    c.strokeStyle = '#e9ded0'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(37, 40, 11, 5, 0, 0, Math.PI * 2); c.moveTo(48, 40); c.lineTo(55, 35); c.lineTo(55, 45); c.closePath(); c.stroke();
  }
}

const DRAWINGS: Record<Kind, Draw[]> = {
  umbrella: ['#d65052', '#368e9a', '#da9b34'].map(color => c => {
    circle(c, 44, 45, 34, '#38262835');
    segments(c, 35, recurringColors(color));
    circle(c, 40, 40, 4, '#894a39');
  }),
  beachball: ['#db4b47', '#3098b0', '#b85c8f'].map(color => c => {
    circle(c, 43, 45, 21, '#38262835');
    segments(c, 21, [color, '#fff5ce', '#f6c24f', '#fff5ce', color, '#fff5ce']);
    circle(c, 40, 40, 5, '#fff8e2');
  }),
  sandcastle: [c => {
    circle(c, 42, 43, 30, '#bc8647'); circle(c, 39, 38, 28, '#f7d199');
    c.fillStyle = '#9f743d'; c.fillRect(20, 27, 40, 28);
    c.fillStyle = '#d19d62'; c.fillRect(20, 23, 40, 28);
    for (const x of [21, 51]) for (const y of [25, 48]) {
      circle(c, x + 2, y + 3, 9, '#b78653'); circle(c, x, y, 8, '#ffe0a8');
    }
    c.fillStyle = '#8a5f3a'; c.fillRect(35, 42, 10, 10);
    c.fillStyle = '#be5550'; c.fillRect(36, 18, 15, 7);
  }],
  buoy: [c => {
    circle(c, 43, 43, 26, '#3e2c2350'); circle(c, 40, 39, 23, '#e56743');
    c.fillStyle = '#f6e4b4'; c.fillRect(18, 35, 44, 8); circle(c, 40, 39, 8, '#dfaa55');
    c.strokeStyle = '#795a40'; c.lineWidth = 3; c.strokeRect(37, 13, 6, 10);
  }],
  'fruit-crate': [c => crate(c, true)],
  'fish-crate': [c => crate(c, false)],
  barrel: [c => {
    circle(c, 43, 43, 24, '#48352860'); circle(c, 40, 40, 23, '#56423c');
    circle(c, 40, 40, 20, '#a77352'); circle(c, 40, 40, 16, '#c39367');
    c.strokeStyle = '#875a43'; c.lineWidth = 2;
    for (const [x, h] of [[32, 12], [40, 16], [48, 12]]) {
      c.beginPath(); c.moveTo(x, 40 - h); c.lineTo(x, 40 + h); c.stroke();
    }
  }],
};

/** Seeded props share the tide and reset naturally after leaving both cameras. */
export function makeHarborProps(ctx: RaceContext, objects: Phaser.GameObjects.GameObject[]) {
  const { scene, world } = ctx;
  const ts = world.tileSize;
  const rng = new Rng(world.seed ^ 0x6df2e7ea);
  const pieces: Piece[] = [];
  const tidal = new Set<Piece>();
  const flatKey = harborTexture(scene, 'sandcastle-flat', SIZE, SIZE, c => {
    circle(c, 40, 40, 29, '#dbb378');
    for (const [x, y, r] of [[27, 30, 7], [46, 32, 8], [39, 49, 9], [55, 52, 5]]) circle(c, x, y, r, '#f5d6a0');
    c.fillStyle = '#bf6555'; c.fillRect(50, 29, 14, 4);
  });

  const add = (kind: Kind, tx: number, ty: number, tile: Tile) => {
    const x = tx * ts, y = ty * ts;
    if (tileAt(world, Math.floor(tx), Math.floor(ty)) !== tile || pieces.some(({ origin }) => Math.hypot(x - origin.x, y - origin.y) < 74)) return;
    const variants = DRAWINGS[kind];
    const variant = rng.int(0, variants.length - 1);
    const key = harborTexture(scene, `${kind}-${variant}`, SIZE, SIZE, variants[variant]);
    const sensor = kind === 'sandcastle';
    const image = scene.matter.add.image(x, y, key, undefined, {
      isSensor: sensor, shape: { type: 'circle', radius: RADII[kind] }, mass: kind === 'beachball' ? 0.25 : 0.55,
      restitution: kind === 'beachball' ? 0.86 : 0.5, frictionAir: kind === 'beachball' ? 0.045 : 0.09,
      collisionFilter: { category: CAT.prop, mask: sensor ? 0 : 0xffff, group: 0 },
    });
    (image.body as MatterJS.BodyType & { plugin: { owner: BodyOwner } }).plugin.owner = { kind: 'prop', prop: image };
    image.setDepth(DEPTH.prop).setName(`harbor-${kind}`);
    if (kind === 'umbrella') image.setScale(1.2);
    objects.push(image);
    pieces.push({ image, origin: { x, y }, kind, key, flattened: false });
  };

  const beach: Kind[] = ['umbrella', 'beachball', 'sandcastle', 'sandcastle'];
  for (const [x, y] of [[28.5, 11.5], [35, 11.4], [38.3, 14.2], [33.5, 17.8], [37, 18], [33.2, 24.4], [38.7, 26.5], [32.5, 30], [37.2, 32.7], [36.5, 35.6]]) {
    for (const [i, kind] of beach.entries()) add(kind, x + (i % 2) * 0.7 + rng.range(-0.18, 0.18), y + Math.floor(i / 2) * 0.7 + rng.range(-0.18, 0.18), Tile.Dirt);
  }
  for (const [x, y] of [[28.2, 13.5], [28.6, 18], [28.2, 25.9], [28.1, 30.8], [28.1, 33.4]]) {
    for (const [i, kind] of (['buoy', 'fish-crate', 'barrel'] as const).entries()) add(kind, x + i * 0.68, y + rng.range(-0.25, 0.25), Tile.Dirt);
  }
  for (const [x, y] of [[8.4, 15.3], [10.3, 18.8], [12.4, 15.3], [14.5, 18.8], [15.9, 16.4]]) add('fruit-crate', x + rng.range(-0.2, 0.2), y + rng.range(-0.2, 0.2), Tile.Grass);
  add('beachball', 29.6, 16.2, Tile.Dirt);
  add('beachball', 32.4, 31.8, Tile.Dirt);

  let gustIn = rng.range(HARBOR.gustMinSec, HARBOR.gustMaxSec);
  return (dt: number, vehicles: IVehicle[], tideFront?: number) => {
    if (tideFront === undefined) tidal.clear();
    const views = ctx.players.map(({ player }) => ctx.camera.worldView(player));
    const offscreen = ({ x, y }: Vec2) => views.every(v => {
      const m = HARBOR.propResetMargin;
      return x < v.x - m || x > v.x + v.w + m || y < v.y - m || y > v.y + v.h + m;
    });
    gustIn -= dt;
    const gust = gustIn <= 0;
    if (gust) gustIn = rng.range(HARBOR.gustMinSec, HARBOR.gustMaxSec);
    const wind = gust && rng.chance(0.5) ? -1 : 1;
    for (const piece of pieces) {
      const { image, origin, kind } = piece;
      if (kind === 'sandcastle') {
        if (!piece.flattened && vehicles.some(v => Math.abs(v.forwardSpeed) >= HARBOR.sandcastleSpeed &&
          !('airborne' in v && v.airborne) && Math.hypot(v.x - image.x, v.y - image.y) < v.spec.length / 2 + RADII.sandcastle)) {
          image.setTexture(flatKey).setDepth(DEPTH.decal);
          piece.flattened = true;
        }
      } else {
        if (tideFront !== undefined && image.x >= 27 * ts && image.x <= tideFront && image.y >= 7 * ts && image.y <= 41 * ts && !tidal.has(piece)) {
          tidal.add(piece);
          image.setVelocity(kind === 'buoy' ? 4.3 : 3, 0.6).setAngularVelocity(0.12);
        }
        if (gust && kind === 'beachball' && !offscreen(image)) image.setVelocity(wind * HARBOR.gustSpeed / 60, 2).setAngularVelocity(wind * 0.15);
      }
      const displaced = Math.hypot(image.x - origin.x, image.y - origin.y) >= 16 || Math.abs(image.rotation) > 0.3;
      if ((!piece.flattened && !displaced) || !offscreen(image) || !offscreen(origin) ||
        vehicles.some(v => Math.hypot(v.x - origin.x, v.y - origin.y) < v.spec.length / 2 + RADII[kind])) continue;
      image.setPosition(origin.x, origin.y).setVelocity(0, 0).setAngularVelocity(0).setRotation(0);
      if (piece.flattened) image.setTexture(piece.key).setDepth(DEPTH.prop);
      piece.flattened = false;
    }
  };
}
