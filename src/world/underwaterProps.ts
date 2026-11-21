import type Phaser from 'phaser';
import { ellipse, fillStroke, type Ctx } from '../art/draw';
import { CAT, DEPTH } from '../config/gameConfig';
import { Rng } from '../core/rng';
import { Tile, type WorldData } from '../core/types';
import { underwaterTexture } from './underwaterPaint';

/** Small loose objects sit on plaza edges, clear of goals, ramps and starting cars. */
export function underwaterPropPositions(world: WorldData): { x: number; y: number; kind: number; angle: number }[] {
  const rng = new Rng(world.seed ^ 0x672f);
  const { widthTiles: w, heightTiles: h, tileSize: ts, tiles } = world;
  const protectedPoints = [...world.places.map(p => p.front), ...world.playerSpawns, ...world.ramps];
  const result: { x: number; y: number; kind: number; angle: number }[] = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (tiles[y * w + x] !== Tile.Plaza || !rng.chance(.23)) continue;
    if (![[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => tiles[(y + dy) * w + x + dx] === Tile.Road)) continue;
    const px = (x + .5) * ts, py = (y + .5) * ts;
    if (protectedPoints.some(p => Math.hypot(p.x - px, p.y - py) < ts * 1.5)) continue;
    if (result.some(p => Math.hypot(p.x - px, p.y - py) < ts * 1.5)) continue;
    result.push({ x: px, y: py, kind: rng.int(0, 2), angle: rng.range(0, Math.PI * 2) });
  }
  return result;
}

function paintProp(c: Ctx, kind: number): void {
  if (kind === 0) {
    // A little treasure chest, viewed from above.
    c.fillStyle = '#86502d'; c.fillRect(5, 10, 50, 40);
    c.strokeStyle = '#e4bc67'; c.lineWidth = 5; c.strokeRect(7, 12, 46, 36);
    c.fillStyle = '#e4bc67'; c.fillRect(27, 10, 6, 40); c.fillRect(6, 27, 48, 5);
  } else if (kind === 1) {
    // A bright buoy.
    ellipse(c, 30, 30, 23, 23); fillStroke(c, '#f1aa6d', '#8c5760', 3);
    ellipse(c, 30, 30, 13, 13); fillStroke(c, '#fbe8c3', '#d67871', 3);
    ellipse(c, 30, 30, 5, 5); fillStroke(c, '#e16f73', null);
  } else {
    // Barrel of supplies for the underwater city.
    ellipse(c, 30, 30, 23, 19); fillStroke(c, '#b88454', '#694c54', 3);
    ellipse(c, 30, 30, 15, 12); fillStroke(c, '#d6ac71', '#e7c896', 3);
    c.strokeStyle = '#9a6948'; c.lineWidth = 2; c.beginPath(); c.moveTo(20, 26); c.lineTo(40, 26); c.moveTo(18, 33); c.lineTo(42, 33); c.stroke();
  }
}

export function addUnderwaterProps(scene: Phaser.Scene, world: WorldData, dynamicProps: Phaser.GameObjects.GameObject[], bodies: MatterJS.BodyType[]): void {
  const keys = Array.from({ length: 3 }, (_, kind) => underwaterTexture(scene, `loose_prop_${kind}`, 60, 60, c => paintProp(c, kind)));
  for (const p of underwaterPropPositions(world)) {
    const img = scene.matter.add.image(p.x, p.y, keys[p.kind], undefined, {
      shape: { type: 'circle', radius: 25 }, friction: .02, frictionStatic: 0, frictionAir: .2,
      restitution: .3, mass: .4, collisionFilter: { category: CAT.prop, mask: 0xffff, group: 0 },
    });
    img.setRotation(p.angle).setDepth(DEPTH.prop).setName('underwater-loose-prop');
    const body = img.body as MatterJS.BodyType & { plugin: { owner?: { kind: 'prop'; prop: typeof img } } };
    body.plugin.owner = { kind: 'prop', prop: img };
    bodies.push(body);
    dynamicProps.push(img);
  }
}
