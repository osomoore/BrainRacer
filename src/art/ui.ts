import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { ANSWER_COLORS, ANSWER_LABELS } from '../config/gameConfig';
import { OUTLINE, ellipse, fillStroke, glossHighlight, lin, makeCanvas, radial, rr } from './draw';

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

export function drawUi(scene: Phaser.Scene): void {
  TEX.buttonBadge.forEach((key, i) => {
    const { ctx, done } = makeCanvas(scene, key, 72, 72);
    const col = ANSWER_COLORS[i];
    ellipse(ctx, 36, 36, 33, 33);
    fillStroke(ctx, radial(ctx, 26, 22, 4, 48, [[0, shade(col, 0.45)], [0.55, col], [1, shade(col, -0.35)]]), OUTLINE, 4);
    ellipse(ctx, 36, 36, 27, 27); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    glossHighlight(ctx, 28, 15, 15, 6, 0.55);
    const yellow = i === 1;
    ctx.font = '900 44px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 7; ctx.strokeStyle = yellow ? '#ffffff' : OUTLINE;
    ctx.strokeText(ANSWER_LABELS[i], 36, 39);
    ctx.fillStyle = yellow ? '#3a2a00' : '#ffffff';
    ctx.fillText(ANSWER_LABELS[i], 36, 39);
    done();
  });
  {
    const { ctx, done } = makeCanvas(scene, TEX.panel, 96, 96);
    rr(ctx, 3, 3, 90, 90, 22);
    fillStroke(ctx, lin(ctx, 0, 0, 0, 96, [[0, '#ffffff'], [1, '#e9edf5']]), '#aab3c8', 4);
    rr(ctx, 7, 7, 82, 82, 18); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    done();
  }
}
