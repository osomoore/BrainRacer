import type Phaser from 'phaser';
import { drawCarDino, drawCarKart, drawCarShadow } from './cars';
import { drawDinoBody, drawDinoHead, drawDinoLegs, drawDinoShadow, drawDinoTail } from './dino';
import { drawFx } from './fx';
import { drawPolice, drawTraffic, drawTruck } from './npc';
import { drawBench, drawBush, drawCone, drawGoal, drawHydrant, drawLamp, drawRamp, drawSignFrame, drawTree } from './props';
import { drawRoads } from './roads';
import { drawDirt, drawGrass, drawPark, drawPlaza, drawRoofs, drawSidewalk, drawWater } from './tiles';
import { drawUi } from './ui';

export { allTextureKeys } from './keys';
export { DINO_RIG } from './dinoRig';

/**
 * Generates every texture listed in src/core/assetKeys.ts (package E).
 * Called once by BootScene after scene images load. Fully deterministic (no Math.random).
 */
export function generateTextures(scene: Phaser.Scene): void {
  drawCarDino(scene); drawCarKart(scene); drawCarShadow(scene);
  drawTraffic(scene); drawTruck(scene); drawPolice(scene);
  drawDinoBody(scene); drawDinoHead(scene); drawDinoTail(scene); drawDinoLegs(scene); drawDinoShadow(scene);
  drawWater(scene); drawGrass(scene); drawSidewalk(scene); drawPark(scene); drawPlaza(scene); drawDirt(scene);
  drawRoads(scene); drawRoofs(scene);
  drawSignFrame(scene); drawRamp(scene);
  drawTree(scene); drawBush(scene); drawLamp(scene); drawHydrant(scene); drawBench(scene); drawCone(scene);
  drawGoal(scene); drawFx(scene); drawUi(scene);
}
