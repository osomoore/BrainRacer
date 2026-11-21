import type Phaser from 'phaser';
import { makeCanvas, radial } from './draw';

/** Local texture keys for the boss crystal (baked once, tinted per boss at runtime). */
export const CRYSTAL_TEX = { gem: 'boss_crystal_gem', glow: 'boss_crystal_glow' } as const;

/** Bake a faceted white/grey gem (tinted per boss) and a soft glow halo. Safe to call repeatedly. */
export function ensureCrystalTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(CRYSTAL_TEX.gem)) {
    const W = 256, H = 320;
    const { ctx, done } = makeCanvas(scene, CRYSTAL_TEX.gem, W, H);
    // hexagon-ish elongated gem: crown on top, pavilion tapering to a point
    const top = [W * 0.5, 8], ul = [W * 0.14, H * 0.3], ur = [W * 0.86, H * 0.3];
    const ml = [W * 0.06, H * 0.52], mr = [W * 0.94, H * 0.52];
    const bot = [W * 0.5, H - 8], cl = [W * 0.36, H * 0.3], cr = [W * 0.64, H * 0.3];
    const poly = (pts: number[][], fill: string) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
    };
    poly([top, ur, mr, bot, ml, ul], '#d9d9e6');
    poly([top, cl, ul], '#ffffff');
    poly([top, cl, cr], '#f4f4ff');
    poly([top, cr, ur], '#c4c4d6');
    poly([ul, cl, bot, ml], '#b4b4c8');
    poly([cl, cr, bot], '#e6e6f4');
    poly([cr, ur, mr, bot], '#9c9cb4');
    // sparkle
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.ellipse(W * 0.34, H * 0.2, 14, 26, -0.6, 0, Math.PI * 2); ctx.fill();
    done();
  }
  if (!scene.textures.exists(CRYSTAL_TEX.glow)) {
    const { ctx, done } = makeCanvas(scene, CRYSTAL_TEX.glow, 128, 128);
    ctx.fillStyle = radial(ctx, 64, 64, 0, 64, [[0, 'rgba(255,255,255,0.95)'], [0.35, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 128, 128);
    done();
  }
}
