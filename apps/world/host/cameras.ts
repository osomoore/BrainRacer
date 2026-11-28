import type Phaser from 'phaser';
import { cameraRotationFor, facingCenter, followAngle } from '../../../src/camera/cameraMath';
import { WORLD, WORLD_HOST } from '../config';
import type { WorldPlayer } from '../core/runtime';

const headings = new WeakMap<Phaser.Cameras.Scene2D.Camera, number>();
const baseZooms = new WeakMap<Phaser.Cameras.Scene2D.Camera, number>();
const zooms = new WeakMap<Phaser.Cameras.Scene2D.Camera, number>();

export function viewRotation(player: WorldPlayer): number {
  return cameraRotationFor(headings.get(player.camera) ?? player.move.angle);
}

export function worldCamera(scene: Phaser.Scene, index: number, count: number): Phaser.Cameras.Scene2D.Camera {
  const camera = index === 0 ? scene.cameras.main : scene.cameras.add();
  const width = WORLD.width / count;
  const baseZoom = count === 1 ? WORLD_HOST.camera.soloZoom : WORLD_HOST.camera.splitZoom;
  baseZooms.set(camera, baseZoom);
  zooms.set(camera, baseZoom);
  return camera.setViewport(index * width, 0, width, WORLD.height)
    .setZoom(baseZoom)
    .setName(`player-${index + 1}`);
}

export function followPlayer(player: WorldPlayer, dt: number): void {
  const { move, camera } = player;
  const { carScreenY, rotTau, maxAngVel, minSpeedZoom, speedZoomTau } = WORLD_HOST.camera;
  const baseZoom = baseZooms.get(camera) ?? camera.zoom;
  const speed = Math.hypot(move.vx, move.vy);
  const speedRatio = Math.max(0, Math.min(1, speed / Math.max(1, player.traits.speed)));
  const targetZoom = baseZoom * (1 - (1 - minSpeedZoom) * speedRatio);
  const previousZoom = zooms.get(camera) ?? baseZoom;
  const zoom = dt === 0 ? baseZoom : previousZoom + (targetZoom - previousZoom) * (1 - Math.exp(-dt / speedZoomTau));
  zooms.set(camera, zoom);
  camera.setZoom(zoom);
  const previous = headings.get(camera) ?? move.angle;
  const heading = dt === 0 ? move.angle : followAngle(previous, move.angle, dt, rotTau, maxAngVel);
  headings.set(camera, heading);
  const center = facingCenter(move, heading, camera.height, camera.zoom, carScreenY);
  camera.setRotation(cameraRotationFor(heading)).centerOn(center.x, center.y);
}
