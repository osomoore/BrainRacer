import type Phaser from 'phaser';
import { drawFarmAnimals } from './farmAnimals';
import { drawFarmExtras } from './farmExtras';
import { drawFarmProps } from './farmProps';
import { drawFarmVehicles } from './farmVehicles';

export { FARM_TILE, FARM_TILE_COUNT, farmTileSource } from './farmTiles';

/** Bakes every TEX.farm texture. Tiles are not textures: the world builder pulls them from `farmTileSource`. */
export function drawFarm(scene: Phaser.Scene): void {
  drawFarmProps(scene);
  drawFarmAnimals(scene);
  drawFarmVehicles(scene);
  drawFarmExtras(scene);
}
