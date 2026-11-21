import { TEX } from '../core/assetKeys';

/** Every texture key the art package must register (Phaser-free, derived from TEX). */
export function allTextureKeys(): string[] {
  const keys = Object.entries(TEX).flatMap(([name, value]) => {
    if (name === 'queuedFeature') return []; // Baked on demand by the active world system.
    if (typeof value === 'string') return value === TEX.roadPrefix ? [] : [value];
    return Object.values(value).flat() as string[];
  });
  for (let m = 0; m < 16; m++) keys.push(`${TEX.roadPrefix}${m}`);
  return keys;
}
