import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { ellipse, lin, makeCanvas, radial, rr, seeded, star } from './draw';

export function drawFx(scene: Phaser.Scene): void {
  // spark: bright core with 4 rays
  {
    const { ctx, done } = makeCanvas(scene, TEX.fxSpark, 24, 24);
    ctx.fillStyle = radial(ctx, 12, 12, 0, 12, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 24, 24);
    ctx.fillStyle = '#fff';
    star(ctx, 12, 12, 11.5, 1.6, 4, 0); ctx.fill();
    done();
  }
  // smoke: soft puff
  {
    const { ctx, done } = makeCanvas(scene, TEX.fxSmoke, 64, 64);
    const r = seeded(3);
    const blobs: [number, number, number][] = [[32, 32, 22]];
    for (let i = 0; i < 6; i++) { const a = r() * 6.28; blobs.push([32 + Math.cos(a) * 11, 32 + Math.sin(a) * 11, 13 + r() * 5]); }
    for (const [x, y, rad] of blobs) {
      ctx.fillStyle = radial(ctx, x, y, 0, rad, [[0, 'rgba(255,255,255,0.5)'], [0.6, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]);
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    done();
  }
  // flame: teardrop pointing up, orange->yellow
  {
    const { ctx, done } = makeCanvas(scene, TEX.fxFlame, 32, 32);
    ctx.beginPath();
    ctx.moveTo(16, 1); ctx.bezierCurveTo(24, 10, 30, 16, 28, 22); ctx.bezierCurveTo(26, 29, 20, 31, 16, 31);
    ctx.bezierCurveTo(12, 31, 6, 29, 4, 22); ctx.bezierCurveTo(2, 16, 10, 12, 16, 1); ctx.closePath();
    ctx.fillStyle = radial(ctx, 16, 24, 1, 16, [[0, '#fff6a0'], [0.4, '#ffc21a'], [0.8, '#ff7a10'], [1, '#e8400a']]);
    ctx.fill();
    ellipse(ctx, 16, 24, 5, 6); ctx.fillStyle = 'rgba(255,255,230,0.9)'; ctx.fill();
    done();
  }
  // star
  {
    const { ctx, done } = makeCanvas(scene, TEX.fxStar, 32, 32);
    star(ctx, 16, 16.8, 15, 6.5);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    done();
  }
  // confetti
  {
    const { ctx, done } = makeCanvas(scene, TEX.fxConfetti, 12, 8);
    rr(ctx, 0.5, 0.5, 11, 7, 1.5); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(1, 4, 10, 3);
    done();
  }
  // dust
  {
    const { ctx, done } = makeCanvas(scene, TEX.fxDust, 32, 32);
    ctx.fillStyle = radial(ctx, 16, 16, 0, 16, [[0, 'rgba(255,255,255,0.7)'], [0.5, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 32, 32);
    done();
  }
  // shockwave ring
  {
    const { ctx, done } = makeCanvas(scene, TEX.fxRing, 256, 256);
    ctx.fillStyle = radial(ctx, 128, 128, 90, 128, [[0, 'rgba(255,255,255,0)'], [0.55, 'rgba(255,255,255,0.35)'], [0.8, 'rgba(255,255,255,0.95)'], [0.92, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 256, 256);
    done();
  }
  // rainbow streak (pre-colored, points +x)
  {
    const { ctx, done } = makeCanvas(scene, TEX.fxRainbow, 96, 32);
    const cols = ['#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#1e6fff', '#a855f7'];
    ctx.save();
    ctx.beginPath(); ctx.moveTo(2, 16); ctx.bezierCurveTo(14, 1, 70, 2, 94, 16); ctx.bezierCurveTo(70, 30, 14, 31, 2, 16); ctx.closePath(); ctx.clip();
    cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, 2 + i * 4.7, 96, 5); });
    ctx.fillStyle = lin(ctx, 0, 0, 96, 0, [[0, 'rgba(255,255,255,0.5)'], [0.4, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 96, 32);
    ctx.restore();
    done();
  }
  // skid mark
  {
    const { ctx, done } = makeCanvas(scene, TEX.skid, 8, 8);
    ctx.fillStyle = 'rgba(20,22,30,0.85)'; rr(ctx, 0, 1, 8, 6, 3); ctx.fill();
    done();
  }
}
