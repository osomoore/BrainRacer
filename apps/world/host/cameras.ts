import type Phaser from 'phaser';
import { cameraRotationFor, facingCenter, followAngle } from '../../../src/camera/cameraMath';
import { WORLD, WORLD_HOST } from '../config';
import type { WorldPlayer } from '../core/runtime';

const headings = new WeakMap<Phaser.Cameras.Scene2D.Camera, number>();

export function viewRotation(player: WorldPlayer): number {
  return cameraRotationFor(headings.get(player.camera) ?? player.move.angle);
}

export function worldCamera(scene: Phaser.Scene, index: number, count: number): Phaser.Cameras.Scene2D.Camera {
  const camera = index === 0 ? scene.cameras.main : scene.cameras.add();
  const width = WORLD.width / count;
  return camera.setViewport(index * width, 0, width, WORLD.height)
    .setZoom(count === 1 ? WORLD_HOST.camera.soloZoom : WORLD_HOST.camera.splitZoom)
    .setName(`player-${index + 1}`);
}

export function followPlayer(player: WorldPlayer, dt: number): void {
  const { move, camera } = player;
  const { carScreenY, rotTau, maxAngVel } = WORLD_HOST.camera;
  const previous = headings.get(camera) ?? move.angle;
  const heading = dt === 0 ? move.angle : followAngle(previous, move.angle, dt, rotTau, maxAngVel);
  headings.set(camera, heading);
  const center = facingCenter(move, heading, camera.height, camera.zoom, carScreenY);
  camera.setRotation(cameraRotationFor(heading)).centerOn(center.x, center.y);
}
