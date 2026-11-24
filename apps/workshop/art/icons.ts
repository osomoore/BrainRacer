import type Phaser from 'phaser';
import type { WorkshopId } from '../core/types';
import { OUTLINE, ensureTexture } from './bake';

export const CURRENCY_ICON_TEXTURES: Readonly<Record<WorkshopId, string>> = {
  race: 'ws:currency:coin',
  dino: 'ws:currency:juice',
};

function coin(g: CanvasRenderingContext2D): void {
  g.lineWidth = 5;
  g.strokeStyle = OUTLINE;
  g.fillStyle = '#f7b928';
  g.beginPath();
  g.arc(48, 48, 39, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.lineWidth = 3;
  g.strokeStyle = '#d78516';
  g.beginPath();
  g.arc(48, 48, 30, 0, Math.PI * 2);
  g.stroke();
  // Chunky four-point stamp keeps the coin identifiable at thumbnail size.
  g.fillStyle = '#fff3a6';
  g.strokeStyle = '#a85a12';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(48, 25); g.lineTo(55, 41); g.lineTo(71, 48); g.lineTo(55, 55);
  g.lineTo(48, 71); g.lineTo(41, 55); g.lineTo(25, 48); g.lineTo(41, 41);
  g.closePath();
  g.fill(); g.stroke();
}

function juice(g: CanvasRenderingContext2D): void {
  g.lineWidth = 5;
  g.strokeStyle = OUTLINE;
  g.fillStyle = '#55d8bb';
  g.beginPath();
  g.moveTo(48, 8);
  g.bezierCurveTo(39, 22, 17, 43, 17, 60);
  g.bezierCurveTo(17, 79, 30, 91, 48, 91);
  g.bezierCurveTo(66, 91, 79, 79, 79, 60);
  g.bezierCurveTo(79, 43, 57, 22, 48, 8);
  g.closePath();
  g.fill(); g.stroke();
  // One broad white glint plus two large bubbles; all remain visible at 40 px.
  g.fillStyle = '#eaffff';
  g.beginPath();
  g.ellipse(37, 47, 6, 12, -0.4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d8fff4';
  g.beginPath(); g.arc(58, 62, 5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(49, 75, 3.5, 0, Math.PI * 2); g.fill();
}

function priceTag(g: CanvasRenderingContext2D): void {
  g.lineWidth = 5;
  g.strokeStyle = OUTLINE;
  g.fillStyle = '#ffe2bd';
  g.beginPath();
  g.moveTo(11, 28); g.quadraticCurveTo(11, 18, 22, 18);
  g.lineTo(168, 18); g.lineTo(188, 56); g.lineTo(168, 94);
  g.lineTo(22, 94); g.quadraticCurveTo(11, 94, 11, 84);
  g.closePath();
  g.fill(); g.stroke();
  g.fillStyle = '#fff6e8';
  g.beginPath(); g.arc(31, 56, 7, 0, Math.PI * 2); g.fill();
  g.strokeStyle = OUTLINE;
  g.lineWidth = 3;
  g.stroke();
}

export function ensureCurrencyIcon(scene: Phaser.Scene, workshop: WorkshopId): string {
  const key = CURRENCY_ICON_TEXTURES[workshop];
  ensureTexture(scene, {
    key, w: 96, h: 96, ox: 0, oy: 0,
    draw: workshop === 'race' ? coin : juice,
  });
  return key;
}

export function ensurePriceTagIcon(scene: Phaser.Scene): string {
  const key = 'ws:currency:price-tag';
  ensureTexture(scene, { key, w: 200, h: 112, ox: 0, oy: 0, draw: priceTag });
  return key;
}
