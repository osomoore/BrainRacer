import type Phaser from 'phaser';
import { drawCarDino, drawCarKart, drawCarShadow } from './cars';
import { drawCollectibles } from './collectibles';
import { drawDinoBody, drawDinoHead, drawDinoLegs, drawDinoShadow, drawDinoTail } from './dino';
import { drawFarm } from './farm';
import { drawFx } from './fx';
import { drawIndustrial } from './industrial';
import { genIndustrialHeadlight } from './industrialHeadlight';
import { drawBrakeLights, drawConvertibles, drawPolice, drawTraffic, drawTruck } from './npc';
import { drawBench, drawBush, drawCone, drawGoal, drawHydrant, drawLamp, drawRamp, drawSignFrame, drawTree } from './props';
import { drawRoads } from './roads';
import { drawDirt, drawGrass, drawPark, drawPlaza, drawRoofs, drawSidewalk, drawWater } from './tiles';
import { drawUi } from './ui';
import { drawBuddies } from './buddies';
import { ensureBombArt } from './homingBombArt';
import { ensureRockMonsterArt } from './rockMonster';
import { drawNewBosses } from './boss';
import { ensureUndergroundOreArt, ensureUndergroundVehicleArt } from './undergroundVehicles';

export { allTextureKeys } from './keys';
export { DINO_RIG } from './dinoRig';

/**
 * Generates every texture listed in src/core/assetKeys.ts (package E).
 * Called once by BootScene after scene images load. Fully deterministic (no Math.random).
 */
export function generateTextures(scene: Phaser.Scene): void {
  drawCarDino(scene); drawCarKart(scene); drawCarShadow(scene);
  drawCollectibles(scene);
  drawTraffic(scene); drawConvertibles(scene); drawTruck(scene); drawPolice(scene); drawBrakeLights(scene);
  drawDinoBody(scene); drawDinoHead(scene); drawDinoTail(scene); drawDinoLegs(scene); drawDinoShadow(scene);
  drawWater(scene); drawGrass(scene); drawSidewalk(scene); drawPark(scene); drawPlaza(scene); drawDirt(scene);
  drawRoads(scene); drawRoofs(scene); drawIndustrial(scene); genIndustrialHeadlight(scene); drawFarm(scene);
  drawSignFrame(scene); drawRamp(scene);
  drawTree(scene); drawBush(scene); drawLamp(scene); drawHydrant(scene); drawBench(scene); drawCone(scene);
  drawGoal(scene); drawFx(scene); drawUi(scene); drawBuddies(scene); ensureBombArt(scene);
  ensureRockMonsterArt(scene); ensureUndergroundVehicleArt(scene); ensureUndergroundOreArt(scene);
  drawNewBosses(scene);
}
