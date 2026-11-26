import { describe, expect, it } from 'vitest';
import { SIZE_SCALE as RACE_SIZE } from '../art/race/looks';
import { SIZE_SCALE as DINO_SIZE } from '../art/dino/looks';
import { WS_ROOM } from '../config';
import { roomLayout } from './room/layout';
import { fitRoomModelScale, roomReferenceFit } from './modelFit';

describe('room model size framing', () => {
  it.each(['wide', 'tall'] as const)('keeps visible size variants increasing in the %s production layout', (kind) => {
    const layout = roomLayout(kind, ['size', 'wheels', 'body', 'engine', 'paint', 'springs', 'shape']);
    const carBounds = { x: -260, y: -180, width: 520, height: 180 };
    const dinoBounds = { x: -300, y: -680, width: 600, height: 680 };
    const carFit = roomReferenceFit(carBounds, layout, kind, 'race', false);
    const dinoFit = roomReferenceFit(dinoBounds, layout, kind, 'dino', false);

    const raceWidths = (['size.tiny', 'size.small', 'size.medium', 'size.big'] as const).map((id) => carBounds.width * (RACE_SIZE[id] / RACE_SIZE['size.big']) * carFit.scale);
    const dinoHeights = (['size.small', 'size.medium', 'size.big', 'size.huge'] as const).map((id) => dinoBounds.height * (DINO_SIZE[id] / DINO_SIZE['size.huge']) * dinoFit.scale);
    for (let i = 1; i < raceWidths.length; i++) expect(raceWidths[i]).toBeGreaterThan(raceWidths[i - 1]);
    for (let i = 1; i < dinoHeights.length; i++) expect(dinoHeights[i]).toBeGreaterThan(dinoHeights[i - 1]);
    expect(dinoHeights[3] / dinoHeights[1]).toBeGreaterThanOrEqual(1.5);
  });

  it('allows a height-bound dino reference to extend above the room model box within its overhang cap', () => {
    const bounds = { x: -140, y: -760, width: 280, height: 760 };
    const layout = roomLayout('wide', []);
    const scale = fitRoomModelScale(
      bounds,
      { x: layout.model.x, y: layout.model.groundY, width: layout.model.maxW, height: layout.model.maxH },
      2,
      [],
      { topOverhang: WS_ROOM.dinoTopOverhang, paneWidth: layout.size.w },
    );
    const drawnHeight = bounds.height * scale;

    expect(drawnHeight).toBeGreaterThan(layout.model.maxH);
    expect(drawnHeight).toBeLessThanOrEqual(layout.model.maxH * (1 + WS_ROOM.dinoTopOverhang));
  });

  it('clamps the model away from a room button hit area and above the pane edge', () => {
    const bounds = { x: -300, y: -700, width: 600, height: 700 };
    const obstacle = { x: 550, y: 600, width: 200, height: 200 };
    const scale = fitRoomModelScale(
      bounds,
      { x: 960, y: 820, width: 900, height: 560 },
      1.5,
      [obstacle],
      { topOverhang: WS_ROOM.dinoTopOverhang, paneWidth: 1920 },
    );
    const left = 960 + bounds.x * scale;
    const right = 960 + (bounds.x + bounds.width) * scale;
    const top = 820 + bounds.y * scale;
    const clearance = WS_ROOM.modelTopClearancePx;
    const obstacleLeft = obstacle.x - obstacle.width / 2 - clearance;
    const obstacleRight = obstacle.x + obstacle.width / 2 + clearance;
    const obstacleTop = obstacle.y - obstacle.height / 2 - clearance;
    const obstacleBottom = obstacle.y + obstacle.height / 2 + clearance;

    expect(top).toBeGreaterThanOrEqual(clearance);
    expect(left).toBeGreaterThanOrEqual(clearance);
    expect(right).toBeLessThanOrEqual(1920 - clearance);
    expect(right <= obstacleLeft || left >= obstacleRight || top >= obstacleBottom || 820 <= obstacleTop).toBe(true);
  });

  it('caps an anchored silhouette at the actual top clearance', () => {
    const bounds = { x: -120, y: -700, width: 240, height: 700 };
    const scale = fitRoomModelScale(
      bounds,
      { x: 480, y: 480, width: 320, height: 510 },
      1.5,
      [],
      { paneWidth: 960 },
    );
    expect(480 + bounds.y * scale).toBeCloseTo(WS_ROOM.modelTopClearancePx, 6);
  });
});
