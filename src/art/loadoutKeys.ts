import { TEX } from '../core/assetKeys';
import type { CarKind } from '../core/types';

export { buddyTexture as guideArt } from '../../shared/buddies/catalog';

export function carArt(kind: CarKind): string {
  if (kind === 'dino') return TEX.carDino;
  if (kind === 'kart') return TEX.carKart;
  return TEX.unlockVehicles[kind];
}
