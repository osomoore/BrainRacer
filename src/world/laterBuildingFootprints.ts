import type { BuildingLot, RaceMap, Vec2, WorldData } from '../core/types';
import { isQueuedMap, type QueuedMap } from '../config/queuedMaps';
import { queuedBuildingQuarterTurns } from './gen/queuedWorlds';
import { laterBuiltFootprint } from './laterBuiltArt';
import { laterNatureFootprint } from './laterNatureArt';
import { underwaterBuildingFootprints } from './underwaterBuildings';

export function usesNatureArt(map: QueuedMap): boolean {
  return map === 'brickworks' || map === 'mushroom' || map === 'tundra' || map === 'volcano';
}

/** The sprite and collision body share these scales and the same local origin. */
export function queuedBuildingPose(map: QueuedMap, world: WorldData, lot: BuildingLot) {
  const ts = world.tileSize;
  const turns = queuedBuildingQuarterTurns(map, world, lot);
  const sideways = turns % 2 === 1;
  return {
    x: (lot.tx + lot.tw / 2) * ts, y: (lot.ty + lot.th / 2) * ts,
    width: (sideways ? lot.th : lot.tw) * ts, height: (sideways ? lot.tw : lot.th) * ts,
    angle: turns * Math.PI / 2,
  };
}

export function laterBuildingPolygons(map: RaceMap, world: WorldData, lot: BuildingLot): Vec2[][] | undefined {
  if (isQueuedMap(map)) {
    const pose = queuedBuildingPose(map, world, lot);
    const points = usesNatureArt(map) ? laterNatureFootprint(map, lot.style) : laterBuiltFootprint(map, lot.style);
    const c = Math.cos(pose.angle), s = Math.sin(pose.angle);
    return [points.map(([px, py]) => {
      const x = (px / 200 - 0.5) * pose.width, y = (py / 160 - 0.5) * pose.height;
      return { x: pose.x + x * c - y * s, y: pose.y + x * s + y * c };
    })];
  }
  if (map === 'underwater') {
    const w = lot.tw * world.tileSize, h = lot.th * world.tileSize;
    const cx = (lot.tx + lot.tw / 2) * world.tileSize;
    const cy = (lot.ty + lot.th / 2) * world.tileSize;
    return underwaterBuildingFootprints(lot).map(box => {
      const left = cx + (box.x - box.w / 2) * w, right = left + box.w * w;
      const top = cy + (box.y - box.h / 2) * h, bottom = top + box.h * h;
      const r = Math.min(right - left, bottom - top) * box.radius;
      const corners = [[right - r, bottom - r], [left + r, bottom - r], [left + r, top + r], [right - r, top + r]];
      return corners.flatMap(([x, y], corner) => Array.from({ length: 4 }, (_, step) => {
        const angle = (corner + step / 3) * Math.PI / 2;
        return { x: x + r * Math.cos(angle), y: y + r * Math.sin(angle) };
      }));
    });
  }
}
