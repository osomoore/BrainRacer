import { TEX } from '../core/assetKeys';

/** Every texture key the art package must register (Phaser-free, derived from TEX). */
export function allTextureKeys(): string[] {
  const keys: string[] = [];
  for (const v of Object.values(TEX)) {
    if (typeof v === 'string') {
      if (v !== TEX.roadPrefix) keys.push(v);
    } else keys.push(...v);
  }
  for (let m = 0; m < 16; m++) keys.push(`${TEX.roadPrefix}${m}`);
  return keys;
}
