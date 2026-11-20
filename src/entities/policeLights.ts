import { TEX } from '../core/assetKeys';

/** Matches either frame of a cruiser's light bar. */
export function isPoliceTexture(key: string | undefined): boolean {
  return key !== undefined && (TEX.police as readonly string[]).includes(key);
}
