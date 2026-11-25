import type Phaser from 'phaser';
import { afterEach, expect, it, vi } from 'vitest';
import { Q } from '../bake';
import { T } from '../../run/common/props';
import { allArtJobs } from './jobs';

const DINO = 'ws:dino-run:far:hills';
const RACE = 'wsr:t:cone';
const BODY = 'ws:r:body:body.car:shape.boxy:paint.yellow:38:16';

function fakeScene() {
  const textures = new Map<string, ReturnType<typeof makeTexture>>();
  function makeTexture(key: string, width: number, height: number) {
    const canvas = { width, height };
    const context = {
      save: vi.fn(), restore: vi.fn(), scale: vi.fn(), translate: vi.fn(), beginPath: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), quadraticCurveTo: vi.fn(), closePath: vi.fn(),
      arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(),
    };
    return { key, getSourceImage: () => canvas, getContext: () => context, refresh: vi.fn() };
  }
  function makeImage(x: number, y: number, key: string) {
    const texture = textures.get(key)!;
    return {
      x, y, texture, originX: 0, originY: 0, scaleX: 1, scaleY: 1,
      setOrigin(ox: number, oy: number) { this.originX = ox; this.originY = oy; return this; },
      setScale(sx: number, sy = sx) { this.scaleX = sx; this.scaleY = sy; return this; },
    };
  }
  const scene = {
    textures: {
      exists: (key: string) => textures.has(key),
      createCanvas(key: string, w: number, h: number) {
        const tex = makeTexture(key, w, h);
        textures.set(key, tex);
        return tex;
      },
    },
    add: { image: makeImage },
    make: { image: ({ x, y, key }: { x: number; y: number; key: string }) => makeImage(x, y, key) },
  };
  return { scene: scene as unknown as Phaser.Scene, textures };
}

afterEach(() => vi.unstubAllGlobals());

it.each(['paint first', 'shape first', 'forced shapes', 'wrong-sized paint'])('uses both scenery job keys with %s', async (order) => {
  vi.resetModules();
  vi.stubGlobal('location', { search: order === 'forced shapes' ? '?art=shapes' : '' });
  const entries = Object.fromEntries(allArtJobs().filter((j) => [DINO, RACE, BODY].includes(j.key))
    .map(({ key, file, w, h, specHash }) => [key, { file: file + '.png', w, h, specHash }]));
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ version: 1, entries }) }));
  vi.stubGlobal('fetch', fetch);
  class FakeImage {
    naturalWidth = 0;
    naturalHeight = 0;
    onload?: () => void;
    set src(url: string) {
      const entry = Object.values(entries).find((e) => url.endsWith(e.file))!;
      this.naturalWidth = order === 'wrong-sized paint' ? entry.w + 1 : entry.w;
      this.naturalHeight = entry.h;
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal('Image', FakeImage);
  const { startPaintedArt } = await import('./painted');
  const { ensureTexture } = await import('../bake');
  const { prop: raceProp } = await import('../../run/common/draw');
  const { image: dinoImage } = await import('../../run/dino/kit/paint');
  await import('../../run/dino/kit/art');
  const { scene, textures } = fakeScene();

  if (order === 'paint first') await startPaintedArt();
  const finishPaint = vi.fn();
  const draw = vi.fn();
  const body = entries[BODY];
  ensureTexture(scene, { key: BODY, w: body.w / Q, h: body.h / Q, ox: 10, oy: 20, draw, finishPaint });
  const dino = dinoImage(scene, 'far:hills', 12, 560, 0.75);
  const race = raceProp(scene, null, T.cone(), 200, 300, 0.9);
  const sprites = [
    [dino, DINO, 12, 560, 0, 1, 0.75],
    [race, RACE, 200, 300, 0.5, 0.5, 0.9],
  ] as const;
  for (const [, key] of sprites) {
    expect(textures.get(key)!.getContext().drawImage).toHaveBeenCalledTimes(order === 'paint first' ? 1 : 0);
  }
  await startPaintedArt();

  const bodyContext = textures.get(BODY)!.getContext();
  expect(draw).toHaveBeenCalledTimes(order === 'paint first' ? 0 : 1);
  if (order === 'paint first' || order === 'shape first') {
    expect(finishPaint).toHaveBeenCalledExactlyOnceWith(bodyContext);
    expect(bodyContext.drawImage.mock.invocationCallOrder[0]).toBeLessThan(finishPaint.mock.invocationCallOrder[0]);
    expect(bodyContext.translate).toHaveBeenCalledWith(10, 20);
  } else {
    expect(finishPaint).not.toHaveBeenCalled();
  }

  for (const [im, key, x, y, ox, oy, scale] of sprites) {
    const tex = textures.get(key)!;
    expect(im.texture).toBe(textures.get(key));
    expect(im).toMatchObject({ x, y, originX: ox, originY: oy });
    expect(im.scaleX * tex.getSourceImage().width).toBeCloseTo(entries[key].w * scale / Q);
    expect(im.scaleY * tex.getSourceImage().height).toBeCloseTo(entries[key].h * scale / Q);
    expect(tex.getContext().drawImage).toHaveBeenCalledTimes(order === 'paint first' || order === 'shape first' ? 1 : 0);
    expect(tex.refresh).toHaveBeenCalledTimes(order === 'shape first' ? 2 : 1);
    if (order === 'paint first') expect(tex.getContext().beginPath).not.toHaveBeenCalled();
    else expect(tex.getContext().beginPath).toHaveBeenCalled();
  }
  expect(fetch).toHaveBeenCalledTimes(order === 'forced shapes' ? 0 : 1);
});
