import { TEX } from '../core/assetKeys';
import type { CarKind, GuideKind } from '../core/types';

export function carArt(kind: CarKind): string {
  if (kind === 'dino') return TEX.carDino;
  if (kind === 'kart') return TEX.carKart;
  return TEX.unlockVehicles[kind];
}

export function guideArt(kind: GuideKind): string {
  if (kind === 'dino') return TEX.buddyDino[0];
  if (kind === 'star') return TEX.buddyStar;
  return TEX.unlockGuides[kind];
}
