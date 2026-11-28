import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import type { WorldPlayer } from '../core/runtime';
import { followPlayer, worldCamera } from './cameras';

function cameraStub() {
  return {
    height: 1080,
    zoom: 1,
    setViewport() { return this; },
    setName() { return this; },
    setZoom(zoom: number) { this.zoom = zoom; return this; },
    setRotation() { return this; },
    centerOn() { return this; },
  };
}

describe('World camera speed zoom', () => {
  it.each([[1, 1.8], [2, 1.6]])('eases from the base zoom with %s views', (count, base) => {
    const camera = cameraStub();
    const scene = { cameras: { main: camera } } as unknown as Phaser.Scene;
    worldCamera(scene, 0, count);
    const move = { x: 0, y: 0, angle: 0, vx: 0, vy: 0 };
    const player = { camera, move, traits: { speed: 350 } } as unknown as WorldPlayer;
    expect(camera.zoom).toBe(base);
    move.vx = 350;
    followPlayer(player, 1 / 60);
    expect(camera.zoom).toBeLessThan(base);
    expect(camera.zoom).toBeGreaterThan(base * 0.95);
    for (let frame = 0; frame < 600; frame++) followPlayer(player, 1 / 60);
    expect(camera.zoom).toBeCloseTo(base * 0.75);
    move.vx = 0;
    followPlayer(player, 1 / 60);
    expect(camera.zoom - base * 0.75).toBeLessThan(base * 0.01);
    for (let frame = 0; frame < 600; frame++) followPlayer(player, 1 / 60);
    expect(camera.zoom).toBeCloseTo(base);
  });
});
